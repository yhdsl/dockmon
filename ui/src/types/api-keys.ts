/**
 * API Key Types
 * Defines types for API key management
 *
 * Group-Based Permissions Refactor (v2.4.0)
 */

export interface ApiKey {
  id: number
  name: string
  description: string | null
  key_prefix: string // e.g., "dockmon_xxxx..." (safe to display)
  group_id: number  // Group whose permissions apply to this key
  group_name: string  // For display
  created_by_username: string | null  // User who created this key (for display)
  allowed_ips: string | null // comma-separated IP addresses/CIDRs
  last_used_at: string | null // ISO 8601 datetime
  usage_count: number
  expires_at: string | null // ISO 8601 datetime
  revoked_at: string | null // ISO 8601 datetime (null = active)
  created_at: string // ISO 8601 datetime
}

export interface CreateApiKeyRequest {
  name: string
  description?: string | null
  group_id: number  // Group whose permissions apply to this key
  allowed_ips?: string | null // optional IP allowlist
  expires_days?: number | null // optional expiration in days (1-365)
}

export interface CreateApiKeyResponse {
  id: number
  name: string
  key: string // PLAINTEXT KEY - only shown once!
  key_prefix: string
  group_id: number
  group_name: string
  expires_at: string | null
  message: string // Warning about saving key
}

export interface UpdateApiKeyRequest {
  name?: string | null
  description?: string | null
  allowed_ips?: string | null
  // Note: group_id cannot be changed after creation
}

export interface ApiKeyListResponse {
  keys: ApiKey[]
}

/**
 * Legacy scope types (for migration)
 * API keys now use group-based permissions
 */
export type ApiKeyScope = 'read' | 'write' | 'admin'

export interface ScopePreset {
  label: string
  scopes: ApiKeyScope[]
  description: string
  icon: string
  useCase: string
}

/**
 * Legacy scope presets (kept for backward compatibility)
 * @deprecated Use group-based permissions instead
 */
export const SCOPE_PRESETS: ScopePreset[] = [
  {
    label: '仅可读',
    scopes: ['read'],
    description: '读取容器和仪表盘数据',
    icon: 'Eye',
    useCase: '主页服务、仪表板监控、只读的访问授权',
  },
  {
    label: '可读写',
    scopes: ['read', 'write'],
    description: '读取与管理容器',
    icon: 'Pencil',
    useCase: 'Ansible 自动化、容器管理脚本',
  },
  {
    label: '管理员',
    scopes: ['admin'],
    description: '完整的访问权限，包括 API 密钥管理',
    icon: 'Lock',
    useCase: '完整的访问权限',
  },
]
