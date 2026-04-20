/**
 * Host Bulk Action Bar
 * Appears when hosts are selected - allows bulk tag operations
 */

import { useState, useRef, useEffect } from 'react'
import { X, Tag, Plus, Minus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { TagInput } from '@/components/TagInput'
import { toast } from 'sonner'
import { apiClient } from '@/lib/api/client'
import { useAuth } from '@/features/auth/AuthContext'

interface HostBulkActionBarProps {
  selectedHostIds: Set<string>
  onClearSelection: () => void
  onTagsUpdated: () => void
}

export function HostBulkActionBar({
  selectedHostIds,
  onClearSelection,
  onTagsUpdated
}: HostBulkActionBarProps) {
  const { hasCapability } = useAuth()
  const canManageTags = hasCapability('tags.manage')

  const [showTagInput, setShowTagInput] = useState(false)
  const [tagMode, setTagMode] = useState<'add' | 'remove'>('add')
  const [tags, setTags] = useState<string[]>([])
  const [tagSuggestions, setTagSuggestions] = useState<string[]>([])
  const tagInputRef = useRef<HTMLDivElement>(null)

  const hostCount = selectedHostIds.size

  // Close tag input when clicking outside
  useEffect(() => {
    if (!showTagInput) return

    const handleClickOutside = (event: MouseEvent) => {
      if (tagInputRef.current && !tagInputRef.current.contains(event.target as Node)) {
        setShowTagInput(false)
        setTags([])
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [showTagInput])

  // Fetch tag suggestions on mount
  useEffect(() => {
    const fetchSuggestions = async () => {
      try {
        const response = await apiClient.get<{ tags: string[] }>('/hosts/tags/suggest', {
          params: { q: '', limit: 50 }
        })
        setTagSuggestions(response.tags)
      } catch (error) {
        console.error('Failed to fetch tag suggestions:', error)
      }
    }
    fetchSuggestions()
  }, [])

  const handleAddTags = () => {
    setTagMode('add')
    setShowTagInput(true)
    setTags([])
  }

  const handleRemoveTags = () => {
    setTagMode('remove')
    setShowTagInput(true)
    setTags([])
  }

  const handleApplyTags = async () => {
    if (tags.length === 0) {
      toast.error('请至少输入一个标签')
      return
    }

    const hostIds = Array.from(selectedHostIds)
    let successCount = 0
    let errorCount = 0

    toast.loading(`${tagMode === 'add' ? '添加标签至' : '删除标签从'} ${hostCount} 个主机中...`, {
      id: 'bulk-tags'
    })

    // Update tags for each host
    for (const hostId of hostIds) {
      try {
        await apiClient.patch(`/hosts/${hostId}/tags`, {
          tags_to_add: tagMode === 'add' ? tags : [],
          tags_to_remove: tagMode === 'remove' ? tags : []
        })
        successCount++
      } catch (error) {
        console.error(`Failed to update tags for host ${hostId}:`, error)
        errorCount++
      }
    }

    // Show result
    toast.dismiss('bulk-tags')
    if (errorCount === 0) {
      toast.success(`已成功${tagMode === 'add' ? '添加标签至' : '删除标签从'} ${successCount} 个主机`)
    } else if (successCount > 0) {
      toast.warning(`已更新 ${successCount} 个主机, ${errorCount} 个失败`)
    } else {
      toast.error(`无法将标签更新至全部主机`)
    }

    // Reset and notify parent
    setShowTagInput(false)
    setTags([])
    onTagsUpdated()
  }

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50">
      <div className="bg-card border border-border rounded-lg shadow-lg p-4 min-w-[500px]">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary">
              {hostCount}
            </div>
            <span className="text-sm font-medium">
              {hostCount} 个主机已选择
            </span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClearSelection}
            className="h-8 w-8 p-0"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {!showTagInput ? (
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleAddTags}
              disabled={!canManageTags}
              className="flex-1"
            >
              <Plus className="h-4 w-4 mr-2" />
              添加标签
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleRemoveTags}
              disabled={!canManageTags}
              className="flex-1"
            >
              <Minus className="h-4 w-4 mr-2" />
              删除标签
            </Button>
          </div>
        ) : (
          <div ref={tagInputRef} className="space-y-3">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Tag className="h-4 w-4" />
              <span>
                {tagMode === 'add' ? '添加标签至' : '删除标签从'} {hostCount} 个主机
              </span>
            </div>
            <TagInput
              value={tags}
              onChange={setTags}
              suggestions={tagSuggestions}
              placeholder={tagMode === 'add' ? '请输入标签 (prod, dev, us-west-1...)' : '请输入待删除的标签...'}
              maxTags={20}
            />
            <div className="flex gap-2">
              <Button
                variant="default"
                size="sm"
                onClick={handleApplyTags}
                disabled={!canManageTags || tags.length === 0}
                className="flex-1"
              >
                {tagMode === 'add' ? '添加' : '删除'}标签
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setShowTagInput(false)
                  setTags([])
                }}
              >
                取消
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
