/**
 * Update Validation Confirmation Modal
 *
 * Displays a confirmation dialog when attempting to update a container
 * that matches a validation pattern (WARN level).
 *
 * Follows the pattern from BulkActionConfirmModal.tsx for consistency.
 */

import { AlertTriangle, Database, Network, Activity, Shield } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { UpdatePolicyCategory } from '../types/updatePolicy'

interface UpdateValidationConfirmModalProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => void
  containerName: string
  reason: string
  matchedPattern?: string | undefined
  category?: UpdatePolicyCategory | undefined
}

/**
 * Get icon for validation category
 */
function getCategoryIcon(category?: UpdatePolicyCategory) {
  switch (category) {
    case 'databases':
      return Database
    case 'proxies':
      return Network
    case 'monitoring':
      return Activity
    case 'critical':
      return Shield
    default:
      return AlertTriangle
  }
}

/**
 * Get color class for validation category
 */
function getCategoryColor(category?: UpdatePolicyCategory): string {
  switch (category) {
    case 'databases':
      return 'text-blue-400'
    case 'proxies':
      return 'text-purple-400'
    case 'monitoring':
      return 'text-green-400'
    case 'critical':
      return 'text-red-400'
    default:
      return 'text-yellow-400'
  }
}

export function UpdateValidationConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  containerName,
  reason,
  matchedPattern,
  category
}: UpdateValidationConfirmModalProps) {
  if (!isOpen) return null

  const Icon = getCategoryIcon(category)
  const iconColor = getCategoryColor(category)

  const handleConfirm = () => {
    onConfirm()
    onClose()
  }

  // Prevent event bubbling to backdrop
  const handleModalClick = (e: React.MouseEvent) => {
    e.stopPropagation()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop - clickable to close */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal Container */}
      <div
        className="relative bg-surface-1 rounded-lg shadow-xl border border-border max-w-md w-full"
        onClick={handleModalClick}
        role="dialog"
        aria-modal="true"
        aria-labelledby="validation-modal-title"
      >
        {/* Header */}
        <div className="p-6 pb-4">
          <div className="flex items-start gap-4">
            <div className={`flex-shrink-0 ${iconColor}`}>
              <Icon className="w-6 h-6" />
            </div>
            <div className="flex-1">
              <h2
                id="validation-modal-title"
                className="text-lg font-semibold text-text-primary"
              >
                确认更新容器
              </h2>
              <p className="mt-1 text-sm text-text-secondary">
                {containerName}
              </p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="px-6 pb-4">
          <div className="bg-surface-2 rounded-md p-4 border border-border/50">
            <p className="text-sm text-text-secondary mb-3">
              该容器在更新模式验证中存在警告，这意味着可能在更新前需要额外注意:
            </p>

            <div className="space-y-2">
              <div className="flex items-start gap-2">
                <span className="text-xs font-medium text-text-tertiary uppercase tracking-wider">
                  原因:
                </span>
                <span className="text-sm text-text-primary flex-1">{reason}</span>
              </div>

              {matchedPattern && (
                <div className="flex items-start gap-2">
                  <span className="text-xs font-medium text-text-tertiary uppercase tracking-wider">
                    模式:
                  </span>
                  <span className="text-sm font-mono text-text-primary bg-surface-3 px-2 py-0.5 rounded">
                    {matchedPattern}
                  </span>
                </div>
              )}
            </div>
          </div>

          <div className="mt-4 bg-yellow-500/10 border border-yellow-500/20 rounded-md p-3">
            <p className="text-xs text-yellow-200/90">
              <strong>强烈建议:</strong> 在继续更新之前，请检查更新说明并确保已进行备份。
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-surface-2 rounded-b-lg border-t border-border flex justify-end gap-3">
          <Button variant="outline" onClick={onClose} className="min-w-[100px]">
            取消
          </Button>
          <Button
            variant="default"
            onClick={handleConfirm}
            className="min-w-[120px] bg-yellow-600 hover:bg-yellow-700 text-white"
          >
            仍然更新
          </Button>
        </div>
      </div>
    </div>
  )
}
