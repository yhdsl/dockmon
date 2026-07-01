/**
 * NetworkCreateModal Component
 *
 * Form modal for creating a Docker bridge network on a host. Per-host only:
 * a network lives on a single Docker host, so there is no cross-host option.
 * Only bridge networks are supported here - overlay requires Swarm mode, and
 * macvlan/ipvlan need a parent host interface this form does not collect.
 */

import { useState, useEffect } from 'react'
import { ConfirmModal } from '@/components/shared/ConfirmModal'
import type { CreateNetworkParams } from '../hooks/useHostNetworks'

interface NetworkCreateModalProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: (params: CreateNetworkParams) => void
  isPending?: boolean
}

export function NetworkCreateModal({
  isOpen,
  onClose,
  onConfirm,
  isPending = false,
}: NetworkCreateModalProps) {
  const [name, setName] = useState('')
  const [subnet, setSubnet] = useState('')
  const [gateway, setGateway] = useState('')
  const [internal, setInternal] = useState(false)

  useEffect(() => {
    if (isOpen) {
      setName('')
      setSubnet('')
      setGateway('')
      setInternal(false)
    }
  }, [isOpen])

  const trimmedName = name.trim()

  const handleConfirm = () => {
    // Omit blank optional fields rather than sending undefined (exactOptionalPropertyTypes)
    const params: CreateNetworkParams = { name: trimmedName, internal }
    const trimmedSubnet = subnet.trim()
    const trimmedGateway = gateway.trim()
    if (trimmedSubnet) params.subnet = trimmedSubnet
    if (trimmedGateway) params.gateway = trimmedGateway
    onConfirm(params)
  }

  const inputClass =
    'w-full px-3 py-2 bg-surface-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent'

  return (
    <ConfirmModal
      isOpen={isOpen}
      onClose={onClose}
      onConfirm={handleConfirm}
      title="创建网络"
      description="在此主机上创建一个 Docker Bridge 网络。"
      confirmText="创建网络"
      pendingText="创建中..."
      variant="info"
      isPending={isPending}
      disabled={!trimmedName}
    >
      <div className="space-y-4">
        <div>
          <label htmlFor="net-name" className="block text-sm font-medium mb-1">
            名称 <span className="text-danger">*</span>
          </label>
          <input
            id="net-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="my-network"
            className={`${inputClass} font-mono`}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="net-subnet" className="block text-sm font-medium mb-1">
              子网
            </label>
            <input
              id="net-subnet"
              type="text"
              value={subnet}
              onChange={(e) => setSubnet(e.target.value)}
              placeholder="172.20.0.0/16"
              className={`${inputClass} font-mono`}
            />
          </div>
          <div>
            <label htmlFor="net-gateway" className="block text-sm font-medium mb-1">
              网关
            </label>
            <input
              id="net-gateway"
              type="text"
              value={gateway}
              onChange={(e) => setGateway(e.target.value)}
              placeholder="172.20.0.1"
              className={`${inputClass} font-mono`}
            />
          </div>
        </div>
        <p className="text-xs text-muted-foreground -mt-2">
          将子网留空，以便于使用 Docker 自动地址分配。
        </p>

        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input
            type="checkbox"
            checked={internal}
            onChange={(e) => setInternal(e.target.checked)}
            className="w-4 h-4 rounded border-border"
          />
          内部网络 (无法连接外部网络)
        </label>
      </div>
    </ConfirmModal>
  )
}
