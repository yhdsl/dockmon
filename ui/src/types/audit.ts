/**
 * Audit Log Type Definitions
 */

// ==================== Action and Entity Type Enums ====================

/**
 * Known audit action types - matches backend AuditAction enum
 */
export const AUDIT_ACTIONS = [
  'login',
  'logout',
  'login_failed',
  'password_change',
  'password_reset_request',
  'password_reset',
  'create',
  'update',
  'delete',
  'start',
  'stop',
  'restart',
  'kill',
  'rename',
  'shell',
  'shell_end',
  'container_update',
  'deploy',
  'copy',
  'prune',
  'toggle',
  'test',
  'settings_change',
  'role_change',
] as const

export type AuditAction = (typeof AUDIT_ACTIONS)[number]

/**
 * Known audit entity types - matches backend AuditEntityType enum
 */
export const AUDIT_ENTITY_TYPES = [
  'session',
  'user',
  'host',
  'container',
  'stack',
  'deployment',
  'alert_rule',
  'notification_channel',
  'tag',
  'registry_credential',
  'health_check',
  'update_policy',
  'api_key',
  'settings',
  'role_permission',
  'oidc_config',
] as const

export type AuditEntityType = (typeof AUDIT_ENTITY_TYPES)[number]

// ==================== Audit Entry Types ====================

export interface AuditLogEntry {
  id: number
  user_id: number | null
  username: string
  action: AuditAction | string  // Allow string for forward compatibility
  entity_type: AuditEntityType | string  // Allow string for forward compatibility
  entity_id: string | null
  entity_name: string | null
  host_id: string | null
  host_name: string | null
  details: Record<string, unknown> | null
  ip_address: string | null
  user_agent: string | null
  created_at: string  // ISO timestamp
}

export interface AuditLogListResponse {
  entries: AuditLogEntry[]
  total: number
  page: number
  page_size: number
  total_pages: number
}

// ==================== Filter Types ====================

export interface AuditLogFilters {
  user_id?: number
  username?: string
  action?: string
  entity_type?: string
  entity_id?: string
  search?: string
  start_date?: string  // ISO date
  end_date?: string    // ISO date
}

export interface AuditLogQueryParams extends AuditLogFilters {
  page?: number
  page_size?: number
}

// ==================== Retention Types ====================

export interface RetentionSettingsResponse {
  retention_days: number
  valid_options: number[]
  oldest_entry_date: string | null
  total_entries: number
}

export interface UpdateRetentionRequest {
  retention_days: number
}

export interface RetentionUpdateResponse {
  retention_days: number
  message: string
  entries_to_delete: number
}

// ==================== Stats Types ====================

export interface AuditLogStatsResponse {
  total_entries: number
  entries_by_action: Record<string, number>
  entries_by_entity_type: Record<string, number>
  entries_by_user: Record<string, number>
  oldest_entry_date: string | null
  newest_entry_date: string | null
}

// ==================== User Reference Types ====================

export interface AuditLogUser {
  user_id: number  // Non-null - backend filters out null user_ids
  username: string
}

// ==================== Cleanup Types ====================

export interface CleanupResponse {
  message: string
  deleted_count: number
}

// ==================== Export Types ====================

export interface ExportResult {
  success: boolean
  filename: string
  isTruncated: boolean
  totalMatching: number | null
  included: number | null
}

// ==================== Display Labels ====================

/**
 * Action type labels for display
 */
export const ACTION_LABELS: Record<string, string> = {
  login: '登录操作',
  logout: '登出操作',
  login_failed: '登录失败',
  password_change: '修改密码',
  password_reset_request: '请求重置密码',
  password_reset: '重置密码',
  create: '创建操作',
  update: '更新操作',
  delete: '删除操作',
  start: '启动操作',
  stop: '停止操作',
  restart: '重启操作',
  kill: '杀死操作',
  rename: '重命名操作',
  shell: 'Shell 访问',
  shell_end: 'Shell 会话终止',
  container_update: '容器更新',
  deploy: '部署操作',
  copy: '复制操作',
  prune: '修剪操作',
  toggle: '切换操作',
  test: '测试操作',
  settings_change: '修改设置',
  role_change: '角色更改',
}

/**
 * Entity type labels for display
 */
export const ENTITY_TYPE_LABELS: Record<string, string> = {
  session: '会话',
  user: '用户',
  host: '主机',
  container: '容器',
  stack: '堆栈',
  deployment: '部署',
  alert_rule: '告警规则',
  notification_channel: '通知频道',
  tag: '标签',
  registry_credential: '注册表凭证',
  health_check: '健康检查',
  update_policy: '更新策略',
  api_key: 'API 密钥',
  settings: '设置',
  role_permission: '角色权限',
  oidc_config: 'OIDC 配置',
}

/**
 * Retention period labels for display
 */
export const RETENTION_LABELS: Record<number, string> = {
  30: '30 天',
  60: '60 天',
  90: '90 天',
  180: '180 天 (6 个月)',
  365: '365 天 (1 年)',
  0: '永久',
}

/**
 * Get action label with fallback
 */
export function getActionLabel(action: string): string {
  return ACTION_LABELS[action] || action
}

/**
 * Get entity type label with fallback
 */
export function getEntityTypeLabel(entityType: string): string {
  return ENTITY_TYPE_LABELS[entityType] || entityType
}
