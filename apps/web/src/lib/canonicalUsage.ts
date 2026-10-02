/** The transcript collector is canonical for legacy accounts that enabled both methods.
 * Preserve all stored evidence, but count one method so overlapping usage never inflates totals. */
export function canonicalUsage<T extends { source: string; connectorVersion: string | null }>(events: T[]): T[] {
  const local = events.some(e => e.source === "claude_code" && !e.connectorVersion?.startsWith("otel-"));
  return local ? events.filter(e => e.source !== "claude_code" || !e.connectorVersion?.startsWith("otel-")) : events;
}
