/**
 * VolumeDeleteConfirmModal Component
 *
 * Confirmation modal for deleting Docker volumes (single or bulk)
 * Shows warning for volumes in use and force delete option
 */

import { useState, useEffect, useCallback } from 'react'
import { AlertTriangle } from 'lucide-react'
import { ConfirmModal } from '@/components/shared/ConfirmModal'
import type { DockerVolume } from '@/types/api'

interface VolumeDeleteConfirmModalProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: (force: boolean) => void
  volume: DockerVolume | null  // Single volume for single delete
  volumeCount?: number         // Total count for bulk delete
  isPending?: boolean
}

export function VolumeDeleteConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  volume,
  volumeCount = 1,
  isPending = false,
}: VolumeDeleteConfirmModalProps) {
  const [forceDelete, setForceDelete] = useState(false)

  // Reset forceDelete when modal opens
  useEffect(() => {
    if (isOpen) {
      setForceDelete(false)
    }
  }, [isOpen])

  const handleConfirm = useCallback(() => {
    onConfirm(forceDelete)
  }, [onConfirm, forceDelete])

  // Bulk delete mode
  if (volumeCount > 1) {
    return (
      <ConfirmModal
        isOpen={isOpen}
        onClose={onClose}
        onConfirm={handleConfirm}
        title="删除卷"
        description={`删除 ${volumeCount} 个已选择的卷? 此操作将无法撤销。`}
        confirmText={`删除 ${volumeCount} 个卷`}
        pendingText="删除中..."
        variant="danger"
        isPending={isPending}
      >
        <div className="space-y-4">
          <div className="flex items-start gap-3 p-3 bg-warning/10 border border-warning/30 rounded-lg">
            <AlertTriangle className="h-5 w-5 text-warning flex-shrink-0 mt-0.5" aria-hidden="true" />
            <div className="text-sm">
              <p className="font-medium text-warning">
                卷批处理删除
              </p>
              <p className="text-muted-foreground mt-1">
                删除正在被容器使用的卷需要启用强制删除。
              </p>
            </div>
          </div>

          <div className="border-t border-border pt-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={forceDelete}
                onChange={(e) => setForceDelete(e.target.checked)}
                className="w-4 h-4 rounded border-border"
              />
              <span className="text-sm text-foreground">
                强制删除 (无视是否被使用)
              </span>
            </label>
          </div>
        </div>
      </ConfirmModal>
    )
  }

  // Single delete mode
  if (!volume) return null

  const isInUse = volume.in_use

  return (
    <ConfirmModal
      isOpen={isOpen}
      onClose={onClose}
      onConfirm={handleConfirm}
      title="删除卷"
      description="此操作将无法撤销"
      confirmText="删除卷"
      pendingText="删除中..."
      variant="danger"
      isPending={isPending}
      disabled={isInUse && !forceDelete}
    >
      <div className="space-y-4">
        {/* Warning for volumes in use */}
        {isInUse && (
          <div className="flex items-start gap-3 p-3 bg-warning/10 border border-warning/30 rounded-lg">
            <AlertTriangle className="h-5 w-5 text-warning flex-shrink-0 mt-0.5" aria-hidden="true" />
            <div className="text-sm">
              <p className="font-medium text-warning">
                卷已被 {volume.container_count} 个容器所使用
              </p>
              <p className="text-muted-foreground mt-1">
                强制删除可能会导致正在运行的容器出现数据丢失。
              </p>
            </div>
          </div>
        )}

        {/* Volume info */}
        <div className="p-3 rounded bg-surface-2 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">名称</span>
            <span className="text-sm font-medium text-foreground font-mono truncate max-w-[200px]" title={volume.name}>
              {volume.name}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">驱动</span>
            <span className="text-sm text-foreground">
              {volume.driver || 'local'}
            </span>
          </div>
          {isInUse && volume.containers && volume.containers.length > 0 && (
            <div className="pt-2 border-t border-border">
              <span className="text-sm text-muted-foreground">被以下容器使用:</span>
              <ul className="mt-1 space-y-1">
                {volume.containers.slice(0, 5).map((container) => (
                  <li key={container.id} className="text-sm text-foreground font-mono pl-2">
                    {container.name || container.id}
                  </li>
                ))}
                {volume.containers.length > 5 && (
                  <li className="text-sm text-muted-foreground pl-2">
                    ...以及剩余的 {volume.containers.length - 5} 个
                  </li>
                )}
              </ul>
            </div>
          )}
        </div>

        {/* Force delete option (only show if volume is in use) */}
        {isInUse && (
          <div className="border-t border-border pt-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={forceDelete}
                onChange={(e) => setForceDelete(e.target.checked)}
                className="w-4 h-4 rounded border-border"
              />
              <span className="text-sm text-foreground">
                强制删除 (可能会丢失数据)
              </span>
            </label>
            <p className="text-xs text-warning mt-2">
              警告: 强制删除将不会考虑卷是否正在被容器使用。
            </p>
          </div>
        )}
      </div>
    </ConfirmModal>
  )
}
