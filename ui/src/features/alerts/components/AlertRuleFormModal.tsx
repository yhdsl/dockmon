/**
 * AlertRuleFormModal Component
 *
 * Form for creating and editing alert rules
 */

import { useState, useRef, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { X, Search, Check, Bell, BellRing, Send, MessageSquare, Hash, Smartphone, Mail, Globe, Users } from 'lucide-react'
import { RemoveScroll } from 'react-remove-scroll'
import { useCreateAlertRule, useUpdateAlertRule } from '../hooks/useAlertRules'
import { useNotificationChannels } from '../hooks/useNotificationChannels'
import type { AlertRule, AlertSeverity, AlertScope, AlertRuleRequest } from '@/types/alerts'
import { useHosts } from '@/features/hosts/hooks/useHosts'
import type { Host } from '@/types/api'
import type { Container } from '@/features/containers/types'
import { apiClient } from '@/lib/api/client'
import { NoChannelsConfirmModal } from './NoChannelsConfirmModal'
import { useAuth } from '@/features/auth/AuthContext'

interface Props {
  rule?: AlertRule | null
  onClose: () => void
}

/**
 * Form data for alert rule creation/editing
 */
interface AlertRuleFormData {
  name: string
  description: string
  scope: AlertScope
  kind: string
  enabled: boolean
  severity: AlertSeverity
  metric?: string | undefined
  threshold?: number | undefined
  operator?: string | undefined
  occurrences: number
  clear_threshold?: number | null | undefined
  // Alert timing
  alert_active_delay_seconds: number
  alert_clear_delay_seconds: number
  // Notification timing
  notification_active_delay_seconds: number
  notification_cooldown_seconds: number
  // Selectors
  host_selector_all: boolean
  host_selector_ids: string[]
  container_selector_all: boolean
  container_selector_included: string[]
  container_run_mode: 'all' | 'should_run' | 'on_demand'
  notify_channels: number[]  // Channel IDs (not type strings) - supports multiple channels per type
  custom_template: string | null
  auto_resolve_updates: boolean
  auto_resolve_on_clear: boolean
  suppress_during_updates: boolean
}

/**
 * Container selector structure for API requests
 */
interface ContainerSelector {
  tags?: string[]
  include_all?: boolean
  include?: string[]
  exclude?: string[]
  should_run?: boolean | null
}

// CPU metrics can exceed 100% on multi-core containers (up to cores * 100%)
const CPU_METRIC = 'cpu_percent'
const MAX_CPU_THRESHOLD = 6400

const RULE_KINDS = [
  {
    value: 'cpu_high',
    label: 'CPU 使用率过高',
    description: '当 CPU 使用率超过阈值时告警',
    category: '性能',
    requiresMetric: true,
    metric: CPU_METRIC,
    defaultOperator: '>=',
    defaultThreshold: 90,
    scopes: ['host', 'container']
  },
  {
    value: 'memory_high',
    label: '内存使用率过高',
    description: '当内存使用率超过阈值时告警',
    category: '性能',
    requiresMetric: true,
    metric: 'memory_percent',
    defaultOperator: '>=',
    defaultThreshold: 90,
    scopes: ['host', 'container']
  },
  {
    value: 'disk_low',
    label: '磁盘剩余空间过低',
    description: '当磁盘使用率超过阈值时告警',
    category: '性能',
    requiresMetric: true,
    metric: 'disk_percent',
    defaultOperator: '>=',
    defaultThreshold: 85,
    scopes: ['host']
  },
  {
    value: 'container_unhealthy',
    label: '容器内建健康检查失败',
    description: '当 Docker 内建的健康检查失败时告警 (Dockerfile 中的 HEALTHCHECK 配置)',
    category: '容器状态',
    requiresMetric: false,
    scopes: ['container']
  },
  {
    value: 'health_check_failed',
    label: '容器健康检查失败',
    description: '当 HTTP/HTTPS 健康检查失败时告警 (在容器健康检查标签中配置)',
    category: '容器状态',
    requiresMetric: false,
    scopes: ['container']
  },
  {
    value: 'container_stopped',
    label: '容器停止/异常退出',
    description: '当容器停止或异常退出 (任何退出码) 时告警。可设置冷却期避免在重启期间误报。',
    category: '容器状态',
    requiresMetric: false,
    scopes: ['container']
  },
  {
    value: 'container_restart',
    label: '容器重启',
    description: '当容器重启时告警 (无论是预期还是非预期重启)',
    category: '容器状态',
    requiresMetric: false,
    scopes: ['container']
  },
  {
    value: 'host_down',
    label: '主机离线',
    description: '当无法访问主机时告警',
    category: '主机状态',
    requiresMetric: false,
    scopes: ['host']
  },
  {
    value: 'update_available',
    label: '更新可用',
    description: '当容器的镜像有可用更新时告警',
    category: '更新',
    requiresMetric: false,
    scopes: ['container']
  },
  {
    value: 'update_completed',
    label: '更新完成',
    description: '当容器的镜像成功更新时告警',
    category: '更新',
    requiresMetric: false,
    scopes: ['container']
  },
  {
    value: 'update_failed',
    label: '更新失败',
    description: '当容器的镜像更新失败或回滚时告警',
    category: '更新',
    requiresMetric: false,
    scopes: ['container']
  },
]

const OPERATORS = [
  { value: '>=', label: '>= (大于等于)' },
  { value: '<=', label: '<= (小于等于)' },
  { value: '>', label: '> (大于)' },
  { value: '<', label: '< (小于)' },
]

// Channel type metadata for icons and labels
const CHANNEL_TYPE_INFO: Record<string, { label: string; icon: typeof Bell }> = {
  pushover: { label: 'Pushover', icon: Smartphone },
  telegram: { label: 'Telegram', icon: Send },
  discord: { label: 'Discord', icon: MessageSquare },
  slack: { label: 'Slack', icon: Hash },
  teams: { label: 'Microsoft Teams', icon: Users },
  gotify: { label: 'Gotify', icon: Bell },
  ntfy: { label: 'ntfy', icon: BellRing },
  smtp: { label: 'Email', icon: Mail },
  webhook: { label: 'Webhook', icon: Globe },
}

/** Get icon component for a channel type */
function getChannelIcon(type: string) {
  return CHANNEL_TYPE_INFO[type]?.icon || Bell
}

export function AlertRuleFormModal({ rule, onClose }: Props) {
  const { hasCapability } = useAuth()
  const canManage = hasCapability('alerts.manage')
  const createRule = useCreateAlertRule()
  const updateRule = useUpdateAlertRule()
  const isEditing = !!rule

  // Fetch hosts and containers for selectors
  const { data: hostsData } = useHosts()
  const { data: containersData } = useQuery<Container[]>({
    queryKey: ['containers'],
    queryFn: () => apiClient.get<Container[]>('/containers'),
  })

  // Fetch configured notification channels
  const { data: channelsData } = useNotificationChannels()

  const hosts: Host[] = hostsData || []
  const containers: Container[] = containersData || []
  const configuredChannels = channelsData?.channels || []

  // Parse existing selectors
  const parseSelector = (json: string | null | undefined) => {
    if (!json) return { all: true, selected: [] }
    try {
      const parsed = JSON.parse(json)
      if (parsed.include_all) return { all: true, selected: [] }
      if (parsed.include) return { all: false, selected: parsed.include }
      return { all: true, selected: [] }
    } catch {
      return { all: true, selected: [] }
    }
  }

  const [formData, setFormData] = useState<AlertRuleFormData>(() => {
    // Determine if this rule requires a metric
    const ruleKind = rule?.kind || 'cpu_high'
    const kindConfig = RULE_KINDS.find((k) => k.value === ruleKind)
    const isMetricDriven = kindConfig?.requiresMetric ?? true

    // Parse container selector to extract should_run filter and include list
    const parseContainerSelector = (json: string | null | undefined) => {
      if (!json) return { all: true, included: [], should_run: null }
      try {
        const parsed = JSON.parse(json)
        if (parsed.include_all) {
          return {
            all: true,
            included: [],
            should_run: parsed.should_run || null
          }
        }
        if (parsed.include) {
          // Explicit include list for manual selection
          return {
            all: false,
            included: parsed.include,
            should_run: parsed.should_run || null
          }
        }
        return { all: true, included: [], should_run: null }
      } catch {
        return { all: true, included: [], should_run: null }
      }
    }

    const containerSelector = parseContainerSelector(rule?.container_selector_json)

    const scope = rule?.scope || 'container'

    return {
      name: rule?.name || '',
      description: rule?.description || '',
      scope: scope,
      kind: ruleKind,
      enabled: rule?.enabled ?? true,
      severity: rule?.severity || 'warning',
      metric: rule?.metric || 'cpu_percent',
      threshold: rule?.threshold || 90,
      operator: rule?.operator || '>=',
      // Alert timing
      // Metric-driven: require sustained breach (300s alert delay, 60s clear delay)
      // Event-driven: fire immediately (0s alert delay), immediate clear (0s)
      alert_active_delay_seconds: rule?.alert_active_delay_seconds ?? (isMetricDriven ? 300 : 0),
      alert_clear_delay_seconds: rule?.alert_clear_delay_seconds ?? (isMetricDriven ? 60 : 0),
      occurrences: rule?.occurrences ?? (isMetricDriven ? 3 : 1),
      clear_threshold: rule?.clear_threshold,
      // Notification timing
      // Metric-driven: notify immediately (0s delay), 5 min cooldown
      // Event-driven: 30s grace before notifying, 15s cooldown
      notification_active_delay_seconds: rule?.notification_active_delay_seconds ?? (isMetricDriven ? 0 : 30),
      notification_cooldown_seconds: rule?.notification_cooldown_seconds ?? (isMetricDriven ? 300 : 15),
      // Selectors
      host_selector_all: parseSelector(rule?.host_selector_json).all,
      host_selector_ids: parseSelector(rule?.host_selector_json).selected,
      container_selector_all: containerSelector.all,
      container_selector_included: containerSelector.included,
      container_run_mode: containerSelector.should_run === null ? 'all' : containerSelector.should_run ? 'should_run' : 'on_demand',
      // Parse channel IDs - filter to numbers only for backward compatibility
      // (old rules may have type strings like "discord" which we drop - user must re-select)
      notify_channels: rule?.notify_channels_json
        ? (JSON.parse(rule.notify_channels_json) as (number | string)[]).filter((v): v is number => typeof v === 'number')
        : [],
      custom_template: rule?.custom_template !== undefined ? rule.custom_template : null,
      // Auto-resolve defaults to false - user can enable for any alert type
      auto_resolve_updates: rule?.auto_resolve ?? false,
      auto_resolve_on_clear: rule?.auto_resolve_on_clear ?? false,
      // Default suppress_during_updates to true for container-scoped rules
      suppress_during_updates: rule?.suppress_during_updates ?? (scope === 'container'),
    }
  })

  const [error, setError] = useState<string | null>(null)
  const [showNoChannelsConfirm, setShowNoChannelsConfirm] = useState(false)

  // Host/Container dropdown state
  const [hostSearchInput, setHostSearchInput] = useState('')
  const [showHostDropdown, setShowHostDropdown] = useState(false)
  const hostDropdownRef = useRef<HTMLDivElement>(null)
  const [containerSearchInput, setContainerSearchInput] = useState('')
  const [showContainerDropdown, setShowContainerDropdown] = useState(false)
  const containerDropdownRef = useRef<HTMLDivElement>(null)

  // Tag selector state (always available, not scope-dependent)
  // Tags now include source metadata to distinguish user-created vs derived (from Docker labels)
  // See: https://github.com/yhdsl/dockmon/issues/88
  type TagWithSource = { name: string; source: 'user' | 'derived'; color?: string | null }
  const [tagSearchInput, setTagSearchInput] = useState('')
  const [availableTags, setAvailableTags] = useState<TagWithSource[]>([])
  const [selectedTags, setSelectedTags] = useState<string[]>(() => {
    // Initialize with existing tags if editing - check selectors not labels_json
    if (rule) {
      try {
        // Check host_selector for tags
        if (rule.host_selector_json) {
          const parsed = JSON.parse(rule.host_selector_json)
          if (parsed.tags && Array.isArray(parsed.tags)) return parsed.tags
        }
        // Check container_selector for tags
        if (rule.container_selector_json) {
          const parsed = JSON.parse(rule.container_selector_json)
          if (parsed.tags && Array.isArray(parsed.tags)) return parsed.tags
        }
      } catch {
        // Parsing failed, fall through
      }
    }
    return []
  })

  // Fetch available tags based on scope (host or container)
  // For containers, include derived tags from Docker labels (compose:*, swarm:*, dockmon.tag)
  useEffect(() => {
    const fetchTags = async () => {
      try {
        const data = formData.scope === 'host'
          ? await apiClient.get<{ tags: (string | TagWithSource)[] }>('/hosts/tags/suggest', { params: { q: tagSearchInput, limit: 50 } })
          : await apiClient.get<{ tags: (string | TagWithSource)[] }>('/tags/suggest', { params: { q: tagSearchInput, limit: 50, include_derived: true } })
        const tags: TagWithSource[] = Array.isArray(data.tags)
          ? data.tags.map((t: string | TagWithSource) =>
              typeof t === 'string'
                ? { name: t, source: 'user' as const, color: null }
                : { name: t.name, source: t.source || 'user', color: t.color ?? null }
            )
          : []
        setAvailableTags(tags)
      } catch (err) {
        console.error('Failed to fetch tags:', err)
      }
    }

    const timer = setTimeout(fetchTags, 300)
    return () => clearTimeout(timer)
  }, [tagSearchInput, formData.scope])

  const selectedKind = RULE_KINDS.find((k) => k.value === formData.kind)
  const requiresMetric = selectedKind?.requiresMetric ?? true

  // Filter rule kinds based on selected scope
  const availableRuleKinds = RULE_KINDS.filter((k) => k.scopes.includes(formData.scope))

  // Filter hosts/containers based on search
  const filteredHosts = hosts.filter(
    (h) =>
      h.name.toLowerCase().includes(hostSearchInput.toLowerCase()) ||
      (h.url && h.url.toLowerCase().includes(hostSearchInput.toLowerCase()))
  )

  const filteredContainers = containers
    .filter((c) => {
      // Apply run mode filter
      if (formData.container_run_mode === 'should_run' && c.desired_state !== 'should_run') return false
      if (formData.container_run_mode === 'on_demand' && c.desired_state !== 'on_demand') return false

      // Apply search filter
      return (
        c.name.toLowerCase().includes(containerSearchInput.toLowerCase()) ||
        (c.host_name && c.host_name.toLowerCase().includes(containerSearchInput.toLowerCase()))
      )
    })

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (hostDropdownRef.current && !hostDropdownRef.current.contains(event.target as Node)) {
        setShowHostDropdown(false)
      }
      if (containerDropdownRef.current && !containerDropdownRef.current.contains(event.target as Node)) {
        setShowContainerDropdown(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Clean up non-existent channel IDs when editing a rule (#166)
  // This handles orphaned references from channels deleted before the backend fix
  useEffect(() => {
    if (isEditing && configuredChannels.length > 0 && formData.notify_channels.length > 0) {
      const validChannelIds = new Set(configuredChannels.map(c => c.id))
      const cleanedChannels = formData.notify_channels.filter(id => validChannelIds.has(id))
      if (cleanedChannels.length !== formData.notify_channels.length) {
        setFormData(prev => ({ ...prev, notify_channels: cleanedChannels }))
      }
    }
  }, [isEditing, configuredChannels]) // Only run when channels load, not on every formData change

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    // Check if user has selected notification channels
    if (formData.notify_channels.length === 0) {
      // Show confirmation modal
      setShowNoChannelsConfirm(true)
      return
    }

    // Proceed with submission
    await performSubmit()
  }

  const performSubmit = async () => {
    try {
      // Prepare request data
      const requestData: Partial<AlertRuleRequest> = {
        name: formData.name,
        description: formData.description,
        scope: formData.scope,
        kind: formData.kind,
        enabled: formData.enabled,
        severity: formData.severity,
        // Notification timing
        notification_active_delay_seconds: formData.notification_active_delay_seconds,
        notification_cooldown_seconds: formData.notification_cooldown_seconds,
      }

      // Add metric fields only if required
      if (requiresMetric) {
        if (formData.metric !== undefined) {
          requestData.metric = formData.metric
        }
        if (formData.threshold !== undefined) {
          requestData.threshold = formData.threshold
        }
        if (formData.operator !== undefined) {
          requestData.operator = formData.operator
        }
        if (formData.clear_threshold !== undefined && formData.clear_threshold !== null) {
          requestData.clear_threshold = formData.clear_threshold
        }
        // Alert timing (for metric rules)
        requestData.alert_active_delay_seconds = formData.alert_active_delay_seconds
        requestData.alert_clear_delay_seconds = formData.alert_clear_delay_seconds
        if (formData.occurrences && formData.occurrences >= 1) {
          requestData.occurrences = formData.occurrences
        }
      } else {
        // For non-metric (event-driven) rules, add alert timing
        requestData.alert_active_delay_seconds = formData.alert_active_delay_seconds
        requestData.alert_clear_delay_seconds = formData.alert_clear_delay_seconds
      }

      // Add selectors - Tag-based OR individual selection (mutually exclusive)
      if (formData.scope === 'host') {
        // Host scope selectors
        if (selectedTags.length > 0) {
          // Tag-based: hosts with ANY of these tags
          requestData.host_selector_json = JSON.stringify({ tags: selectedTags })
        } else if (formData.host_selector_all) {
          requestData.host_selector_json = JSON.stringify({ include_all: true })
        } else if (formData.host_selector_ids.length > 0) {
          requestData.host_selector_json = JSON.stringify({ include: formData.host_selector_ids })
        }
      } else if (formData.scope === 'container') {
        // Helper to apply should_run filter based on run mode
        const applyRunModeFilter = (selector: ContainerSelector): ContainerSelector => {
          if (formData.container_run_mode === 'should_run') {
            selector.should_run = true
          } else if (formData.container_run_mode === 'on_demand') {
            selector.should_run = false
          }
          return selector
        }

        // Container scope selectors
        if (selectedTags.length > 0) {
          // Tag-based: containers with ANY of these tags
          const selector = applyRunModeFilter({ tags: selectedTags })
          requestData.container_selector_json = JSON.stringify(selector)
        } else if (formData.container_selector_all) {
          const selector = applyRunModeFilter({ include_all: true })
          requestData.container_selector_json = JSON.stringify(selector)
        } else if (formData.container_selector_included.length > 0) {
          const selector = applyRunModeFilter({ include: formData.container_selector_included })
          requestData.container_selector_json = JSON.stringify(selector)
        }
      }

      // Add notification channels
      if (formData.notify_channels.length > 0) {
        requestData.notify_channels_json = JSON.stringify(formData.notify_channels)
      }

      // Add custom template (null/empty string means use category default)
      if (formData.custom_template !== undefined && formData.custom_template !== null) {
        requestData.custom_template = formData.custom_template
      }

      // Add auto_resolve flags for all alert types
      requestData.auto_resolve = formData.auto_resolve_updates || false
      requestData.auto_resolve_on_clear = formData.auto_resolve_on_clear || false

      // Add suppress_during_updates flag for container-scoped rules
      if (formData.scope === 'container') {
        requestData.suppress_during_updates = formData.suppress_during_updates || false
      }

      if (isEditing && rule) {
        await updateRule.mutateAsync({ ruleId: rule.id, rule: requestData as AlertRuleRequest })
      } else {
        await createRule.mutateAsync(requestData as AlertRuleRequest)
      }
      onClose()
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '保存告警规则时失败'
      setError(errorMessage)
    }
  }

  const handleChange = <K extends keyof AlertRuleFormData>(field: K, value: AlertRuleFormData[K]) => {
    setFormData((prev) => {
      const updated = { ...prev, [field]: value }

      // When scope changes, reset rule kind if current selection is invalid for new scope
      // Also clear selected tags since they're scope-specific
      if (field === 'scope') {
        const newScope = value as AlertScope
        setSelectedTags([])
        // Default suppress_during_updates to true for container scope
        updated.suppress_during_updates = (newScope === 'container')

        const currentKind = RULE_KINDS.find((k) => k.value === prev.kind)
        if (currentKind && !currentKind.scopes.includes(newScope)) {
          // Find first valid rule kind for new scope
          const firstValidKind = RULE_KINDS.find((k) => k.scopes.includes(newScope))
          if (firstValidKind) {
            updated.kind = firstValidKind.value
            if (firstValidKind.requiresMetric) {
              // Metric-driven rule defaults
              updated.metric = firstValidKind.metric
              updated.operator = firstValidKind.defaultOperator
              updated.threshold = firstValidKind.defaultThreshold
              updated.alert_active_delay_seconds = 300
              updated.alert_clear_delay_seconds = 60
              updated.occurrences = 3
              updated.notification_active_delay_seconds = 0
              updated.notification_cooldown_seconds = 300
            } else {
              // Event-driven rule defaults
              updated.alert_active_delay_seconds = 0
              updated.alert_clear_delay_seconds = 0
              updated.occurrences = 1
              updated.notification_active_delay_seconds = 30
              updated.notification_cooldown_seconds = 15
            }
          }
        }
      }

      // Auto-set metric, operator, threshold, and timing when rule kind changes
      if (field === 'kind') {
        const kind = RULE_KINDS.find((k) => k.value === value)
        if (kind?.requiresMetric) {
          // Metric-driven rule defaults
          updated.metric = kind.metric
          updated.operator = kind.defaultOperator
          updated.threshold = kind.defaultThreshold
          updated.alert_active_delay_seconds = 300
          updated.alert_clear_delay_seconds = 60
          updated.occurrences = 3
          updated.notification_active_delay_seconds = 0
          updated.notification_cooldown_seconds = 300
        } else {
          // Event-driven rule defaults
          updated.alert_active_delay_seconds = 0
          updated.alert_clear_delay_seconds = 0
          updated.occurrences = 1
          updated.notification_active_delay_seconds = 30
          updated.notification_cooldown_seconds = 15
        }
      }

      return updated
    })
  }

  // Helper to build summary text
  const getSummaryText = () => {
    const parts: string[] = []

    // Trigger type
    if (requiresMetric) {
      const metricName = formData.metric?.replace('_', ' ')
      parts.push(`告警条件: ${
          (metricName || 'metric').replace("cpu percent", "CPU 占用率").replace("memory percent", "内存占用率").replace("disk percent", "磁盘占用率")
      }`)
      parts.push(`阈值: ${formData.operator} ${formData.threshold}%`)
      parts.push(`告警触发延迟: ${formData.alert_active_delay_seconds}s (触发 ${formData.occurrences} 次后告警)`)
    } else {
      const kindLabel = selectedKind?.label || formData.kind
      parts.push(`告警条件: ${kindLabel}`)
      if (formData.alert_active_delay_seconds > 0) {
        parts.push(`告警触发延迟: ${formData.alert_active_delay_seconds}s`)
      }
    }

    // Scope
    if (formData.scope === 'host') {
      if (selectedTags.length > 0) {
        parts.push(`范围: 全部拥有 [${selectedTags.join(', ')}] 标签的主机`)
      } else if (formData.host_selector_all) {
        parts.push('范围: 全部主机')
      } else if (formData.host_selector_ids.length > 0) {
        parts.push(`范围: ${formData.host_selector_ids.length} 个选择的主机`)
      }
    } else if (formData.scope === 'container') {
      let scopeText = ''
      if (selectedTags.length > 0) {
        scopeText = `全部拥有 [${selectedTags.join(', ')}] 标签的容器`
      } else if (formData.container_selector_all) {
        scopeText = '全部容器'
      } else if (formData.container_selector_included.length > 0) {
        scopeText = `${formData.container_selector_included.length} 个选择的容器`
      }
      // Add run mode filter
      if (formData.container_run_mode === 'should_run') {
        scopeText += ' (始终运行)'
      } else if (formData.container_run_mode === 'on_demand') {
        scopeText += ' (按需运行)'
      }
      if (scopeText) {
        parts.push(`范围: ${scopeText}`)
      }
    } else {
      parts.push(`范围: ${formData.scope}`)
    }

    // Severity
    parts.push(`严重程度: ${{'info': '通知','warning': '警告','error': '错误','critical': '严重',}[formData.severity]}`)

    // Timing Configuration
    if (!requiresMetric) {
      // For event-driven rules, show notification active delay
      if (formData.notification_active_delay_seconds > 0) {
        parts.push(`通知触发延迟: ${formData.notification_active_delay_seconds}s`)
      }
      if (formData.alert_clear_delay_seconds > 0) {
        parts.push(`告警清除延迟: ${formData.alert_clear_delay_seconds}s`)
      }
    } else {
      // For metric-driven rules, show clear threshold/delay if set
      if (formData.clear_threshold !== undefined && formData.clear_threshold !== null) {
        parts.push(`自动解决阈值: ${formData.clear_threshold}%`)
      }
      if (formData.alert_clear_delay_seconds > 0) {
        parts.push(`告警清除延迟: ${formData.alert_clear_delay_seconds}s`)
      }
    }

    // Cooldown
    parts.push(`通知冷却时长: ${formData.notification_cooldown_seconds}s`)

    // Suppress during updates (container scope only)
    if (formData.scope === 'container') {
      parts.push(`在更新期间禁用: ${formData.suppress_during_updates ? '是' : '否'}`)
    }

    // Notifications - filter out channels that no longer exist
    const existingChannels = formData.notify_channels
      .map((id) => configuredChannels.find(c => c.id === id))
      .filter((c): c is NonNullable<typeof c> => c !== undefined)
    if (existingChannels.length > 0) {
      const channelNames = existingChannels.map(c => c.name).join(', ')
      parts.push(`通知频道: ${channelNames}`)
    } else {
      parts.push('通知频道: 无')
    }

    return parts
  }

  // Compute button text - avoid nested ternary in JSX
  const isSaving = createRule.isPending || updateRule.isPending
  const submitButtonText = isSaving ? '保存中...' : (isEditing ? '更新规则' : '保存规则')

  return (
    <RemoveScroll>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/70 z-50"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
        <div className="w-full max-w-6xl rounded-lg border border-gray-700 bg-[#0d1117] shadow-2xl max-h-[90vh] overflow-y-auto pointer-events-auto">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-700 px-6 py-4">
          <h2 className="text-xl font-semibold text-white">{isEditing ? '编辑告警规则' : '创建告警规则'}</h2>
          <button
            onClick={onClose}
            className="rounded-md p-1 text-gray-400 transition-colors hover:bg-gray-800 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Form - 2 Column Layout */}
        <form onSubmit={handleSubmit} className="flex">
          {/* Left Column - Form Fields */}
          <fieldset disabled={!canManage} className="flex-1 disabled:opacity-60">
          <div className="p-6 space-y-6 border-r border-gray-700">
            {error && (
              <div className="rounded-md bg-red-500/10 border border-red-500/20 px-4 py-3 text-sm text-red-400">
                {error}
              </div>
            )}

          {/* Basic Info */}
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">告警规则名称*</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => handleChange('name', e.target.value)}
                required
                className="w-full rounded-md border border-gray-700 bg-gray-800 px-3 py-2 text-white placeholder-gray-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                placeholder="例如: CPU 使用率过高时告警"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">描述</label>
              <textarea
                value={formData.description}
                onChange={(e) => handleChange('description', e.target.value)}
                rows={2}
                className="w-full rounded-md border border-gray-700 bg-gray-800 px-3 py-2 text-white placeholder-gray-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                placeholder="该告警规则监控的指标的可选描述"
              />
            </div>
          </div>

          {/* Scope Selection */}
          <div className="space-y-4 rounded-lg border border-gray-700 bg-gray-800/30 p-4">
            <h3 className="text-sm font-semibold text-white">告警范围</h3>
            <p className="text-xs text-gray-400">
              选择该告警规则作用于主机还是容器
            </p>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">范围*</label>
              <select
                value={formData.scope}
                onChange={(e) => handleChange('scope', e.target.value as AlertScope)}
                required
                className="w-full rounded-md border border-gray-700 bg-gray-800 px-3 py-2 text-white focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="host">主机</option>
                <option value="container">容器</option>
              </select>
            </div>
          </div>

          {/* Rule Configuration */}
          <div className="space-y-4 rounded-lg border border-gray-700 bg-gray-800/30 p-4">
            <h3 className="text-sm font-semibold text-white">配置告警规则</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">告警规则类型*</label>
                <select
                  value={formData.kind}
                  onChange={(e) => handleChange('kind', e.target.value)}
                  required
                  className="w-full rounded-md border border-gray-700 bg-gray-800 px-3 py-2 text-white focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  {/* Group rule kinds by category */}
                  {Object.entries(
                    availableRuleKinds.reduce((groups: Record<string, typeof availableRuleKinds>, kind) => {
                      const category = kind.category || '其他'
                      if (!groups[category]) groups[category] = []
                      groups[category].push(kind)
                      return groups
                    }, {})
                  ).map(([category, kinds]) => (
                    <optgroup key={category} label={category}>
                      {kinds.map((kind) => (
                        <option key={kind.value} value={kind.value}>
                          {kind.label}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
                {selectedKind?.description && (
                  <p className="mt-1 text-xs text-gray-400">{selectedKind.description}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">严重程度*</label>
                <select
                  value={formData.severity}
                  onChange={(e) => handleChange('severity', e.target.value as AlertSeverity)}
                  required
                  className="w-full rounded-md border border-gray-700 bg-gray-800 px-3 py-2 text-white focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  <option value="info">通知</option>
                  <option value="warning">警告</option>
                  <option value="error">错误</option>
                  <option value="critical">严重</option>
                </select>
              </div>
            </div>
          </div>

          {/* Tag Filter (Optional) - Always available */}
          <div className="space-y-4 rounded-lg border border-gray-700 bg-gray-800/30 p-4">
            <h3 className="text-sm font-semibold text-white">基于标签的过滤器 (可选)</h3>
            <p className="text-xs text-gray-400">
              选择标签以便将告警规则作用于任何具有其中一个已选择标签的{formData.scope === 'host' ? '主机' : '容器'}。
              当选择了标签后，下方的单独选择卡片将会被禁用。
            </p>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">搜索并选择标签</label>
                <div className="relative mb-2">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
                  <input
                    type="text"
                    value={tagSearchInput}
                    onChange={(e) => setTagSearchInput(e.target.value)}
                    placeholder="搜索标签..."
                    className="w-full pl-9 pr-3 py-2 rounded-md border border-gray-700 bg-gray-800 text-white placeholder-gray-500 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>

                {/* Available Tags */}
                <div className="space-y-1 max-h-40 overflow-y-auto border border-gray-700 rounded-md p-2 bg-gray-900">
                  {availableTags.length === 0 ? (
                    <div className="text-sm text-gray-400 text-center py-2">未找到匹配的标签</div>
                  ) : (
                    availableTags.map((tag) => {
                      const isSelected = selectedTags.includes(tag.name)
                      const isDerived = tag.source === 'derived'
                      return (
                        <button
                          key={tag.name}
                          type="button"
                          onClick={() => {
                            const newTags = isSelected
                              ? selectedTags.filter((t) => t !== tag.name)
                              : [...selectedTags, tag.name]
                            setSelectedTags(newTags)
                          }}
                          className="w-full px-3 py-1.5 text-left text-sm flex items-center gap-2 hover:bg-gray-800 rounded transition-colors"
                        >
                          <div
                            className={`h-4 w-4 rounded border flex items-center justify-center ${
                              isSelected
                                ? 'bg-blue-600 border-blue-600'
                                : 'border-gray-600 bg-gray-800'
                            }`}
                          >
                            {isSelected && <Check className="h-3 w-3 text-white" />}
                          </div>
                          <span className={isDerived ? 'text-gray-300 italic' : 'text-white'}>{tag.name}</span>
                          {isDerived && (
                            <span className="text-xs text-gray-500 ml-auto">(来自派生标签)</span>
                          )}
                        </button>
                      )
                    })
                  )}
                </div>

                {/* Selected Tags Display */}
                {selectedTags.length > 0 && (
                  <div className="mt-3">
                    <label className="block text-xs font-medium text-gray-400 mb-2">已选择的标签 ({selectedTags.length})</label>
                    <div className="flex flex-wrap gap-2">
                      {selectedTags.map((tag) => (
                        <span
                          key={tag}
                          className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-blue-600/20 text-blue-400 text-xs"
                        >
                          {tag}
                          <button
                            type="button"
                            onClick={() => setSelectedTags(selectedTags.filter((t) => t !== tag))}
                            className="hover:text-blue-300"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
          </div>

          {/* Metric Conditions (only for metric-based rules) */}
          {requiresMetric && (
            <div className="space-y-4 rounded-lg border border-gray-700 bg-gray-800/30 p-4">
              <h3 className="text-sm font-semibold text-white">配置阈值</h3>

              <div className="grid grid-cols-2 gap-4">

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">运算符*</label>
                  <select
                    value={formData.operator}
                    onChange={(e) => handleChange('operator', e.target.value)}
                    required={requiresMetric}
                    className="w-full rounded-md border border-gray-700 bg-gray-800 px-3 py-2 text-white focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  >
                    {OPERATORS.map((op) => (
                      <option key={op.value} value={op.value}>
                        {op.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">
                    阈值 (%) *
                  </label>
                  <input
                    type="number"
                    value={formData.threshold}
                    onChange={(e) => handleChange('threshold', e.target.value ? parseFloat(e.target.value) : undefined)}
                    required={requiresMetric}
                    min={0}
                    max={formData.metric === CPU_METRIC ? MAX_CPU_THRESHOLD : 100}
                    step={0.1}
                    className="w-full rounded-md border border-gray-700 bg-gray-800 px-3 py-2 text-white focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                  <p className="mt-1 text-xs text-gray-400">
                    当{{'cpu percent': ' CPU 占用率','memory percent': '内存占用率','disk percent': '磁盘占用率',}[formData.metric?.replace('_', ' ') ?? '']} {formData.operator} {formData.threshold}% 时触发告警
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">自动解决阈值</label>
                  <input
                    type="number"
                    value={formData.clear_threshold || ''}
                    onChange={(e) => handleChange('clear_threshold', e.target.value ? parseFloat(e.target.value) : undefined)}
                    min={0}
                    max={formData.metric === CPU_METRIC ? MAX_CPU_THRESHOLD : 100}
                    step={0.1}
                    className="w-full rounded-md border border-gray-700 bg-gray-800 px-3 py-2 text-white focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    placeholder="可选"
                  />
                  <p className="mt-1 text-xs text-gray-400">触发后自动解决告警的阈值 (例如，当 CPU 占用率降低到 80% 以下)。如果未指定，则默认为规则设定的阈值。</p>
                </div>
              </div>
            </div>
          )}

          {/* Host Selector */}
          {formData.scope === 'host' && (
            <div className="space-y-4 rounded-lg border border-gray-700 bg-gray-800/30 p-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-white">单独主机选择</h3>
                {selectedTags.length === 0 && (
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        handleChange('host_selector_ids', [])
                        handleChange('host_selector_all', true)
                      }}
                      className="text-xs text-blue-400 hover:text-blue-300 underline"
                    >
                      全选
                    </button>
                    <span className="text-gray-600">|</span>
                    <button
                      type="button"
                      onClick={() => {
                        handleChange('host_selector_ids', [])
                        handleChange('host_selector_all', false)
                      }}
                      className="text-xs text-blue-400 hover:text-blue-300 underline"
                    >
                      取消全选
                    </button>
                  </div>
                )}
              </div>

              {selectedTags.length > 0 ? (
                <div className="rounded-md bg-gray-900/50 border border-gray-700 p-4 text-center">
                  <p className="text-sm text-gray-400">
                    单独的主机选择卡片已被禁用。该告警规则适用于任何具有其中一个已选择标签的主机。
                    删除已选择的标签以便手动指定主机。
                  </p>
                </div>
              ) : (
                <div ref={hostDropdownRef} className="relative">
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    选择主机
                    {formData.host_selector_all && hosts.length > 0 && (
                      <span className="ml-2 text-xs text-blue-400">({hosts.length} 个主机 - 已全部选择)</span>
                    )}
                    {!formData.host_selector_all && formData.host_selector_ids.length > 0 && (
                      <span className="ml-2 text-xs text-blue-400">({formData.host_selector_ids.length} 个主机已选择)</span>
                    )}
                  </label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
                    <input
                      type="text"
                      value={hostSearchInput}
                      onChange={(e) => setHostSearchInput(e.target.value)}
                      onFocus={() => setShowHostDropdown(true)}
                      placeholder="搜索主机..."
                      className="w-full pl-9 pr-3 py-2 rounded-md border border-gray-700 bg-gray-800 text-white placeholder-gray-500 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>

                {/* Host Dropdown */}
                {showHostDropdown && (
                  <div className="absolute z-50 w-full mt-1 py-1 rounded-md border border-gray-700 bg-gray-800 shadow-lg max-h-[240px] overflow-y-auto">
                    {filteredHosts.length === 0 ? (
                      <div className="px-3 py-2 text-sm text-gray-400">未找到匹配的主机</div>
                    ) : (
                      filteredHosts.map((host: Host) => {
                        const isSelected = formData.host_selector_all || formData.host_selector_ids.includes(host.id)
                        return (
                          <button
                            key={host.id}
                            type="button"
                            onClick={() => {
                              if (formData.host_selector_all) {
                                // When "all" is selected, clicking means exclude this one
                                const allExcept = hosts.filter(h => h.id !== host.id).map(h => h.id)
                                handleChange('host_selector_ids', allExcept)
                                handleChange('host_selector_all', false)
                              } else {
                                const newIds = isSelected
                                  ? formData.host_selector_ids.filter((id: string) => id !== host.id)
                                  : [...formData.host_selector_ids, host.id]
                                handleChange('host_selector_ids', newIds)
                              }
                            }}
                            className="w-full px-3 py-2 text-left text-sm flex items-center gap-2 hover:bg-gray-700 transition-colors"
                          >
                            <div
                              className={`h-4 w-4 rounded border flex items-center justify-center ${
                                isSelected
                                  ? 'bg-blue-600 border-blue-600'
                                  : 'border-gray-600 bg-gray-800'
                              }`}
                            >
                              {isSelected && <Check className="h-3 w-3 text-white" />}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="font-medium truncate text-white">{host.name}</div>
                              {host.url && (
                                <div className="text-xs text-gray-400 truncate">{host.url}</div>
                              )}
                            </div>
                          </button>
                        )
                      })
                    )}
                  </div>
                )}
                </div>
              )}
            </div>
          )}

          {/* Container Selector (for container scope) */}
          {formData.scope === 'container' && (
            <div className="space-y-4 rounded-lg border border-gray-700 bg-gray-800/30 p-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-white">单独容器选择</h3>
                {selectedTags.length === 0 && (
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        handleChange('container_selector_included', [])
                        handleChange('container_selector_all', true)
                      }}
                      className="text-xs text-blue-400 hover:text-blue-300 underline"
                    >
                      全选
                    </button>
                    <span className="text-gray-600">|</span>
                    <button
                      type="button"
                      onClick={() => {
                        // Deselect all: switch to manual include mode with empty list
                        handleChange('container_selector_included', [])
                        handleChange('container_selector_all', false)
                      }}
                      className="text-xs text-blue-400 hover:text-blue-300 underline"
                    >
                      取消全选
                    </button>
                  </div>
                )}
              </div>

              {selectedTags.length > 0 ? (
                <div className="rounded-md bg-gray-900/50 border border-gray-700 p-4 text-center">
                  <p className="text-sm text-gray-400">
                    单独的容器选择卡片已被禁用。该告警规则适用于任何具有其中一个已选择标签的容器。
                    删除已选择的标签以便手动指定容器。
                  </p>
                </div>
              ) : (
                <>
                  {/* Container Run Mode Selector */}
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">容器运行模式</label>
                    <div className="grid grid-cols-3 gap-2">
                      <button
                        type="button"
                        onClick={() => handleChange('container_run_mode', 'all')}
                        className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                          formData.container_run_mode === 'all'
                            ? 'bg-blue-600 text-white'
                            : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                        }`}
                      >
                        全部容器
                      </button>
                      <button
                        type="button"
                        onClick={() => handleChange('container_run_mode', 'should_run')}
                        className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                          formData.container_run_mode === 'should_run'
                            ? 'bg-blue-600 text-white'
                            : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                        }`}
                      >
                        始终运行
                      </button>
                      <button
                        type="button"
                        onClick={() => handleChange('container_run_mode', 'on_demand')}
                        className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                          formData.container_run_mode === 'on_demand'
                            ? 'bg-blue-600 text-white'
                            : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                        }`}
                      >
                        按需运行
                      </button>
                    </div>
                    <p className="mt-2 text-xs text-gray-400">
                      根据不同的运行模式过滤容器，以便为不同的严重程度创建独立的告警规则
                    </p>
                  </div>

                  {/* Show container selector only when "All Containers" is selected */}
                  {formData.container_run_mode === 'all' ? (
                    <div ref={containerDropdownRef} className="relative">
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    选择容器
                    {formData.container_selector_all && filteredContainers.length > 0 && (
                      <span className="ml-2 text-xs text-blue-400">({filteredContainers.length} 个容器 - 已全部选择)</span>
                    )}
                    {!formData.container_selector_all && formData.container_selector_included.length > 0 && (
                      <span className="ml-2 text-xs text-blue-400">({formData.container_selector_included.length} 个容器已选择)</span>
                    )}
                  </label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
                  <input
                    type="text"
                    value={containerSearchInput}
                    onChange={(e) => setContainerSearchInput(e.target.value)}
                    onFocus={() => setShowContainerDropdown(true)}
                    placeholder="搜索容器..."
                    className="w-full pl-9 pr-3 py-2 rounded-md border border-gray-700 bg-gray-800 text-white placeholder-gray-500 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>

                {/* Container Dropdown */}
                {showContainerDropdown && (
                  <div className="absolute z-50 w-full mt-1 py-1 rounded-md border border-gray-700 bg-gray-800 shadow-lg max-h-[240px] overflow-y-auto">
                    {filteredContainers.length === 0 ? (
                      <div className="px-3 py-2 text-sm text-gray-400">未找到匹配的容器</div>
                    ) : (
                      filteredContainers.map((container: Container) => {
                        // Issue #99: Use composite key (host_id:name) to differentiate same-named containers on different hosts
                        const containerKey = `${container.host_id}:${container.name}`
                        // Check both composite key (new format) and name-only (legacy format) for backward compatibility
                        const isSelected = formData.container_selector_all ||
                          formData.container_selector_included.includes(containerKey) ||
                          formData.container_selector_included.includes(container.name)
                        return (
                          <button
                            key={container.id}
                            type="button"
                            onClick={() => {
                              if (formData.container_selector_all) {
                                // When "all" is selected, clicking switches to include mode with all except this one
                                const allExcept = filteredContainers
                                  .filter(c => `${c.host_id}:${c.name}` !== containerKey)
                                  .map(c => `${c.host_id}:${c.name}`)
                                handleChange('container_selector_included', allExcept)
                                handleChange('container_selector_all', false)
                              } else {
                                // Manual include mode - toggle this container
                                const newKeys = isSelected
                                  // Filter out both composite key (new) and name (legacy) to handle both formats
                                  ? formData.container_selector_included.filter((k: string) => k !== containerKey && k !== container.name)
                                  : [...formData.container_selector_included, containerKey]
                                handleChange('container_selector_included', newKeys)
                              }
                            }}
                            className="w-full px-3 py-2 text-left text-sm flex items-center gap-2 hover:bg-gray-700 transition-colors"
                          >
                            <div
                              className={`h-4 w-4 rounded border flex items-center justify-center ${
                                isSelected
                                  ? 'bg-blue-600 border-blue-600'
                                  : 'border-gray-600 bg-gray-800'
                              }`}
                            >
                              {isSelected && <Check className="h-3 w-3 text-white" />}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="font-medium truncate text-white">{container.name}</div>
                              {container.host_name && (
                                <div className="text-xs text-gray-400 truncate">{container.host_name}</div>
                              )}
                            </div>
                          </button>
                        )
                      })
                    )}
                  </div>
                )}
              </div>
            ) : (
              /* Show read-only info when a specific run mode is selected */
              <div className="space-y-2">
                <div className="text-sm text-gray-300">
                  <span className="font-medium">匹配的容器数目:</span>
                  <span className="ml-2 text-xs text-blue-400">{filteredContainers.length} 个</span>
                </div>
                <div className="rounded-lg border border-blue-500/30 bg-blue-500/10 p-3">
                  <p className="text-xs text-blue-300">
                    所有运行模式为"{formData.container_run_mode === 'should_run' ? '始终运行' : '按需运行'}"的容器将会被自动监控。
                    如果需要将特定容器排除在此告警规则之外，请在对应容器的设置中更改运行模式。
                  </p>
                </div>
              </div>
            )}
                </>
              )}
            </div>
          )}

          {/* Alert Timing Configuration - Hide for update rules */}
          {!['update_available', 'update_completed', 'update_failed'].includes(formData.kind) && (
          <div className="space-y-4 rounded-lg border border-gray-700 bg-gray-800/30 p-4">
            <div>
              <h3 className="text-sm font-semibold text-white">告警时间</h3>
              <p className="text-xs text-gray-400 mt-1">控制告警何时触发以及何时清除</p>
            </div>

            {/* Metric-driven alert timing */}
            {requiresMetric && (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">告警激活延迟 (秒) *</label>
                    <input
                      type="number"
                      value={formData.alert_active_delay_seconds}
                      onChange={(e) => handleChange('alert_active_delay_seconds', parseInt(e.target.value) || 0)}
                      required
                      min={0}
                      className="w-full rounded-md border border-gray-700 bg-gray-800 px-3 py-2 text-white focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                    <p className="mt-1 text-xs text-gray-500">需要告警条件保持为真多久后触发告警</p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">告警清除延迟 (秒)</label>
                    <input
                      type="number"
                      value={formData.alert_clear_delay_seconds}
                      onChange={(e) => handleChange('alert_clear_delay_seconds', parseInt(e.target.value) || 0)}
                      min={0}
                      placeholder="60"
                      className="w-full rounded-md border border-gray-700 bg-gray-800 px-3 py-2 text-white focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                    <p className="mt-1 text-xs text-gray-500">需要告警条件保持为假多久后清除告警</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">触发次数*</label>
                    <input
                      type="number"
                      value={formData.occurrences}
                      onChange={(e) => handleChange('occurrences', parseInt(e.target.value) || 1)}
                      required
                      min={1}
                      max={100}
                      className="w-full rounded-md border border-gray-700 bg-gray-800 px-3 py-2 text-white focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                    <p className="mt-1 text-xs text-gray-500">需要重复达到多少次告警条件后触发告警</p>
                  </div>
                </div>
              </>
            )}

            {/* Event-driven alert timing */}
            {!requiresMetric && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">告警激活延迟 (秒)</label>
                  <input
                    type="number"
                    value={formData.alert_active_delay_seconds}
                    onChange={(e) => handleChange('alert_active_delay_seconds', parseInt(e.target.value) || 0)}
                    min={0}
                    placeholder="0"
                    className="w-full rounded-md border border-gray-700 bg-gray-800 px-3 py-2 text-white focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                  <p className="mt-1 text-xs text-gray-400">
                    需要告警条件保持为真多久后触发告警？设置为 0 以立即触发告警。
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">告警清除延迟 (秒)</label>
                  <input
                    type="number"
                    value={formData.alert_clear_delay_seconds}
                    onChange={(e) => handleChange('alert_clear_delay_seconds', parseInt(e.target.value) || 0)}
                    min={0}
                    placeholder="0"
                    className="w-full rounded-md border border-gray-700 bg-gray-800 px-3 py-2 text-white focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                  <p className="mt-1 text-xs text-gray-400">
                    需要告警条件保持为假多久后清除告警？设置为 0 以立即清除告警。
                  </p>
                </div>
              </div>
            )}
          </div>
          )}

          {/* Notification Timing Configuration */}
          {!['update_available', 'update_completed', 'update_failed'].includes(formData.kind) && (
          <div className="space-y-4 rounded-lg border border-gray-700 bg-gray-800/30 p-4">
            <div>
              <h3 className="text-sm font-semibold text-white">通知时间</h3>
              <p className="text-xs text-gray-400 mt-1">控制通知何时发送以及重复次数</p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">通知激活延迟 (秒)</label>
                <input
                  type="number"
                  value={formData.notification_active_delay_seconds}
                  onChange={(e) => handleChange('notification_active_delay_seconds', parseInt(e.target.value) || 0)}
                  min={0}
                  placeholder={requiresMetric ? '0' : '30'}
                  className="w-full rounded-md border border-gray-700 bg-gray-800 px-3 py-2 text-white focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
                <p className="mt-1 text-xs text-gray-400">
                  需要告警激活多久后发送通知。可用于过滤存在频繁波动下触发的告警。
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">通知冷却时长 (秒) *</label>
                <input
                  type="number"
                  value={formData.notification_cooldown_seconds}
                  onChange={(e) => handleChange('notification_cooldown_seconds', parseInt(e.target.value) || 0)}
                  required
                  min={0}
                  className="w-full rounded-md border border-gray-700 bg-gray-800 px-3 py-2 text-white focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
                <p className="mt-1 text-xs text-gray-500">重复发送相同告警的通知的最短时长</p>
              </div>
            </div>
          </div>
          )}

          {/* Auto-Resolve Options - Available for all alert types */}
          <div className="space-y-4 rounded-lg border border-gray-700 bg-gray-800/30 p-4">
            <h3 className="text-sm font-semibold text-white">告警自动解决行为</h3>

            {/* Auto-resolve on clear (condition-based) */}
            <div className="flex items-start gap-3">
              <input
                type="checkbox"
                id="auto_resolve_on_clear"
                checked={formData.auto_resolve_on_clear || false}
                onChange={(e) => handleChange('auto_resolve_on_clear', e.target.checked)}
                className="mt-1 h-4 w-4 rounded border-gray-600 bg-gray-800 text-blue-600 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-gray-900"
              />
              <div className="flex-1">
                <label htmlFor="auto_resolve_on_clear" className="block text-sm font-medium text-gray-300 cursor-pointer">
                  当告警条件清除后自动解决
                </label>
                <p className="mt-1 text-xs text-gray-400">
                  当告警条件不再为真时自动解决告警 (例如，容器已重启或恢复健康)。
                  建议为大多数告警规则启用此功能。
                </p>
              </div>
            </div>

            {/* Auto-resolve after notification (notification-only mode) */}
            <div className="flex items-start gap-3">
              <input
                type="checkbox"
                id="auto_resolve_updates"
                checked={formData.auto_resolve_updates || false}
                onChange={(e) => handleChange('auto_resolve_updates', e.target.checked)}
                className="mt-1 h-4 w-4 rounded border-gray-600 bg-gray-800 text-blue-600 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-gray-900"
              />
              <div className="flex-1">
                <label htmlFor="auto_resolve_updates" className="block text-sm font-medium text-gray-300 cursor-pointer">
                  当发送通知后自动解决
                </label>
                <p className="mt-1 text-xs text-gray-400">
                  告警将在发送通知后立即自动解决。
                  如果你不希望告警数据在 DockMon 告警列表中累积，可选择该配置用于仅发送告警通知。
                </p>
              </div>
            </div>
          </div>

          {/* Suppress During Updates - Only for container-scoped rules */}
          {formData.scope === 'container' && !['update_available', 'update_completed', 'update_failed'].includes(formData.kind) && (
          <div className="space-y-4 rounded-lg border border-gray-700 bg-gray-800/30 p-4">
            <h3 className="text-sm font-semibold text-white">在更新期间禁用</h3>
            <div className="flex items-start gap-3">
              <input
                type="checkbox"
                id="suppress_during_updates"
                checked={formData.suppress_during_updates || false}
                onChange={(e) => handleChange('suppress_during_updates', e.target.checked)}
                className="mt-1 h-4 w-4 rounded border-gray-600 bg-gray-800 text-blue-600 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-gray-900"
              />
              <div className="flex-1">
                <label htmlFor="suppress_during_updates" className="block text-sm font-medium text-gray-300 cursor-pointer">
                  在容器更新期间禁用该告警规则
                </label>
                <p className="mt-1 text-xs text-gray-400">
                  在容器更新期间不触发此告警规则。在更新完成后将重新开始监视 - 只有当问题仍然持续存在时才会触发告警 (例如，更新后容器仍然处于停止状态)。
                </p>
              </div>
            </div>
          </div>
          )}

          {/* Notification Channels */}
          <div className="space-y-4 rounded-lg border border-gray-700 bg-gray-800/30 p-4">
            <h3 className="text-sm font-semibold text-white">通知频道</h3>
            <p className="text-xs text-gray-400">选择此告警规则触发时需要通知的频道</p>

            {configuredChannels.length === 0 ? (
              <div className="text-sm text-gray-400 py-4 text-center">
                尚未配置任何通知频道。请在设置页面中进行配置以启用通知功能。
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {/* Render each configured channel individually (supports multiple per type) */}
                {configuredChannels.map((channel) => {
                  const IconComponent = getChannelIcon(channel.type)
                  const typeInfo = CHANNEL_TYPE_INFO[channel.type]
                  const isDisabled = !channel.enabled

                  return (
                    <label
                      key={channel.id}
                      className={`flex items-center gap-2 text-sm p-2 rounded ${
                        isDisabled
                          ? 'text-gray-500 cursor-not-allowed'
                          : 'text-gray-300 hover:bg-gray-800/50 cursor-pointer'
                      }`}
                      title={isDisabled ? `${channel.name} 已被禁用` : undefined}
                    >
                      <input
                        type="checkbox"
                        checked={formData.notify_channels.includes(channel.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            handleChange('notify_channels', [...formData.notify_channels, channel.id])
                          } else {
                            handleChange('notify_channels', formData.notify_channels.filter((id) => id !== channel.id))
                          }
                        }}
                        disabled={isDisabled}
                        className="h-4 w-4 rounded border-gray-600 bg-gray-800 text-blue-600 focus:ring-2 focus:ring-blue-500 focus:ring-offset-0 disabled:opacity-50 disabled:cursor-not-allowed"
                      />
                      <IconComponent className="h-4 w-4" />
                      <span className="flex items-center gap-1">
                        <span>{channel.name}</span>
                        <span className="text-xs text-gray-500">({typeInfo?.label || channel.type})</span>
                      </span>
                    </label>
                  )
                })}
              </div>
            )}
          </div>

          {/* Custom Template (Optional) */}
          <div className="space-y-4 rounded-lg border border-gray-700 bg-gray-800/30 p-4">
            <div>
              <h3 className="text-sm font-semibold text-white">自定义消息模板 (可选)</h3>
              <p className="text-xs text-gray-400">在此告警规则中使用自定义的消息模板</p>
            </div>

            <div>
              <label className="flex items-center gap-2 text-sm text-gray-300 mb-2">
                <input
                  type="checkbox"
                  checked={!!formData.custom_template}
                  onChange={(e) => {
                    if (e.target.checked) {
                      handleChange('custom_template', '')
                    } else {
                      handleChange('custom_template', null)
                    }
                  }}
                  className="h-4 w-4 rounded border-gray-600 bg-gray-800 text-blue-600 focus:ring-2 focus:ring-blue-500 focus:ring-offset-0"
                />
                在此告警规则中使用自定义的消息模板
              </label>

              {formData.custom_template !== null && formData.custom_template !== undefined && (
                <>
                  <textarea
                    value={formData.custom_template}
                    onChange={(e) => handleChange('custom_template', e.target.value)}
                    rows={6}
                    placeholder="输入自定义的消息模板，或者留空以使用默认的消息模板..."
                    className="w-full rounded-md border border-gray-700 bg-gray-800 px-3 py-2 text-white font-mono text-sm placeholder-gray-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                  <p className="mt-2 text-xs text-gray-400">
                    留空以使用设置页面中各类别的默认消息模板。可用使用例如 {'{CONTAINER_NAME}'} 这样的变量。
                  </p>
                </>
              )}
            </div>
          </div>

          {/* Enable/Disable */}
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="enabled"
              checked={formData.enabled}
              onChange={(e) => handleChange('enabled', e.target.checked)}
              className="h-4 w-4 rounded border-gray-600 bg-gray-800 text-blue-600 focus:ring-2 focus:ring-blue-500 focus:ring-offset-0"
            />
            <label htmlFor="enabled" className="text-sm text-gray-300">
              立即启用此告警规则
            </label>
          </div>
          </div>
          </fieldset>

          {/* Right Column - Summary */}
          <div className="w-80 p-6 bg-gray-800/30">
            <h3 className="text-sm font-semibold text-white mb-4">告警规则摘要</h3>
            <div className="space-y-3">
              {getSummaryText().map((line, idx) => {
                const colonIdx = line.indexOf(':')
                const label = colonIdx >= 0 ? line.slice(0, colonIdx) : line
                const value = colonIdx >= 0 ? line.slice(colonIdx + 1) : ''
                return (
                  <div key={idx} className="text-sm">
                    <span className="text-gray-400">{label}:</span>
                    <span className="text-white ml-1">{value}</span>
                  </div>
                )
              })}
            </div>
          </div>
        </form>

        {/* Actions - Below form */}
        <div className="flex items-center justify-end gap-3 border-t border-gray-700 px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md bg-gray-800 px-4 py-2 text-sm font-medium text-gray-300 transition-colors hover:bg-gray-700"
          >
            取消
          </button>
          <button
            type="button"
            onClick={() => {
              const form = document.querySelector('form')
              if (form) {
                form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
              }
            }}
            disabled={!canManage || isSaving}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
          >
            {submitButtonText}
          </button>
        </div>
        </div>
      </div>

      {/* No Channels Confirmation Modal */}
      <NoChannelsConfirmModal
        isOpen={showNoChannelsConfirm}
        onClose={() => setShowNoChannelsConfirm(false)}
        onConfirm={() => {
          setShowNoChannelsConfirm(false)
          void performSubmit()
        }}
        hasConfiguredChannels={configuredChannels.length > 0}
      />
    </RemoveScroll>
  )
}
