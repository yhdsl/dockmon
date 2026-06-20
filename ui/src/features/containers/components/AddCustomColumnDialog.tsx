/**
 * Modal for adding a custom env/label column to the containers table.
 *
 * The "Environment variable" option is offered only when the user holds
 * containers.view_env. This is a UX-only gate — the actual env enforcement
 * is server-side in filter_ws_container_message / filter_container_env.
 * Don't relax those trusting this UI.
 */
import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

interface AddCustomColumnDialogProps {
  open: boolean
  existingColumnIds: string[]
  canAddEnv: boolean
  onOpenChange: (open: boolean) => void
  onAdd: (columnId: string) => void
}

export function AddCustomColumnDialog({
  open,
  existingColumnIds,
  canAddEnv,
  onOpenChange,
  onAdd,
}: AddCustomColumnDialogProps) {
  const [kind, setKind] = useState<'env' | 'label'>('env')
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)

  // Derived so prop changes (e.g. capability flips, dialog reopens) always win
  // over stale local state — no useEffect snap-back needed.
  const effectiveKind: 'env' | 'label' = canAddEnv ? kind : 'label'

  const handleSubmit = () => {
    const trimmed = name.trim()
    if (!trimmed) {
      setError('名称为必填项')
      return
    }
    const id = `${effectiveKind}:${trimmed}`
    if (existingColumnIds.includes(id)) {
      setError('列已存在')
      return
    }
    onAdd(id)
    setName('')
    setError(null)
    onOpenChange(false)
  }

  const handleOpenChange = (next: boolean) => {
    if (!next) {
      setName('')
      setError(null)
    }
    onOpenChange(next)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>添加自定义列</DialogTitle>
          <DialogDescription>
            {canAddEnv
              ? '将 Docker 中的环境变量或者标签显示为列表中单独的一列。'
              : '将 Docker 中的标签显示为列表中单独的一列。'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {canAddEnv && (
            <div>
              <label className="block text-sm font-medium mb-2">来源</label>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant={effectiveKind === 'env' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setKind('env')}
                >
                  环境变量
                </Button>
                <Button
                  type="button"
                  variant={effectiveKind === 'label' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setKind('label')}
                >
                  Docker 标签
                </Button>
              </div>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium mb-2">
              {effectiveKind === 'env' ? '变量名称' : '标签名称'}
            </label>
            <Input
              value={name}
              onChange={(e) => {
                setName(e.target.value)
                setError(null)
              }}
              placeholder={effectiveKind === 'env' ? 'VIRTUAL_HOST' : 'com.acme.url'}
              onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
              autoFocus
            />
            {error && <p className="text-sm text-destructive mt-1">{error}</p>}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)}>
            取消
          </Button>
          <Button onClick={handleSubmit}>添加自定义列</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
