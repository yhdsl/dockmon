/**
 * Quick Action Page
 *
 * Standalone page for executing one-time action tokens from notification links.
 * Requires authentication - redirects to login if not authenticated.
 *
 * Flow:
 * 1. User clicks link in notification (Pushover, Telegram, etc.)
 * 2. If not logged in -> redirect to login with return URL
 * 3. After login -> validates token and shows action details
 * 4. User confirms -> executes action
 * 5. Shows success/failure result
 */

import { useState, useEffect } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { Container, ArrowRight, CheckCircle2, XCircle, Loader2, Clock, AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { apiClient, ApiError } from '@/lib/api/client'

interface TokenInfo {
  valid: boolean
  reason?: string
  action_type?: string
  action_params?: {
    host_id?: string
    host_name?: string
    container_id?: string
    container_name?: string
    current_image?: string
    new_image?: string
  }
  created_at?: string
  expires_at?: string
  hours_remaining?: number
}

interface ExecuteResult {
  success: boolean
  action_type?: string
  result?: {
    message?: string
    previous_image?: string
    new_image?: string
  }
  error?: string
}

interface UpdateResponse {
  status?: string
  message?: string
  detail?: string
  previous_image?: string
  new_image?: string
}

interface ConsumeResponse {
  success: boolean
  error?: string
}

type PageState = 'loading' | 'invalid' | 'ready' | 'executing' | 'success' | 'error'

export function QuickActionPage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const token = searchParams.get('token')

  const [state, setState] = useState<PageState>('loading')
  const [tokenInfo, setTokenInfo] = useState<TokenInfo | null>(null)
  const [executeResult, setExecuteResult] = useState<ExecuteResult | null>(null)
  const [errorMessage, setErrorMessage] = useState<string>('')

  // Validate token on mount
  useEffect(() => {
    if (!token) {
      setState('invalid')
      setErrorMessage('未提供令牌')
      return
    }

    validateToken()
  }, [token])

  const redirectToLogin = () => {
    const returnUrl = encodeURIComponent(window.location.pathname + window.location.search)
    navigate(`/login?redirect=${returnUrl}`)
  }

  const validateToken = async () => {
    try {
      const data = await apiClient.get<TokenInfo>(
        `/v2/action-tokens/${encodeURIComponent(token!)}/info`
      )

      setTokenInfo(data)

      if (data.valid) {
        setState('ready')
      } else {
        setState('invalid')
        setErrorMessage(getErrorMessage(data.reason))
      }
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        redirectToLogin()
        return
      }
      setState('invalid')
      setErrorMessage('无法验证令牌')
    }
  }

  const executeAction = async () => {
    if (!token || !tokenInfo?.action_params) return

    setState('executing')

    try {
      // Step 1: Consume the token (validates and marks as used)
      const consumeData = await apiClient.post<ConsumeResponse>(
        `/v2/action-tokens/${encodeURIComponent(token!)}/consume`,
        { confirmed: true }
      )

      if (!consumeData.success) {
        setState('error')
        setErrorMessage(consumeData.error || '无法验证令牌')
        return
      }

      // Step 2: Call the EXISTING update endpoint (same code path as manual updates)
      const { host_id, container_id } = tokenInfo.action_params
      if (!host_id || !container_id) {
        setState('error')
        setErrorMessage('缺乏主机或容器信息')
        return
      }

      const updateData = await apiClient.post<UpdateResponse>(
        `/hosts/${encodeURIComponent(host_id)}/containers/${encodeURIComponent(container_id)}/execute-update`,
        undefined,
        { params: { force: true } }
      )

      if (updateData.status === 'success') {
        const result: ExecuteResult['result'] = {}
        if (updateData.message) result.message = updateData.message
        if (updateData.previous_image) result.previous_image = updateData.previous_image
        if (updateData.new_image) result.new_image = updateData.new_image
        setExecuteResult({
          success: true,
          action_type: 'container_update',
          result,
        })
        setState('success')
      } else {
        setState('error')
        setErrorMessage(updateData.detail || updateData.message || '更新失败')
      }
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        redirectToLogin()
        return
      }
      setState('error')
      setErrorMessage('无法执行操作')
    }
  }

  const getErrorMessage = (reason?: string): string => {
    switch (reason) {
      case 'expired':
        return '此链接已过期'
      case 'already_used':
        return '此链接已被使用'
      case 'revoked':
        return '此链接已被吊销'
      case 'not_found':
        return '无效或未知的链接'
      default:
        return '无效的链接'
    }
  }

  const formatTimeRemaining = (hours?: number): string => {
    if (!hours) return ''
    if (hours < 1) {
      const minutes = Math.round(hours * 60)
      return `剩余 ${minutes} 分钟`
    }
    return `剩余 ${Math.round(hours)} 小时`
  }

  return (
    <div className="min-h-screen bg-[#0a0e14] flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-2 mb-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <Container className="h-6 w-6 text-primary" />
            </div>
            <span className="text-2xl font-semibold text-white">DockMon</span>
          </div>
          <p className="text-sm text-gray-400">快速操作</p>
        </div>

        {/* Content Card */}
        <div className="bg-[#0d1117] border border-gray-800 rounded-xl p-6">
          {/* Loading State */}
          {state === 'loading' && (
            <div className="text-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-4" />
              <p className="text-gray-400">验证链接中...</p>
            </div>
          )}

          {/* Invalid Token State */}
          {state === 'invalid' && (
            <div className="text-center py-8">
              <XCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
              <h2 className="text-xl font-semibold text-white mb-2">无效的链接</h2>
              <p className="text-gray-400">{errorMessage}</p>
            </div>
          )}

          {/* Ready State - Show Action Details */}
          {state === 'ready' && tokenInfo?.action_params && (
            <>
              <h2 className="text-lg font-semibold text-white mb-4">
                {tokenInfo.action_type === 'container_update' ? '更新容器' : '确认操作'}
              </h2>

              {/* Container Info */}
              <div className="bg-[#161b22] rounded-lg p-4 mb-4">
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-400">容器</span>
                    <span className="text-white font-medium">{tokenInfo.action_params.container_name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">主机</span>
                    <span className="text-white">{tokenInfo.action_params.host_name || '未知'}</span>
                  </div>
                </div>

                {/* Image Change */}
                {tokenInfo.action_params.current_image && tokenInfo.action_params.new_image && (
                  <div className="mt-4 pt-4 border-t border-gray-700">
                    <div className="flex items-center justify-center gap-2 text-sm">
                      <span className="text-gray-400 font-mono text-xs truncate max-w-[140px]" title={tokenInfo.action_params.current_image}>
                        {tokenInfo.action_params.current_image.split(':').pop()}
                      </span>
                      <ArrowRight className="h-4 w-4 text-primary flex-shrink-0" />
                      <span className="text-green-400 font-mono text-xs truncate max-w-[140px]" title={tokenInfo.action_params.new_image}>
                        {tokenInfo.action_params.new_image.split(':').pop()}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* What will happen */}
              <div className="text-xs text-gray-400 mb-4">
                <p className="mb-2">这将会:</p>
                <ul className="list-disc list-inside space-y-1 text-gray-500">
                  <li>拉取新的镜像</li>
                  <li>停止当前容器</li>
                  <li>基于新镜像启动容器</li>
                  <li>如果健康检查失败则回滚</li>
                </ul>
              </div>

              {/* Time Remaining */}
              {tokenInfo.hours_remaining && (
                <div className="flex items-center gap-2 text-xs text-gray-500 mb-4">
                  <Clock className="h-3 w-3" />
                  <span>链接还{formatTimeRemaining(tokenInfo.hours_remaining)}</span>
                </div>
              )}

              {/* Action Buttons */}
              <div className="space-y-2">
                <Button
                  onClick={executeAction}
                  className="w-full"
                  size="lg"
                >
                  确认更新
                </Button>
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => window.close()}
                >
                  取消
                </Button>
              </div>
            </>
          )}

          {/* Executing State */}
          {state === 'executing' && (
            <div className="text-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-4" />
              <p className="text-white font-medium mb-2">更新容器中...</p>
              <p className="text-gray-400 text-sm">这可能需要若干分钟</p>
            </div>
          )}

          {/* Success State */}
          {state === 'success' && executeResult?.result && (
            <div className="text-center py-8">
              <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto mb-4" />
              <h2 className="text-xl font-semibold text-white mb-2">更新完成</h2>
              <p className="text-gray-400 text-sm mb-4">
                {executeResult.result.message || '容器已成功更新'}
              </p>

              {executeResult.result.previous_image && executeResult.result.new_image && (
                <div className="bg-[#161b22] rounded-lg p-3 text-xs">
                  <div className="flex items-center justify-center gap-2">
                    <span className="text-gray-400 font-mono">{executeResult.result.previous_image.split(':').pop()}</span>
                    <ArrowRight className="h-3 w-3 text-primary" />
                    <span className="text-green-400 font-mono">{executeResult.result.new_image.split(':').pop()}</span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Error State */}
          {state === 'error' && (
            <div className="text-center py-8">
              <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
              <h2 className="text-xl font-semibold text-white mb-2">更新失败</h2>
              <p className="text-gray-400 text-sm">{errorMessage}</p>
              {executeResult?.error?.includes('rolled back') && (
                <p className="text-yellow-500 text-xs mt-2">容器已回滚至先前的状态</p>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <p className="text-center text-xs text-gray-600 mt-4">
          由 DockMon 提供支持
        </p>
      </div>
    </div>
  )
}
