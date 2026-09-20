/**
 * Host-visibility picker for the group editor.
 *
 * Selection is by tag id (names can collide across renames). An empty selection
 * means the group is unrestricted and its members see every host.
 */

import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import type { HostTagWithMeta } from '@/types/groups'

interface GroupTagScopesFieldProps {
  tags: HostTagWithMeta[]
  selectedIds: string[]
  onChange: (ids: string[]) => void
  isLoading?: boolean
}

export function GroupTagScopesField({ tags, selectedIds, onChange, isLoading = false }: GroupTagScopesFieldProps) {
  const toggle = (id: string, checked: boolean) => {
    onChange(checked ? [...selectedIds, id] : selectedIds.filter((s) => s !== id))
  }

  return (
    <div className="grid gap-2">
      <Label>主机可见性</Label>
      <p className="text-xs text-muted-foreground">
        成员只能看到带有已选择标签的主机。留空则视为无限制 (成员可以看到所有的主机)。
      </p>
      {isLoading ? (
        <p className="text-sm text-muted-foreground">加载主机标签中…</p>
      ) : tags.length === 0 ? (
        <p className="text-sm text-muted-foreground">尚未添加任何主机标签，请先添加一个主机标签。</p>
      ) : (
        <ul className="max-h-48 overflow-y-auto rounded-md border p-2" role="group" aria-label="Host visibility tags">
          {tags.map((tag) => {
            const inputId = `tag-scope-${tag.id}`
            return (
              <li key={tag.id} className="flex items-center gap-2 py-1">
                <Checkbox
                  id={inputId}
                  checked={selectedIds.includes(tag.id)}
                  onCheckedChange={(checked) => toggle(tag.id, checked === true)}
                />
                <Label htmlFor={inputId} className="flex cursor-pointer items-center gap-2 font-normal">
                  <span
                    className="inline-block h-2.5 w-2.5 rounded-full border"
                    style={{ backgroundColor: tag.color ?? undefined }}
                    aria-hidden="true"
                  />
                  {tag.name}
                </Label>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
