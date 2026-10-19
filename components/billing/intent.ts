export type FinancialPayload = Record<string, string | number | boolean | null>;
export type FinancialIntent = { fingerprint: string; key: string; payload: FinancialPayload };
export function financialIntent(previous: FinancialIntent | null, payload: FinancialPayload): FinancialIntent {
  const fingerprint = JSON.stringify(payload);
  return previous?.fingerprint === fingerprint ? previous : { fingerprint, key: crypto.randomUUID(), payload: { ...payload } };
}
type IntentStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
const memoryFallback = new Map<string, FinancialIntent>();
const prefix = 'gymdash:pending-billing:v1:';
export function createFinancialIntentStore(storage: IntentStorage | null, memory = memoryFallback) {
  function read(scope: string): FinancialIntent | null {
    try {
      const raw = storage?.getItem(prefix + scope);
      if (raw) {
        const value = JSON.parse(raw) as FinancialIntent;
        if (typeof value.key === 'string' && /^[0-9a-f-]{36}$/i.test(value.key) && value.payload && JSON.stringify(value.payload) === value.fingerprint) {
          memory.set(scope, value); return value;
        }
      }
    } catch { /* Browser storage can be unavailable; preserve the in-memory command. */ }
    return memory.get(scope) ?? null;
  }
  return {
    read,
    begin(scope: string, payload: FinancialPayload) {
      const intent = financialIntent(read(scope), payload);
      memory.set(scope, intent);
      try { storage?.setItem(prefix + scope, JSON.stringify(intent)); } catch { /* Same-tab memory fallback. */ }
      return intent;
    },
    clear(scope: string) {
      memory.delete(scope);
      try { storage?.removeItem(prefix + scope); } catch { /* Same-tab memory fallback. */ }
    },
  };
}
export function browserFinancialIntents() {
  let storage: IntentStorage | null = null;
  try { if (typeof window !== 'undefined') storage = window.sessionStorage; } catch { /* Restricted browser storage. */ }
  return createFinancialIntentStore(storage);
}
export function restoreFinancialFields(intent: FinancialIntent | null) {
  const payload = intent?.payload;
  let paidAt = '';
  if (typeof payload?.paidAt === 'string') {
    const value = new Date(payload.paidAt);
    if (Number.isFinite(value.getTime())) {
      // datetime-local displays local time; retries still send the original exact UTC payload.
      paidAt = new Date(value.getTime() - value.getTimezoneOffset() * 60000).toISOString().slice(0, 23);
    }
  }
  return {
    months: typeof payload?.months === 'number' ? String(payload.months) : '1',
    paid: typeof payload?.paid === 'boolean' ? payload.paid : true,
    mode: typeof payload?.mode === 'string' ? payload.mode : 'ESPECES',
    reference: typeof payload?.reference === 'string' ? payload.reference : '',
    amount: typeof payload?.amountFcfa === 'number' ? String(payload.amountFcfa) : '',
    paidAt,
  };
}
