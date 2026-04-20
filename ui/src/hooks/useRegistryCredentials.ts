/**
 * React Query hooks for registry credentials management
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { apiClient } from '@/lib/api/client'
import type { RegistryCredential, RegistryCredentialCreate, RegistryCredentialUpdate } from '@/types/api'

/**
 * Fetch all registry credentials
 */
export function useRegistryCredentials() {
  return useQuery({
    queryKey: ['registry-credentials'],
    queryFn: () => apiClient.get<RegistryCredential[]>('/registry-credentials'),
  })
}

/**
 * Create new registry credential
 */
export function useCreateRegistryCredential() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: RegistryCredentialCreate) =>
      apiClient.post<RegistryCredential>('/registry-credentials', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['registry-credentials'] })
      toast.success('已成功创建注册表凭证')
    },
    onError: (error: Error) => {
      toast.error(`创建注册表凭证时失败: ${error.message}`)
    },
  })
}

/**
 * Update existing registry credential
 */
export function useUpdateRegistryCredential() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: RegistryCredentialUpdate }) =>
      apiClient.put<RegistryCredential>(`/registry-credentials/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['registry-credentials'] })
      toast.success('已成功更新注册表凭证')
    },
    onError: (error: Error) => {
      toast.error(`更新注册表凭证时失败: ${error.message}`)
    },
  })
}

/**
 * Delete registry credential
 */
export function useDeleteRegistryCredential() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: number) => apiClient.delete(`/registry-credentials/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['registry-credentials'] })
      toast.success('已成功删除注册表凭证')
    },
    onError: (error: Error) => {
      toast.error(`删除注册表凭证时失败: ${error.message}`)
    },
  })
}
