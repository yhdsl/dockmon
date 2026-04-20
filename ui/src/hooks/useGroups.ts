/**
 * useGroups Hook
 * Manages Custom Groups CRUD operations with React Query
 *
 * Group-Based Permissions Refactor (v2.4.0)
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '@/lib/api/client'
import type {
  Group,
  GroupDetail,
  GroupMember,
  GroupListResponse,
  CreateGroupRequest,
  UpdateGroupRequest,
  AddMemberRequest,
  AddMemberResponse,
  RemoveMemberResponse,
  DeleteGroupResponse,
  GroupPermissionsResponse,
  UpdateGroupPermissionsRequest,
  UpdatePermissionsResponse,
  AllGroupPermissionsResponse,
  CopyPermissionsResponse,
} from '@/types/groups'
import { toast } from 'sonner'

const GROUPS_QUERY_KEY = ['groups']
const PERMISSIONS_QUERY_KEY = ['group-permissions']

/**
 * Fetch all groups (admin only)
 */
export function useGroups() {
  return useQuery({
    queryKey: GROUPS_QUERY_KEY,
    queryFn: () => apiClient.get<GroupListResponse>('/v2/groups'),
    staleTime: 30 * 1000, // 30 seconds
  })
}

/**
 * Get a single group with members (admin only)
 */
export function useGroup(groupId: number | null) {
  return useQuery({
    queryKey: [...GROUPS_QUERY_KEY, groupId],
    queryFn: () => apiClient.get<GroupDetail>(`/v2/groups/${groupId}`),
    enabled: groupId !== null,
    staleTime: 30 * 1000,
  })
}

/**
 * Get group members (admin only)
 */
export function useGroupMembers(groupId: number | null) {
  return useQuery({
    queryKey: [...GROUPS_QUERY_KEY, groupId, 'members'],
    queryFn: () => apiClient.get<GroupMember[]>(`/v2/groups/${groupId}/members`),
    enabled: groupId !== null,
    staleTime: 30 * 1000,
  })
}

/**
 * Create a new group (admin only)
 */
export function useCreateGroup() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (request: CreateGroupRequest) => apiClient.post<Group>('/v2/groups', request),
    onSuccess: (group) => {
      queryClient.invalidateQueries({ queryKey: GROUPS_QUERY_KEY })
      toast.success(`已成功创建用户群组 "${group.name}"`)
    },
    onError: (error: Error) => {
      console.error('Failed to create group:', error)
      toast.error('无法创建用户群组。请稍后再试。')
    },
  })
}

/**
 * Update an existing group (admin only)
 */
export function useUpdateGroup() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ groupId, request }: { groupId: number; request: UpdateGroupRequest }) =>
      apiClient.put<Group>(`/v2/groups/${groupId}`, request),
    onSuccess: (group) => {
      queryClient.invalidateQueries({ queryKey: GROUPS_QUERY_KEY })
      toast.success(`已成功更新用户群组 "${group.name}"`)
    },
    onError: (error: Error) => {
      console.error('Failed to update group:', error)
      toast.error('无法更新用户群组。请稍后再试。')
    },
  })
}

/**
 * Delete a group (admin only)
 */
export function useDeleteGroup() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (groupId: number) => apiClient.delete<DeleteGroupResponse>(`/v2/groups/${groupId}`),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: GROUPS_QUERY_KEY })
      toast.success(data.message || '已成功删除用户群组')
    },
    onError: (error: Error) => {
      console.error('Failed to delete group:', error)
      toast.error('无法删除用户群组。请稍后再试。')
    },
  })
}

/**
 * Add a member to a group (admin only)
 */
export function useAddGroupMember() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ groupId, request }: { groupId: number; request: AddMemberRequest }) =>
      apiClient.post<AddMemberResponse>(`/v2/groups/${groupId}/members`, request),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: GROUPS_QUERY_KEY })
      toast.success(data.message || '已成功添加成员')
    },
    onError: (error: Error) => {
      console.error('Failed to add member:', error)
      toast.error('无法添加成员。请稍后再试。')
    },
  })
}

/**
 * Remove a member from a group (admin only)
 */
export function useRemoveGroupMember() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ groupId, userId }: { groupId: number; userId: number }) =>
      apiClient.delete<RemoveMemberResponse>(`/v2/groups/${groupId}/members/${userId}`),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: GROUPS_QUERY_KEY })
      toast.success(data.message || '已成功删除成员')
    },
    onError: (error: Error) => {
      console.error('Failed to remove member:', error)
      toast.error('无法删除成员。请稍后再试。')
    },
  })
}

// ==================== Group Permissions ====================

/**
 * Fetch permissions for a specific group
 */
export function useGroupPermissions(groupId: number | null) {
  return useQuery({
    queryKey: [...PERMISSIONS_QUERY_KEY, groupId],
    queryFn: () => apiClient.get<GroupPermissionsResponse>(`/v2/groups/${groupId}/permissions`),
    enabled: groupId !== null,
    staleTime: 30 * 1000,
  })
}

/**
 * Fetch permissions for all groups (for permission matrix view)
 * Uses bulk endpoint to avoid N+1 query problem
 */
export function useAllGroupPermissions() {
  return useQuery({
    queryKey: [...PERMISSIONS_QUERY_KEY, 'all'],
    queryFn: async () => {
      // Fetch groups and all permissions in parallel
      const [groupsResponse, permissionsResponse] = await Promise.all([
        apiClient.get<GroupListResponse>('/v2/groups'),
        apiClient.get<AllGroupPermissionsResponse>('/v2/groups/permissions/all'),
      ])

      return {
        groups: groupsResponse.groups || [],
        permissions: permissionsResponse.permissions,
      }
    },
    staleTime: 30 * 1000,
  })
}

/**
 * Update permissions for a group
 */
export function useUpdateGroupPermissions() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ groupId, request }: { groupId: number; request: UpdateGroupPermissionsRequest }) =>
      apiClient.put<UpdatePermissionsResponse>(`/v2/groups/${groupId}/permissions`, request),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: PERMISSIONS_QUERY_KEY })
      toast.success(data.message || '已成功更新权限')
    },
    onError: (error: Error) => {
      console.error('Failed to update permissions:', error)
      toast.error('无法更新权限。请稍后再试。')
    },
  })
}

/**
 * Copy permissions from one group to another
 */
export function useCopyGroupPermissions() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ targetGroupId, sourceGroupId }: { targetGroupId: number; sourceGroupId: number }) =>
      apiClient.post<CopyPermissionsResponse>(`/v2/groups/${targetGroupId}/permissions/copy-from/${sourceGroupId}`, {}),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: PERMISSIONS_QUERY_KEY })
      // Show warning if present (e.g., copying from empty source group)
      if (data.warning) {
        toast.warning(data.warning)
      } else {
        toast.success(data.message || '已成功复制权限')
      }
    },
    onError: (error: Error) => {
      console.error('Failed to copy permissions:', error)
      toast.error('无法复制权限。请稍后再试。')
    },
  })
}
