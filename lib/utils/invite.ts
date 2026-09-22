/**
 * Utility for parsing and extracting group IDs from invite links, URLs, and codes.
 */

const UUID_REGEX = /[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/;

/**
 * Extracts a group UUID from user input.
 * Handles:
 * - Full URLs: https://clicksplit.app/group/UUID, http://localhost:3000/group/UUID?ref=invite
 * - Relative paths: /group/UUID
 * - Raw UUIDs: UUID
 * - Surrounding whitespace or accompanying text
 */
export function extractGroupId(input: string): string | null {
  if (!input || typeof input !== 'string') return null;
  const match = input.trim().match(UUID_REGEX);
  return match ? match[0].toLowerCase() : null;
}
