/**
 * NetworkDeleteConfirmModal Component
 *
 * Confirmation modal for deleting Docker networks (single or bulk)
 * Shows warning for networks with connected containers and force delete option
 */

import { useState, useEffect, useCallback } from 'react'
import { AlertTriangle } from 'lucide-react'
import { ConfirmModal } from '@/components/shared/ConfirmModal'
import type { DockerNetwork } from '@/types/api'

interface NetworkDeleteConfirmModalProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: (force: boolean) => void
  network: DockerNetwork | null  // Single network for single delete
  networkCount?: number          // Total count for bulk delete
  isPending?: boolean
}

export function NetworkDeleteConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  network,
  networkCount = 1,
  isPending = false,
}: NetworkDeleteConfirmModalProps) {
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
  if (networkCount > 1) {
    return (
      <ConfirmModal
        isOpen={isOpen}
        onClose={onClose}
        onConfirm={handleConfirm}
        title="删除网络"
        description={`删除 ${networkCount} 个选择的网络? 此操作将无法撤销。`}
        confirmText={`删除 ${networkCount} 个网络`}
        pendingText="删除中..."
        variant="danger"
        isPending={isPending}
      >
        <div className="space-y-4">
          <div className="flex items-start gap-3 p-3 bg-warning/10 border border-warning/30 rounded-lg">
            <AlertTriangle className="h-5 w-5 text-warning flex-shrink-0 mt-0.5" aria-hidden="true" />
            <div className="text-sm">
              <p className="font-medium text-warning">
                网络批处理删除
              </p>
              <p className="text-muted-foreground mt-1">
                删除正在被容器使用的网络需要启用强制删除。
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
  if (!network) return null

  const hasConnectedContainers = network.container_count > 0

  return (
    <ConfirmModal
      isOpen={isOpen}
      onClose={onClose}
      onConfirm={handleConfirm}
      title="删除网络"
      description="此操作将无法撤销"
      confirmText="删除网络"
      pendingText="删除中..."
      variant="danger"
      isPending={isPending}
      disabled={hasConnectedContainers && !forceDelete}
    >
      <div className="space-y-4">
        {/* Warning for networks with connected containers */}
        {hasConnectedContainers && (
          <div className="flex items-start gap-3 p-3 bg-warning/10 border border-warning/30 rounded-lg">
            <AlertTriangle className="h-5 w-5 text-warning flex-shrink-0 mt-0.5" aria-hidden="true" />
            <div className="text-sm">
              <p className="font-medium text-warning">
                网络已被 {network.container_count} 个容器所使用
              </p>
              <p className="text-muted-foreground mt-1">
                删除该网络前需要先断开所有已连接的容器。
                这可能会影响这些容器的网络连接。
              </p>
            </div>
          </div>
        )}

        {/* Network info */}
        <div className="p-3 rounded bg-surface-2 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">名称</span>
            <span className="text-sm font-medium text-foreground font-mono">
              {network.name}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">驱动</span>
            <span className="text-sm text-foreground">
              {network.driver || 'default'}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">作用域</span>
            <span className="text-sm text-foreground">
              {{local: "本地", swarm: "Swarm", global: "全局", }[network.scope]}
            </span>
          </div>
          {hasConnectedContainers && (
            <div className="pt-2 border-t border-border">
              <span className="text-sm text-muted-foreground">已连接的容器:</span>
              <ul className="mt-1 space-y-1">
                {network.containers.slice(0, 5).map((container) => (
                  <li key={container.id} className="text-sm text-foreground font-mono pl-2">
                    {container.name || container.id}
                  </li>
                ))}
                {network.containers.length > 5 && (
                  <li className="text-sm text-muted-foreground pl-2">
                    ...以及剩余的 {network.containers.length - 5} 个
                  </li>
                )}
              </ul>
            </div>
          )}
        </div>

        {/* Force delete option (only show if there are connected containers) */}
        {hasConnectedContainers && (
          <div className="border-t border-border pt-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={forceDelete}
                onChange={(e) => setForceDelete(e.target.checked)}
                className="w-4 h-4 rounded border-border"
              />
              <span className="text-sm text-foreground">
                强制删除 (直接断开容器连接)
              </span>
            </label>
            <p className="text-xs text-warning mt-2">
              警告: 强制删除将从此网络中移除所有已连接的容器。
            </p>
          </div>
        )}
      </div>
    </ConfirmModal>
  )
}
