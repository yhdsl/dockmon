/**
 * User Account Modal
 *
 * Allows users to:
 * - Change their display name
 * - Change their username
 * - Change their password
 */

import { useState, type FormEvent } from 'react'
import { X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ChangePasswordModal } from '@/features/auth/ChangePasswordModal'
import { useAuth } from '@/features/auth/AuthContext'
import { apiClient, ApiError } from '@/lib/api/client'
import { useQueryClient } from '@tanstack/react-query'

interface UserAccountModalProps {
  isOpen: boolean
  onClose: () => void
}

export function UserAccountModal({ isOpen, onClose }: UserAccountModalProps) {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const [showPasswordModal, setShowPasswordModal] = useState(false)
  const [username, setUsername] = useState(user?.username || '')
  const [displayName, setDisplayName] = useState(user?.display_name || '')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const isOIDC = user?.auth_provider === 'oidc'

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setSuccess(null)

    if (!username.trim()) {
      setError('用户名为必填项')
      return
    }

    setIsSubmitting(true)

    try {
      // Update profile
      await apiClient.post('/v2/auth/update-profile', {
        username: username.trim(),
        display_name: displayName.trim() || null,
      })

      // Refetch user data
      await queryClient.invalidateQueries({ queryKey: ['auth', 'currentUser'] })

      setSuccess('已成功更新账户信息!')
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 400) {
          setError(err.message || '用户名已被使用')
        } else {
          setError('无法更新账户信息，请稍后重试。')
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
    <>
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
        onClick={onClose}
      >
        <div
          className="relative w-full max-w-md rounded-2xl border border-border bg-background p-6 shadow-lg"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-xl font-semibold">账户设置</h2>
              <p className="text-sm text-muted-foreground mt-1">
                管理你的账户信息
              </p>
            </div>
            <button
              onClick={onClose}
              className="rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100"
            >
              <X className="h-4 w-4" />
              <span className="sr-only">关闭</span>
            </button>
          </div>

          {/* Content */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Success/Error Messages */}
            {error && (
              <div className="rounded-lg border-l-4 border-danger bg-danger/10 p-3 text-sm text-danger">
                {error}
              </div>
            )}
            {success && (
              <div className="rounded-lg border-l-4 border-success bg-success/10 p-3 text-sm text-success">
                {success}
              </div>
            )}

            {isOIDC ? (
              <div className="rounded-lg border-l-4 border-primary bg-primary/10 p-3 text-sm text-muted-foreground">
                你的账户由 SSO 提供商管理，更改个人资料操作需要前往提供商处进行。
              </div>
            ) : (
              <>
                {/* Display Name */}
                <div>
                  <label htmlFor="displayName" className="block text-sm font-medium mb-1">
                    昵称
                  </label>
                  <Input
                    id="displayName"
                    type="text"
                    value={displayName}
                    onChange={(e) => {
                      setDisplayName(e.target.value)
                      if (error || success) {
                        setError(null)
                        setSuccess(null)
                      }
                    }}
                    disabled={isSubmitting}
                    placeholder="请输入可选的昵称"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    如何优雅的展示你的用户名
                  </p>
                </div>

                {/* Username */}
                <div>
                  <label htmlFor="username" className="block text-sm font-medium mb-1">
                    用户名 <span className="text-destructive">*</span>
                  </label>
                  <Input
                    id="username"
                    type="text"
                    value={username}
                    onChange={(e) => {
                      setUsername(e.target.value)
                      if (error || success) {
                        setError(null)
                        setSuccess(null)
                      }
                    }}
                    disabled={isSubmitting}
                    required
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    用于登录的用户名
                  </p>
                </div>

                {/* Save Button */}
                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full"
                >
                  {isSubmitting ? '保存中...' : '保存更改'}
                </Button>
              </>
            )}
          </form>

          {!isOIDC && (
            <>
              {/* Divider */}
              <div className="my-4 border-t border-border" />

              {/* Password Change Button */}
              <Button
                variant="outline"
                className="w-full"
                onClick={() => setShowPasswordModal(true)}
              >
                修改密码
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Password Change Modal */}
      <ChangePasswordModal
        isOpen={showPasswordModal}
        isRequired={false}
        onClose={() => setShowPasswordModal(false)}
      />
    </>
  )
}
