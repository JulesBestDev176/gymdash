'use client';
import { useEffect, useRef, useState } from 'react';
import axios from 'axios';
import { Package, RefreshCw, Trash2, Upload } from 'lucide-react';
import Shell from '@/components/shell';
import { releaseRequest, useReleaseAccess, type AppRelease, type ReleasePage } from '@/lib/app-releases';
import { clearUploadAttempt, readUploadAttempt, saveUploadAttempt, uploadMessage, type UploadAttempt } from '@/lib/release-upload';
import '../subscriptions/subscriptions.css';
import './releases.css';

const MAX_APK = 256 * 1024 * 1024;
const date = (value: string | null) => value ? new Date(value).toLocaleString('fr-FR') : '—';
const size = (bytes: number) => `${(bytes / 1024 / 1024).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} Mio`;
function uploadSession() {
  try {
    const user = JSON.parse(localStorage.getItem('gymdash_user') || 'null');
    return { storage: sessionStorage, owner: typeof user?.id === 'string' ? user.id : '' };
  } catch { return { storage: undefined, owner: '' }; }
}

function Releases() {
  const { access, retry } = useReleaseAccess();
  const [page, setPage] = useState<ReleasePage | null>(null);
  const [latest, setLatest] = useState<AppRelease | null>(null);
  const [cursors, setCursors] = useState<Array<string | null>>([null]);
  const cursor = cursors[cursors.length - 1];
  const [revision, setRevision] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [stalledSeconds, setStalledSeconds] = useState(0);
  const [recovery, setRecovery] = useState<UploadAttempt | null>(null);
  const lastProgress = useRef({ at: 0, bytes: 0 });
  const fileInput = useRef<HTMLInputElement>(null);
  const refresh = () => { setLoading(true); setError(''); setRevision(n => n + 1); };
  useEffect(() => {
    if (access !== 'allowed') return;
    const abort = new AbortController();
    Promise.all([
      releaseRequest<ReleasePage>(`admin${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ''}`, { signal: abort.signal }),
      releaseRequest<{ release: AppRelease | null }>('latest', { signal: abort.signal }),
    ]).then(([data, active]) => {
      if (!abort.signal.aborted) { setPage(data); setLatest(active.release); setError(''); }
    }).catch(err => { if (!abort.signal.aborted) setError(err instanceof Error ? err.message : 'Chargement impossible.'); })
      .finally(() => {
        if (!abort.signal.aborted) {
          setLoading(false);
          const session = uploadSession();
          setRecovery(readUploadAttempt(session.storage, session.owner));
        }
      });
    return () => abort.abort();
  }, [access, cursor, revision]);
  useEffect(() => {
    if (busy !== 'upload') return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    const timer = window.setInterval(() => setStalledSeconds(Math.floor((Date.now() - lastProgress.current.at) / 1000)), 1000);
    return () => { window.removeEventListener('beforeunload', warn); window.clearInterval(timer); };
  }, [busy]);

  async function upload(event: React.FormEvent) {
    event.preventDefault();
    if (!file || busy) return;
    if (!file.name.toLowerCase().endsWith('.apk') || file.size === 0 || file.size > MAX_APK) { setError('Sélectionnez un APK valide, de 256 Mio maximum.'); return; }
    setBusy('upload'); setError(''); setNotice(''); setProgress(0);
    setStalledSeconds(0); setRecovery(null);
    lastProgress.current = { at: Date.now(), bytes: 0 };
    const attempt = { name: file.name, size: file.size, startedAt: Date.now() };
    const session = uploadSession();
    saveUploadAttempt(session.storage, session.owner, attempt);
    try {
      const body = new FormData(); body.append('apk', file); body.append('notes', notes);
      const token = localStorage.getItem('gymdash_token');
      const result = await axios.post<AppRelease>('/api/app-releases/admin', body, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        onUploadProgress: event => {
          if (event.loaded > lastProgress.current.bytes) {
            lastProgress.current = { at: Date.now(), bytes: event.loaded };
            setStalledSeconds(0);
          }
          if (event.total) setProgress(Math.min(100, Math.floor(event.loaded * 100 / event.total)));
        },
        // Allow the five-minute transfer budget plus APK analysis/storage.
        timeout: 360_000,
      });
      clearUploadAttempt(session.storage, session.owner);
      setNotice(`Brouillon ${result.data.versionName} (${result.data.versionCode}) créé. Vérifiez les détails avant publication.`);
      setFile(null); setNotes(''); if (fileInput.current) fileInput.current.value = '';
      setCursors([null]); refresh();
    } catch (err) {
      setRecovery(attempt);
      setError(axios.isAxiosError(err) ? err.response?.data?.error || (err.code === 'ECONNABORTED'
        ? 'Le délai d’import a été dépassé. Vérifiez l’historique avant de renvoyer le fichier : le serveur a pu terminer le brouillon.'
        : 'Connexion interrompue pendant l’import. Vérifiez l’historique avant de renvoyer le fichier.') : 'Création impossible.');
    } finally { setBusy(null); }
  }
  async function deleteRelease(release: AppRelease) {
    if (busy || !window.confirm(`Supprimer GymPass ${release.versionName} (code ${release.versionCode}) ?\n\nCette action est irréversible.`)) return;
    setBusy(release.id + '-del'); setError(''); setNotice('');
    try {
      await releaseRequest(`admin/${encodeURIComponent(release.id)}`, { method: 'DELETE' });
      setNotice(`Version ${release.versionName} supprimée.`); refresh();
    } catch (err) { setError(`${err instanceof Error ? err.message : 'Suppression impossible.'} Actualisez avant de réessayer.`); }
    finally { setBusy(null); }
  }
  async function publish(release: AppRelease) {
    if (busy || !window.confirm(`Publier GymPass ${release.versionName} (code ${release.versionCode}) ?\n\nCette version deviendra disponible pour toutes les applications Android. Le fichier et les notes sont définitifs.`)) return;
    setBusy(release.id); setError(''); setNotice('');
    try {
      await releaseRequest(`admin/${encodeURIComponent(release.id)}/publish`, { method: 'POST' });
      setNotice(`Version ${release.versionName} publiée.`); refresh();
    } catch (err) { setError(`${err instanceof Error ? err.message : 'Publication impossible.'} Actualisez avant de réessayer.`); }
    finally { setBusy(null); }
  }
  if (access === 'loading') return <div className="billing-empty" role="status">Vérification des droits de publication…</div>;
  if (access === 'denied') return <div className="billing-empty"><Package size={28} /><h1>Accès réservé à la plateforme</h1><p>Seuls les super-administrateurs autorisés peuvent gérer les versions Android.</p></div>;
  if (access === 'error') return <div className="billing-error" role="alert">Impossible de vérifier votre accès.<button className="billing-btn" onClick={retry}>Réessayer</button></div>;
  return <div className="billing-page releases-page fade-up">
    <div className="billing-heading"><div><div className="section-label">Application Android</div><h1 className="page-title">Versions GymPass</h1><p className="page-sub">Importez un APK, vérifiez le brouillon, puis publiez explicitement.</p></div><button className="billing-btn" disabled={!!busy || loading} onClick={refresh}><RefreshCw size={15} /> Actualiser</button></div>
    {notice && <div className="billing-notice" role="status">{notice}<button className="billing-btn" onClick={() => setNotice('')}>Fermer</button></div>}
    {error && <div className="billing-error" role="alert">{error}<button className="billing-btn" disabled={!!busy} onClick={refresh}>Actualiser / réessayer</button></div>}
    {recovery && busy !== 'upload' && <div className="billing-notice" role="status" aria-label="Import non confirmé">
      <strong>Import non confirmé : {recovery.name}</strong>
      <p className="billing-note">{size(recovery.size)} · commencé le {date(new Date(recovery.startedAt).toISOString())}. Une actualisation ou une coupure peut interrompre le transfert. Vérifiez l’historique avant de sélectionner à nouveau l’APK ; aucun renvoi automatique n’est effectué.</p>
      <button className="billing-btn" onClick={() => { setCursors([null]); refresh(); }}>Vérifier l’historique</button>
      <button className="billing-btn" onClick={() => { const session = uploadSession(); clearUploadAttempt(session.storage, session.owner); setRecovery(null); }}>J’ai vérifié</button>
    </div>}
    {loading && <div role="status" className="billing-note">Chargement des versions…</div>}
    <section className="billing-panel" aria-label="Version disponible"><h2><Package size={18} /> Version actuellement disponible</h2>{latest ? <><p className="release-active">{latest.versionName} <span>code {latest.versionCode}</span></p><p className="billing-note">Publiée le {date(latest.publishedAt)} · {size(latest.sizeBytes)}</p><p className="release-notes">{latest.notes || 'Aucune note de version.'}</p></> : !loading && !error ? <p className="billing-note">Aucune version publiée.</p> : <p className="billing-note">Version disponible en cours de vérification.</p>}</section>
    <section className="billing-panel"><h2>Nouveau brouillon</h2><p className="billing-note">APK signé pour com.gympass.gympass_sn · 256 Mio maximum. La version, le package et l’empreinte sont extraits du fichier par le serveur.</p>
      <form className="release-form" onSubmit={upload}><label>Fichier APK<input ref={fileInput} type="file" accept=".apk,application/vnd.android.package-archive" required disabled={!!busy} onChange={event => setFile(event.target.files?.[0] ?? null)} /></label><label>Notes de version<textarea rows={4} maxLength={10000} value={notes} disabled={!!busy} onChange={event => setNotes(event.target.value)} placeholder="Améliorations et correctifs de cette version…" /></label>
        {busy === 'upload' && <div role="status"><progress aria-label="Progression du transfert APK" value={progress} max={100} /><p className="billing-note">{uploadMessage(progress, stalledSeconds)}</p></div>}
        <button className="billing-btn billing-primary" type="submit" disabled={!file || !!busy || loading}><Upload size={15} />{busy === 'upload' ? 'Import en cours…' : 'Importer le brouillon'}</button>
      </form>
    </section>
    <section className="billing-panel" aria-label="Historique des versions"><div className="billing-section-heading"><div><h2>Historique des versions</h2><p className="billing-note">20 versions par page · Un brouillon est privé jusqu’à sa publication.</p></div></div>
      {page && <><div className="billing-table-wrap"><table><thead><tr><th>Version / Package</th><th>Fichier et détails</th><th>Statut</th><th>Publication</th></tr></thead><tbody>{page.items.map(release => <tr key={release.id}><td><strong>{release.versionName} <span className="billing-count">{release.versionCode}</span></strong><small>{release.packageName}</small><small>Importée le {date(release.createdAt)}</small></td><td>{size(release.sizeBytes)}<details><summary>Détails et notes</summary><p className="release-notes">{release.notes || 'Aucune note de version.'}</p><p className="billing-note">SHA-256</p><code className="release-hash">{release.sha256}</code></details></td><td><span className={`billing-status ${release.status === 'PUBLISHED' ? 'billing-status-paid' : 'billing-status-unpaid'}`}>{release.status === 'PUBLISHED' ? 'Publiée' : 'Brouillon'}</span>{latest?.id === release.id && <small>Version active</small>}</td><td>{release.status === 'DRAFT' ? <><button className="billing-btn billing-primary" disabled={!!busy || loading || !!error || !!latest && release.versionCode <= latest.versionCode} onClick={() => publish(release)}>{busy === release.id ? 'Publication…' : 'Publier'}</button>{latest && release.versionCode <= latest.versionCode && <small>Code inférieur ou égal à la version active</small>}<button className="billing-btn billing-danger" disabled={!!busy} onClick={() => deleteRelease(release)} title="Supprimer ce brouillon"><Trash2 size={14} /></button></> : <>{date(release.publishedAt)}{latest?.id !== release.id && <button className="billing-btn billing-danger" disabled={!!busy} onClick={() => deleteRelease(release)} title="Supprimer cette version"><Trash2 size={14} /></button>}</>}</td></tr>)}</tbody></table></div>{page.items.length === 0 && <div className="billing-empty">Aucune version importée.</div>}<div className="billing-pagination"><button className="billing-btn" disabled={cursors.length === 1 || loading || !!busy} onClick={() => { setLoading(true); setCursors(values => values.slice(0, -1)); }}>Précédent</button><span>Page {cursors.length}</span><button className="billing-btn" disabled={!page.nextCursor || loading || !!busy} onClick={() => { setLoading(true); setCursors(values => [...values, page.nextCursor]); }}>Suivant</button></div></>}
    </section>
  </div>;
}
export default function AppReleasesPage() { return <Shell><Releases /></Shell>; }
