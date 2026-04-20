/**
 * Edit User Modal
 * Form to edit an existing user's details and group membership
 *
 * Group-Based Permissions Refactor (v2.4.0)
 */

import { useState, useEffect, type FormEvent } from 'react'
import { X, Loader2, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useUser, useUpdateUser } from '@/hooks/useUsers'
import { useGroups } from '@/hooks/useGroups'
import type { UpdateUserRequest } from '@/types/users'
import { toast } from 'sonner'

interface EditUserModalProps {
  isOpen: boolean
  onClose: () => void
  userId: number
}

export function EditUserModal({ isOpen, onClose, userId }: EditUserModalProps) {
  // Only fetch user data when modal is open and we have a valid userId
  const { data: user, isLoading } = useUser(isOpen && userId > 0 ? userId : null)
  const { data: groupsData, isLoading: loadingGroups } = useGroups()
  const updateUser = useUpdateUser()

  const [email, setEmail] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [selectedGroupIds, setSelectedGroupIds] = useState<Set<number>>(new Set())

  const groups = groupsData?.groups || []

  // Initialize form when user data loads
  useEffect(() => {
    if (user) {
      setEmail(user.email || '')
      setDisplayName(user.display_name || '')
      // Initialize selected groups from user's current groups
      setSelectedGroupIds(new Set(user.groups?.map((g) => g.id) || []))
    }
  }, [user])

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

    if (!user) return

    if (selectedGroupIds.size === 0) {
      toast.error('用户必须加入一个用户群组')
      return
    }

    try {
      const request: UpdateUserRequest = {}

      // Only include fields that changed
      const newEmail = email.trim() || null
      const newDisplayName = displayName.trim() || null

      if (newEmail !== user.email) {
        request.email = newEmail
      }

      if (newDisplayName !== user.display_name) {
        request.display_name = newDisplayName
      }

      // Check if groups changed
      const currentGroupIds = new Set(user.groups?.map((g) => g.id) || [])
      const selectedGroupIdsArray = Array.from(selectedGroupIds)
      const groupsChanged =
        currentGroupIds.size !== selectedGroupIds.size ||
        selectedGroupIdsArray.some((id) => !currentGroupIds.has(id))

      if (groupsChanged) {
        request.group_ids = selectedGroupIdsArray
      }

      // Check if anything changed
      if (Object.keys(request).length === 0) {
        toast.info('没有更改可供保存')
        onClose()
        return
      }

      await updateUser.mutateAsync({ userId, data: request })
      onClose()
    } catch {
      // Error handled by mutation
    }
  }

  const handleClose = () => {
    if (updateUser.isPending) return
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="mx-4 max-h-[90vh] w-full max-w-md overflow-y-auto rounded-lg border border-gray-800 bg-gray-900">
        {/* Header */}
        <div className="sticky top-0 flex items-center justify-between border-b border-gray-800 bg-gray-900 px-6 py-4">
          <h2 className="text-lg font-semibold text-white">编辑用户</h2>
          <button
            onClick={handleClose}
            disabled={updateUser.isPending}
            className="text-gray-400 hover:text-gray-300"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        {isLoading || loadingGroups ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
          </div>
        ) : !user ? (
          <div className="py-12 text-center text-gray-400">用户未找到</div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5 p-6">
            {/* Username (read-only) */}
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-300">用户名</label>
              <Input
                type="text"
                value={user.username}
                disabled
                className="w-full bg-gray-800/50 text-gray-400"
              />
              <p className="mt-1 text-xs text-gray-500">无法修改用户名</p>
            </div>

            {/* Display Name */}
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-300">昵称</label>
              <Input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="例如: John Doe"
                disabled={updateUser.isPending}
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
                disabled={updateUser.isPending}
                className="w-full"
              />
              <p className="mt-1 text-xs text-gray-500">
                用于重置密码和 OIDC 配置 (可选)
              </p>
            </div>

            {/* Group Selection */}
            <div>
              <label className="mb-3 block text-sm font-medium text-gray-300">
                用户群组 <span className="text-xs text-gray-500">(请至少选择一个)</span>
              </label>
              {groups.length === 0 ? (
                <div className="rounded-lg border border-yellow-900/30 bg-yellow-900/10 p-3 text-sm text-yellow-300">
                  没有可用的用户群组。
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
                        disabled={updateUser.isPending}
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

            {/* Auth Provider Info */}
            {user.auth_provider === 'oidc' && (
              <div className="rounded-lg border border-cyan-900/30 bg-cyan-900/10 p-3">
                <p className="text-sm text-cyan-300">
                  这是一个 SSO 用户。其所在的用户群组可能会在下次登录时被 OIDC 映射所覆盖更新。
                </p>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-2 pt-2">
              <Button type="submit" disabled={updateUser.isPending} className="flex-1">
                {updateUser.isPending ? '保存中...' : '保存更改'}
              </Button>
              <Button
                type="button"
                onClick={handleClose}
                disabled={updateUser.isPending}
                variant="outline"
                className="flex-1"
              >
                取消
              </Button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
