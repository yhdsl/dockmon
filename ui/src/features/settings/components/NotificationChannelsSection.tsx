/**
 * NotificationChannelsSection Component
 * Manage notification channels in Settings page
 */

import { useState } from 'react'
import { Plus, Trash2, Edit, Power, PowerOff, Bell, BellRing, LucideIcon } from 'lucide-react'
import { Smartphone, Send, MessageSquare, Hash, Mail, Users } from 'lucide-react'
import { useAuth } from '@/features/auth/AuthContext'
import {
  useNotificationChannels,
  useCreateChannel,
  useUpdateChannel,
  useDeleteChannel,
  useTestChannel,
  useDependentAlerts,
  NotificationChannel,
  ChannelCreateRequest,
} from '../../alerts/hooks/useNotificationChannels'
import { ChannelForm } from '../../alerts/components/ChannelForm'
import { toast } from 'sonner'

const CHANNEL_ICONS: Record<string, LucideIcon> = {
  telegram: Send,
  discord: MessageSquare,
  slack: Hash,
  teams: Users,
  pushover: Smartphone,
  gotify: Bell,
  ntfy: BellRing,
  smtp: Mail,
}

export function NotificationChannelsSection() {
  const { hasCapability } = useAuth()
  const canManage = hasCapability('notifications.manage')
  const [view, setView] = useState<'list' | 'create' | 'edit'>('list')
  const [selectedChannel, setSelectedChannel] = useState<NotificationChannel | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null)

  const { data: channelsData, isLoading } = useNotificationChannels()
  const createChannel = useCreateChannel()
  const updateChannel = useUpdateChannel()
  const deleteChannel = useDeleteChannel()
  const testChannel = useTestChannel()
  const { data: dependentData } = useDependentAlerts(deleteConfirm)

  const channels = channelsData?.channels || []

  const handleCreate = async (data: ChannelCreateRequest) => {
    try {
      await createChannel.mutateAsync(data)
      setView('list')
      toast.success('已成功创建频道')
    } catch (error) {
      toast.error(`创建频道时失败: ${error instanceof Error ? error.message : '未知错误'}`)
    }
  }

  const handleUpdate = async (data: ChannelCreateRequest) => {
    if (!selectedChannel) return
    try {
      await updateChannel.mutateAsync({
        channelId: selectedChannel.id,
        updates: data,
      })
      setView('list')
      setSelectedChannel(null)
      toast.success('已成功更新频道')
    } catch (error) {
      toast.error(`更新频道时失败: ${error instanceof Error ? error.message : '未知错误'}`)
    }
  }

  const handleDelete = async (channelId: number) => {
    try {
      await deleteChannel.mutateAsync(channelId)
      setDeleteConfirm(null)
      toast.success('已成功删除频道')
    } catch (error) {
      toast.error(`删除频道时失败: ${error instanceof Error ? error.message : '未知错误'}`)
    }
  }

  const handleToggleEnabled = async (channel: NotificationChannel) => {
    try {
      await updateChannel.mutateAsync({
        channelId: channel.id,
        updates: { enabled: !channel.enabled },
      })
      toast.success(channel.enabled ? '频道已禁用' : '频道已启用')
    } catch (error) {
      toast.error(`切换频道状态时失败: ${error instanceof Error ? error.message : '未知错误'}`)
    }
  }

  const handleEdit = (channel: NotificationChannel) => {
    setSelectedChannel(channel)
    setView('edit')
  }

  const handleCancelForm = () => {
    setView('list')
    setSelectedChannel(null)
  }

  if (view === 'create' || view === 'edit') {
    return (
      <div>
        <div className="mb-4">
          <button
            onClick={handleCancelForm}
            className="text-sm text-blue-400 hover:text-blue-300 underline"
          >
            ← 返回通知频道页面
          </button>
        </div>
        <ChannelForm
          channel={selectedChannel}
          onSubmit={view === 'create' ? handleCreate : handleUpdate}
          onCancel={handleCancelForm}
          isSubmitting={createChannel.isPending || updateChannel.isPending}
          disabled={!canManage}
        />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <fieldset disabled={!canManage} className="space-y-4 disabled:opacity-60">
      <div className="flex items-center justify-between">
        <p className="text-xs text-gray-400">
          配置通知频道以接收告警通知
        </p>
        <button
          className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-blue-700"
          onClick={() => setView('create')}
        >
          <Plus className="h-4 w-4" />
          添加频道
        </button>
      </div>

      {isLoading ? (
        <div className="text-center py-8 text-gray-400">加载频道中...</div>
      ) : channels.length === 0 ? (
        <div className="text-center py-8">
          <Bell className="h-12 w-12 text-gray-600 mx-auto mb-3" />
          <p className="text-gray-400 mb-2">尚未配置任何通知频道</p>
          <p className="text-sm text-gray-500">请添加一个通知频道以接收告警通知</p>
        </div>
      ) : (
        <div className="space-y-3">
          {channels.map((channel) => {
            const IconComponent = CHANNEL_ICONS[channel.type] || Bell
            return (
              <div
                key={channel.id}
                className="flex items-center justify-between rounded-lg border border-gray-700 bg-gray-800/30 p-4 hover:bg-gray-800/50 transition-colors"
              >
                <div className="flex items-center gap-4 flex-1 min-w-0">
                  <IconComponent className="h-5 w-5 text-gray-400 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-medium text-white truncate">{channel.name}</h3>
                      {channel.enabled ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-green-500/10 px-2 py-0.5 text-xs text-green-400">
                          <Power className="h-3 w-3" />
                          已启用
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-gray-500/10 px-2 py-0.5 text-xs text-gray-400">
                          <PowerOff className="h-3 w-3" />
                          已禁用
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-400 mt-0.5 capitalize">{channel.type}</p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={async () => {
                      try {
                        const result = await testChannel.mutateAsync(channel.id)
                        if (result.success) {
                          toast.success('测试通知发送成功!')
                        } else {
                          toast.error(`测试失败: ${result.error || '未知错误'}`)
                        }
                      } catch (error) {
                        toast.error(`测试失败: ${error instanceof Error ? error.message : '未知错误'}`)
                      }
                    }}
                    disabled={!channel.enabled}
                    className="rounded-md bg-gray-700 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-gray-600 disabled:opacity-50"
                  >
                    测试
                  </button>
                  <button
                    onClick={() => handleToggleEnabled(channel)}
                    className="rounded-md p-1.5 text-gray-400 transition-colors hover:bg-gray-700 hover:text-white"
                    title={channel.enabled ? '禁用频道' : '启用频道'}
                  >
                    {channel.enabled ? <PowerOff className="h-4 w-4" /> : <Power className="h-4 w-4" />}
                  </button>
                  <button
                    onClick={() => handleEdit(channel)}
                    className="rounded-md p-1.5 text-gray-400 transition-colors hover:bg-gray-700 hover:text-white"
                    title="编辑频道"
                  >
                    <Edit className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => setDeleteConfirm(channel.id)}
                    className="rounded-md p-1.5 text-gray-400 transition-colors hover:bg-gray-700 hover:text-red-400"
                    title="删除频道"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      </fieldset>

      {/* Delete Confirmation Dialog */}
      {deleteConfirm !== null && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-md rounded-lg border border-gray-700 bg-[#0d1117] p-6">
            <div className="flex items-start gap-3 mb-4">
              <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-red-500/10">
                <Trash2 className="h-6 w-6 text-red-500" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white mb-1">删除通知频道?</h3>
                <p className="text-sm text-gray-400">
                  这将永久删除该通知频道，并将其从所有的告警规则中删除。
                </p>
                {dependentData && dependentData.alert_count > 0 && (
                  <div className="mt-3 rounded-md bg-yellow-500/10 border border-yellow-500/20 p-3">
                    <p className="text-sm text-yellow-400 font-medium mb-1">
                      警告: {dependentData.alert_count} 个告警规则将会被自动更新:
                    </p>
                    <ul className="text-sm text-yellow-300 list-disc list-inside space-y-1">
                      {dependentData.alert_names.map((name, idx) => (
                        <li key={idx}>{name}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="rounded-md bg-gray-800 px-4 py-2 text-sm font-medium text-gray-300 transition-colors hover:bg-gray-700"
              >
                取消
              </button>
              <button
                onClick={() => handleDelete(deleteConfirm)}
                disabled={deleteChannel.isPending}
                className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-700 disabled:opacity-50"
              >
                {deleteChannel.isPending ? '删除中...' : '删除频道'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
