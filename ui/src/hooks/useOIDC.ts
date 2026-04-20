/**
 * OIDC Hooks
 * React Query hooks for OIDC configuration and group mappings
 *
 * Group-Based Permissions Refactor (v2.4.0)
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '@/lib/api/client'
import { toast } from 'sonner'
import type {
  OIDCConfig,
  OIDCConfigUpdateRequest,
  OIDCDiscoveryRequest,
  OIDCDiscoveryResponse,
  OIDCGroupMapping,
  OIDCGroupMappingCreateRequest,
  OIDCGroupMappingUpdateRequest,
  OIDCStatus,
} from '@/types/oidc'

const QUERY_KEYS = {
  config: ['oidc', 'config'],
  status: ['oidc', 'status'],
  groupMappings: ['oidc', 'group-mappings'],
}

// ==================== OIDC Status (Public) ====================

export function useOIDCStatus() {
  return useQuery<OIDCStatus>({
    queryKey: QUERY_KEYS.status,
    queryFn: async () => {
      return apiClient.get('/v2/oidc/status')
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  })
}

// ==================== OIDC Configuration (Admin) ====================

export function useOIDCConfig() {
  return useQuery<OIDCConfig>({
    queryKey: QUERY_KEYS.config,
    queryFn: async () => {
      return apiClient.get('/v2/oidc/config')
    },
  })
}

export function useUpdateOIDCConfig() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (data: OIDCConfigUpdateRequest) => {
      return apiClient.put<OIDCConfig>('/v2/oidc/config', data)
    },
    onSuccess: (data) => {
      queryClient.setQueryData(QUERY_KEYS.config, data)
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.status })
      toast.success('配置已保存', {
        description: 'OIDC 设置已更新。',
      })
    },
    onError: (error: Error) => {
      toast.error('保存时失败', {
        description: error.message,
      })
    },
  })
}

export function useDiscoverOIDC() {
  return useMutation({
    mutationFn: async (data: OIDCDiscoveryRequest) => {
      return apiClient.post<OIDCDiscoveryResponse>('/v2/oidc/discover', data)
    },
    onError: (error: Error) => {
      toast.error('发现时失败', {
        description: error.message,
      })
    },
  })
}

// ==================== OIDC Group Mappings (Admin) ====================

export function useOIDCGroupMappings() {
  return useQuery<OIDCGroupMapping[]>({
    queryKey: QUERY_KEYS.groupMappings,
    queryFn: async () => {
      return apiClient.get('/v2/oidc/group-mappings')
    },
  })
}

export function useCreateOIDCGroupMapping() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (data: OIDCGroupMappingCreateRequest) => {
      return apiClient.post<OIDCGroupMapping>('/v2/oidc/group-mappings', data)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.groupMappings })
      toast.success('已创建映射', {
        description: 'OIDC 用户群组映射已创建。',
      })
    },
    onError: (error: Error) => {
      toast.error('创建用户群组映射时失败', {
        description: error.message,
      })
    },
  })
}

export function useUpdateOIDCGroupMapping() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, data }: { id: number; data: OIDCGroupMappingUpdateRequest }) => {
      return apiClient.put<OIDCGroupMapping>(`/v2/oidc/group-mappings/${id}`, data)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.groupMappings })
      toast.success('已更新映射', {
        description: 'OIDC 用户群组映射已更新。',
      })
    },
    onError: (error: Error) => {
      toast.error('更新用户群组映射时失败', {
        description: error.message,
      })
    },
  })
}

export function useDeleteOIDCGroupMapping() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: number) => {
      return apiClient.delete(`/v2/oidc/group-mappings/${id}`)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.groupMappings })
      toast.success('已删除映射', {
        description: 'OIDC 用户群组映射已删除。',
      })
    },
    onError: (error: Error) => {
      toast.error('删除用户群组映射时失败', {
        description: error.message,
      })
    },
  })
}

// ==================== Legacy Aliases (for backward compatibility) ====================

/** @deprecated Use useOIDCGroupMappings instead */
export const useOIDCRoleMappings = useOIDCGroupMappings
/** @deprecated Use useCreateOIDCGroupMapping instead */
export const useCreateOIDCRoleMapping = useCreateOIDCGroupMapping
/** @deprecated Use useUpdateOIDCGroupMapping instead */
export const useUpdateOIDCRoleMapping = useUpdateOIDCGroupMapping
/** @deprecated Use useDeleteOIDCGroupMapping instead */
export const useDeleteOIDCRoleMapping = useDeleteOIDCGroupMapping
