type Dict = Record<string, unknown>;
type Status = 'sent' | 'delivered' | 'read' | 'pending' | 'failed' | 'unknown';
export interface RelayioConfig { baseUrl: string; apiKey: string; sessionId: string }
export interface RelayioMessage { id: string; to: string; body: string; status: Status; createdAt?: string; direction: string }
interface Session { id: string; name: string; status: string; phone: string }
type State = 'unconfigured' | 'connected' | 'disconnected' | 'session_required' | 'session_missing' | 'auth_error' | 'upstream_error';
export interface RelayioSnapshot {
  configured: boolean; connected: boolean; state: State; channel: Session | null;
  messages: RelayioMessage[]; stats: Record<'total' | Status, number>;
  historyScope: 'fetched'; historyAvailable: boolean; error?: string;
}
const object = (v: unknown): Dict => v !== null && typeof v === 'object' && !Array.isArray(v) ? v as Dict : {};
const text = (v: unknown) => typeof v === 'string' ? v : '';
export class RelayioError extends Error {
  state: State; status: number;
  constructor(message: string, state: State = 'upstream_error', status = 502) {
    super(message); this.state = state; this.status = status;
  }
}
export function normalizeMessage(value: unknown): RelayioMessage {
  const m = object(value), direction = text(m.direction).toLowerCase(), raw = text(m.status).toLowerCase();
  const status: Status = raw === 'read' ? 'read' : raw === 'delivered' ? 'delivered' : raw === 'sent' ? 'sent'
    : ['pending', 'queued', 'sending'].includes(raw) ? 'pending'
    : ['failed', 'undelivered', 'error'].includes(raw) ? 'failed' : 'unknown';
  const date = text(m.timestamp) || text(m.createdAt);
  return {
    id: text(m.id) || text(m._id) || text(m.whatsappMessageId),
    to: text(m.to) || text(m.chatId),
    body: text(m.body) || (m.hasMedia ? '[Média]' : ''), status, direction,
    createdAt: date && Number.isFinite(Date.parse(date)) ? new Date(date).toISOString() : undefined,
  };
}
function isOutgoingMessage(value: unknown): boolean {
  const message = object(value);
  const direction = text(message.direction).trim().toLowerCase();
  // The sent-message API may omit direction. Explicit incoming records must
  // never leave this server route, even if an upstream version returns them.
  if (direction && direction !== 'outbound') return false;
  if (message.fromMe === false || object(message.key).fromMe === false) return false;
  return text(message.status).toLowerCase() !== 'received';
}
export function relayioConfig(): RelayioConfig {
  return { baseUrl: process.env.RELAYIO_BASE_URL || 'https://relayio.minifootapp.com/v1', apiKey: process.env.RELAYIO_API_KEY?.trim() || '', sessionId: process.env.RELAYIO_SESSION_ID?.trim() || '' };
}
export function createRelayio(config: RelayioConfig, fetcher: typeof fetch = fetch) {
  const base = config.baseUrl.replace(/\/+$/, '');
  async function request(path: string, init: RequestInit = {}) {
    try {
      const response = await fetcher(`${base}${path}`, {
        ...init, headers: { 'x-api-key': config.apiKey, 'Content-Type': 'application/json' },
        cache: 'no-store', signal: AbortSignal.timeout(15_000), redirect: 'error',
      });
      if ([401, 403].includes(response.status)) throw new RelayioError('Relayio refuse les identifiants. Demandez à un administrateur de vérifier la connexion.', 'auth_error');
      if (!response.ok) throw new RelayioError('Relayio est temporairement indisponible. Réessayez dans quelques instants.');
      return await response.json() as unknown;
    } catch (error) {
      if (error instanceof RelayioError) throw error;
      throw new RelayioError('Impossible de joindre Relayio. Réessayez ou contactez un administrateur.');
    }
  }
  async function selectSession(): Promise<Session> {
    if (!config.apiKey) throw new RelayioError('La connexion Relayio doit être configurée par un administrateur.', 'unconfigured', 503);
    const result = await request('/sessions');
    if (!Array.isArray(result)) throw new RelayioError('Relayio a renvoyé une liste de sessions illisible.');
    const sessions = result.map(object);
    const selected = config.sessionId ? sessions.find(s => s.id === config.sessionId || s._id === config.sessionId) : sessions.length === 1 ? sessions[0] : undefined;
    if (!selected) {
      if (!config.sessionId && sessions.length > 1) throw new RelayioError('Plusieurs sessions sont disponibles. Demandez à un administrateur de choisir la session WhatsApp.', 'session_required', 409);
      throw new RelayioError('La session WhatsApp est introuvable. Demandez à un administrateur de vérifier la session Relayio.', 'session_missing', 409);
    }
    if (!text(selected.id)) throw new RelayioError('Relayio a renvoyé une session sans identifiant.');
    return { id: text(selected.id), name: text(selected.name), status: text(selected.status), phone: text(selected.phoneNumber) };
  }
  async function snapshot(): Promise<RelayioSnapshot> {
    const result: RelayioSnapshot = {
      configured: Boolean(config.apiKey), connected: false, state: 'unconfigured', channel: null,
      messages: [], stats: { total: 0, sent: 0, delivered: 0, read: 0, pending: 0, failed: 0, unknown: 0 }, historyScope: 'fetched', historyAvailable: false,
    };
    try {
      result.channel = await selectSession();
      result.connected = result.channel.status.toUpperCase() === 'READY';
      result.state = result.connected ? 'connected' : 'disconnected';
      const messages = await request(`/sessions/${encodeURIComponent(result.channel.id)}/messages`);
      if (!Array.isArray(messages)) throw new RelayioError('Relayio a renvoyé un historique illisible.');
      result.messages = messages.filter(isOutgoingMessage).map(normalizeMessage);
      result.historyAvailable = true; result.stats.total = result.messages.length;
      for (const message of result.messages) result.stats[message.status]++;
      if (!result.connected) result.error = 'La session WhatsApp est déconnectée. Demandez à un administrateur de la reconnecter dans Relayio.';
    } catch (error) {
      const failure = error instanceof RelayioError ? error : new RelayioError('La connexion Relayio est indisponible.');
      result.state = failure.state; result.error = failure.message;
    }
    return result;
  }
  async function send(input: unknown): Promise<RelayioMessage> {
    const value = object(input), phone = text(value.to).replace(/[\s().-]/g, '').replace(/^\+/, ''), body = text(value.body).trim();
    if (!/^[1-9]\d{6,14}$/.test(phone)) throw new RelayioError('Indiquez un numéro international valide, avec son indicatif pays.', 'connected', 400);
    if (!body || body.length > 4096) throw new RelayioError('Le message doit contenir entre 1 et 4096 caractères.', 'connected', 400);
    const session = await selectSession();
    if (session.status.toUpperCase() !== 'READY') throw new RelayioError('Veuillez reconnecter la session WhatsApp dans Relayio avant tout envoi.', 'disconnected', 409);
    // This self-hosted Relayio passes the address unchanged to Baileys.
    const message = normalizeMessage(await request(`/sessions/${encodeURIComponent(session.id)}/messages/text`, { method: 'POST', body: JSON.stringify({ chatId: `${phone}@s.whatsapp.net`, body }) }));
    if (message.status === 'failed') throw new RelayioError('L’envoi a échoué dans Relayio.');
    if (!message.id) throw new RelayioError('Relayio n’a pas confirmé la prise en charge du message. Vérifiez l’historique avant de réessayer.');
    return message;
  }
  async function reconnect(): Promise<void> {
    const session = await selectSession();
    await request(`/sessions/${encodeURIComponent(session.id)}/start`, { method: 'POST' });
  }
  async function pairPhone(phone: string): Promise<{ code: string; expiresAt?: string }> {
    const clean = phone.replace(/[\s().-]/g, '').replace(/^\+/, '');
    if (!/^[1-9]\d{6,14}$/.test(clean)) throw new RelayioError('Numéro invalide. Indiquez un numéro international complet (ex: +221 77 000 00 00).', 'connected', 400);
    const session = await selectSession();
    const result = await request(`/sessions/${encodeURIComponent(session.id)}/pairing-code`, {
      method: 'POST', body: JSON.stringify({ phoneNumber: clean }),
    });
    const code = text(object(result).code);
    if (!code) throw new RelayioError('Relayio n\'a pas retourné de code de jumelage. Réessayez.');
    const expiresAt = text(object(result).expiresAt) || undefined;
    return { code, expiresAt };
  }
  return { snapshot, send, reconnect, pairPhone };
}
