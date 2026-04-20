/**
 * Tag Validation Utilities
 *
 * Centralized validation logic for container tags.
 * Ensures consistent validation across the application.
 */

export interface TagValidationResult {
  valid: boolean
  error?: string
}

/**
 * Validate a single tag
 *
 * Rules:
 * - Must be 1-24 characters after trimming
 * - Only alphanumeric, dash, underscore, colon, and dot allowed
 * - Optional: check for duplicates against existing tags
 */
export function validateTag(
  tag: string,
  existingTags?: string[]
): TagValidationResult {
  const trimmed = tag.trim()

  if (!trimmed) {
    return { valid: false, error: '标签不能为空' }
  }

  if (trimmed.length < 1 || trimmed.length > 24) {
    return { valid: false, error: '标签不能超过 24 个字符' }
  }

  // Allow alphanumeric + dash, underscore, colon, dot
  const validPattern = /^[a-zA-Z0-9\p{L}\p{N}\-_:.]+$/u
  if (!validPattern.test(trimmed)) {
    return { valid: false, error: '标签只能包含数字和字母、连字符、下划线、冒号以及点' }
  }

  // Check for duplicates if existing tags provided
  if (existingTags) {
    const normalizedTag = trimmed.toLowerCase()
    if (existingTags.map(t => t.toLowerCase()).includes(normalizedTag)) {
      return { valid: false, error: '标签重复' }
    }
  }

  return { valid: true }
}

/**
 * Normalize a tag (trim and lowercase)
 */
export function normalizeTag(tag: string): string {
  return tag.trim().toLowerCase()
}

/**
 * Check if a tag is a derived tag (from docker-compose or swarm)
 */
export function isDerivedTag(tag: string): boolean {
  return tag.startsWith('compose:') || tag.startsWith('swarm:')
}

/**
 * Validate tag suggestions response from API
 * Handles both string arrays and object arrays with {name: string}
 */
export function validateTagSuggestionsResponse(data: unknown): string[] {
  if (!data || typeof data !== 'object') {
    return []
  }

  const response = data as Record<string, unknown>
  if (!Array.isArray(response.tags)) {
    return []
  }

  // Handle both strings and objects like {id, name, color, kind}
  return response.tags
    .map((tag) => {
      if (typeof tag === 'string') {
        return tag.trim()
      } else if (tag && typeof tag === 'object' && 'name' in tag && typeof tag.name === 'string') {
        return tag.name.trim()
      }
      return ''
    })
    .filter((tag) => tag.length > 0)
}
