/**
 * No Channels Confirmation Modal
 *
 * Displays a warning when attempting to create/edit an alert rule
 * without any notification channels selected.
 */

import { AlertTriangle } from 'lucide-react'
import { RemoveScroll } from 'react-remove-scroll'
import { Button } from '@/components/ui/button'

interface NoChannelsConfirmModalProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => void
  hasConfiguredChannels: boolean
}

export function NoChannelsConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  hasConfiguredChannels
}: NoChannelsConfirmModalProps) {
  if (!isOpen) return null

  const handleConfirm = () => {
    onConfirm()
    onClose()
  }

  // Prevent event bubbling to backdrop
  const handleModalClick = (e: React.MouseEvent) => {
    e.stopPropagation()
  }

  return (
    <RemoveScroll>
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
        aria-labelledby="no-channels-modal-title"
      >
        {/* Header */}
        <div className="p-6 pb-4">
          <div className="flex items-start gap-4">
            <div className="flex-shrink-0 text-yellow-400">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div className="flex-1">
              <h2
                id="no-channels-modal-title"
                className="text-lg font-semibold text-text-primary"
              >
                未选择通知频道
              </h2>
              <p className="mt-1 text-sm text-text-secondary">
                因此该告警规则将不会发送任何通知
              </p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="px-6 pb-4">
          <div className="bg-surface-2 rounded-md p-4 border border-border/50">
            <p className="text-sm text-text-secondary mb-3">
              {hasConfiguredChannels
                ? "你尚未为此告警规则选择任意一个通知频道。"
                : "你尚未在设置中创建通知渠道。"}
            </p>

            <div className="space-y-2">
              <div className="flex items-start gap-2">
                <span className="text-sm text-text-primary flex-1">
                  <strong>这意味着:</strong>
                  <ul className="list-disc list-inside mt-1 space-y-1 text-text-secondary">
                    <li>当满足条件时将会触发告警</li>
                    <li>在告警页面中将会限制告警内容</li>
                    <li>
                      <strong className="text-yellow-400">但不会发送任何通知</strong>{' '}
                      (例如电子邮件、Telegram 等)
                    </li>
                  </ul>
                </span>
              </div>
            </div>
          </div>

          <div className="mt-4 bg-yellow-500/10 border border-yellow-500/20 rounded-md p-3">
            <p className="text-xs text-yellow-200/90">
              {hasConfiguredChannels ? (
                <>
                  <strong>强烈建议:</strong> 返回并至少选择一个通知频道，
                  以便通过电子邮件、Telegram、Discord 或其他通知服务接收告警。
                </>
              ) : (
                <>
                  <strong>强烈建议:</strong> 创建告警规则前，在设置 {'>'}{' '}
                  通知选项中创建至少一个通知频道。
                </>
              )}
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-surface-2 rounded-b-lg border-t border-border flex justify-end gap-3">
          <Button variant="outline" onClick={onClose} className="min-w-[100px]">
            返回
          </Button>
          <Button
            variant="default"
            onClick={handleConfirm}
            className="min-w-[120px] bg-yellow-600 hover:bg-yellow-700 text-white"
          >
            仍然创建
          </Button>
        </div>
      </div>
    </div>
    </RemoveScroll>
  )
}
