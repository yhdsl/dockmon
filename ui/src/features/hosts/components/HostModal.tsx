/**
 * Host Modal Component
 *
 * FEATURES:
 * - Add/Edit host modal with two connection methods
 * - Tabbed interface for Agent vs Remote Docker Connection
 * - React Hook Form + Zod validation
 * - TLS certificate fields (expandable)
 * - Description textarea
 *
 * TABS:
 * - Agent: Token generation and docker run command
 * - Remote Docker Connection: Traditional mTLS form
 *
 * FIELDS (Remote Docker Connection):
 * - Host Name (required)
 * - Address/Endpoint (required)
 * - TLS Toggle (expands certificate fields)
 * - CA Certificate (textarea, TLS only)
 * - Client Certificate (textarea, mTLS)
 * - Client Key (textarea, mTLS)
 * - Description (textarea)
 *
 * NOTE: Tags are managed via the host drawer/modal, not in add/edit.
 */

import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { RemoveScroll } from 'react-remove-scroll'
import { z } from 'zod'

// Type for API errors
interface ApiError extends Error {
  response?: {
    data?: {
      detail?: string
    }
  }
}
import { X, Trash2, AlertTriangle, Copy, Check, Terminal, Container, Server } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Tabs } from '@/components/ui/tabs'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { useAddHost, useUpdateHost, useDeleteHost, type HostConfig } from '../hooks/useHosts'
import { useGenerateToken } from '@/features/agents/hooks/useAgents'
import type { Host } from '@/types/api'
import { toast } from 'sonner'
import { apiClient } from '@/lib/api/client'
import { debug } from '@/lib/debug'
import { useAllContainers } from '@/lib/stats/StatsProvider'
import { useQuery } from '@tanstack/react-query'
import { useGlobalSettings } from '@/hooks/useSettings'
import { cn } from '@/lib/utils'
import { useAuth } from '@/features/auth/AuthContext'

type InstallMethod = 'docker' | 'systemd'

// Zod schema for host form
// URL validation is relaxed to allow empty for agent hosts (validated in onSubmit)
const hostSchema = z.object({
  name: z
    .string()
    .min(1, '主机名称为必填项')
    .max(100, '主机名称不能超过 100 个字符')
    .regex(/^[a-zA-Z0-9][a-zA-Z0-9 ._-]*$/, '主机名称包含非法字符'),
  url: z
    .string()
    .min(1, '地址或端点为必填项')
    .refine(
      (val) => val === 'agent://' || /^(tcp|unix|http|https):\/\/.+/.test(val),
      'URL 必须以 tcp://、unix://、http:// 或 https:// 开头'
    ),
  enableTls: z.boolean(),
  tls_ca: z.string().optional(),
  tls_cert: z.string().optional(),
  tls_key: z.string().optional(),
  description: z.string().max(1000, '描述文本不能超过 1000 个字符').optional(),
})

type HostFormData = z.infer<typeof hostSchema>

interface HostModalProps {
  isOpen: boolean
  onClose: () => void
  host?: Host | null // If editing
}

export function HostModal({ isOpen, onClose, host }: HostModalProps) {
  const [activeTab, setActiveTab] = useState<'agent' | 'remote'>('agent')
  const [showTlsFields, setShowTlsFields] = useState(false)
  const [replaceCa, setReplaceCa] = useState(false)
  const [replaceCert, setReplaceCert] = useState(false)
  const [replaceKey, setReplaceKey] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [copied, setCopied] = useState<string | null>(null)
  const [installMethod, setInstallMethod] = useState<InstallMethod>('docker')
  const [multiUse, setMultiUse] = useState(false)

  const { hasCapability } = useAuth()
  const canManageHosts = hasCapability('hosts.manage')
  const canManageAgents = hasCapability('agents.manage')

  const addMutation = useAddHost()
  const updateMutation = useUpdateHost()
  const deleteMutation = useDeleteHost()
  const generateToken = useGenerateToken()

  // Get settings for timezone
  const { data: settings } = useGlobalSettings()

  // Get containers for this host (for delete confirmation)
  const containers = useAllContainers(host?.id || undefined)

  // Get open alerts for this host (for delete confirmation)
  const { data: alertsData } = useQuery({
    queryKey: ['alerts', 'host', host?.id],
    queryFn: async () => {
      const response = await apiClient.get<{ alerts: any[]; total: number }>(
        `/alerts/?state=open&page_size=500`
      )
      return response.alerts.filter((alert: any) => alert.host_id === host?.id)
    },
    enabled: showDeleteConfirm && !!host?.id,
  })

  const openAlerts = alertsData || []

  // Check if host has existing certificates
  const hostHasCerts = host?.security_status === 'secure'

  // Check if this is an agent-based host (can't edit URL or TLS settings)
  const isAgentHost = host?.connection_type === 'agent'

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<HostFormData>({
    resolver: zodResolver(hostSchema),
    defaultValues: {
      name: host?.name || '',
      url: host?.url || '',
      enableTls: hostHasCerts || false,
      tls_ca: '',
      tls_cert: '',
      tls_key: '',
      description: host?.description || '',
    },
  })

  const watchUrl = watch('url')

  // Update form when host prop changes or modal opens
  useEffect(() => {
    if (host) {
      // Edit mode - only show remote tab
      setActiveTab('remote')
      const hasCerts = host.security_status === 'secure'
      setShowTlsFields(hasCerts)
      setReplaceCa(false)
      setReplaceCert(false)
      setReplaceKey(false)

      reset({
        name: host.name,
        url: host.url,
        enableTls: hasCerts,
        tls_ca: '',
        tls_cert: '',
        tls_key: '',
        description: host.description || '',
      })
    } else {
      // Add mode - reset to agent tab
      setActiveTab('agent')
      setShowTlsFields(false)
      setReplaceCa(false)
      setReplaceCert(false)
      setReplaceKey(false)

      reset({
        name: '',
        url: '',
        enableTls: false,
        tls_ca: '',
        tls_cert: '',
        tls_key: '',
        description: '',
      })
    }
  }, [host, isOpen, reset])

  const token = generateToken.data?.token
  const expiresAt = generateToken.data?.expires_at
  const isMultiUse = generateToken.data?.multi_use

  const handleCopy = async (text: string, id: string) => {
    await navigator.clipboard.writeText(text)
    setCopied(id)
    setTimeout(() => setCopied(null), 2000)
  }

  // Auto-detect DockMon URL from current browser location
  const dockmonUrl = `${window.location.protocol}//${window.location.host}`
  const isHttps = window.location.protocol === 'https:'

  const timezone = settings?.timezone || 'UTC'
  const dockerCommand = token
    ? `docker run -d \\
  --name dockmon-agent \\
  --restart unless-stopped \\
  -v /var/run/docker.sock:/var/run/docker.sock:ro \\
  -v dockmon-agent-data:/data \\
  -e DOCKMON_URL=${dockmonUrl} \\
  -e REGISTRATION_TOKEN=${token} \\
  -e TZ=${timezone} \\${isHttps ? '\n  -e INSECURE_SKIP_VERIFY=true \\' : ''}
  ghcr.io/darthnorse/dockmon-agent:latest`
    : ''

  const systemdInstallCommand = token
    ? `curl -fsSL https://raw.githubusercontent.com/yhdsl/dockmon/main/scripts/install-agent.sh | \\
  DOCKMON_URL=${dockmonUrl} \\
  REGISTRATION_TOKEN=${token} \\
  TZ=${timezone}${isHttps ? ' \\\n  INSECURE_SKIP_VERIFY=true' : ''} bash`
    : ''

  const formatExpiry = (isoString: string) => {
    const date = new Date(isoString)
    const now = new Date()
    const diff = date.getTime() - now.getTime()
    const minutes = Math.ceil(diff / 60000)  // Round up so "14:59" shows as "15 minutes"
    return `${minutes} 分钟后`
  }

  const testConnection = async () => {
    const formData = watch()

    if (!formData.url) {
      toast.error('请先输入地址/端点')
      return
    }

    const testConfig: HostConfig = {
      name: formData.name || 'test',
      url: formData.url,
      tags: [],
      description: null,
    }

    if (showTlsFields) {
      if (hostHasCerts && !replaceCa && !replaceCert && !replaceKey) {
        toast.info('正在使用现有证书测试连接')
        testConfig.tls_ca = null
        testConfig.tls_cert = null
        testConfig.tls_key = null
      } else {
        if (!formData.tls_ca || !formData.tls_cert || !formData.tls_key) {
          toast.error('使用 mTLS 连接时需要提供全部三个证书')
          return
        }
        testConfig.tls_ca = formData.tls_ca
        testConfig.tls_cert = formData.tls_cert
        testConfig.tls_key = formData.tls_key
      }
    }

    try {
      toast.loading('测试连接中...', { id: 'test-connection' })

      const response = await apiClient.post<{
        success: boolean
        message: string
        docker_version: string
        api_version: string
      }>('/hosts/test-connection', testConfig)

      const dockerVersion = response.docker_version || '未知版本'
      const apiVersion = response.api_version || '未知版本'

      toast.success(`已成功连接l! Docker ${dockerVersion} (API ${apiVersion})`, {
        id: 'test-connection',
        duration: 5000
      })
    } catch (error: unknown) {
      const apiError = error as ApiError
      const message = apiError.response?.data?.detail || apiError.message || '连接失败'
      toast.error(message, { id: 'test-connection' })
    }
  }

  const onSubmit = async (data: HostFormData) => {
    const config: HostConfig = {
      name: data.name,
      // For agent hosts, keep the existing URL (agent://)
      url: isAgentHost ? host!.url : data.url,
      tags: [],
      description: data.description || null,
    }

    // Only include TLS config for non-agent hosts
    if (!isAgentHost && data.enableTls) {
      if (host && hostHasCerts) {
        config.tls_ca = replaceCa ? (data.tls_ca || null) : null
        config.tls_cert = replaceCert ? (data.tls_cert || null) : null
        config.tls_key = replaceKey ? (data.tls_key || null) : null
      } else {
        config.tls_ca = data.tls_ca || null
        config.tls_cert = data.tls_cert || null
        config.tls_key = data.tls_key || null
      }
    }

    try {
      if (host) {
        await updateMutation.mutateAsync({ id: host.id, config })
      } else {
        await addMutation.mutateAsync(config)
      }
      onClose()
      reset()
    } catch (error) {
      debug.error('HostModal', 'Error saving host:', error)
    }
  }

  const handleDeleteClick = () => {
    setShowDeleteConfirm(true)
  }

  const handleDeleteConfirm = async () => {
    if (!host) return

    try {
      await deleteMutation.mutateAsync(host.id)
      setShowDeleteConfirm(false)
      onClose()
    } catch (error) {
      setShowDeleteConfirm(false)
    }
  }

  const handleDeleteCancel = () => {
    setShowDeleteConfirm(false)
  }

  if (!isOpen) return null

  // Agent Tab Content
  const agentTabContent = (
    <div className="p-6 space-y-4">
      {!token ? (
        <>
          <p className="text-sm text-muted-foreground">
            在你的远程 Docker 主机上部署一个轻量级的代理。该代理通过 WebSocket 连接到 DockMon - 无需暴露 Docker 端口或者配置 mTLS 证书。
          </p>
          <p className="text-sm font-medium text-green-600 dark:text-green-500">
            强烈推荐: 这是首选且最安全的使用方法
          </p>

          <div className="flex items-center gap-2 py-2">
            <input
              type="checkbox"
              id="multiUse"
              checked={multiUse}
              onChange={(e) => setMultiUse(e.target.checked)}
              className="h-4 w-4"
            />
            <label htmlFor="multiUse" className="text-sm">
              允许多个代理使用此令牌
            </label>
          </div>
          {multiUse && (
            <p className="text-xs text-muted-foreground -mt-1">
              适用于批量主机注册。需要所有的代理在 15 分钟内完成注册。
            </p>
          )}

          <Button
            onClick={() => generateToken.mutate({ multiUse })}
            disabled={!canManageAgents || generateToken.isPending}
          >
            {generateToken.isPending ? '生成令牌中...' : '生成注册令牌'}
          </Button>
        </>
      ) : (
        <div className="space-y-4">
          <Alert>
            <Terminal className="h-4 w-4" />
            <AlertDescription>
              {isMultiUse ? '可复用令牌' : '令牌'}已成功生成! 将过期于{' '}
              <strong>{expiresAt && formatExpiry(expiresAt)}</strong>
              {isMultiUse && ' — 允许被多个代理使用'}
            </AlertDescription>
          </Alert>

          <div className="space-y-2">
            <label className="text-sm font-medium">注册令牌</label>
            <div className="flex gap-2">
              <code className="flex-1 rounded bg-muted px-3 py-2 text-sm font-mono break-all">
                {token}
              </code>
              <Button
                size="icon"
                variant="outline"
                onClick={() => handleCopy(token, 'token')}
              >
                {copied === 'token' ? (
                  <Check className="h-4 w-4" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>

          {/* Installation Method Toggle */}
          <div className="space-y-4">
            <div className="flex rounded-lg bg-muted p-1">
              <button
                onClick={() => setInstallMethod('docker')}
                className={cn(
                  'flex-1 flex items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                  installMethod === 'docker'
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                <Container className="h-4 w-4" />
                Docker 容器
              </button>
              <button
                onClick={() => setInstallMethod('systemd')}
                className={cn(
                  'flex-1 flex items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                  installMethod === 'systemd'
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                <Server className="h-4 w-4" />
                系统服务
              </button>
            </div>

            {installMethod === 'docker' && (
              <div className="space-y-2">
                <label className="text-sm font-medium">Docker 容器部署命令</label>
                <div className="relative">
                  <pre className="rounded bg-muted p-4 text-sm font-mono overflow-x-auto whitespace-pre-wrap">
                    {dockerCommand}
                  </pre>
                  <Button
                    size="sm"
                    variant="outline"
                    className="absolute top-2 right-2"
                    onClick={() => handleCopy(dockerCommand, 'docker')}
                  >
                    {copied === 'docker' ? (
                      <Check className="h-4 w-4 mr-1" />
                    ) : (
                      <Copy className="h-4 w-4 mr-1" />
                    )}
                    复制
                  </Button>
                </div>
              </div>
            )}

            {installMethod === 'systemd' && (
              <div className="space-y-2">
                <label className="text-sm font-medium">安装命令</label>
                <p className="text-xs text-muted-foreground">
                  请在远程主机上以 root 权限运行此命令，以便于将代理安装为 systemd 服务:
                </p>
                <div className="relative">
                  <pre className="rounded bg-muted p-4 text-sm font-mono overflow-x-auto whitespace-pre-wrap">
                    {systemdInstallCommand}
                  </pre>
                  <Button
                    size="sm"
                    variant="outline"
                    className="absolute top-2 right-2"
                    onClick={() => handleCopy(systemdInstallCommand, 'systemd')}
                  >
                    {copied === 'systemd' ? (
                      <Check className="h-4 w-4 mr-1" />
                    ) : (
                      <Copy className="h-4 w-4 mr-1" />
                    )}
                    复制
                  </Button>
                </div>
              </div>
            )}
          </div>

          <Alert>
            <AlertDescription className="text-sm">
              <strong>注意:</strong> 如果 <code>DOCKMON_URL</code> 不正确，请在远程主机上运行命令之前将其更改为正确的 URL。
              代理将通过 WebSocket 连接，并自动出现在主机列表中。
            </AlertDescription>
          </Alert>

          <Button
            variant="outline"
            onClick={() => {
              generateToken.reset()
              onClose()
            }}
          >
            完成
          </Button>
        </div>
      )}

      {generateToken.isError && (
        <Alert variant="destructive">
          <AlertDescription>
            {generateToken.error?.message || '无法生成令牌'}
          </AlertDescription>
        </Alert>
      )}
    </div>
  )

  // Remote Docker Connection Tab Content
  const remoteTabContent = (
    <div className="p-6">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <fieldset disabled={!canManageHosts} className="space-y-4 disabled:opacity-60">
        <div>
          <label htmlFor="name" className="block text-sm font-medium mb-1">
            主机名称 <span className="text-destructive">*</span>
          </label>
          <Input
            id="name"
            {...register('name')}
            placeholder="docker-prod-01"
            className={errors.name ? 'border-destructive' : ''}
            data-testid="host-name-input"
          />
          {errors.name && (
            <p className="text-xs text-destructive mt-1">{errors.name.message}</p>
          )}
        </div>

        {/* Address/Endpoint */}
        <div>
          <label htmlFor="url" className="block text-sm font-medium mb-1">
            地址 / 端点 {!isAgentHost && <span className="text-destructive">*</span>}
          </label>
          {isAgentHost ? (
            <div className="w-full rounded-md border border-input bg-muted px-3 py-2 text-sm text-muted-foreground">
              agent:// (由代理管理)
            </div>
          ) : (
            <>
              <Input
                id="url"
                {...register('url')}
                placeholder="tcp://192.168.1.20:2376 或者 unix:///var/run/docker.sock"
                className={errors.url ? 'border-destructive' : ''}
                data-testid="host-url-input"
              />
              {errors.url && (
                <p className="text-xs text-destructive mt-1">{errors.url.message}</p>
              )}
            </>
          )}
        </div>

        {/* TLS Toggle or UNIX Socket Note - hidden for agent hosts */}
        {isAgentHost ? null : watchUrl?.startsWith('unix://') ? (
          <div className="rounded-lg border border-border p-3 bg-muted/10">
            <p className="text-sm text-muted-foreground">
              本地 UNIX 套接字 — 无法启用 TLS
            </p>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="enableTls"
                  checked={showTlsFields}
                  onChange={(e) => {
                    const checked = e.target.checked
                    setShowTlsFields(checked)
                    setValue('enableTls', checked)
                  }}
                  className="h-4 w-4"
                  data-testid="host-enable-tls"
                />
                <label htmlFor="enableTls" className="text-sm font-medium">
                  启用 mTLS (双向 TLS)
                </label>
              </div>
              {!showTlsFields && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={testConnection}
                  className="h-7 text-xs"
                >
                  测试连接
                </Button>
              )}
            </div>

            {/* mTLS Certificate Fields */}
            {showTlsFields && (
              <div className="space-y-4 rounded-lg border border-border p-4 bg-muted/20">
                <div className="flex items-center justify-between">
                  <p className="text-xs text-muted-foreground">
                    使用 mTLS 连接时需要提供以下三个证书。
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={testConnection}
                    className="h-7 text-xs"
                  >
                    测试连接
                  </Button>
                </div>

                {/* CA Certificate */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label htmlFor="tls_ca" className="block text-sm font-medium">
                      CA 证书 <span className="text-destructive">*</span>
                    </label>
                    {hostHasCerts && !replaceCa && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setReplaceCa(true)}
                        className="h-7 text-xs"
                      >
                        替换
                      </Button>
                    )}
                  </div>
                  {hostHasCerts && !replaceCa ? (
                    <div className="w-full rounded-md border border-input bg-muted px-3 py-2 text-sm text-muted-foreground">
                      上传 — •••
                    </div>
                  ) : (
                    <textarea
                      id="tls_ca"
                      {...register('tls_ca')}
                      rows={4}
                      placeholder="-----BEGIN CERTIFICATE-----&#10;...&#10;-----END CERTIFICATE-----"
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono"
                      data-testid="host-tls-ca"
                    />
                  )}
                </div>

                {/* Client Certificate */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label htmlFor="tls_cert" className="block text-sm font-medium">
                      客户端证书 <span className="text-destructive">*</span>
                    </label>
                    {hostHasCerts && !replaceCert && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setReplaceCert(true)}
                        className="h-7 text-xs"
                      >
                        替换
                      </Button>
                    )}
                  </div>
                  {hostHasCerts && !replaceCert ? (
                    <div className="w-full rounded-md border border-input bg-muted px-3 py-2 text-sm text-muted-foreground">
                      上传 — •••
                    </div>
                  ) : (
                    <textarea
                      id="tls_cert"
                      {...register('tls_cert')}
                      rows={4}
                      placeholder="-----BEGIN CERTIFICATE-----&#10;...&#10;-----END CERTIFICATE-----"
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono"
                      data-testid="host-tls-cert"
                    />
                  )}
                </div>

                {/* Client Key */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label htmlFor="tls_key" className="block text-sm font-medium">
                      客户端私钥 <span className="text-destructive">*</span>
                    </label>
                    {hostHasCerts && !replaceKey && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setReplaceKey(true)}
                        className="h-7 text-xs"
                      >
                        替换
                      </Button>
                    )}
                  </div>
                  {hostHasCerts && !replaceKey ? (
                    <div className="w-full rounded-md border border-input bg-muted px-3 py-2 text-sm text-muted-foreground">
                      上传 — •••
                    </div>
                  ) : (
                    <textarea
                      id="tls_key"
                      {...register('tls_key')}
                      rows={4}
                      placeholder="-----BEGIN PRIVATE KEY-----&#10;...&#10;-----END PRIVATE KEY-----"
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono"
                      data-testid="host-tls-key"
                    />
                  )}
                </div>
              </div>
            )}
          </>
        )}

        {/* Description */}
        <div>
          <label htmlFor="description" className="block text-sm font-medium mb-1">
            描述
          </label>
          <textarea
            id="description"
            {...register('description')}
            rows={3}
            placeholder="可选的关于主机的笔记..."
            className={cn(
              'w-full rounded-md border bg-background px-3 py-2 text-sm',
              errors.description ? 'border-destructive' : 'border-input'
            )}
            data-testid="host-description"
          />
          {errors.description && (
            <p className="text-xs text-destructive mt-1">{errors.description.message}</p>
          )}
        </div>

        </fieldset>

        {/* Footer Actions */}
        <div className="flex justify-between gap-2 pt-4 border-t">
          {host ? (
            <Button
              type="button"
              variant="outline"
              onClick={handleDeleteClick}
              disabled={!canManageHosts || deleteMutation.isPending}
              className="text-red-500 hover:text-red-600 hover:bg-red-50"
              data-testid="host-modal-delete"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              {deleteMutation.isPending ? '删除中...' : '删除'}
            </Button>
          ) : (
            <div></div>
          )}

          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={onClose} data-testid="host-modal-cancel">
              取消
            </Button>
            <Button type="submit" disabled={!canManageHosts || isSubmitting} data-testid="host-modal-save">
              {isSubmitting ? '保存中...' : host ? '更新主机' : '添加主机'}
            </Button>
          </div>
        </div>
      </form>
    </div>
  )

  return (
    <RemoveScroll>
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" data-testid="host-modal">
      <div
        className="relative w-full max-w-2xl max-h-[90vh] rounded-2xl border border-border bg-background shadow-lg flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 pb-4 border-b">
          <div>
            <h2 className="text-xl font-semibold">
              {host ? '编辑主机' : '添加主机'}
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              {host
                ? isAgentHost
                  ? '更新由代理管理的主机名称和描述'
                  : '更新 Docker 主机的连接配置'
                : '选择如何连接至 Docker 主机'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100"
            data-testid="host-modal-close"
          >
            <X className="h-4 w-4" />
            <span className="sr-only">关闭</span>
          </button>
        </div>

        {/* Tabs - Only show for new hosts */}
        {!host ? (
          <Tabs
            tabs={[
              {
                id: 'agent',
                label: '代理管理 (推荐)',
                content: agentTabContent,
              },
              {
                id: 'remote',
                label: '传统连接',
                content: remoteTabContent,
              },
            ]}
            activeTab={activeTab}
            onTabChange={(tab) => setActiveTab(tab as 'agent' | 'remote')}
            className="flex-1 overflow-hidden"
          />
        ) : (
          // For edit mode, just show the remote form (no tabs)
          <div className="flex-1 overflow-y-auto">
            {remoteTabContent}
          </div>
        )}
      </div>

      {/* Delete Confirmation Dialog */}
      {showDeleteConfirm && host && (
        <div className="fixed inset-0 bg-black/70 z-[60] flex items-center justify-center p-4">
          <div className="bg-surface border border-border rounded-lg shadow-2xl max-w-md w-full p-6">
            <div className="flex items-start gap-4 mb-4">
              <div className="flex-shrink-0 w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center">
                <AlertTriangle className="h-6 w-6 text-red-500" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold mb-2">删除主机</h3>
                <p className="text-sm text-muted-foreground mb-3">
                  确定要删除主机 <span className="font-semibold text-foreground">{host.name}</span> 吗? 该操作将无法撤销。
                </p>

                <div className="rounded-lg border border-border bg-muted/20 p-3 space-y-2 text-sm">
                  <p className="font-medium text-foreground mb-2">这将会影响:</p>
                  <div className="space-y-1.5 text-muted-foreground">
                    <div className="flex items-center justify-between">
                      <span>监控中的容器:</span>
                      <span className="font-semibold text-foreground">{containers.length} 个</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>未解决的告警:</span>
                      <span className="font-semibold text-foreground">{openAlerts.length} 条将被标记为已解决</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>容器设置:</span>
                      <span className="font-semibold text-foreground">将会被删除</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>事件历史记录:</span>
                      <span className="font-semibold text-green-500">仍会被保留</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2">
              <button
                onClick={handleDeleteCancel}
                disabled={deleteMutation.isPending}
                className="px-4 py-2 rounded-lg border border-border bg-background hover:bg-muted transition-colors text-sm disabled:opacity-50"
              >
                取消
              </button>
              <button
                onClick={handleDeleteConfirm}
                disabled={deleteMutation.isPending}
                className="px-4 py-2 rounded-lg bg-red-500 hover:bg-red-600 text-white transition-colors text-sm disabled:opacity-50"
              >
                {deleteMutation.isPending ? '删除中...' : '删除主机'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
    </RemoveScroll>
  )
}
