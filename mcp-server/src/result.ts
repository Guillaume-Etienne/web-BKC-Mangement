/** Shared MCP tool result helpers — every tool returns text content, JSON-encoded. */

export function jsonResult(value: unknown) {
  return { content: [{ type: 'text' as const, text: JSON.stringify(value, null, 2) }] }
}

export function errorResult(message: string) {
  return { content: [{ type: 'text' as const, text: message }], isError: true }
}
