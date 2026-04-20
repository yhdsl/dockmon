/**
 * Change Password Modal
 *
 * SECURITY:
 * - Forces password change on first login
 * - Validates password strength
 * - Cannot be dismissed if is_first_login is true
 *
 * DESIGN:
 * - Modal dialog that blocks interaction
 * - Clear validation messages
 * - WCAG 2.1 AA accessible
 */

import { useState, type FormEvent } from 'react'
import { Lock, X } from 'lucide-react'
import { apiClient, ApiError } from '@/lib/api/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useQueryClient } from '@tanstack/react-query'

interface ChangePasswordModalProps {
  isOpen: boolean
  onClose: () => void
  isRequired: boolean // If true, modal cannot be closed
}

export function ChangePasswordModal({
  isOpen,
  onClose,
  isRequired,
}: ChangePasswordModalProps) {
  const queryClient = useQueryClient()
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)

    // Validation
    if (!currentPassword || !newPassword || !confirmPassword) {
      setError('请填写所有字段内容')
      return
    }

    if (newPassword.length < 8) {
      setError('新密码长度必须至少为 8 个字符')
      return
    }

    if (newPassword === currentPassword) {
      setError('新密码必须与当前密码不同')
      return
    }

    if (newPassword !== confirmPassword) {
      setError('新密码与确认密码不同')
      return
    }

    setIsSubmitting(true)

    try {
      // Call password change API (v2 endpoint with cookie auth)
      await apiClient.post('/v2/auth/change-password', {
        current_password: currentPassword,
        new_password: newPassword,
      })

      // Invalidate user query to refetch (will update is_first_login)
      await queryClient.invalidateQueries({ queryKey: ['auth', 'currentUser'] })

      // Clear form
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')

      // Close modal
      onClose()
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 401) {
          setError('当前密码不正确')
        } else if (err.status === 400) {
          const msg = (err.message || '').toLowerCase()
          if (msg.includes('same as') || msg.includes('reuse')) {
            setError('新密码不能与旧密码相同')
          } else if (msg.includes('too short') || msg.includes('min')) {
            setError('新密码未能满足最小字符长度要求')
          } else {
            setError('无效的密码。请检查密码要求后重试。')
          }
        } else {
          setError('修改密码时失败，请再试一次。')
        }
      } else {
        setError('连接错误。请检查后端服务是否正常运行。')
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={isRequired ? undefined : onClose}
    >
      <div
        className="relative w-full max-w-md rounded-2xl border border-border bg-background p-6 shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
              <Lock className="h-6 w-6 text-primary" />
            </div>
            <h2 className="text-xl font-semibold">
              {isRequired ? '更改你的密码' : '重置密码'}
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              {isRequired
                ? '出于安全原因，必须先更改密码才能继续使用。'
                : '请输入当前密码并设置一个新密码。'}
            </p>
          </div>
          {!isRequired && (
            <button
              onClick={onClose}
              className="rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100"
            >
              <X className="h-4 w-4" />
              <span className="sr-only">关闭</span>
            </button>
          )}
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Error Alert */}
          {error && (
            <div
              role="alert"
              className="rounded-lg border-l-4 border-danger bg-danger/10 p-3 text-sm text-danger"
            >
              {error}
            </div>
          )}

          {/* Current Password */}
          <div>
            <label
              htmlFor="current-password"
              className="block text-sm font-medium mb-1"
            >
              当前密码 <span className="text-destructive">*</span>
            </label>
            <Input
              id="current-password"
              type="password"
              value={currentPassword}
              onChange={(e) => {
                setCurrentPassword(e.target.value)
                if (error) setError(null)
              }}
              disabled={isSubmitting}
              autoComplete="current-password"
              autoFocus
              required
            />
          </div>

          {/* New Password */}
          <div>
            <label
              htmlFor="new-password"
              className="block text-sm font-medium mb-1"
            >
              新密码 <span className="text-destructive">*</span>
            </label>
            <Input
              id="new-password"
              type="password"
              value={newPassword}
              onChange={(e) => {
                setNewPassword(e.target.value)
                if (error) setError(null)
              }}
              disabled={isSubmitting}
              autoComplete="new-password"
              required
              minLength={8}
            />
            <p className="text-xs text-muted-foreground mt-1">
              至少为 8 个字符
            </p>
          </div>

          {/* Confirm New Password */}
          <div>
            <label
              htmlFor="confirm-password"
              className="block text-sm font-medium mb-1"
            >
              确认新的密码 <span className="text-destructive">*</span>
            </label>
            <Input
              id="confirm-password"
              type="password"
              value={confirmPassword}
              onChange={(e) => {
                setConfirmPassword(e.target.value)
                if (error) setError(null)
              }}
              disabled={isSubmitting}
              autoComplete="new-password"
              required
            />
          </div>

          {/* Buttons */}
          <div className="flex gap-2 pt-2">
            {!isRequired && (
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                disabled={isSubmitting}
                className="flex-1"
              >
                取消
              </Button>
            )}
            <Button
              type="submit"
              disabled={isSubmitting}
              className={isRequired ? 'w-full' : 'flex-1'}
            >
              {isSubmitting ? (
                <>
                  <span className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
                  重置中...
                </>
              ) : (
                '重置密码'
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
