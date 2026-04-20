/**
 * Create User Modal
 * Form to create a new user with group selection
 *
 * Group-Based Permissions Refactor (v2.4.0)
 */

import { useState, type FormEvent } from 'react'
import { X, Eye, EyeOff, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useCreateUser } from '@/hooks/useUsers'
import { useGroups } from '@/hooks/useGroups'
import type { CreateUserRequest } from '@/types/users'
import { toast } from 'sonner'

interface CreateUserModalProps {
  isOpen: boolean
  onClose: () => void
}

export function CreateUserModal({ isOpen, onClose }: CreateUserModalProps) {
  const createUser = useCreateUser()
  const { data: groupsData, isLoading: loadingGroups } = useGroups()

  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [selectedGroupIds, setSelectedGroupIds] = useState<Set<number>>(new Set())
  const [mustChangePassword, setMustChangePassword] = useState(true)
  const [showPassword, setShowPassword] = useState(false)

  const groups = groupsData?.groups || []

  if (!isOpen) return null

  const handleGroupToggle = (groupId: number) => {
    setSelectedGroupIds((prev) => {
      const next = new Set(prev)
      if (next.has(groupId)) {
        next.delete(groupId)
      } else {
        next.add(groupId)
      }
      return next
    })
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()

    // Validation
    const trimmedUsername = username.trim()
    if (!trimmedUsername) {
      toast.error('用户名为必填项')
      return
    }

    if (trimmedUsername.length < 3) {
      toast.error('用户名必须至少为 3 个字符')
      return
    }

    if (trimmedUsername.length > 32) {
      toast.error('用户名不能超过 32 个字符')
      return
    }

    if (!/^[a-zA-Z][a-zA-Z0-9_-]*$/.test(trimmedUsername)) {
      toast.error('用户名必须以字母开头，并且只能包含字母、数字、下划线和连字符')
      return
    }

    // Check for reserved usernames
    const reservedNames = ['admin', 'root', 'system', 'administrator', 'guest', 'api', 'auth', 'oauth', 'oidc']
    if (reservedNames.includes(trimmedUsername.toLowerCase())) {
      toast.error(`用户名 "${trimmedUsername}" 为系统保留名称`)
      return
    }

    if (!password) {
      toast.error('密码为必填项')
      return
    }

    if (password.length < 8) {
      toast.error('密码必须至少为 8 个字符')
      return
    }

    if (password !== confirmPassword) {
      toast.error('密码与确认密码不同')
      return
    }

    if (selectedGroupIds.size === 0) {
      toast.error('请选择一个用户群组')
      return
    }

    try {
      const request: CreateUserRequest = {
        username: username.trim(),
        password,
        group_ids: Array.from(selectedGroupIds),
        must_change_password: mustChangePassword,
      }

      if (email.trim()) {
        request.email = email.trim()
      }

      if (displayName.trim()) {
        request.display_name = displayName.trim()
      }

      await createUser.mutateAsync(request)

      // Reset form
      resetForm()
      onClose()
    } catch {
      // Error handled by mutation
    }
  }

  const resetForm = () => {
    setUsername('')
    setEmail('')
    setDisplayName('')
    setPassword('')
    setConfirmPassword('')
    setSelectedGroupIds(new Set())
    setMustChangePassword(true)
    setShowPassword(false)
  }

  const handleClose = () => {
    if (createUser.isPending) return
    resetForm()
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="mx-4 max-h-[90vh] w-full max-w-md overflow-y-auto rounded-lg border border-gray-800 bg-gray-900">
        {/* Header */}
        <div className="sticky top-0 flex items-center justify-between border-b border-gray-800 bg-gray-900 px-6 py-4">
          <h2 className="text-lg font-semibold text-white">创建用户</h2>
          <button
            onClick={handleClose}
            disabled={createUser.isPending}
            className="text-gray-400 hover:text-gray-300"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-5 p-6">
          {/* Username */}
          <div>
            <label className="mb-2 block text-sm font-medium text-gray-300">用户名 *</label>
            <Input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="例如: johndoe"
              disabled={createUser.isPending}
              className="w-full"
            />
            <p className="mt-1 text-xs text-gray-500">
              必须以字母开头，并且只能包含字母、数字、下划线和连字符。
            </p>
          </div>

          {/* Display Name */}
          <div>
            <label className="mb-2 block text-sm font-medium text-gray-300">昵称</label>
            <Input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="例如: John Doe"
              disabled={createUser.isPending}
              className="w-full"
            />
            <p className="mt-1 text-xs text-gray-500">如何优雅的展示你的用户名 (可选)</p>
          </div>

          {/* Email */}
          <div>
            <label className="mb-2 block text-sm font-medium text-gray-300">邮箱</label>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="例如: john@example.com"
              disabled={createUser.isPending}
              className="w-full"
            />
            <p className="mt-1 text-xs text-gray-500">
              用于重置密码和 OIDC 配置 (可选)
            </p>
          </div>

          {/* Password */}
          <div>
            <label className="mb-2 block text-sm font-medium text-gray-300">密码 *</label>
            <div className="relative">
              <Input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="不少于 8 个字符"
                disabled={createUser.isPending}
                className="w-full pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-300"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {/* Confirm Password */}
          <div>
            <label className="mb-2 block text-sm font-medium text-gray-300">确认密码 *</label>
            <Input
              type={showPassword ? 'text' : 'password'}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="请再次输入密码"
              disabled={createUser.isPending}
              className="w-full"
            />
          </div>

          {/* Group Selection */}
          <div>
            <label className="mb-3 block text-sm font-medium text-gray-300">
              用户群组 * <span className="text-xs text-gray-500">(请至少选择一个)</span>
            </label>
            {loadingGroups ? (
              <div className="text-sm text-gray-500">加载用户群组中...</div>
            ) : groups.length === 0 ? (
              <div className="rounded-lg border border-yellow-900/30 bg-yellow-900/10 p-3 text-sm text-yellow-300">
                没有可用的群组，请先前往群组管理页面创建一个用户群组。
              </div>
            ) : (
              <div className="space-y-2">
                {groups.map((group) => (
                  <label
                    key={group.id}
                    className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors ${
                      selectedGroupIds.has(group.id)
                        ? 'border-blue-500 bg-blue-900/30'
                        : 'border-gray-700 bg-gray-800/50 hover:border-gray-600'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={selectedGroupIds.has(group.id)}
                      onChange={() => handleGroupToggle(group.id)}
                      disabled={createUser.isPending}
                      className="mt-0.5 h-4 w-4 rounded border-gray-600 bg-gray-800 text-blue-600 focus:ring-blue-500"
                    />
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <Users className="h-4 w-4 text-blue-400" />
                        <span className="font-medium text-white">{group.name}{group.is_system ? ` (${{'Administrators': "管理群组", 'Operators': "操作群组", 'Read Only': "访客群组"}[group.name]})` : ""}</span>
                        {group.is_system && (
                          <span className="rounded bg-gray-700 px-1.5 py-0.5 text-xs text-gray-400">
                            系统群组
                          </span>
                        )}
                      </div>
                      {group.description && (
                        <div className="mt-1 text-xs text-gray-400">{group.description}</div>
                      )}
                    </div>
                  </label>
                ))}
              </div>
            )}
          </div>

          {/* Must Change Password */}
          <div>
            <label className="flex cursor-pointer items-center gap-3">
              <input
                type="checkbox"
                checked={mustChangePassword}
                onChange={(e) => setMustChangePassword(e.target.checked)}
                disabled={createUser.isPending}
                className="h-4 w-4 rounded border-gray-600 bg-gray-800 text-blue-600 focus:ring-blue-500"
              />
              <div>
                <span className="text-sm font-medium text-gray-300">
                  首次登录后需要更改密码
                </span>
                <p className="text-xs text-gray-500">建议启用以提升安全性</p>
              </div>
            </label>
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-2">
            <Button type="submit" disabled={createUser.isPending} className="flex-1">
              {createUser.isPending ? '创建中...' : '创建用户'}
            </Button>
            <Button
              type="button"
              onClick={handleClose}
              disabled={createUser.isPending}
              variant="outline"
              className="flex-1"
            >
              取消
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
