/**
 * Create API Key Modal
 * Form to create a new API key with group-based permissions
 *
 * Group-Based Permissions Refactor (v2.4.0)
 */

import { useState, type FormEvent } from 'react'
import { X, Users } from 'lucide-react'
import { RemoveScroll } from 'react-remove-scroll'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useCreateApiKey } from '@/hooks/useApiKeys'
import { useGroups } from '@/hooks/useGroups'
import type { CreateApiKeyResponse, CreateApiKeyRequest } from '@/types/api-keys'

interface CreateApiKeyModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: (response: CreateApiKeyResponse) => void
}

export function CreateApiKeyModal({ isOpen, onClose, onSuccess }: CreateApiKeyModalProps) {
  const createKey = useCreateApiKey()
  const { data: groupsData, isLoading: loadingGroups, isError: groupsError } = useGroups()

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [selectedGroupId, setSelectedGroupId] = useState<number | null>(null)
  const [allowedIps, setAllowedIps] = useState('')
  const [expiresDays, setExpiresDays] = useState('')

  const groups = groupsData?.groups || []

  if (!isOpen) return null

  const resetForm = () => {
    setName('')
    setDescription('')
    setSelectedGroupId(null)
    setAllowedIps('')
    setExpiresDays('')
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()

    if (!name.trim()) {
      toast.error('API 密钥名称为必填项')
      return
    }

    if (!selectedGroupId) {
      toast.error('请为此 API 密钥选择一个用户群组')
      return
    }

    try {
      const request: CreateApiKeyRequest = {
        name: name.trim(),
        group_id: selectedGroupId,
      }

      if (description.trim()) {
        request.description = description.trim()
      }

      if (allowedIps.trim()) {
        request.allowed_ips = allowedIps.trim()
      }

      if (expiresDays) {
        request.expires_days = parseInt(expiresDays, 10)
      }

      const response = await createKey.mutateAsync(request)
      resetForm()
      onSuccess(response)
    } catch {
      // Error handled by mutation
    }
  }

  const handleClose = () => {
    if (createKey.isPending) return
    resetForm()
    onClose()
  }

  return (
    <RemoveScroll>
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-gray-900 rounded-lg max-w-md w-full mx-4 border border-gray-800 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-gray-900 border-b border-gray-800 px-6 py-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white">创建 API 密钥</h2>
          <button onClick={handleClose} disabled={createKey.isPending} className="text-gray-400 hover:text-gray-300">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">名称 *</label>
            <Input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="例如: Ansible 自动化"
              disabled={createKey.isPending}
              className="w-full"
            />
            <p className="text-xs text-gray-500 mt-1">此 API 密钥的描述性名称</p>
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">备注</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="此密钥的用途是什么? (可选)"
              disabled={createKey.isPending}
              rows={2}
              className="w-full bg-gray-800 text-white rounded border border-gray-700 px-3 py-2 text-sm focus:border-blue-500 outline-none"
            />
          </div>

          {/* Group Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-3">
              授权群组 *
            </label>
            <p className="text-xs text-gray-500 mb-3">
              此 API 密钥将授予与所选群组相同的权限。
            </p>
            {loadingGroups ? (
              <div className="text-sm text-gray-500">加载用户群组中...</div>
            ) : groupsError ? (
              <div className="rounded-lg border border-red-900/30 bg-red-900/10 p-3 text-sm text-red-300">
                无法加载用户群组，请稍后再试。
              </div>
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
                      selectedGroupId === group.id
                        ? 'border-blue-500 bg-blue-900/30'
                        : 'border-gray-700 bg-gray-800/50 hover:border-gray-600'
                    }`}
                  >
                    <input
                      type="radio"
                      name="group"
                      checked={selectedGroupId === group.id}
                      onChange={() => setSelectedGroupId(group.id)}
                      disabled={createKey.isPending}
                      className="mt-0.5 h-4 w-4 border-gray-600 bg-gray-800 text-blue-600 focus:ring-blue-500"
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

          {/* IP Allowlist */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">IP 白名单 (可选)</label>
            <textarea
              value={allowedIps}
              onChange={(e) => setAllowedIps(e.target.value)}
              placeholder="192.168.1.0/24, 10.0.0.1, 203.0.113.5"
              disabled={createKey.isPending}
              rows={2}
              className="w-full bg-gray-800 text-white rounded border border-gray-700 px-3 py-2 text-sm focus:border-blue-500 outline-none"
            />
            <p className="text-xs text-gray-500 mt-1">
              以英文逗号分隔的 IP 地址或者 CIDR 范围。留空表示不限制访问。此功能需要配合反向代理服务才能正常工作。
            </p>
          </div>

          {/* Expiration */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">过期时间 (可选)</label>
            <select
              value={expiresDays}
              onChange={(e) => setExpiresDays(e.target.value)}
              disabled={createKey.isPending}
              className="w-full bg-gray-800 text-white rounded border border-gray-700 px-3 py-2 text-sm focus:border-blue-500 outline-none"
            >
              <option value="">从不过期</option>
              <option value="30">30 天</option>
              <option value="90">90 天</option>
              <option value="180">6 个月</option>
              <option value="365">1 天</option>
            </select>
            <p className="text-xs text-gray-500 mt-1">在超过指定日期后自动撤销该密钥</p>
          </div>

          {/* Warning */}
          <div className="rounded bg-yellow-900/20 border border-yellow-900/30 p-3">
            <p className="text-xs text-yellow-300">
              <strong>请稍后立即保存密钥。</strong> 该密钥文本只会在创建后显示一次，之后将无法再次显示。
            </p>
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-2">
            <Button
              type="submit"
              disabled={createKey.isPending}
              className="flex-1"
            >
              {createKey.isPending ? '创建中...' : '创建 API 密钥'}
            </Button>
            <Button
              type="button"
              onClick={handleClose}
              disabled={createKey.isPending}
              variant="outline"
              className="flex-1"
            >
              取消
            </Button>
          </div>
        </form>
      </div>
    </div>
    </RemoveScroll>
  )
}
