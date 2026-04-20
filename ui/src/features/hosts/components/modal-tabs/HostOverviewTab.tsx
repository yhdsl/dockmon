/**
 * HostOverviewTab Component
 *
 * Overview tab for host modal
 * - Large performance charts (CPU, Memory, Network)
 * - Time range selector
 * - Right sidebar with Host Information and Events
 * - Agent info and updates for agent-based hosts
 */

import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Cpu, MemoryStick, Network, Calendar, AlertCircle, ArrowUpCircle, RefreshCw } from 'lucide-react'
import { useHostMetrics, useHostSparklines } from '@/lib/stats/StatsProvider'
import { ResponsiveMiniChart } from '@/lib/charts/ResponsiveMiniChart'
import { TagInput } from '@/components/TagInput'
import { TagChip } from '@/components/TagChip'
import { Button } from '@/components/ui/button'
import { useHostTagEditor } from '@/hooks/useHostTagEditor'
import { useHostEvents } from '@/hooks/useEvents'
import { apiClient } from '@/lib/api/client'
import { useTimeFormat } from '@/lib/hooks/useUserPreferences'
import { formatTime } from '@/lib/utils/timeFormat'
import type { Host } from '@/types/api'
import { useAuth } from '@/features/auth/AuthContext'
import { formatBytes, formatNetworkRate } from '@/lib/utils/formatting'
import {formatSeverity} from "@/lib/utils/eventUtils.ts";

interface HostOverviewTabProps {
  hostId: string
  host: Host
}

interface AgentInfo {
  id: string
  version: string
  arch: string | null
  os: string | null
  status: string
  update_available: boolean
  latest_version: string | null
  is_container_mode: boolean
  last_seen_at: string | null
}

export function HostOverviewTab({ hostId, host }: HostOverviewTabProps) {
  const { hasCapability } = useAuth()
  const canManageAgents = hasCapability('agents.manage')
  const canManageTags = hasCapability('tags.manage')

  const { timeFormat } = useTimeFormat()
  const queryClient = useQueryClient()
  const [updateTriggered, setUpdateTriggered] = useState(false)

  const metrics = useHostMetrics(hostId)
  const sparklines = useHostSparklines(hostId)
  const { data: eventsData, isLoading: isLoadingEvents, error: eventsError } = useHostEvents(hostId, 3)
  const events = eventsData?.events ?? []

  // Fetch agent info for agent-based hosts
  const { data: agent } = useQuery({
    queryKey: ['host-agent', hostId],
    queryFn: () => apiClient.get<AgentInfo>(`/hosts/${hostId}/agent`),
    enabled: host.connection_type === 'agent',
    refetchInterval: 10000,
  })

  // Reset updateTriggered when agent reconnects with new version (update_available becomes false)
  useEffect(() => {
    if (updateTriggered && agent && !agent.update_available) {
      setUpdateTriggered(false)
    }
  }, [agent?.update_available, updateTriggered])

  // Trigger agent update mutation
  const triggerUpdate = useMutation({
    mutationFn: async () => {
      await apiClient.post(`/hosts/${hostId}/agent/update`)
    },
    onSuccess: () => {
      setUpdateTriggered(true)
      queryClient.invalidateQueries({ queryKey: ['host-agent', hostId] })
    },
  })

  const currentTags = host.tags || []

  const {
    isEditing: isEditingTags,
    editedTags,
    tagSuggestions,
    isLoading: isLoadingTags,
    setEditedTags,
    handleStartEdit,
    handleCancelEdit,
    handleSaveTags,
  } = useHostTagEditor({ hostId, currentTags })

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="p-3 sm:p-4 md:p-6">
        {/* Agent Update Banner - shown at top when update available */}
        {agent?.update_available && !updateTriggered && (
          <div className="rounded-lg border bg-amber-500/10 border-amber-500/30 p-3 mb-4 sm:mb-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ArrowUpCircle className="h-4 w-4 text-amber-500" />
                <div>
                  <div className="text-sm font-medium">代理更新可用</div>
                  <div className="text-xs text-muted-foreground">
                    新版本 v{agent.latest_version} (当前版本: v{agent.version})
                  </div>
                </div>
              </div>
              {!agent.is_container_mode && (
                <Button
                  onClick={() => triggerUpdate.mutate()}
                  disabled={!canManageAgents || triggerUpdate.isPending}
                  size="sm"
                >
                  {triggerUpdate.isPending ? (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                      更新中...
                    </>
                  ) : (
                    '更新代理'
                  )}
                </Button>
              )}
            </div>
            {agent.is_container_mode && (
              <div className="mt-2 text-xs text-muted-foreground">
                该代理正在容器中运行。请更新 DockMon 以同时更新此代理。
              </div>
            )}
          </div>
        )}

        {/* Agent Update In Progress */}
        {updateTriggered && (
          <div className="rounded-lg border bg-blue-500/10 border-blue-500/30 p-3 mb-4 sm:mb-6">
            <div className="flex items-center gap-2">
              <RefreshCw className="h-4 w-4 text-blue-500 animate-spin" />
              <div>
                <div className="text-sm font-medium">正在更新</div>
                <div className="text-xs text-muted-foreground">
                  代理将很快重新连接...
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
          {/* LEFT COLUMN */}
          <div className="space-y-4 sm:space-y-6">
            {/* Host Information */}
            <div>
              <h4 className="text-base sm:text-lg font-medium text-foreground mb-3">主机信息</h4>
              <div className="space-y-2">
                {host.host_ips && host.host_ips.length > 0 ? (
                  <div className="flex flex-col sm:flex-row sm:justify-between gap-1 sm:gap-2 text-sm">
                    <span className="text-muted-foreground">IP 地址</span>
                    <div className="flex flex-col gap-0.5">
                      {host.host_ips.map((ip) => (
                        <span key={ip} className="text-sm text-foreground">{ip}</span>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col sm:flex-row sm:justify-between gap-1 sm:gap-2 text-sm">
                    <span className="text-muted-foreground">端点</span>
                    <span className="font-mono text-xs break-all">{host.url || '—'}</span>
                  </div>
                )}
                <div className="flex flex-col sm:flex-row sm:justify-between gap-1 sm:gap-2 text-sm">
                  <span className="text-muted-foreground">操作系统</span>
                  <span>{host.os_version || '未知'}</span>
                </div>
                <div className="flex flex-col sm:flex-row sm:justify-between gap-1 sm:gap-2 text-sm">
                  <span className="text-muted-foreground">{host.is_podman ? 'Podman' : 'Docker'} 版本</span>
                  <span>{host.docker_version || '—'}</span>
                </div>
                <div className="flex flex-col sm:flex-row sm:justify-between gap-1 sm:gap-2 text-sm">
                  <span className="text-muted-foreground">CPU</span>
                  <span>{host.num_cpus || '—'}</span>
                </div>
                <div className="flex flex-col sm:flex-row sm:justify-between gap-1 sm:gap-2 text-sm">
                  <span className="text-muted-foreground">内存</span>
                  <span>{host.total_memory ? formatBytes(host.total_memory) : '—'}</span>
                </div>
                {/* Agent info - only for agent-based hosts */}
                {host.connection_type === 'agent' && agent && (
                  <>
                    <div className="border-t border-border my-2" />
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">代理版本</span>
                      <span>v{agent.version}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">代理平台</span>
                      <span>{agent.os || 'linux'}/{agent.arch || 'amd64'}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">代理部署类型</span>
                      <span>{agent.is_container_mode ? '基于容器' : '系统服务'}</span>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Tags */}
            <div>
              {isEditingTags ? (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h4 className="text-lg font-medium text-foreground">标签</h4>
                  </div>
                  <TagInput
                    value={editedTags}
                    onChange={setEditedTags}
                    suggestions={tagSuggestions}
                    placeholder="请输入标签内容..."
                    maxTags={20}
                    showPrimaryIndicator={true}
                  />
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={handleSaveTags}
                      disabled={isLoadingTags}
                      className="flex-1"
                    >
                      保存
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleCancelEdit}
                      disabled={isLoadingTags}
                    >
                      取消
                    </Button>
                  </div>
                </div>
              ) : (
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-lg font-medium text-foreground">标签</h4>
                    <button
                      onClick={handleStartEdit}
                      disabled={!canManageTags}
                      className="text-xs text-primary hover:text-primary/80 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      + 编辑
                    </button>
                  </div>
                  {currentTags.length === 0 ? (
                    <span className="text-sm text-muted-foreground">暂无标签</span>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {(currentTags as string[]).map((tag) => (
                        <TagChip key={tag} tag={tag} size="sm" />
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Events */}
            <div>
              <h4 className="text-lg font-medium text-foreground mb-3">事件</h4>
              {isLoadingEvents ? (
                <div className="text-center py-4 text-muted-foreground">
                  <p className="text-sm">加载事件数据中...</p>
                </div>
              ) : eventsError ? (
                <div className="text-center py-4">
                  <AlertCircle className="h-8 w-8 mx-auto mb-2 text-red-500 opacity-50" />
                  <p className="text-sm text-red-500">无法加载事件数据</p>
                </div>
              ) : events.length === 0 ? (
                <div className="text-center py-4 text-muted-foreground">
                  <Calendar className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">最近暂无事件</p>
                </div>
              ) : (
                <div className="border border-border rounded-lg overflow-hidden">
                  {/* Mini table header */}
                  <div className="bg-surface-2 px-3 py-1.5 grid grid-cols-[60px_60px_1fr] sm:grid-cols-[80px_70px_1fr] gap-2 text-xs font-medium text-muted-foreground border-b border-border">
                    <div>时间戳</div>
                    <div className="hidden sm:block">严重程度</div>
                    <div className="sm:hidden">严重程度</div>
                    <div>详细信息</div>
                  </div>
                  {/* Events */}
                  <div className="divide-y divide-border bg-surface-1">
                    {events.map((event) => (
                      <div key={event.id} className="px-3 py-2 grid grid-cols-[60px_60px_1fr] sm:grid-cols-[80px_70px_1fr] gap-2 text-xs hover:bg-surface-2 transition-colors">
                        <div className="font-mono text-muted-foreground truncate">
                          {formatTime(event.timestamp, timeFormat)}
                        </div>
                        <div className={`font-medium ${
                          event.severity === 'critical' ? 'text-red-500' :
                          event.severity === 'error' ? 'text-red-400' :
                          event.severity === 'warning' ? 'text-yellow-500' :
                          event.severity === 'info' ? 'text-blue-400' : 'text-gray-400'
                        }`}>
                          {formatSeverity(event.severity)}
                        </div>
                        <div className="text-foreground truncate" title={event.title}>
                          {event.title}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* RIGHT COLUMN */}
          <div className="space-y-4 sm:space-y-6">
            {/* Live Stats Header */}
            <div className="-mb-2 sm:-mb-3">
              <h4 className="text-base sm:text-lg font-medium text-foreground">实时统计数据</h4>
            </div>

            {/* CPU Usage */}
            <div className="bg-surface-2 rounded-lg p-3 border border-border overflow-hidden">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Cpu className="h-4 w-4 text-amber-500" />
                  <span className="font-medium text-sm">CPU 使用率</span>
                </div>
                <span className="text-xs text-muted-foreground">
                  {metrics?.cpu_percent !== undefined
                    ? `${metrics.cpu_percent.toFixed(0)}%`
                    : '—'}
                </span>
              </div>
              {sparklines?.cpu && sparklines.cpu.length > 0 ? (
                <div className="h-[120px] w-full">
                  <ResponsiveMiniChart
                    data={sparklines.cpu}
                    color="cpu"
                    height={120}
                    showAxes={true}
                  />
                </div>
              ) : (
                <div className="h-[120px] flex items-center justify-center text-muted-foreground text-xs">
                  没有可用的数据
                </div>
              )}
            </div>

            {/* Memory Usage */}
            <div className="bg-surface-2 rounded-lg p-3 border border-border overflow-hidden">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <MemoryStick className="h-4 w-4 text-green-500" />
                  <span className="font-medium text-sm">内存使用率</span>
                </div>
                <span className="text-xs text-muted-foreground">
                  {metrics?.mem_bytes
                    ? `${formatBytes(metrics.mem_bytes)}`
                    : '—'}
                </span>
              </div>
              {sparklines?.mem && sparklines.mem.length > 0 ? (
                <div className="h-[120px] w-full">
                  <ResponsiveMiniChart
                    data={sparklines.mem}
                    color="memory"
                    height={120}
                    showAxes={true}
                  />
                </div>
              ) : (
                <div className="h-[120px] flex items-center justify-center text-muted-foreground text-xs">
                  没有可用的数据
                </div>
              )}
            </div>

            {/* Network Traffic */}
            <div className="bg-surface-2 rounded-lg p-3 border border-border overflow-hidden">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Network className="h-4 w-4 text-orange-500" />
                  <span className="font-medium text-sm">网络流量</span>
                </div>
                <span className="text-xs text-muted-foreground">
                  {metrics?.net_bytes_per_sec !== undefined
                    ? formatNetworkRate(metrics.net_bytes_per_sec)
                    : '—'}
                </span>
              </div>
              {sparklines?.net && sparklines.net.length > 0 ? (
                <div className="h-[120px] w-full">
                  <ResponsiveMiniChart
                    data={sparklines.net}
                    color="network"
                    height={120}
                    showAxes={true}
                  />
                </div>
              ) : (
                <div className="h-[120px] flex items-center justify-center text-muted-foreground text-xs">
                  没有可用的数据
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
