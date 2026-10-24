export interface UploadAttempt { name: string; size: number; startedAt: number }
type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
const key = (owner: string) => `gymdash_apk_upload:${owner}`;

// Only metadata is stored. Reloading cannot resume the browser's File stream.
export function readUploadAttempt(storage: StorageLike | undefined, owner: string): UploadAttempt | null {
  if (!owner) return null;
  try {
    const value = JSON.parse(storage?.getItem(key(owner)) || 'null');
    return value && typeof value.name === 'string' && value.name.length <= 255 &&
      Number.isFinite(value.size) && value.size > 0 && value.size <= 256 * 1024 * 1024 &&
      Number.isFinite(value.startedAt) && value.startedAt > 0 && value.startedAt <= 8.64e15
      ? { name: value.name, size: value.size, startedAt: value.startedAt } : null;
  } catch { return null; }
}
export function saveUploadAttempt(storage: StorageLike | undefined, owner: string, attempt: UploadAttempt) {
  if (!owner) return;
  try { storage?.setItem(key(owner), JSON.stringify(attempt)); } catch { /* Restricted storage must not block upload. */ }
}
export function clearUploadAttempt(storage: StorageLike | undefined, owner: string) {
  if (!owner) return;
  try { storage?.removeItem(key(owner)); } catch { /* Best effort. */ }
}
export function uploadMessage(progress: number, stalledSeconds: number) {
  if (progress >= 100) return 'Fichier transmis. Analyse de l’APK et enregistrement du brouillon en cours…';
  return stalledSeconds >= 15
    ? `Transfert : ${progress} %. La progression est momentanément arrêtée ; le réseau ou le serveur peut être lent. Gardez cette page ouverte.`
    : `Transfert : ${progress} %. Gardez cette page ouverte jusqu’à la confirmation du brouillon.`;
}
