/**
 * NotificationChannelsModal Component
 *
 * Modal for managing notification channels
 */

import { useState } from 'react'
import { X, Plus, Trash2, Edit, Power, PowerOff, CheckCircle2, XCircle, AlertTriangle } from 'lucide-react'
import { Smartphone, Send, MessageSquare, Hash, Bell, Mail, Users, BellRing, LucideIcon } from 'lucide-react'
import { RemoveScroll } from 'react-remove-scroll'
import {
  useNotificationChannels,
  useCreateChannel,
  useUpdateChannel,
  useDeleteChannel,
  useTestChannel,
  useDependentAlerts,
  NotificationChannel,
  ChannelCreateRequest,
} from '../hooks/useNotificationChannels'
import { ChannelForm } from './ChannelForm'
import { useAuth } from '@/features/auth/AuthContext'

interface Props {
  onClose: () => void
}

type View = 'list' | 'create' | 'edit'

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

export function NotificationChannelsModal({ onClose }: Props) {
  const { hasCapability } = useAuth()
  const canManageNotifications = hasCapability('notifications.manage')
  const [view, setView] = useState<View>('list')
  const [selectedChannel, setSelectedChannel] = useState<NotificationChannel | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null)
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null)

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
      setTestResult(null)
    } catch (error: unknown) {
      console.error('Failed to create channel:', error)
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
      setTestResult(null)
    } catch (error: unknown) {
      console.error('Failed to update channel:', error)
    }
  }

  const handleDelete = async (channelId: number) => {
    try {
      await deleteChannel.mutateAsync(channelId)
      setDeleteConfirm(null)
    } catch (error: unknown) {
      console.error('Failed to delete channel:', error)
    }
  }

  const handleToggleEnabled = async (channel: NotificationChannel) => {
    try {
      await updateChannel.mutateAsync({
        channelId: channel.id,
        updates: { enabled: !channel.enabled },
      })
    } catch (error: unknown) {
      console.error('Failed to toggle channel:', error)
    }
  }

  const handleTest = async (_data: ChannelCreateRequest) => {
    // For new channels, we can't test until created
    // For existing channels, test using the channel ID
    if (selectedChannel) {
      try {
        const result = await testChannel.mutateAsync(selectedChannel.id)
        if (result.success) {
          setTestResult({ success: true, message: '测试通知发送成功!' })
        } else {
          setTestResult({ success: false, message: result.error || '测试失败' })
        }
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : '测试失败'
        setTestResult({ success: false, message })
      }
    } else {
      setTestResult({ success: false, message: '请在测试前保存频道' })
    }
  }

  const handleEdit = (channel: NotificationChannel) => {
    setSelectedChannel(channel)
    setView('edit')
    setTestResult(null)
  }

  const handleCancelForm = () => {
    setView('list')
    setSelectedChannel(null)
    setTestResult(null)
  }

  return (
    <RemoveScroll>
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="w-full max-w-4xl rounded-lg border border-gray-700 bg-[#0d1117] shadow-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-700 px-6 py-4 sticky top-0 bg-[#0d1117] z-10">
          <h2 className="text-xl font-semibold text-white">
            {view === 'list' ? '通知频道' : view === 'create' ? '添加通知频道' : '编辑通知频道'}
          </h2>
          <button
            onClick={onClose}
            className="rounded-md p-1 text-gray-400 transition-colors hover:bg-gray-800 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {view === 'list' && (
            <>
              {/* Add Channel Button */}
              <div className="mb-6 flex items-center gap-4">
                <button
                  onClick={() => { setTestResult(null); setView('create') }}
                  disabled={!canManageNotifications}
                  className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-60"
                >
                  <Plus className="h-4 w-4" />
                  添加频道
                </button>
                {testResult && (
                  <div className={`flex items-center gap-2 rounded-md px-3 py-1.5 text-sm ${testResult.success ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'}`}>
                    {testResult.success ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
                    {testResult.message}
                    <button onClick={() => setTestResult(null)} className="ml-1 text-gray-400 hover:text-white">
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                )}
              </div>

              {/* Channels List */}
              {isLoading ? (
                <div className="text-center py-12 text-gray-400">加载频道中...</div>
              ) : channels.length === 0 ? (
                <div className="text-center py-12">
                  <Bell className="h-12 w-12 text-gray-600 mx-auto mb-3" />
                  <p className="text-gray-400 mb-2">尚未配置任何通知频道</p>
                  <p className="text-sm text-gray-500">添加一个通知频道以开始接收告警通知</p>
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

                        <fieldset disabled={!canManageNotifications} className="disabled:opacity-60">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={async () => {
                                try {
                                  const result = await testChannel.mutateAsync(channel.id)
                                  if (result.success) {
                                    setTestResult({ success: true, message: '测试通知发送成功!' })
                                  } else {
                                    setTestResult({ success: false, message: result.error || '测试失败' })
                                  }
                                } catch (error: unknown) {
                                  const message = error instanceof Error ? error.message : '未知错误'
                                  setTestResult({ success: false, message: `测试失败: ${message}` })
                                }
                              }}
                              disabled={!channel.enabled}
                              className="rounded-md bg-gray-700 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              Test
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
                        </fieldset>
                      </div>
                    )
                  })}
                </div>
              )}
            </>
          )}

          {(view === 'create' || view === 'edit') && (
            <div>
              {testResult && (
                <div className={`mb-4 rounded-md p-3 flex items-start gap-2 ${testResult.success ? 'bg-green-500/10 border border-green-500/20' : 'bg-red-500/10 border border-red-500/20'}`}>
                  {testResult.success ? (
                    <CheckCircle2 className="h-5 w-5 text-green-400 flex-shrink-0 mt-0.5" />
                  ) : (
                    <XCircle className="h-5 w-5 text-red-400 flex-shrink-0 mt-0.5" />
                  )}
                  <p className={`text-sm ${testResult.success ? 'text-green-400' : 'text-red-400'}`}>
                    {testResult.message}
                  </p>
                </div>
              )}
              <ChannelForm
                channel={selectedChannel}
                onSubmit={view === 'create' ? handleCreate : handleUpdate}
                onCancel={handleCancelForm}
                onTest={handleTest}
                isSubmitting={createChannel.isPending || updateChannel.isPending}
                isTesting={testChannel.isPending}
                disabled={!canManageNotifications}
              />
            </div>
          )}
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      {deleteConfirm !== null && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-md rounded-lg border border-gray-700 bg-[#0d1117] p-6">
            <div className="flex items-start gap-3 mb-4">
              <AlertTriangle className="h-6 w-6 text-yellow-500 flex-shrink-0" />
              <div>
                <h3 className="text-lg font-semibold text-white mb-1">删除通知频道?</h3>
                <p className="text-sm text-gray-400">
                  这将永久删除该通知频道，并将其从所有的告警规则中删除。
                </p>
                {dependentData && dependentData.alert_count > 0 && (
                  <p className="text-sm text-yellow-400 mt-2">
                    警告: {dependentData.alert_count} 个告警规则将会被自动更新。
                  </p>
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
                disabled={!canManageNotifications || deleteChannel.isPending}
                className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-700 disabled:opacity-50"
              >
                {deleteChannel.isPending ? '删除中...' : '删除频道'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
    </RemoveScroll>
  )
}
