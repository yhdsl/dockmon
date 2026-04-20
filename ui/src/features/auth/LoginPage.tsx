/**
 * Login Page - Design System v2
 *
 * SECURITY:
 * - No password stored in state longer than necessary
 * - Form submission uses secure cookie-based auth
 * - Error messages don't reveal if username exists (security best practice)
 *
 * DESIGN:
 * - Tailwind CSS + shadcn/ui components
 * - Grafana/Portainer-inspired dark theme
 * - WCAG 2.1 AA accessible
 *
 * OIDC (v2.3.0):
 * - Shows SSO button when OIDC is enabled
 * - Handles OIDC callback error messages
 */

import { useState, useEffect, type FormEvent } from 'react'
import { LogIn, KeyRound } from 'lucide-react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { useAuth } from './AuthContext'
import { useOIDCStatus } from '@/hooks/useOIDC'
import { ApiError, apiClient } from '@/lib/api/client'
import { getBasePath } from '@/lib/utils/basePath'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

function Divider({ label }: { label: string }) {
  return (
    <div className="relative my-4">
      <div className="absolute inset-0 flex items-center">
        <span className="w-full border-t border-border" />
      </div>
      <div className="relative flex justify-center text-xs uppercase">
        <span className="bg-card px-2 text-muted-foreground">{label}</span>
      </div>
    </div>
  )
}

interface LocalLoginFormProps {
  username: string
  setUsername: (v: string) => void
  password: string
  setPassword: (v: string) => void
  error: string | null
  setError: (v: string | null) => void
  isLoading: boolean
  onSubmit: (e: FormEvent) => void
  submitVariant?: 'default' | 'outline'
}

function LocalLoginForm({
  username, setUsername, password, setPassword,
  error, setError, isLoading, onSubmit, submitVariant,
}: LocalLoginFormProps) {
  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="space-y-2">
        <label htmlFor="username" className="text-xs font-medium text-muted-foreground">
          用户名
        </label>
        <Input
          id="username"
          data-testid="login-username"
          type="text"
          value={username}
          onChange={(e) => {
            setUsername(e.target.value)
            if (error) setError(null)
          }}
          disabled={isLoading}
          autoComplete="username"
          autoFocus
          placeholder="请输入用户名"
        />
      </div>
      <div className="space-y-2">
        <label htmlFor="password" className="text-xs font-medium text-muted-foreground">
          密码
        </label>
        <Input
          id="password"
          data-testid="login-password"
          type="password"
          value={password}
          onChange={(e) => {
            setPassword(e.target.value)
            if (error) setError(null)
          }}
          disabled={isLoading}
          autoComplete="current-password"
          placeholder="请输入密码"
        />
      </div>
      <Button
        type="submit"
        data-testid="login-submit"
        disabled={isLoading}
        variant={submitVariant}
        className="w-full"
        size="lg"
      >
        {isLoading ? (
          <>
            <span className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
            登录中...
          </>
        ) : (
          <>
            <LogIn className="h-4 w-4" />
            登录
          </>
        )}
      </Button>
    </form>
  )
}

/**
 * Validate redirect URL to prevent open redirect attacks.
 * Only allows relative paths starting with '/'.
 */
function getSafeRedirect(url: string | null): string {
  if (!url) return '/'
  // Only allow relative paths (must start with / and not //)
  if (url.startsWith('/') && !url.startsWith('//')) {
    return url
  }
  return '/'
}

/** Safe OIDC error messages - prevents phishing via arbitrary URL text */
const OIDC_ERROR_MESSAGES: Record<string, string> = {
  access_denied: '身份提供商拒绝了访问请求。',
  login_failed: 'SSO 登录失败，请稍后重试。',
  invalid_state: 'SSO 会话已过期，请稍后重试。',
  provider_error: '身份提供商返回了错误回复。',
  no_email: '身份提供商未提供电子邮件地址。',
  account_disabled: '你的账户已被禁用。',
  pending_approval: '你的账户正在等待管理员批准，请联系网站管理员。',
}

const DEFAULT_OIDC_ERROR = 'SSO 认证失败，请稍后重试或联系网站管理员。'

export function LoginPage() {
  const { login, isLoading } = useAuth()
  const { data: oidcStatus } = useOIDCStatus()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [showLocalLogin, setShowLocalLogin] = useState(false)

  // Get redirect URL from query params (e.g., /login?redirect=/quick-action?token=xxx)
  const redirectUrl = getSafeRedirect(searchParams.get('redirect'))

  // Check for OIDC error from callback
  const oidcError = searchParams.get('error')
  const oidcErrorMessage = searchParams.get('message')

  useEffect(() => {
    if (oidcError === 'oidc_error' && oidcErrorMessage) {
      setError(OIDC_ERROR_MESSAGES[oidcErrorMessage] || DEFAULT_OIDC_ERROR)
    }
  }, [oidcError, oidcErrorMessage])

  const handleOIDCLogin = () => {
    // Redirect to OIDC authorize endpoint, preserving redirect URL
    const authorizeUrl = new URL(`${getBasePath()}/api/v2/auth/oidc/authorize`, window.location.origin)
    if (redirectUrl) {
      authorizeUrl.searchParams.set('redirect', redirectUrl)
    }
    window.location.href = authorizeUrl.toString()
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!username.trim() || !password) {
      setError('请输入用户名和密码')
      return
    }

    try {
      await login({ username: username.trim(), password })

      // Sync browser timezone to backend on successful login
      const browserTimezoneOffset = -new Date().getTimezoneOffset()
      apiClient.put('/settings', { timezone_offset: browserTimezoneOffset }).catch(err => {
        console.warn('Failed to sync timezone offset:', err)
      })

      navigate(redirectUrl, { replace: true })
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 401) {
          setError('用户名或密码错误')
        } else if (err.status === 429) {
          setError('尝试登录次数过多，请稍后再试。')
        } else {
          setError('登录时失败，请再试一次')
        }
      } else {
        setError('连接错误。请检查后端服务是否正常运行。')
      }
    }
  }

  const formProps = {
    username, setUsername, password, setPassword,
    error, setError, isLoading, onSubmit: handleSubmit,
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1 text-center">
          <div className="mb-2 flex justify-center">
            <img src={`${getBasePath()}/logo-192.png`} alt="DockMon" className="h-16 w-16 rounded-xl" />
          </div>
          <CardTitle className="text-2xl">DockMon</CardTitle>
          <CardDescription>Docker 容器监控服务</CardDescription>
        </CardHeader>

        <CardContent>
          {error && (
            <div
              role="alert"
              className="mb-4 rounded-lg border-l-4 border-danger bg-danger/10 p-3 text-sm text-danger"
            >
              {error}
            </div>
          )}

          {oidcStatus?.enabled && oidcStatus.sso_default ? (
            <>
              {/* SSO-primary layout */}
              <Button
                type="button"
                className="w-full"
                size="lg"
                onClick={handleOIDCLogin}
              >
                <KeyRound className="h-4 w-4" />
                使用 SSO 登录
              </Button>

              {!showLocalLogin ? (
                <button
                  type="button"
                  className="mt-4 w-full text-center text-sm text-muted-foreground hover:text-foreground transition-colors"
                  onClick={() => setShowLocalLogin(true)}
                >
                  使用本地账户登录
                </button>
              ) : (
                <>
                  <Divider label="本地账户" />
                  <LocalLoginForm {...formProps} submitVariant="outline" />
                </>
              )}
            </>
          ) : (
            <>
              {/* Default layout: local login primary */}
              <LocalLoginForm {...formProps} />

              {/* OIDC SSO Button (secondary) */}
              {oidcStatus?.enabled && (
                <>
                  <Divider label="或者" />
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full"
                    size="lg"
                    onClick={handleOIDCLogin}
                  >
                    <KeyRound className="h-4 w-4" />
                    使用 SSO 登录
                  </Button>
                </>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
