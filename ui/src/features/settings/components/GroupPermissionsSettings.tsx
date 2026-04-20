/**
 * Group Permissions Settings Component
 * Admin-only group permissions management interface
 *
 * Group-Based Permissions Refactor (v2.4.0)
 */

import { useState, useEffect, useMemo, useCallback } from 'react'
import {
  RefreshCw,
  Save,
  Users,
  ChevronDown,
  ChevronRight,
  AlertTriangle,
  Check,
  X,
  Lock,
  Copy,
} from 'lucide-react'
import { useCapabilities } from '@/hooks/useRoles'
import { useGroups, useAllGroupPermissions, useUpdateGroupPermissions, useCopyGroupPermissions } from '@/hooks/useGroups'
import type { Group } from '@/types/groups'
import { Button } from '@/components/ui/button'
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

export function GroupPermissionsSettings() {
  // Queries
  const { data: capabilitiesData, isLoading: loadingCaps } = useCapabilities()
  const { data: groupsData, isLoading: loadingGroups } = useGroups()
  const { data: permissionsData, isLoading: loadingPerms, refetch } = useAllGroupPermissions()

  // Mutations
  const updatePermissions = useUpdateGroupPermissions()
  const copyPermissions = useCopyGroupPermissions()

  // Local state for edited permissions
  const [editedPermissions, setEditedPermissions] = useState<Record<number, Record<string, boolean>>>({})
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set())
  const [showCopyDialog, setShowCopyDialog] = useState(false)
  const [copyTargetGroupId, setCopyTargetGroupId] = useState<number | null>(null)
  const [copySourceGroupId, setCopySourceGroupId] = useState<string>('')

  const groups = groupsData?.groups || []

  // Initialize edited permissions from server data
  useEffect(() => {
    if (permissionsData?.permissions) {
      setEditedPermissions(permissionsData.permissions)
    }
  }, [permissionsData])

  // Expand all categories by default
  useEffect(() => {
    if (capabilitiesData?.categories) {
      setExpandedCategories(new Set(capabilitiesData.categories))
    }
  }, [capabilitiesData])

  // Group capabilities by category
  const categorizedCapabilities = useMemo(() => {
    if (!capabilitiesData?.capabilities) return new Map()

    const map = new Map<string, typeof capabilitiesData.capabilities>()
    for (const cap of capabilitiesData.capabilities) {
      const existing = map.get(cap.category) || []
      existing.push(cap)
      map.set(cap.category, existing)
    }
    return map
  }, [capabilitiesData])

  // Check if there are unsaved changes (bidirectional)
  const hasChanges = useMemo(() => {
    if (!permissionsData?.permissions) return false

    // Forward: check if edited has values different from original
    for (const [groupId, caps] of Object.entries(editedPermissions)) {
      const original = permissionsData.permissions[parseInt(groupId, 10)] || {}
      for (const [cap, allowed] of Object.entries(caps)) {
        if (original[cap] !== allowed) return true
      }
    }

    // Reverse: check if original has values not present in edited
    for (const [groupId, caps] of Object.entries(permissionsData.permissions)) {
      const edited = editedPermissions[parseInt(groupId, 10)] || {}
      for (const [cap, allowed] of Object.entries(caps)) {
        if (edited[cap] !== allowed) return true
      }
    }

    return false
  }, [permissionsData, editedPermissions])

  // Toggle category expansion
  const toggleCategory = useCallback((category: string) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev)
      if (next.has(category)) {
        next.delete(category)
      } else {
        next.add(category)
      }
      return next
    })
  }, [])

  // Handle permission toggle
  const handleToggle = useCallback((groupId: number, capability: string) => {
    setEditedPermissions((prev) => ({
      ...prev,
      [groupId]: {
        ...prev[groupId],
        [capability]: !prev[groupId]?.[capability],
      },
    }))
  }, [])

  // Save changes for a specific group
  const handleSaveGroup = async (groupId: number) => {
    if (!permissionsData?.permissions) return

    const original = permissionsData.permissions[groupId] || {}
    const edited = editedPermissions[groupId] || {}
    const changes: Array<{ capability: string; allowed: boolean }> = []

    for (const [capability, allowed] of Object.entries(edited)) {
      if (original[capability] !== allowed) {
        changes.push({ capability, allowed })
      }
    }

    if (changes.length > 0) {
      await updatePermissions.mutateAsync({
        groupId,
        request: { permissions: changes },
      })
      await refetch()
    }
  }

  // Save all changes
  const handleSaveAll = async () => {
    if (!permissionsData?.permissions) return
    const errors: string[] = []

    for (const group of groups) {
      const original = permissionsData.permissions[group.id] || {}
      const edited = editedPermissions[group.id] || {}
      const changes: Array<{ capability: string; allowed: boolean }> = []

      for (const [capability, allowed] of Object.entries(edited)) {
        if (original[capability] !== allowed) {
          changes.push({ capability, allowed })
        }
      }

      if (changes.length > 0) {
        try {
          await updatePermissions.mutateAsync({
            groupId: group.id,
            request: { permissions: changes },
          })
        } catch {
          errors.push(group.name)
        }
      }
    }
    await refetch()
    if (errors.length > 0) {
      toast.error(`无法为 ${errors.join(', ')} 保存权限`)
    }
  }

  // Open copy dialog
  const openCopyDialog = (targetGroupId: number) => {
    setCopyTargetGroupId(targetGroupId)
    setCopySourceGroupId('')
    setShowCopyDialog(true)
  }

  // Handle copy confirm
  const handleCopyConfirm = async () => {
    if (!copyTargetGroupId || !copySourceGroupId) return
    await copyPermissions.mutateAsync({
      targetGroupId: copyTargetGroupId,
      sourceGroupId: parseInt(copySourceGroupId, 10),
    })
    await refetch()
    setShowCopyDialog(false)
  }

  // Discard changes
  const handleDiscard = () => {
    if (permissionsData?.permissions) {
      setEditedPermissions(permissionsData.permissions)
    }
  }

  // Check if group has any changes (both directions to catch removals)
  const groupHasChanges = (groupId: number) => {
    if (!permissionsData?.permissions) return false
    const original = permissionsData.permissions[groupId] || {}
    const edited = editedPermissions[groupId] || {}

    for (const [cap, allowed] of Object.entries(edited)) {
      if (original[cap] !== allowed) return true
    }
    for (const [cap, allowed] of Object.entries(original)) {
      if (edited[cap] !== allowed) return true
    }
    return false
  }

  const isLoading = loadingCaps || loadingGroups || loadingPerms

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <RefreshCw className="h-6 w-6 animate-spin text-gray-400" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-white">群组权限</h2>
          <p className="mt-1 text-sm text-gray-400">
            自定义各群组可对系统执行的操作
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw className="mr-2 h-4 w-4" />
            刷新
          </Button>
        </div>
      </div>

      {/* Unsaved changes warning */}
      {hasChanges && (
        <div className="flex items-center justify-between rounded-lg border border-yellow-700 bg-yellow-900/20 p-3">
          <div className="flex items-center gap-2 text-yellow-300">
            <AlertTriangle className="h-4 w-4" />
            <span className="text-sm">你有未保存的更改</span>
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={handleDiscard}>
              丢弃
            </Button>
            <Button
              size="sm"
              onClick={handleSaveAll}
              disabled={updatePermissions.isPending}
            >
              {updatePermissions.isPending ? (
                <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Save className="mr-2 h-4 w-4" />
              )}
              保存
            </Button>
          </div>
        </div>
      )}

      {/* Permission matrix */}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b border-gray-700">
              <th className="min-w-[250px] p-3 text-left text-sm font-medium text-gray-400">
                授权内容
              </th>
              {groups.map((group) => (
                <th key={group.id} className="w-32 p-3 text-center">
                  <div className="flex flex-col items-center gap-1">
                    <div className="flex items-center gap-1">
                      <Users className="h-4 w-4 text-blue-400" />
                      {group.is_system && (
                        <span title="系统群组">
                          <Lock className="h-3 w-3 text-gray-500" />
                        </span>
                      )}
                    </div>
                    <span className="text-sm font-medium text-gray-300">
                        {group.name}{group.is_system ? ` (${{'Administrators': "管理群组", 'Operators': "操作群组", 'Read Only': "访客群组"}[group.name]})` : ""}
                    </span>
                    <div className="mt-1 flex gap-1">
                      <button
                        onClick={() => openCopyDialog(group.id)}
                        className="rounded px-1.5 py-0.5 text-xs text-gray-500 hover:bg-gray-700 hover:text-gray-300"
                        title="从其他群组复制权限设定"
                      >
                        <Copy className="h-3 w-3" />
                      </button>
                      {groupHasChanges(group.id) && (
                        <button
                          onClick={() => handleSaveGroup(group.id)}
                          disabled={updatePermissions.isPending}
                          className="rounded bg-blue-600/50 px-1.5 py-0.5 text-xs text-blue-300 hover:bg-blue-600"
                        >
                          保存
                        </button>
                      )}
                    </div>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from(categorizedCapabilities.entries()).map(([category, capabilities]) => (
              <CategorySection
                key={category}
                category={category}
                capabilities={capabilities}
                expanded={expandedCategories.has(category)}
                onToggle={() => toggleCategory(category)}
                groups={groups}
                editedPermissions={editedPermissions}
                onPermissionToggle={handleToggle}
              />
            ))}
          </tbody>
        </table>
      </div>

      {/* Copy permissions dialog */}
      <Dialog open={showCopyDialog} onOpenChange={setShowCopyDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>复制权限设定</DialogTitle>
            <DialogDescription>
              从其他群组复制权限设定至{' '}
              <strong>{groups.find((g) => g.id === copyTargetGroupId)?.name}</strong> 群组。
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-start gap-2 rounded-md border border-yellow-700 bg-yellow-900/20 p-3 text-sm text-yellow-300">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>这将覆盖该群组当前的所有权限设定。</span>
          </div>
          <div className="py-2">
            <Select value={copySourceGroupId} onValueChange={setCopySourceGroupId}>
              <SelectTrigger>
                <SelectValue placeholder="请选择一个群组">
                  {copySourceGroupId && (() => {
                    const selectedGroup = groups.find((g) => g.id.toString() === copySourceGroupId)
                    return selectedGroup ? `${selectedGroup.name}${selectedGroup.is_system ? ' (系统群组)' : ''}` : ''
                  })()}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {groups
                  .filter((g) => g.id !== copyTargetGroupId)
                  .map((group) => (
                    <SelectItem key={group.id} value={group.id.toString()}>
                      {group.name}
                      {group.is_system && ' (系统群组)'}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCopyDialog(false)}>
              取消
            </Button>
            <Button
              onClick={handleCopyConfirm}
              disabled={!copySourceGroupId || copyPermissions.isPending}
            >
              {copyPermissions.isPending && (
                <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
              )}
              复制权限
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// Category section component
interface CategorySectionProps {
  category: string
  capabilities: Array<{ name: string; capability: string; description: string }>
  expanded: boolean
  onToggle: () => void
  groups: Group[]
  editedPermissions: Record<number, Record<string, boolean>>
  onPermissionToggle: (groupId: number, capability: string) => void
}

function CategorySection({
  category,
  capabilities,
  expanded,
  onToggle,
  groups,
  editedPermissions,
  onPermissionToggle,
}: CategorySectionProps) {
  return (
    <>
      {/* Category header row */}
      <tr
        className="cursor-pointer border-b border-gray-800 bg-gray-900/50 hover:bg-gray-800/50"
        onClick={onToggle}
      >
        <td className="p-3" colSpan={1 + groups.length}>
          <div className="flex items-center gap-2">
            {expanded ? (
              <ChevronDown className="h-4 w-4 text-gray-400" />
            ) : (
              <ChevronRight className="h-4 w-4 text-gray-400" />
            )}
            <span className="font-medium text-white">{category}</span>
            <span className="text-xs text-gray-500">({capabilities.length})</span>
          </div>
        </td>
      </tr>

      {/* Capability rows */}
      {expanded &&
        capabilities.map((cap) => (
          <tr key={cap.capability} className="border-b border-gray-800 hover:bg-gray-800/30">
            <td className="p-3">
              <div className="flex flex-col">
                <span className="text-sm font-medium text-gray-200">{cap.name}</span>
                <span className="text-xs text-gray-500">{cap.description}</span>
              </div>
            </td>
            {groups.map((group) => {
              const isAllowed = editedPermissions[group.id]?.[cap.capability] ?? false

              return (
                <td key={group.id} className="p-3 text-center">
                  <button
                    onClick={() => onPermissionToggle(group.id, cap.capability)}
                    className={`
                      inline-flex h-7 w-7 items-center justify-center rounded-md transition-colors
                      ${
                        isAllowed
                          ? 'bg-green-900/50 text-green-400 hover:bg-green-800/50'
                          : 'bg-gray-800 text-gray-500 hover:bg-gray-700'
                      }
                    `}
                    title={isAllowed ? '允许' : '禁止'}
                  >
                    {isAllowed ? <Check className="h-4 w-4" /> : <X className="h-4 w-4" />}
                  </button>
                </td>
              )
            })}
          </tr>
        ))}
    </>
  )
}
