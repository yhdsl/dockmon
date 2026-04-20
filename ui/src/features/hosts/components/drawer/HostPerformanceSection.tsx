/**
 * HostPerformanceSection Component
 *
 * Displays real-time CPU/Memory/Network sparklines for a host
 */

import { Cpu, MemoryStick, Network } from 'lucide-react'
import { DrawerSection } from '@/components/ui/drawer'
import { ResponsiveMiniChart } from '@/lib/charts/ResponsiveMiniChart'
import { useHostMetrics, useHostSparklines } from '@/lib/stats/StatsProvider'
import { formatNetworkRate } from '@/lib/utils/formatting'

interface HostPerformanceSectionProps {
  hostId: string
}

export function HostPerformanceSection({ hostId }: HostPerformanceSectionProps) {
  const metrics = useHostMetrics(hostId)
  const sparklines = useHostSparklines(hostId)

  return (
    <DrawerSection title="性能">
      <div className="space-y-4">
        {/* CPU */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Cpu className="h-4 w-4 text-amber-500" />
              <span className="text-sm font-medium">CPU 使用率</span>
            </div>
            <span className="text-sm font-mono">
              {metrics?.cpu_percent !== undefined
                ? `${metrics.cpu_percent.toFixed(1)}%`
                : '—'}
            </span>
          </div>
          {sparklines?.cpu && sparklines.cpu.length > 0 ? (
            <ResponsiveMiniChart
              data={sparklines.cpu}
              color="cpu"
              height={100}
              showAxes={true}
            />
          ) : (
            <div className="h-[100px] flex items-center justify-center bg-muted rounded text-xs text-muted-foreground">
              没有可用的数据
            </div>
          )}
        </div>

        {/* Memory */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <MemoryStick className="h-4 w-4 text-blue-500" />
              <span className="text-sm font-medium">内存使用率</span>
            </div>
            <span className="text-sm font-mono">
              {metrics?.mem_percent !== undefined
                ? `${metrics.mem_percent.toFixed(1)}%`
                : '—'}
            </span>
          </div>
          {sparklines?.mem && sparklines.mem.length > 0 ? (
            <ResponsiveMiniChart
              data={sparklines.mem}
              color="memory"
              height={100}
              showAxes={true}
            />
          ) : (
            <div className="h-[100px] flex items-center justify-center bg-muted rounded text-xs text-muted-foreground">
              没有可用的数据
            </div>
          )}
        </div>

        {/* Network */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Network className="h-4 w-4 text-green-500" />
              <span className="text-sm font-medium">网络 I/O</span>
            </div>
            <span className="text-sm font-mono">
              {metrics?.net_bytes_per_sec !== undefined
                ? formatNetworkRate(metrics.net_bytes_per_sec)
                : '—'}
            </span>
          </div>
          {sparklines?.net && sparklines.net.length > 0 ? (
            <ResponsiveMiniChart
              data={sparklines.net}
              color="network"
              height={100}
              showAxes={true}
            />
          ) : (
            <div className="h-[100px] flex items-center justify-center bg-muted rounded text-xs text-muted-foreground">
              没有可用的数据
            </div>
          )}
        </div>

        {/* Update Info */}
        <div className="text-xs text-muted-foreground text-center pt-2">
          每 2 秒更新一次
        </div>
      </div>
    </DrawerSection>
  )
}
