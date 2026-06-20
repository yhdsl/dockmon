/**
 * Admin editor for the global webui_url_mapping_chain. Templates support
 * ${env:NAME} and ${label:NAME} placeholders; first non-empty resolution wins.
 *
 * State model: rows live locally as { id, value }[] keyed by synthetic UUIDs
 * so reorder/remove during mid-edit don't lose focus. All updates flow
 * through setRows (which keeps rowsRef in sync synchronously). Persists are
 * serialized via a promise-chain queue (inFlightTailRef) so concurrent edits
 * land on the server in submission order; failures revert via a snapshot
 * passed by the caller, gated by editSeqRef so newer local edits aren't
 * clobbered by an older failure.
 *
 * Permission gating (settings.manage) is handled by the parent SystemSettings
 * fieldset — no checks needed here.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import {
  DndContext,
  closestCenter,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Plus, Trash2, GripVertical } from 'lucide-react'
import { toast } from 'sonner'
import { useGlobalSettings, useUpdateGlobalSettings } from '@/hooks/useSettings'
import { useDndSensors } from '@/features/dashboard/hooks/useDndSensors'

type Row = { id: string; value: string }

// Synthetic id for React keys + dnd-kit sortable id. Not security-sensitive.
// crypto.randomUUID() requires a Secure Context (HTTPS or localhost); plain-http
// deployments behind reverse proxies (REVERSE_PROXY_MODE / Issue #25) have no
// crypto.randomUUID and would crash this component on render.
let _rowIdCounter = 0
function makeRowId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  _rowIdCounter += 1
  return `r-${Date.now()}-${_rowIdCounter}-${Math.random().toString(36).slice(2)}`
}

function makeRow(value: string): Row {
  return { id: makeRowId(), value }
}

function rowsEqual(a: readonly string[], b: readonly string[]): boolean {
  if (a.length !== b.length) return false
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false
  }
  return true
}

function SortableRow({
  id,
  index,
  value,
  onChange,
  onBlur,
  onRemove,
}: {
  id: string
  index: number
  value: string
  onChange: (next: string) => void
  onBlur: () => void
  onRemove: () => void
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <div ref={setNodeRef} style={style} className="flex items-center gap-2">
      <button
        type="button"
        {...attributes}
        {...listeners}
        title="拖动以重新排列顺序"
        className="cursor-grab active:cursor-grabbing p-1 text-gray-400 hover:text-white"
      >
        <GripVertical className="h-4 w-4" />
      </button>
      <span className="text-xs text-gray-500 w-6 text-right">{index + 1}.</span>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        placeholder="https://${env:VIRTUAL_HOST}"
        className="flex-1 rounded-md border border-gray-700 bg-gray-800 px-3 py-2 text-white placeholder-gray-500 font-mono text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
      />
      <button
        type="button"
        onClick={onRemove}
        title="移除"
        className="p-2 text-gray-400 hover:text-red-400"
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </div>
  )
}

export function WebUIUrlMappingSection() {
  const { data: settings } = useGlobalSettings()
  const updateSettings = useUpdateGlobalSettings()
  const sensors = useDndSensors()

  const [rows, setRowsState] = useState<Row[] | null>(null)
  const rowsRef = useRef<Row[] | null>(null)
  // Promise-chain queue. Each persist chains its body onto this tail
  // SYNCHRONOUSLY before yielding control, so even N concurrent enqueues run
  // strictly in submission order. The tail is `.catch(()=>{})`-wrapped so a
  // single rejection can never poison the chain.
  const inFlightTailRef = useRef<Promise<unknown>>(Promise.resolve())
  // Last payload we successfully sent to the server. The no-op check inside
  // the queued section compares against this rather than the React Query
  // settings cache, so a payload that "looks like" the cached server value
  // but is actually different from the most-recent successful write is not
  // silently dropped.
  const lastSentPayloadRef = useRef<string[] | null>(null)
  // Monotonic edit clock — bumped on every local row change. Each persist
  // captures this SYNCHRONOUSLY at enqueue time (not when its queued body
  // runs); the revert-on-failure path only restores the snapshot if editSeq
  // hasn't advanced since enqueue. Capturing at enqueue (vs body start)
  // matters when persists queue behind a slow predecessor and the user
  // makes more local edits while waiting — body-start capture would see
  // the post-edit clock and incorrectly think nothing had changed.
  const editSeqRef = useRef(0)
  // Track mount state so the catch path doesn't toast/setState after the
  // user has navigated away while a persist was still in flight.
  const mountedRef = useRef(true)
  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])

  // Single setter that keeps state and ref in sync. The ref is updated
  // SYNCHRONOUSLY here (not inside the queued setRowsState updater), so any
  // caller that synchronously reads rowsRef.current after setRows(next) sees
  // the new value. Bumps editSeqRef so the persist failure path can detect
  // intervening user edits.
  const setRows = useCallback((next: Row[] | ((prev: Row[]) => Row[])) => {
    const prevRows = rowsRef.current ?? []
    const resolved = typeof next === 'function' ? next(prevRows) : next
    rowsRef.current = resolved
    editSeqRef.current++
    setRowsState(resolved)
  }, [])

  // Initial seed from server. We intentionally only seed once (rows === null)
  // to avoid clobbering in-flight typing every time the settings query
  // refetches after a mutation. After the first seed, the server is reflected
  // back into rows only via the optimistic-update path in `persist`.
  useEffect(() => {
    if (rowsRef.current === null && settings) {
      const seeded = (settings.webui_url_mapping_chain ?? []).map(makeRow)
      rowsRef.current = seeded
      // Seed the no-op baseline so the first edit-equal-to-server doesn't
      // round-trip the server unnecessarily.
      lastSentPayloadRef.current = settings.webui_url_mapping_chain ?? []
      setRowsState(seeded)
    }
  }, [settings])

  const persist = useCallback(
    (nextRows: Row[], revertTo?: Row[]): Promise<void> => {
      // Capture the payload synchronously — must reflect the rows passed in,
      // not whatever rowsRef holds when the queued body eventually runs.
      const payload = nextRows
        .map((r) => r.value.trim())
        .filter((v) => v.length > 0)

      // Capture editSeq AT ENQUEUE TIME (not at body-start). If we captured
      // inside the queued body, a persist waiting behind a slow predecessor
      // would see the editSeq value AFTER any user edits made while waiting
      // — and incorrectly conclude "nothing changed" on failure, reverting
      // past those newer edits.
      const editSeqAtEnqueue = editSeqRef.current

      // Chain SYNCHRONOUSLY onto the queue tail before any await. This is the
      // critical invariant — if we yielded control before assigning, a
      // synchronously-following persist could capture the same prev tail and
      // run concurrently. By chaining first and assigning synchronously, the
      // next persist sees `op` as the new tail and chains behind it.
      const prev = inFlightTailRef.current
      const op = prev.then(async () => {
        // Now serialized: only one body runs at a time, in submission order.
        // Compare against the most-recent successful write (not the React
        // Query cache, which lags in-flight mutations).
        if (rowsEqual(payload, lastSentPayloadRef.current ?? [])) return

        try {
          await updateSettings.mutateAsync({ webui_url_mapping_chain: payload })
          lastSentPayloadRef.current = payload
        } catch {
          // Skip side effects if we've unmounted (user navigated away mid-flight).
          if (!mountedRef.current) return
          toast.error('自动添加 WebUI URL 时出错')
          // Only revert if (a) the caller gave us a meaningful pre-op snapshot
          // (handlers that mutate local state pass it; blur/typing doesn't),
          // and (b) no local edits happened since this persist was enqueued —
          // if editSeq moved on, the user has newer state we'd clobber.
          if (revertTo && editSeqRef.current === editSeqAtEnqueue) {
            rowsRef.current = revertTo
            setRowsState(revertTo)
          }
        }
      })

      // Tail must NEVER reject — chained persists would all skip their bodies.
      inFlightTailRef.current = op.catch(() => {})
      return op
    },
    [updateSettings],
  )

  const handleAdd = useCallback(() => {
    // Adding a row is local-only (empty rows aren't persisted). The user
    // types into the new row and persistence happens on blur.
    setRows((prev) => [...prev, makeRow('')])
  }, [setRows])

  const handleChange = useCallback(
    (id: string, value: string) => {
      setRows((prev) => prev.map((r) => (r.id === id ? { ...r, value } : r)))
    },
    [setRows],
  )

  const handleBlur = useCallback(() => {
    // persist() no-ops when the trimmed payload already matches the server,
    // so an unconditional call here is safe and clearer than per-row diffing.
    // We deliberately don't pass a revertTo — typed-then-failed-on-blur leaves
    // the user's text in the input (with a toast) so they can fix and retry,
    // rather than losing their typing to a network blip.
    void persist(rowsRef.current ?? [])
  }, [persist])

  const handleRemove = useCallback(
    (id: string) => {
      // Capture pre-op state so persist can restore it on failure. Without
      // this, the optimistic setRows below changes rowsRef and the catch
      // path's "revert to current state" would be a no-op.
      const current = rowsRef.current ?? []
      const next = current.filter((r) => r.id !== id)
      setRows(next)
      void persist(next, current)
    },
    [persist, setRows],
  )

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event
      if (!over || active.id === over.id) return
      const current = rowsRef.current ?? []
      const oldIndex = current.findIndex((r) => r.id === active.id)
      const newIndex = current.findIndex((r) => r.id === over.id)
      if (oldIndex < 0 || newIndex < 0) return
      const next = arrayMove(current, oldIndex, newIndex)
      setRows(next)
      void persist(next, current)
    },
    [persist, setRows],
  )

  const displayRows = rows ?? []

  return (
    <div>
      <div className="mb-4">
        <h3 className="text-lg font-semibold text-white">WebUI URL 自动填充</h3>
        <p className="text-xs text-gray-400 mt-1">
          当容器未设置 WebUI URL 时，DockMon 会按顺序根据环境变量和 Docker 标签解析以下 URL 模板，
          并使用第一个解析结果非空的 URL。手动设置的 WebUI URL 始终具有最高优先级。
        </p>
        <p className="text-xs text-gray-500 mt-2">
          占位符说明: <code className="text-gray-300">{'${env:NAME}'}</code> 引用环境变量，而{' '}
          <code className="text-gray-300">{'${label:NAME}'}</code> 引用 Docker 标签。例如:{' '}
          <code className="text-gray-300">{'https://${env:VIRTUAL_HOST}'}</code>
        </p>
        <p className="text-xs text-gray-500 mt-2">
          注意: 在使用代理管理的主机上，<code className="text-gray-300">env:</code>
          占位符需要使用 <strong className="text-gray-300">Agent v1.1.0 或者更高版本</strong>。
          旧版本的代理仅支持解析 <code className="text-gray-300">label:</code> 占位符。
        </p>
      </div>

      {displayRows.length === 0 && (
        <p className="text-sm text-gray-500 italic">
          未配置任何模板，自动填充功能已禁用。
        </p>
      )}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={displayRows.map((r) => r.id)}
          strategy={verticalListSortingStrategy}
        >
          <div className="space-y-2">
            {displayRows.map((row, index) => (
              <SortableRow
                key={row.id}
                id={row.id}
                index={index}
                value={row.value}
                onChange={(next) => handleChange(row.id, next)}
                onBlur={handleBlur}
                onRemove={() => handleRemove(row.id)}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      <button
        type="button"
        onClick={handleAdd}
        className="mt-3 inline-flex items-center gap-2 rounded-md border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-gray-300 hover:bg-gray-700"
      >
        <Plus className="h-3.5 w-3.5" />
        添加填充模板
      </button>
    </div>
  )
}
