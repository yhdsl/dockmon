/**
 * Registry Credentials Settings Component
 * Manage authentication credentials for private container registries
 */

import { useState } from 'react'
import { Trash2, Plus, Edit2, AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  useRegistryCredentials,
  useCreateRegistryCredential,
  useUpdateRegistryCredential,
  useDeleteRegistryCredential,
} from '@/hooks/useRegistryCredentials'
import type { RegistryCredential } from '@/types/api'
import { useAuth } from '@/features/auth/AuthContext'

export function RegistryCredentialsSettings() {
  const { hasCapability } = useAuth()
  const canView = hasCapability('registry.view')
  const canManage = hasCapability('registry.manage')
  const { data: credentials, isLoading } = useRegistryCredentials()
  const [showAddModal, setShowAddModal] = useState(false)
  const [editingCredential, setEditingCredential] = useState<RegistryCredential | null>(null)
  const [deletingId, setDeletingId] = useState<number | null>(null)

  if (!canView) return null

  return (
    <div>
      <div className="mb-4">
        <h3 className="text-lg font-semibold text-foreground">注册表凭证</h3>
        <p className="text-xs text-muted-foreground mt-1">
          为私有镜像注册表网站配置登录凭证
        </p>
      </div>

      {/* Security Notice */}
      <div className="mb-4 rounded-md border border-yellow-900/50 bg-yellow-950/20 px-4 py-3">
        <div className="flex gap-2">
          <AlertTriangle className="h-5 w-5 text-yellow-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-yellow-200">安全提示</p>
            <p className="text-xs text-yellow-300/80 mt-1">
              在存储前凭证内容将会被加密。
              然而，如果数据库和加密密钥同时泄露，登录凭证仍有可能被解密。请查看官方文档以了解详情。
            </p>
          </div>
        </div>
      </div>

      {/* Credentials Table */}
      <div className="rounded-md border border-border bg-surface-1">
        {isLoading ? (
          <div className="px-4 py-8 text-center text-sm text-muted-foreground">
            加载登录凭证中...
          </div>
        ) : credentials && credentials.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border text-left">
                  <th className="px-4 py-3 text-xs font-medium text-muted-foreground uppercase">注册表 URL</th>
                  <th className="px-4 py-3 text-xs font-medium text-muted-foreground uppercase">用户名</th>
                  <th className="px-4 py-3 text-xs font-medium text-muted-foreground uppercase">创建于</th>
                  <th className="px-4 py-3 text-xs font-medium text-muted-foreground uppercase w-24">凭证操作</th>
                </tr>
              </thead>
              <tbody>
                {credentials.map((cred) => (
                  <tr key={cred.id} className="border-b border-border/50 last:border-0 hover:bg-muted/30">
                    <td className="px-4 py-3 text-sm text-foreground font-mono">{cred.registry_url}</td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">{cred.username}</td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">
                      {new Date(cred.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3">
                      <fieldset disabled={!canManage} className="flex gap-2 disabled:opacity-60">
                        <button
                          onClick={() => setEditingCredential(cred)}
                          className="p-1 text-muted-foreground hover:text-primary transition-colors"
                          title="编辑凭证"
                        >
                          <Edit2 className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => setDeletingId(cred.id)}
                          className="p-1 text-muted-foreground hover:text-danger transition-colors"
                          title="删除凭证"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </fieldset>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="px-4 py-8 text-center">
            <p className="text-sm text-muted-foreground">尚未配置任何登录凭证</p>
            <p className="text-xs text-muted-foreground/70 mt-1">
              请添加一个凭证以登录私有的容器镜像注册表网站
            </p>
          </div>
        )}
      </div>

      {/* Add Credential Button */}
      <div className="mt-4">
        <Button onClick={() => setShowAddModal(true)} variant="outline" size="sm" disabled={!canManage}>
          <Plus className="h-4 w-4 mr-2" />
          添加凭证
        </Button>
      </div>

      {/* Add/Edit Modal */}
      {(showAddModal || editingCredential) && (
        <CredentialModal
          credential={editingCredential}
          disabled={!canManage}
          onClose={() => {
            setShowAddModal(false)
            setEditingCredential(null)
          }}
        />
      )}

      {/* Delete Confirmation */}
      {deletingId !== null && (
        <DeleteConfirmationDialog
          credentialId={deletingId}
          registryUrl={credentials?.find((c) => c.id === deletingId)?.registry_url || ''}
          disabled={!canManage}
          onClose={() => setDeletingId(null)}
        />
      )}
    </div>
  )
}

// ==================== Add/Edit Modal ====================

interface CredentialModalProps {
  credential: RegistryCredential | null
  disabled?: boolean
  onClose: () => void
}

function CredentialModal({ credential, disabled, onClose }: CredentialModalProps) {
  const createMutation = useCreateRegistryCredential()
  const updateMutation = useUpdateRegistryCredential()

  const [registryUrl, setRegistryUrl] = useState(credential?.registry_url || '')
  const [username, setUsername] = useState(credential?.username || '')
  const [password, setPassword] = useState('')

  const isEditing = credential !== null
  const isLoading = createMutation.isPending || updateMutation.isPending

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (isEditing) {
      // Update existing credential
      const data: { username?: string; password?: string } = {}
      if (username !== credential.username) {
        data.username = username
      }
      if (password) {
        data.password = password
      }

      if (Object.keys(data).length === 0) {
        onClose()
        return
      }

      await updateMutation.mutateAsync({ id: credential.id, data })
      onClose()
    } else {
      // Create new credential
      await createMutation.mutateAsync({ registry_url: registryUrl, username, password })
      onClose()
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div
        className="bg-surface rounded-lg shadow-xl max-w-md w-full mx-4 border border-border"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 py-4 border-b border-border">
          <h3 className="text-lg font-semibold text-foreground">
            {isEditing ? '编辑注册表凭证' : '添加注册表凭证'}
          </h3>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-4 space-y-4">
          <fieldset disabled={disabled} className="space-y-4 disabled:opacity-60">
          {/* Registry URL */}
          <div>
            <label htmlFor="registry-url" className="block text-sm font-medium text-muted-foreground mb-2">
              注册表 URL
            </label>
            <input
              id="registry-url"
              type="text"
              value={registryUrl}
              onChange={(e) => setRegistryUrl(e.target.value)}
              disabled={isEditing}
              placeholder="例如 ghcr.io 或 registry.example.com"
              className="w-full rounded-md border border-border bg-surface-1 px-3 py-2 text-foreground placeholder-muted-foreground/50 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50 disabled:cursor-not-allowed"
              required={!isEditing}
            />
            {isEditing && (
              <p className="text-xs text-muted-foreground/70 mt-1">无法修改注册表 URL</p>
            )}
          </div>

          {/* Username */}
          <div>
            <label htmlFor="username" className="block text-sm font-medium text-muted-foreground mb-2">
              用户名
            </label>
            <input
              id="username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="注册表用户名"
              className="w-full rounded-md border border-border bg-surface-1 px-3 py-2 text-foreground placeholder-muted-foreground/50 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              required={!isEditing}
            />
          </div>

          {/* Password */}
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-muted-foreground mb-2">
              {isEditing ? '修改密码 (可选)' : '密码'}
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={isEditing ? '留空以使用之前保存的密码' : '密码或访问令牌'}
              className="w-full rounded-md border border-border bg-surface-1 px-3 py-2 text-foreground placeholder-muted-foreground/50 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              required={!isEditing}
            />
          </div>

          {/* Form Actions */}
          <div className="flex gap-3 pt-4">
            <Button type="submit" disabled={isLoading} className="flex-1">
              {isLoading ? '保存中...' : isEditing ? '更新' : '创建'}
            </Button>
            <Button type="button" variant="outline" onClick={onClose} disabled={isLoading}>
              取消
            </Button>
          </div>
          </fieldset>
        </form>
      </div>
    </div>
  )
}

// ==================== Delete Confirmation ====================

interface DeleteConfirmationDialogProps {
  credentialId: number
  registryUrl: string
  disabled?: boolean
  onClose: () => void
}

function DeleteConfirmationDialog({ credentialId, registryUrl, disabled, onClose }: DeleteConfirmationDialogProps) {
  const deleteMutation = useDeleteRegistryCredential()

  const handleDelete = async () => {
    await deleteMutation.mutateAsync(credentialId)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div
        className="bg-surface rounded-lg shadow-xl max-w-md w-full mx-4 border border-border"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 py-4 border-b border-border">
          <h3 className="text-lg font-semibold text-foreground">删除注册表凭证</h3>
        </div>

        <div className="px-6 py-4">
          <p className="text-sm text-muted-foreground">
            确定要删除{' '}
            <span className="font-mono text-foreground">{registryUrl}</span> 的登录凭证吗?
          </p>
          <p className="text-xs text-muted-foreground/70 mt-2">
            如果该镜像注册表需要身份验证，则使用此注册表镜像的容器将无法进行更新检查。
          </p>
        </div>

        <fieldset disabled={disabled} className="px-6 py-4 border-t border-border flex gap-3 disabled:opacity-60">
          <Button
            onClick={handleDelete}
            disabled={deleteMutation.isPending}
            variant="outline"
            className="flex-1 border-red-900 text-red-400 hover:bg-red-950/50"
          >
            {deleteMutation.isPending ? '删除中...' : '删除'}
          </Button>
          <Button variant="outline" onClick={onClose} disabled={deleteMutation.isPending}>
            取消
          </Button>
        </fieldset>
      </div>
    </div>
  )
}
