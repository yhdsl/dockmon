/**
 * OIDC Settings Component
 * Admin-only OIDC configuration and group mapping interface
 *
 * Group-Based Permissions Refactor (v2.4.0)
 */

import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import {
  ExternalLink,
  Plus,
  Trash2,
  Edit2,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Save,
  Key,
  Globe,
  Users,
  AlertTriangle,
  Copy,
  Check,
  ShieldCheck,
  Bell,
} from 'lucide-react'
import {
  useOIDCConfig,
  useUpdateOIDCConfig,
  useDiscoverOIDC,
  useOIDCGroupMappings,
  useCreateOIDCGroupMapping,
  useUpdateOIDCGroupMapping,
  useDeleteOIDCGroupMapping,
} from '@/hooks/useOIDC'
import { useGroups } from '@/hooks/useGroups'
import { usePendingUserCount, useApproveAllUsers } from '@/hooks/useUsers'
import { useNotificationChannels } from '@/features/alerts/hooks/useNotificationChannels'
import type {
  OIDCGroupMapping,
  OIDCDiscoveryResponse,
  OIDCConfigUpdateRequest,
} from '@/types/oidc'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { toast } from 'sonner'
import { getBasePath } from '@/lib/utils/basePath'

const DEFAULT_SCOPES = 'openid profile email groups'
const DEFAULT_GROUPS_CLAIM = 'groups'
const NO_DEFAULT_GROUP = '__none__'

function arraysEqual(a: number[], b: number[]): boolean {
  if (a.length !== b.length) return false
  const sortedA = [...a].sort((x, y) => x - y)
  const sortedB = [...b].sort((x, y) => x - y)
  return sortedA.every((v, i) => v === sortedB[i])
}

export function OIDCSettings() {
  const { data: config, isLoading: configLoading } = useOIDCConfig()
  const { data: mappings, isLoading: mappingsLoading } = useOIDCGroupMappings()
  const { data: groupsData } = useGroups()
  const updateConfig = useUpdateOIDCConfig()
  const discoverOIDC = useDiscoverOIDC()
  const createMapping = useCreateOIDCGroupMapping()
  const updateMapping = useUpdateOIDCGroupMapping()
  const deleteMapping = useDeleteOIDCGroupMapping()
  const { data: pendingCountData } = usePendingUserCount()
  const approveAllUsers = useApproveAllUsers()
  const { data: channelsData } = useNotificationChannels()

  const groups = groupsData?.groups || []
  const channels = channelsData?.channels || []
  const pendingCount = pendingCountData?.count ?? 0

  const [enabled, setEnabled] = useState(false)
  const [providerUrl, setProviderUrl] = useState('')
  const [clientId, setClientId] = useState('')
  const [clientSecret, setClientSecret] = useState('')
  const [scopes, setScopes] = useState(DEFAULT_SCOPES)
  const [claimForGroups, setClaimForGroups] = useState(DEFAULT_GROUPS_CLAIM)
  const [defaultGroupId, setDefaultGroupId] = useState<string>('')
  const [ssoDefault, setSsoDefault] = useState(false)
  const [requireApproval, setRequireApproval] = useState(false)
  const [approvalNotifyChannelIds, setApprovalNotifyChannelIds] = useState<number[]>([])
  const [showApprovalConfirm, setShowApprovalConfirm] = useState(false)

  const callbackUrl = useMemo(() => {
    return `${window.location.origin}${getBasePath()}/api/v2/auth/oidc/callback`
  }, [])
  const [callbackCopied, setCallbackCopied] = useState(false)
  const copyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const [discoveryResult, setDiscoveryResult] = useState<OIDCDiscoveryResponse | null>(null)

  const [showCreateMapping, setShowCreateMapping] = useState(false)
  const [editingMapping, setEditingMapping] = useState<OIDCGroupMapping | null>(null)
  const [deletingMapping, setDeletingMapping] = useState<OIDCGroupMapping | null>(null)

  useEffect(() => {
    if (config) {
      setEnabled(config.enabled)
      setProviderUrl(config.provider_url || '')
      setClientId(config.client_id || '')
      setScopes(config.scopes || DEFAULT_SCOPES)
      setClaimForGroups(config.claim_for_groups || DEFAULT_GROUPS_CLAIM)
      setDefaultGroupId(config.default_group_id ? config.default_group_id.toString() : NO_DEFAULT_GROUP)
      setSsoDefault(config.sso_default)
      setRequireApproval(config.require_approval)
      setApprovalNotifyChannelIds(config.approval_notify_channel_ids || [])
      // Don't sync client_secret - it's never returned
    }
  }, [config])

  useEffect(() => {
    return () => {
      if (copyTimerRef.current) clearTimeout(copyTimerRef.current)
    }
  }, [])

  const hasChanges = useMemo(() => {
    if (!config) return false
    return (
      enabled !== config.enabled ||
      providerUrl !== (config.provider_url || '') ||
      clientId !== (config.client_id || '') ||
      clientSecret !== '' ||
      scopes !== (config.scopes || DEFAULT_SCOPES) ||
      claimForGroups !== (config.claim_for_groups || DEFAULT_GROUPS_CLAIM) ||
      defaultGroupId !== (config.default_group_id ? config.default_group_id.toString() : NO_DEFAULT_GROUP) ||
      ssoDefault !== config.sso_default ||
      requireApproval !== config.require_approval ||
      !arraysEqual(approvalNotifyChannelIds, config.approval_notify_channel_ids || [])
    )
  }, [config, enabled, providerUrl, clientId, clientSecret, scopes, claimForGroups, defaultGroupId, ssoDefault, requireApproval, approvalNotifyChannelIds])

  const buildConfigData = useCallback((): OIDCConfigUpdateRequest => {
    const data: OIDCConfigUpdateRequest = {}
    if (enabled !== config?.enabled) data.enabled = enabled
    if (providerUrl !== (config?.provider_url || '')) data.provider_url = providerUrl || null
    if (clientId !== (config?.client_id || '')) data.client_id = clientId || null
    if (clientSecret) data.client_secret = clientSecret
    if (scopes !== (config?.scopes || DEFAULT_SCOPES)) data.scopes = scopes || null
    if (claimForGroups !== (config?.claim_for_groups || DEFAULT_GROUPS_CLAIM)) data.claim_for_groups = claimForGroups || null
    if (defaultGroupId !== (config?.default_group_id ? config.default_group_id.toString() : NO_DEFAULT_GROUP)) {
      data.default_group_id = defaultGroupId && defaultGroupId !== NO_DEFAULT_GROUP ? parseInt(defaultGroupId, 10) : 0
    }
    if (ssoDefault !== config?.sso_default) data.sso_default = ssoDefault
    if (requireApproval !== config?.require_approval) data.require_approval = requireApproval
    if (!arraysEqual(approvalNotifyChannelIds, config?.approval_notify_channel_ids || [])) {
      data.approval_notify_channel_ids = approvalNotifyChannelIds
    }
    return data
  }, [config, enabled, providerUrl, clientId, clientSecret, scopes, claimForGroups, defaultGroupId, ssoDefault, requireApproval, approvalNotifyChannelIds])

  const doSaveConfig = useCallback(async (data: OIDCConfigUpdateRequest) => {
    try {
      await updateConfig.mutateAsync(data)
      setClientSecret('')
    } catch {
      // Error handled by mutation
    }
  }, [updateConfig])

  const handleSaveConfig = async () => {
    const data = buildConfigData()

    // When toggling require_approval OFF and there are pending users, show confirmation
    const turningOffApproval = config?.require_approval && !requireApproval
    if (turningOffApproval && pendingCount > 0) {
      setShowApprovalConfirm(true)
      return
    }

    await doSaveConfig(data)
  }

  const handleApprovalConfirmApproveAll = async () => {
    try {
      await approveAllUsers.mutateAsync()
    } catch {
      // Error handled by mutation
    }
    setShowApprovalConfirm(false)
    await doSaveConfig(buildConfigData())
  }

  const handleApprovalConfirmKeepPending = async () => {
    setShowApprovalConfirm(false)
    await doSaveConfig(buildConfigData())
  }

  const handleToggleChannelId = useCallback((channelId: number, checked: boolean) => {
    setApprovalNotifyChannelIds((prev) =>
      checked ? [...prev, channelId] : prev.filter((id) => id !== channelId)
    )
  }, [])

  const handleTestConnection = async () => {
    setDiscoveryResult(null)
    try {
      const result = await discoverOIDC.mutateAsync({
        provider_url: providerUrl || null,
        client_id: clientId || null,
        client_secret: clientSecret || null,
      })
      setDiscoveryResult(result)
    } catch {
      // Error handled by mutation
    }
  }

  const isLoading = configLoading || mappingsLoading

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <RefreshCw className="h-6 w-6 animate-spin text-gray-400" />
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {/* Provider Configuration */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-white">OIDC 提供商配置</h2>
            <p className="mt-1 text-sm text-gray-400">
              配置 OpenID Connect 提供商以实现单点登录 (SSO)
            </p>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Switch
                id="sso-default"
                checked={ssoDefault}
                onCheckedChange={setSsoDefault}
                disabled={!enabled}
              />
              <Label htmlFor="sso-default" className={`text-sm ${enabled ? 'text-gray-300' : 'text-gray-500'}`}>
                默认使用单点登录
              </Label>
            </div>
            <div className="flex items-center gap-2">
              <Switch
                id="oidc-enabled"
                checked={enabled}
                onCheckedChange={setEnabled}
              />
              <Label htmlFor="oidc-enabled" className="text-sm text-gray-300">
                启用 OIDC
              </Label>
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-gray-800 bg-gray-900/50 p-4 space-y-4">
          {/* Callback URL - needed for OIDC provider configuration */}
          <div className="space-y-2">
            <Label className="text-sm text-gray-300">回调 URL</Label>
            <div className="flex items-center gap-2">
              <Input
                readOnly
                value={callbackUrl}
                className="font-mono text-sm bg-gray-950/50"
              />
              <Button
                variant="outline"
                size="icon"
                className="shrink-0"
                onClick={() => {
                  navigator.clipboard.writeText(callbackUrl)
                  setCallbackCopied(true)
                  if (copyTimerRef.current) clearTimeout(copyTimerRef.current)
                  copyTimerRef.current = setTimeout(() => setCallbackCopied(false), 2000)
                }}
              >
                {callbackCopied ? (
                  <Check className="h-4 w-4 text-green-400" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            </div>
            <p className="text-xs text-gray-500">
              将 OIDC 提供商中的允许重定向 URI 设置为此 URL
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="provider-url" className="text-sm text-gray-300">
                提供商 URL
              </Label>
              <div className="relative">
                <Globe className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
                <Input
                  id="provider-url"
                  placeholder="https://auth.example.com/realms/myrealm"
                  value={providerUrl}
                  onChange={(e) => setProviderUrl(e.target.value)}
                  className="pl-10"
                />
              </div>
              <p className="text-xs text-gray-500">
                OIDC 提供商的基础 URL (例如 Keycloak、Azure AD、Okta 等)
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="client-id" className="text-sm text-gray-300">
                客户端 ID
              </Label>
              <div className="relative">
                <Key className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
                <Input
                  id="client-id"
                  placeholder="dockmon-client"
                  value={clientId}
                  onChange={(e) => setClientId(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="client-secret" className="text-sm text-gray-300">
                客户端密钥
              </Label>
              <Input
                id="client-secret"
                type="password"
                placeholder={config?.client_secret_configured ? '********' : '请输入客户端密钥'}
                value={clientSecret}
                onChange={(e) => setClientSecret(e.target.value)}
              />
              {config?.client_secret_configured && (
                <p className="text-xs text-gray-500">
                  留空以使用之前的密钥
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="scopes" className="text-sm text-gray-300">
                作用域
              </Label>
              <Input
                id="scopes"
                placeholder="openid profile email groups"
                value={scopes}
                onChange={(e) => setScopes(e.target.value)}
              />
              <p className="text-xs text-gray-500">
                向提供商请求的认证权限。如果提供方需要在令牌中包含用户组数据，请额外在此添加 <code className="text-gray-400">groups</code>。
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="claim-for-groups" className="text-sm text-gray-300">
                用户组声明
              </Label>
              <Input
                id="claim-for-groups"
                placeholder="groups"
                value={claimForGroups}
                onChange={(e) => setClaimForGroups(e.target.value)}
                className="max-w-xs"
              />
              <p className="text-xs text-gray-500">
                ID 令牌中用于标识用户组成员关系的字段。不同的提供商可能不同 (例如 <code className="text-gray-400">groups</code> 或 <code className="text-gray-400">roles</code>)。
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="default-group" className="text-sm text-gray-300">
                默认群组
              </Label>
              <Select value={defaultGroupId} onValueChange={setDefaultGroupId}>
                <SelectTrigger className="max-w-xs">
                  <SelectValue placeholder="请选择一个默认群组">
                    {defaultGroupId === NO_DEFAULT_GROUP
                      ? '没有默认群组 (拒绝访问)'
                      : (() => {
                          const g = groups.find((gr) => gr.id.toString() === defaultGroupId)
                          return g ? `${g.name}${g.is_system ? ' (系统群组)' : ''}` : defaultGroupId
                        })()}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">没有默认群组 (拒绝访问)</SelectItem>
                  {groups.map((group) => (
                    <SelectItem key={group.id} value={group.id.toString()}>
                      {group.name}
                      {group.is_system && ' (系统群组)'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-gray-500">
                当没有匹配到任何 OIDC 用户组时默认分配的用户群组
              </p>
            </div>
          </div>

        </div>
      </section>

      {/* User Approval */}
      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            <ShieldCheck className="h-5 w-5" />
            用户批准
          </h2>
          <p className="mt-1 text-sm text-gray-400">
            控制新添加的 OIDC 用户在能够访问 DockMon 之前是否需要管理员批准
          </p>
        </div>

        <div className="rounded-lg border border-gray-800 bg-gray-900/50 p-4 space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Label htmlFor="require-approval" className="text-sm text-gray-300">
                新用户需要管理员批准
              </Label>
              <p className="text-xs text-gray-500">
                启用后，新添加的 OIDC 用户在访问 DockMon 之前必须由管理员批准。
              </p>
            </div>
            <Switch
              id="require-approval"
              checked={requireApproval}
              onCheckedChange={setRequireApproval}
            />
          </div>

          {requireApproval && (
            <div className="space-y-3 pt-3 border-t border-gray-800">
              <div className="space-y-1">
                <Label className="text-sm text-gray-300 flex items-center gap-2">
                  <Bell className="h-4 w-4" />
                  请求批准的通知频道
                </Label>
                <p className="text-xs text-gray-500">
                  当有新的用户等待管理员批准时，待发送通知的频道
                </p>
              </div>
              {channels.length > 0 ? (
                <div className="space-y-2">
                  {channels.filter((ch) => ch.enabled).map((channel) => (
                    <label
                      key={channel.id}
                      htmlFor={`approval-channel-${channel.id}`}
                      className="flex items-center gap-3 rounded-md border border-gray-800 bg-gray-950/50 px-3 py-2 cursor-pointer hover:bg-gray-800/50"
                    >
                      <Checkbox
                        id={`approval-channel-${channel.id}`}
                        checked={approvalNotifyChannelIds.includes(channel.id)}
                        onCheckedChange={(checked) =>
                          handleToggleChannelId(channel.id, checked === true)
                        }
                      />
                      <div className="flex-1 min-w-0">
                        <span className="text-sm text-gray-200">{channel.name}</span>
                        <span className="ml-2 text-xs text-gray-500">({channel.type})</span>
                      </div>
                    </label>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-500">
                  尚未配置任何通知频道。请前往通知设置页面添加一个。
                </p>
              )}
            </div>
          )}
        </div>
      </section>

      {/* Save & Test */}
      <div className="flex items-center gap-3">
        <Button
          onClick={handleSaveConfig}
          disabled={!hasChanges || updateConfig.isPending}
        >
          <Save className="mr-2 h-4 w-4" />
          {updateConfig.isPending ? '保存中...' : '保存配置'}
        </Button>
        <Button
          variant="outline"
          onClick={handleTestConnection}
          disabled={!providerUrl || discoverOIDC.isPending}
        >
          <ExternalLink className="mr-2 h-4 w-4" />
          {discoverOIDC.isPending ? '测试中...' : '测试连接'}
        </Button>
      </div>

      {/* Discovery Result */}
      {discoveryResult && (() => {
        const overallStatus = !discoveryResult.success
          ? 'error'
          : discoveryResult.client_validated === false
            ? 'error'
            : discoveryResult.client_validated === true
              ? 'success'
              : 'warning'
        const statusStyles = {
          success: { border: 'border-green-800 bg-green-900/20', text: 'text-green-300', icon: 'text-green-400' },
          warning: { border: 'border-yellow-800 bg-yellow-900/20', text: 'text-yellow-300', icon: 'text-yellow-400' },
          error: { border: 'border-red-800 bg-red-900/20', text: 'text-red-300', icon: 'text-red-400' },
        }
        const style = statusStyles[overallStatus]
        return (
        <div className={`rounded-lg border p-4 ${style.border}`}>
          <div className="flex items-start gap-3">
            {overallStatus === 'error' ? (
              <XCircle className={`h-5 w-5 ${style.icon} mt-0.5`} />
            ) : overallStatus === 'success' ? (
              <CheckCircle2 className={`h-5 w-5 ${style.icon} mt-0.5`} />
            ) : (
              <AlertTriangle className={`h-5 w-5 ${style.icon} mt-0.5`} />
            )}
            <div className="flex-1 space-y-2">
              <p className={`font-medium ${style.text}`}>
                {discoveryResult.message}
              </p>
              {discoveryResult.success && (
                <div className="text-sm text-gray-400 space-y-1">
                  <p><span className="text-gray-500">颁发者:</span> {discoveryResult.issuer}</p>
                  <p><span className="text-gray-500">授权端点:</span> {discoveryResult.authorization_endpoint}</p>
                  <p><span className="text-gray-500">令牌端点:</span> {discoveryResult.token_endpoint}</p>
                  {discoveryResult.scopes_supported && (
                    <p><span className="text-gray-500">Scopes:</span> {discoveryResult.scopes_supported.slice(0, 10).join(', ')}</p>
                  )}
                  {discoveryResult.client_validation_message && (
                    <p className={`mt-2 font-medium ${
                      discoveryResult.client_validated === true
                        ? 'text-green-400'
                        : discoveryResult.client_validated === false
                          ? 'text-red-400'
                          : 'text-yellow-400'
                    }`}>
                      <span className="text-gray-500">凭证:</span> {discoveryResult.client_validation_message}
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
        )
      })()}

      {/* Group Mappings */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-white">映射 OIDC 用户组到 DockMon 群组</h2>
            <p className="mt-1 text-sm text-gray-400">
              将 OIDC 用户组映射到 DockMon 群组。优先级较高的映射将先生效。
            </p>
          </div>
          <Button onClick={() => setShowCreateMapping(true)}>
            <Plus className="mr-2 h-4 w-4" />
            添加映射
          </Button>
        </div>

        <div className="rounded-lg border border-gray-800 bg-gray-900/50 overflow-hidden">
          {mappings && mappings.length > 0 ? (
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-800 bg-gray-800/50">
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-400">OIDC 用户组</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-400">DockMon 群组</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-400">优先级</th>
                  <th className="px-4 py-3 text-right text-sm font-medium text-gray-400">映射操作</th>
                </tr>
              </thead>
              <tbody>
                {mappings.map((mapping) => (
                  <tr key={mapping.id} className="border-b border-gray-800/50 last:border-0">
                    <td className="px-4 py-3">
                      <code className="rounded bg-gray-800 px-2 py-1 text-sm text-blue-300">
                        {mapping.oidc_value}
                      </code>
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-900/50 px-2.5 py-0.5 text-xs font-medium text-blue-300">
                        <Users className="h-3 w-3" />
                        {{'Administrators': "管理群组", 'Operators': "操作群组", 'Read Only': "访客群组"}[mapping.group_name] ?? mapping.group_name}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-300">{mapping.priority}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setEditingMapping(mapping)}
                          aria-label={`Edit mapping for ${mapping.oidc_value}`}
                        >
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setDeletingMapping(mapping)}
                          className="text-red-400 hover:text-red-300"
                          aria-label={`Delete mapping for ${mapping.oidc_value}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="px-4 py-8 text-center text-gray-500">
              <Users className="mx-auto h-8 w-8 text-gray-600 mb-2" />
              <p>暂未配置任何映射</p>
              <p className="text-sm">没有被匹配的用户将被分配至默认群组</p>
            </div>
          )}
        </div>

        {/* Default Group Note */}
        <div className="flex items-start gap-3 rounded-lg border border-yellow-800/50 bg-yellow-900/20 p-4">
          <AlertTriangle className="h-5 w-5 text-yellow-400 mt-0.5" />
          <div className="text-sm">
            <p className="font-medium text-yellow-300">默认群组</p>
            <p className="text-yellow-200/70">
              未匹配的 OIDC 用户组中的用户将被分配到{' '}
              {config?.default_group_name ? (
                <strong>{{'Administrators': "管理群组", 'Operators': "操作群组", 'Read Only': "访客群组"}[config.default_group_name] ?? config.default_group_name}</strong>
              ) : (
                <span>空群组 (拒绝访问)</span>
              )}
              .
            </p>
          </div>
        </div>
      </section>

      {/* Create Mapping Modal */}
      <GroupMappingModal
        isOpen={showCreateMapping}
        onClose={() => setShowCreateMapping(false)}
        groups={groups}
        onSubmit={async (data) => {
          await createMapping.mutateAsync(data)
          setShowCreateMapping(false)
        }}
        isSubmitting={createMapping.isPending}
      />

      {/* Edit Mapping Modal */}
      <GroupMappingModal
        isOpen={!!editingMapping}
        onClose={() => setEditingMapping(null)}
        mapping={editingMapping}
        groups={groups}
        onSubmit={async (data) => {
          if (!editingMapping) return
          await updateMapping.mutateAsync({ id: editingMapping.id, data })
          setEditingMapping(null)
        }}
        isSubmitting={updateMapping.isPending}
      />

      {/* Delete Confirmation */}
      <Dialog open={!!deletingMapping} onOpenChange={() => setDeletingMapping(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>删除映射</DialogTitle>
            <DialogDescription>
              确定要删除用户组 <code className="rounded bg-gray-800 px-2 py-1">{deletingMapping?.oidc_value}</code> 的映射吗?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeletingMapping(null)}>
              取消
            </Button>
            <Button
              variant="destructive"
              onClick={async () => {
                if (!deletingMapping) return
                await deleteMapping.mutateAsync(deletingMapping.id)
                setDeletingMapping(null)
              }}
              disabled={deleteMapping.isPending}
            >
              {deleteMapping.isPending ? '删除中...' : '删除'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Approval Confirmation Dialog */}
      <Dialog open={showApprovalConfirm} onOpenChange={() => setShowApprovalConfirm(false)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>待批准的用户</DialogTitle>
            <DialogDescription>
              当前有 {pendingCount} 个用户正在等待批准。是否立即批准他们?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={handleApprovalConfirmKeepPending}
              disabled={approveAllUsers.isPending || updateConfig.isPending}
            >
              否，继续等待
            </Button>
            <Button
              onClick={handleApprovalConfirmApproveAll}
              disabled={approveAllUsers.isPending || updateConfig.isPending}
            >
              {approveAllUsers.isPending ? '批准中...' : '是，批准全部'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ==================== Helper Components ====================

interface GroupMappingModalProps {
  isOpen: boolean
  onClose: () => void
  mapping?: OIDCGroupMapping | null
  groups: Array<{ id: number; name: string; is_system: boolean }>
  onSubmit: (data: { oidc_value: string; group_id: number; priority: number }) => Promise<void>
  isSubmitting: boolean
}

function GroupMappingModal({ isOpen, onClose, mapping, groups, onSubmit, isSubmitting }: GroupMappingModalProps) {
  const [oidcValue, setOidcValue] = useState('')
  const [groupId, setGroupId] = useState<string>('')
  const [priority, setPriority] = useState(0)

  useEffect(() => {
    if (isOpen && mapping) {
      setOidcValue(mapping.oidc_value)
      setGroupId(mapping.group_id.toString())
      setPriority(mapping.priority)
    } else {
      setOidcValue('')
      setGroupId('')
      setPriority(0)
    }
  }, [mapping, isOpen])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!oidcValue.trim()) {
      toast.error('OIDC 用户组名为必填项')
      return
    }
    if (!groupId) {
      toast.error('请选择一个 DockMon 群组')
      return
    }
    await onSubmit({
      oidc_value: oidcValue.trim(),
      group_id: parseInt(groupId, 10),
      priority,
    })
  }

  return (
    <Dialog open={isOpen} onOpenChange={() => onClose()}>
      <DialogContent>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>{mapping ? '编辑映射' : '创建映射'}</DialogTitle>
            <DialogDescription>
              将 OIDC 用户组映射到 DockMon 群组。隶属于该 OIDC 用户组的用户将被分配到指定的 DockMon 群组。
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="oidc-value">OIDC 用户组名</Label>
              <Input
                id="oidc-value"
                placeholder="dockmon-admins"
                value={oidcValue}
                onChange={(e) => setOidcValue(e.target.value)}
                required
              />
              <p className="text-xs text-gray-500">
                应与 OIDC 提供商中显示的用户组名完全一致
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="dockmon-group">DockMon 群组</Label>
              <Select value={groupId} onValueChange={setGroupId}>
                <SelectTrigger>
                  <SelectValue placeholder="请选择一个群组">
                    {(() => {
                      const g = groups.find((gr) => gr.id.toString() === groupId)
                      return g ? `${g.name}${g.is_system ? ' (系统群组)' : ''}` : groupId
                    })()}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {groups.map((group) => (
                    <SelectItem key={group.id} value={group.id.toString()}>
                      <span className="flex items-center gap-2">
                        <Users className="h-3 w-3 text-blue-400" />
                        {group.name}
                        {group.is_system && ' (系统群组)'}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="priority">优先级</Label>
              <Input
                id="priority"
                type="number"
                min={0}
                max={1000}
                value={priority}
                onChange={(e) => setPriority(parseInt(e.target.value) || 0)}
              />
              <p className="text-xs text-gray-500">
                当匹配到多个 OIDC 用户组时，优先级较高的映射将先生效
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              取消
            </Button>
            <Button type="submit" disabled={!oidcValue || !groupId || isSubmitting}>
              {isSubmitting ? '保存中...' : mapping ? '保存更改' : '创建映射'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
