/**
 * Update Policy Types
 *
 * Types for container update validation policies.
 * Supports priority-based validation: labels → per-container → patterns → default allow.
 */

/**
 * Update policy value type
 */
export type UpdatePolicyValue = 'allow' | 'warn' | 'block' | null

/**
 * Update policy action type
 * - 'warn': Show confirmation dialog before update (default)
 * - 'ignore': Skip from automatic update checks (manual checks still allowed)
 */
export type UpdatePolicyAction = 'warn' | 'ignore'

/**
 * Update policy category
 */
export type UpdatePolicyCategory = 'databases' | 'proxies' | 'monitoring' | 'critical' | 'custom'

/**
 * Single update policy pattern
 */
export interface UpdatePolicy {
  id: number
  pattern: string
  enabled: boolean
  action: UpdatePolicyAction
  created_at: string | null
  updated_at: string | null
}

/**
 * Update policies grouped by category
 */
export interface UpdatePoliciesResponse {
  categories: {
    [key in UpdatePolicyCategory]?: UpdatePolicy[]
  }
}

/**
 * Validation result from update attempt
 */
export interface UpdateValidationResponse {
  validation: 'allow' | 'warn' | 'block'
  reason: string
  matched_pattern?: string
}

/**
 * Response from toggle category endpoint
 */
export interface ToggleCategoryResponse {
  success: boolean
  category: string
  enabled: boolean
  patterns_affected: number
}

/**
 * Response from create custom pattern endpoint
 */
export interface CreateCustomPatternResponse {
  success: boolean
  id: number
  pattern: string
}

/**
 * Response from delete custom pattern endpoint
 */
export interface DeleteCustomPatternResponse {
  success: boolean
  deleted_pattern: string
}

/**
 * Response from update policy action endpoint
 */
export interface UpdatePolicyActionResponse {
  success: boolean
  id: number
  pattern: string
  action: UpdatePolicyAction
}

/**
 * Response from set container policy endpoint
 */
export interface SetContainerPolicyResponse {
  success: boolean
  host_id: string
  container_id: string
  update_policy: UpdatePolicyValue
}

/**
 * Category display metadata
 */
export interface CategoryMetadata {
  category: UpdatePolicyCategory
  label: string
  description: string
  icon: string
  color: string
}

/**
 * Category metadata for UI display
 */
export const CATEGORY_METADATA: Record<UpdatePolicyCategory, CategoryMetadata> = {
  databases: {
    category: 'databases',
    label: '数据库',
    description: '数据库容器 (postgres, mysql, mongodb 等)',
    icon: 'database',
    color: 'text-blue-400'
  },
  proxies: {
    category: 'proxies',
    label: '代理',
    description: '反向代理和流量入口容器 (traefik, nginx, caddy)',
    icon: 'network',
    color: 'text-purple-400'
  },
  monitoring: {
    category: 'monitoring',
    label: '监控',
    description: '监控或指标监视容器 (grafana, prometheus)',
    icon: 'activity',
    color: 'text-green-400'
  },
  critical: {
    category: 'critical',
    label: '关键设施',
    description: '关键的基础设施容器 (portainer, dockmon)',
    icon: 'alert-triangle',
    color: 'text-red-400'
  },
  custom: {
    category: 'custom',
    label: '自定义模式',
    description: '用户自定义的更新检测模式',
    icon: 'plus-circle',
    color: 'text-gray-400'
  }
}

/**
 * Policy selector options for dropdown
 */
export const POLICY_OPTIONS: Array<{ value: UpdatePolicyValue; label: string; description: string }> = [
  {
    value: null,
    label: '使用全局设置',
    description: '使用全局模式和 Docker 标签'
  },
  {
    value: 'allow',
    label: '始终允许',
    description: '始终允许更新，忽略警告'
  },
  {
    value: 'warn',
    label: '更新前警告',
    description: '更新前需要确认'
  },
  {
    value: 'block',
    label: '禁止更新',
    description: '完全禁止自动更新操作'
  }
]

/**
 * Action options for pattern action dropdown
 */
export const ACTION_OPTIONS: Array<{ value: UpdatePolicyAction; label: string; description: string }> = [
  {
    value: 'warn',
    label: '警告',
    description: '在更新前显示确认对话框'
  },
  {
    value: 'ignore',
    label: '忽略',
    description: '跳过自动更新检查'
  }
]
