export interface AuditEntry {
  id: string;
  action: string;
  detail: string;
  ts: string;
}

export function addAuditEntry(action: string, detail: string) {
  if (typeof window === 'undefined') return;
  const raw = localStorage.getItem('gymdash_audit');
  const entries: AuditEntry[] = raw ? JSON.parse(raw) : [];
  entries.unshift({
    id: crypto.randomUUID(),
    action,
    detail,
    ts: new Date().toISOString(),
  });
  // Keep last 200 entries
  localStorage.setItem('gymdash_audit', JSON.stringify(entries.slice(0, 200)));
}

export function getAuditEntries(): AuditEntry[] {
  if (typeof window === 'undefined') return [];
  const raw = localStorage.getItem('gymdash_audit');
  return raw ? JSON.parse(raw) : [];
}
