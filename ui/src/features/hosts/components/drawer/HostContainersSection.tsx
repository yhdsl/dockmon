/**
 * HostContainersSection Component
 *
 * Displays containers for a host with configurable sorting
 */

import { Box, ArrowRight, Circle, ChevronDown } from 'lucide-react'
import { DrawerSection } from '@/components/ui/drawer'
import { useAllContainers } from '@/lib/stats/StatsProvider'
import { Link } from 'react-router-dom'
import { useState, useMemo, useEffect } from 'react'
import { DropdownMenu, DropdownMenuItem } from '@/components/ui/dropdown-menu'
import { useUserPreferences, useUpdatePreferences } from '@/lib/hooks/useUserPreferences'

interface HostContainersSectionProps {
  hostId: string
}

type SortKey = 'name' | 'state' | 'cpu' | 'memory' | 'start_time'

export function HostContainersSection({ hostId }: HostContainersSectionProps) {
  const allContainers = useAllContainers(hostId)
  const { data: prefs } = useUserPreferences()
  const updatePreferences = useUpdatePreferences()

  // Initialize sort key from preferences, fallback to 'state'
  const [sortKey, setSortKey] = useState<SortKey>(() => {
    const savedSort = prefs?.hostContainerSorts?.[hostId]
    return (savedSort as SortKey) || 'state'
  })

  // Update local state when preferences change (e.g., loaded from server)
  useEffect(() => {
    const savedSort = prefs?.hostContainerSorts?.[hostId]
    if (savedSort) {
      setSortKey(savedSort as SortKey)
    }
  }, [prefs?.hostContainerSorts, hostId])

  // Sort containers based on selected key
  const sortedContainers = useMemo(() => {
    const containers = [...allContainers]

    switch (sortKey) {
      case 'name':
        return containers.sort((a, b) => a.name.localeCompare(b.name))

      case 'state':
        // Running first, then alphabetically by name
        return containers.sort((a, b) => {
          if (a.state === 'running' && b.state !== 'running') return -1
          if (a.state !== 'running' && b.state === 'running') return 1
          return a.name.localeCompare(b.name)
        })

      case 'cpu':
        return containers.sort((a, b) => (b.cpu_percent || 0) - (a.cpu_percent || 0))

      case 'memory':
        return containers.sort((a, b) => (b.memory_percent || 0) - (a.memory_percent || 0))

      case 'start_time':
        // Sort by created timestamp (newest first)
        return containers.sort((a, b) => {
          const dateA = new Date(a.created).getTime()
          const dateB = new Date(b.created).getTime()
          return dateB - dateA
        })

      default:
        return containers
    }
  }, [allContainers, sortKey])

  // Show top 5 after sorting
  const displayContainers = sortedContainers.slice(0, 5)

  const getStatusColor = (state: string) => {
    switch (state.toLowerCase()) {
      case 'running':
        return 'text-green-500 fill-green-500'
      case 'exited':
      case 'stopped':
        return 'text-red-500 fill-red-500'
      case 'paused':
        return 'text-yellow-500 fill-yellow-500'
      case 'restarting':
        return 'text-blue-500 fill-blue-500'
      default:
        return 'text-muted-foreground fill-muted-foreground'
    }
  }

  const getStatusTextColor = (state: string) => {
    switch (state.toLowerCase()) {
      case 'running':
        return 'text-green-500'
      case 'exited':
      case 'stopped':
        return 'text-red-500'
      case 'paused':
        return 'text-yellow-500'
      case 'restarting':
        return 'text-blue-500'
      default:
        return 'text-muted-foreground'
    }
  }

  const getSortLabel = (key: SortKey): string => {
    switch (key) {
      case 'name':
        return '名称 (A–Z)'
      case 'state':
        return '状态 (运行优先)'
      case 'cpu':
        return 'CPU (从高到低)'
      case 'memory':
        return '内存 (从高到低)'
      case 'start_time':
        return '启动时间 (最新优先)'
      default:
        return '排序依据'
    }
  }

  // Handle sort change and save to preferences
  const handleSortChange = (newSort: SortKey) => {
    setSortKey(newSort)
    updatePreferences.mutate({
      hostContainerSorts: {
        ...(prefs?.hostContainerSorts || {}),
        [hostId]: newSort,
      },
    })
  }

  return (
    <DrawerSection title="容器">
      {allContainers.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          <Box className="h-12 w-12 mx-auto mb-3 opacity-50" />
          <p className="text-sm">暂未在此主机上找到容器</p>
        </div>
      ) : (
        <div className="space-y-3">
          {/* Sort Dropdown */}
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">
              正在展示 {displayContainers.length} / {allContainers.length}
            </span>
            <DropdownMenu
              trigger={
                <button className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors">
                  <span>{getSortLabel(sortKey)}</span>
                  <ChevronDown className="h-3 w-3" />
                </button>
              }
              align="end"
            >
              <DropdownMenuItem onClick={() => handleSortChange('state')}>
                状态 (运行优先)
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleSortChange('name')}>
                名称 (A–Z)
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleSortChange('cpu')}>
                CPU (从高到低)
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleSortChange('memory')}>
                内存 (从高到低)
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleSortChange('start_time')}>
                启动时间 (最新优先)
              </DropdownMenuItem>
            </DropdownMenu>
          </div>

          {/* Container List */}
          {displayContainers.map((container) => (
            <div
              key={container.id}
              className="flex items-center gap-3 p-3 rounded-lg bg-muted hover:bg-muted/80 transition-colors"
            >
              {/* Status dot */}
              <Circle className={`h-2 w-2 ${getStatusColor(container.state)}`} />

              {/* Container name */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{container.name}</p>
              </div>

              {/* State */}
              <div className={`text-sm capitalize font-medium ${getStatusTextColor(container.state)}`}>
                {{
                  running: "运行中",
                  stopped: "已停止",
                  exited: "已暂停",
                  created: "已创建",
                  paused: "已暂停",
                  restarting: "重启中",
                  removing: "删除中",
                  dead: "已死亡",
                }[container.state.toLowerCase()]}
              </div>
            </div>
          ))}

          {/* View All Link */}
          <Link
            to={`/containers?hostId=${hostId}`}
            className="flex items-center justify-center gap-2 p-3 rounded-lg border border-border hover:bg-muted transition-colors text-sm text-muted-foreground hover:text-foreground"
          >
            <span>查看此主机上的全部 {allContainers.length} 个容器</span>
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      )}
    </DrawerSection>
  )
}
