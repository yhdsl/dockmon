/**
 * Warning banner listing host-port conflicts for the selected target host.
 *
 * Rendered between the host selector and the action-button row in StackEditor.
 * Hidden when there are no conflicts. Shows a neutral "check skipped" variant
 * when the validation request errors (e.g., host offline).
 */

import { AlertTriangle, Info } from 'lucide-react'

import type { PortConflict } from '../types'

interface PortConflictBannerProps {
  conflicts: PortConflict[]
  isLoading: boolean
  error: Error | null
  hostName: string
}

export function PortConflictBanner({
  conflicts,
  isLoading,
  error,
  hostName,
}: PortConflictBannerProps) {
  if (isLoading) return null

  if (error) {
    return (
      <div className="flex items-start gap-3 rounded-lg border border-border bg-muted/30 p-3 text-sm">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        <div className="text-muted-foreground">
          已跳过端口冲突检查 — 无法连接到 <strong>{hostName}</strong>。部署将按照正常流程继续尝试。
        </div>
      </div>
    )
  }

  if (conflicts.length === 0) return null

  return (
    <div className="flex items-start gap-3 rounded-lg border border-warning/30 bg-warning/10 p-3 text-sm">
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" aria-hidden="true" />
      <div className="space-y-1">
        <p className="font-medium text-warning">
          {hostName}上存在端口冲突
        </p>
        <ul className="space-y-0.5 text-muted-foreground">
          {conflicts.map((c) => (
            <li key={`${c.port}-${c.protocol}-${c.container_id}`}>
              端口 <code className="rounded bg-warning/20 px-1 text-foreground">{c.port}/{c.protocol}</code>{' '}
              已被 <strong className="text-foreground">{c.container_name}</strong> 使用
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
