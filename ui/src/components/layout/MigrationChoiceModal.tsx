/**
 * Migration Choice Modal - Cloned VM Migration Selection
 *
 * When multiple remote/mTLS hosts share the same Docker engine_id (cloned VMs),
 * the user must choose which host to migrate settings from.
 *
 * This modal is NON-DISMISSABLE - user must make a choice.
 */

import { useState, useEffect } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, Server, ArrowRight, Loader2 } from 'lucide-react'
import { RemoveScroll } from 'react-remove-scroll'
import { toast } from 'sonner'
import { useWebSocketContext } from '@/lib/websocket/WebSocketProvider'
import { apiClient } from '@/lib/api/client'


interface MigrationCandidate {
  host_id: string
  host_name: string
}

interface MigrationChoiceData {
  agent_id: string
  host_id: string
  host_name: string
  candidates: MigrationCandidate[]
}

export function MigrationChoiceModal() {
  const [choiceData, setChoiceData] = useState<MigrationChoiceData | null>(null)
  const [selectedHostId, setSelectedHostId] = useState<string | null>(null)
  const { addMessageHandler } = useWebSocketContext()
  const queryClient = useQueryClient()

  // Listen for migration choice events
  useEffect(() => {
    const cleanup = addMessageHandler((message) => {
      if (message.type === 'migration_choice_needed') {
        const data = message.data as MigrationChoiceData
        setChoiceData(data)
        setSelectedHostId(null)
      }
    })

    return cleanup
  }, [addMessageHandler])

  // Mutation to perform the migration
  const migrateMutation = useMutation({
    mutationFn: async ({ agentId, sourceHostId }: { agentId: string; sourceHostId: string }) => {
      const response = await apiClient.post<Record<string, unknown>>(`/agent/${agentId}/migrate-from/${sourceHostId}`)
      return response
    },
    onSuccess: (data: Record<string, unknown>) => {
      const migratedFrom = data.migrated_from as { host_name: string } | undefined
      toast.success('已成功完成迁移', {
        description: `已完成 ${migratedFrom?.host_name || '之前的主机'} 的设置迁移`,
      })
      // Invalidate queries to refresh data
      queryClient.invalidateQueries({ queryKey: ['hosts'] })
      queryClient.invalidateQueries({ queryKey: ['containers'] })
      // Close modal
      setChoiceData(null)
      setSelectedHostId(null)
    },
    onError: (error: Error) => {
      toast.error('迁移失败', {
        description: error.message || '无法完成设置迁移',
      })
    },
  })

  const handleMigrate = () => {
    if (!choiceData || !selectedHostId) return
    migrateMutation.mutate({
      agentId: choiceData.agent_id,
      sourceHostId: selectedHostId,
    })
  }

  // Don't render if no choice needed
  if (!choiceData) {
    return null
  }

  return (
    <RemoveScroll>
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      {/* Backdrop - no onClick to prevent dismissal */}
      <div className="absolute inset-0 bg-black/60" />

      {/* Modal */}
      <div className="relative bg-surface-1 rounded-lg shadow-xl border border-border max-w-lg w-full mx-4 max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center h-10 w-10 rounded-full bg-warning/10">
              <AlertTriangle className="h-6 w-6 text-warning" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-foreground">
                需要选择迁移方案
              </h2>
              <p className="text-sm text-muted-foreground mt-1">
                多个主机共享同一个 Docker engine ID
              </p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="px-6 py-4 space-y-4">
          <div className="text-sm text-foreground">
            <p>
              已连接至 <span className="font-medium text-foreground">{choiceData.host_name}</span> 代理，
              但发现有多个现有主机使用了相同的 Docker engine ID。
            </p>
            <p className="mt-2 text-muted-foreground">
              这通常发生在被克隆的虚拟机或 LXC 容器中。请选择应该将哪个主机的设置 (标签、自动重启配置等) 迁移到新的代理。
            </p>
          </div>

          {/* Agent info */}
          <div className="flex items-center gap-3 p-3 rounded-lg bg-surface-2 border border-border">
            <Server className="h-5 w-5 text-primary flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-foreground truncate">
                {choiceData.host_name}
              </div>
              <div className="text-xs text-muted-foreground">
                已连接至新的代理
              </div>
            </div>
          </div>

          {/* Candidates list */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">
              迁移设置来源:
            </label>
            <div className="space-y-2">
              {choiceData.candidates.map((candidate) => (
                <label
                  key={candidate.host_id}
                  className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                    selectedHostId === candidate.host_id
                      ? 'bg-primary/10 border-primary'
                      : 'bg-surface-2 border-border hover:border-muted-foreground'
                  }`}
                >
                  <input
                    type="radio"
                    name="migration-source"
                    value={candidate.host_id}
                    checked={selectedHostId === candidate.host_id}
                    onChange={() => setSelectedHostId(candidate.host_id)}
                    className="h-4 w-4 text-primary"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-foreground truncate">
                      {candidate.host_name}
                    </div>
                    <div className="text-xs text-muted-foreground truncate">
                      {candidate.host_id}
                    </div>
                  </div>
                  {selectedHostId === candidate.host_id && (
                    <ArrowRight className="h-4 w-4 text-primary flex-shrink-0" />
                  )}
                </label>
              ))}
            </div>
          </div>

          {/* Info note */}
          <div className="text-xs text-muted-foreground bg-surface-2 rounded p-3 space-y-2">
            <p>
              <strong>迁移通知:</strong> 所选主机将会被标记为已迁移，相关设置 (标签、自动重启配置、期望状态等) 将被转移到新的代理中。
              原有的旧主机不会被删除，但将处于非活动状态。
            </p>
            <p className="text-warning">
              <strong>重要提示:</strong> 每个 Docker engine ID 只能迁移一个主机。
              其他克隆的主机在你重新生成新的 Docker engine ID 之前，将无法被注册。
            </p>
            <p>
              要修复其他克隆的主机: <code className="px-1 py-0.5 bg-surface-1 rounded text-foreground">rm /var/lib/docker/engine-id</code> (或者在旧系统中编辑 <code className="px-1 py-0.5 bg-surface-1 rounded text-foreground">/etc/docker/key.json</code>)，然后重启 Docker。查看{' '}
              <a
                href="https://github.com/darthnorse/dockmon/wiki/Cloned-VMs-and-Duplicate-Engine-IDs"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                了解更多
              </a>
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-border flex items-center justify-end gap-2">
          <button
            onClick={handleMigrate}
            disabled={!selectedHostId || migrateMutation.isPending}
            className="px-4 py-2 text-sm font-medium rounded transition-colors bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {migrateMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                迁移中...
              </>
            ) : (
              '迁移设置'
            )}
          </button>
        </div>
      </div>
    </div>
    </RemoveScroll>
  )
}
