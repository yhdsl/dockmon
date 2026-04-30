import { RemoveScroll } from 'react-remove-scroll'
import { useAuth } from '@/features/auth/AuthContext'
import type { Container } from '../types'
import { makeCompositeKey } from '@/lib/utils/containerKeys'

interface BulkActionConfirmModalProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => void
  action: 'start' | 'stop' | 'restart'
  containers: Container[]
}

export function BulkActionConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  action,
  containers,
}: BulkActionConfirmModalProps) {
  const { hasCapability } = useAuth()
  const canOperate = hasCapability('containers.operate')

  if (!isOpen) return null

  const actionLabels = {
    start: '启动',
    stop: '停止',
    restart: '重启',
  }

  const actionColors = {
    start: 'bg-success text-success-foreground',
    stop: 'bg-destructive text-destructive-foreground',
    restart: 'bg-info text-info-foreground',
  }

  return (
    <RemoveScroll>
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      {/* Modal */}
      <div className="relative bg-surface-1 rounded-lg shadow-xl border border-border max-w-md w-full mx-4 max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-border">
          <h2 className="text-lg font-semibold text-foreground">
            确认{actionLabels[action]}操作
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            {action === 'stop'
              ? `确定要${actionLabels[action]} ${containers.length} 个容器吗? 这将中断正在运行的容器进程。`
              : `确定要${actionLabels[action]} ${containers.length} 个容器吗?`
            }
          </p>
        </div>

        {/* Container List */}
        <div className="px-6 py-4 overflow-y-auto flex-1">
          <div className="space-y-2">
            {containers.map((container) => (
              <div
                key={makeCompositeKey(container)}
                className="flex items-center gap-3 p-2 rounded bg-surface-2"
              >
                <div
                  className={`h-2 w-2 rounded-full ${
                    container.state === 'running'
                      ? 'bg-success'
                      : container.state === 'paused'
                      ? 'bg-warning'
                      : 'bg-muted-foreground'
                  }`}
                />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-foreground truncate">
                    {container.name}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {container.host_name || 'localhost'}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-border flex items-center justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-foreground hover:bg-surface-2 rounded transition-colors"
          >
            取消
          </button>
          <fieldset disabled={!canOperate} className="disabled:opacity-60">
            <button
              onClick={onConfirm}
              className={`px-4 py-2 text-sm font-medium rounded transition-colors ${actionColors[action]}`}
            >
              {actionLabels[action]} {containers.length} 个容器
            </button>
          </fieldset>
        </div>
      </div>
    </div>
    </RemoveScroll>
  )
}
