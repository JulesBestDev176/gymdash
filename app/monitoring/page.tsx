'use client';

import { useEffect, useMemo, useState } from 'react';
import { Activity, AlertTriangle, CheckCircle2, Database, Globe, HardDrive, RefreshCw, RotateCcw, Server, ShieldCheck, WifiOff } from 'lucide-react';
import Shell from '@/components/shell';
import Spinner from '@/components/ui/spinner';
import { SystemChart, RequestCharts } from '@/components/monitoring/charts';
import { authenticatedFetch } from '@/lib/authenticated-fetch';
import { formatBytes } from '@/lib/monitoring-model';
import type { MonitoringData } from '@/lib/monitoring-model';
import './monitoring.css';

type Tab = 'overview' | 'api' | 'storage' | 'security' | 'alerts';
const tabs = [
  ['overview', 'Vue d’ensemble', Activity], ['api', 'Performances API', Globe],
  ['storage', 'Stockage', HardDrive], ['security', 'Sécurité', ShieldCheck], ['alerts', 'Alertes', AlertTriangle],
] as const;
const labels: Record<string, string> = { 'gympass-backend': 'API GymPass', gymdash: 'GymDash', 'gympass-postgres': 'PostgreSQL', relayio: 'Relayio WhatsApp' };
const stateLabels = { up: 'En ligne', degraded: 'À vérifier', down: 'Indisponible' };
const stateColors = { up: 'var(--success)', degraded: 'var(--warning)', down: 'var(--danger)' };
const percent = (value: number | null | undefined) => value == null ? '—' : `${value.toFixed(1)} %`;
const date = (value: string | null | undefined) => value ? new Date(value).toLocaleString('fr-FR') : 'Indisponible';
const ms = (value: number | null | undefined) => value == null ? '—' : `${Math.round(value).toLocaleString('fr-FR')} ms`;

function Stat({ label, value, detail, progress, color = 'var(--accent)' }: { label: string; value: string; detail: string; progress?: number | null; color?: string }) {
  return <div className="card monitor-panel">
    <div className="section-label">{label}</div>
    <div className="stat-value monitor-number" style={{ fontSize: 27, marginTop: 10, color }}>{value}</div>
    <div className="monitor-sub" style={{ marginTop: 5 }}>{detail}</div>
    {progress != null && <div className="monitor-meter"><span style={{ width: `${Math.min(100, Math.max(0, progress))}%`, background: progress >= 85 ? 'var(--warning)' : color }} /></div>}
  </div>;
}

export default function MonitoringPage() {
  const [tab, setTab] = useState<Tab>('overview');
  const [hours, setHours] = useState(24);
  const [data, setData] = useState<MonitoringData | null>(null);
  const [error, setError] = useState('');
  const [refresh, setRefresh] = useState(0);
  const [fetching, setFetching] = useState(true);
  const [search, setSearch] = useState('');
  const [redeploying, setRedeploying] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<{ uuid: string; name: string } | null>(null);
  const [actionResult, setActionResult] = useState('');
  useEffect(() => { const timer = setInterval(() => setRefresh(v => v + 1), 30000); return () => clearInterval(timer); }, []);
  useEffect(() => {
    const controller = new AbortController();
    setFetching(true);
    authenticatedFetch(`/api/monitoring?hours=${hours}`, { signal: controller.signal })
      .then(async response => { if (!response.ok) { const body = await response.json().catch(() => ({})); throw new Error(body.error || 'Monitoring indisponible'); } return response.json(); })
      .then(body => { if (!controller.signal.aborted) { setData(body); setError(''); } })
      .catch(e => { if (!controller.signal.aborted) setError(e.message || 'Impossible de charger le monitoring'); })
      .finally(() => { if (!controller.signal.aborted) setFetching(false); });
    return () => controller.abort();
  }, [hours, refresh]);

  const metrics = data?.metrics;
  const routes = useMemo(() => [...(metrics?.api.routes ?? [])].filter(route => `${route.method} ${route.route}`.toLowerCase().includes(search.toLowerCase())).sort((a, b) => b.p95Ms - a.p95Ms), [metrics, search]);
  const healthy = data?.services.filter(s => s.state === 'up').length ?? 0;
  const server = metrics?.server;
  const collectionErrors = metrics?.collection.errors ?? [];
  const collectionAge = metrics?.collection.lastSampleAt ? Date.now() - Date.parse(metrics.collection.lastSampleAt) : null;
  const stale = collectionAge == null || collectionAge > 120000;

  async function redeploy() {
    if (!confirmation) return;
    setRedeploying(confirmation.uuid); setActionResult('');
    try {
      const response = await authenticatedFetch('/api/coolify/redeploy', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ uuid: confirmation.uuid }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || 'Redéploiement refusé');
      setActionResult('Redéploiement demandé à Coolify. Le statut sera actualisé automatiquement.'); setConfirmation(null); setRefresh(v => v + 1);
    } catch (e) { setActionResult(e instanceof Error ? e.message : 'Redéploiement impossible'); }
    finally { setRedeploying(null); }
  }

  return <Shell><div className="fade-up" style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
      <div><h1 className="page-title">Monitoring</h1><p className="page-sub">Infrastructure, performances et sécurité de GymPass</p></div>
      <div className="monitor-header-actions">
        {[1, 24, 168].map(value => <button key={value} className="monitor-period" aria-pressed={hours === value} onClick={() => { if (hours !== value) { setData(null); setHours(value); } }}>{value === 168 ? '7 jours' : `${value} h`}</button>)}
        <button className="btn-ghost" onClick={() => setRefresh(v => v + 1)} disabled={fetching} style={{ display: 'flex', gap: 7, alignItems: 'center', fontSize: 12 }}>{fetching ? <Spinner size="sm" /> : <RefreshCw size={13} />} Actualiser</button>
      </div>
    </div>
    {error && <div className="banner-error" role="alert"><WifiOff size={15} /> {error}{data ? ' · Dernières données conservées ci-dessous.' : ''}</div>}
    {data && <div className="card monitor-panel" style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
      <div style={{ color: healthy === data.services.length ? 'var(--success)' : 'var(--warning)' }}><Activity size={23} /></div>
      <div style={{ flex: 1 }}><div style={{ fontWeight: 700 }}>{healthy}/{data.services.length} services opérationnels</div><div className="monitor-sub">Vérifié le {date(data.timestamp)} · actualisation 30 s</div></div>
      <div className="monitor-sub">Collecte {stale ? <span style={{ color: 'var(--warning)' }}>à vérifier</span> : <span style={{ color: 'var(--success)' }}>active</span>} · historique persistant {metrics?.collection.retentionDays ?? 7} jours</div>
    </div>}
    {data?.partialErrors.length ? <div className="monitor-alert" role="status"><AlertTriangle size={16} color="var(--warning)" /><div className="monitor-sub">Données partielles : {data.partialErrors.join(' · ')}. Les valeurs absentes restent indisponibles.</div></div> : null}
    {collectionErrors.length > 0 && <div className="monitor-alert" role="status"><AlertTriangle size={16} color="var(--warning)" /><div className="monitor-sub">Collecte : {collectionErrors.join(' · ')}</div></div>}
    {actionResult && <div className="monitor-alert" role="status">{actionResult}</div>}
    <div className="monitor-tabs" role="tablist" aria-label="Sections du monitoring">{tabs.map(([id, text, Icon]) => <button id={`tab-${id}`} key={id} className="monitor-tab" role="tab" aria-selected={tab === id} aria-controls={`panel-${id}`} onClick={() => setTab(id)}><Icon size={14} />{text}{id === 'alerts' && !!data?.alerts.length && <span className="badge badge-warning">{data.alerts.length}</span>}</button>)}</div>
    {!data && fetching ? <div className="monitor-empty"><Spinner size="md" /><p style={{ marginTop: 12 }}>Lecture des services et des métriques…</p></div> : data && <div id={`panel-${tab}`} role="tabpanel" aria-labelledby={`tab-${tab}`} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {tab === 'overview' && <>
        <div className="monitor-grid-4">
          <Stat label="CPU serveur" value={percent(server?.cpuPercent)} detail="Utilisation de tous les cœurs" progress={server?.cpuPercent} />
          <Stat label="Mémoire" value={percent(server?.memoryPercent)} detail={`${formatBytes(server?.memoryUsedBytes)} / ${formatBytes(server?.memoryTotalBytes)}`} progress={server?.memoryPercent} color="var(--blue)" />
          <Stat label="Disque hôte" value={percent(server?.diskPercent)} detail={`${formatBytes(server?.diskUsedBytes)} / ${formatBytes(server?.diskTotalBytes)}`} progress={server?.diskPercent} color="var(--purple)" />
          <Stat label="Requêtes API" value={metrics ? metrics.api.totalRequests.toLocaleString('fr-FR') : '—'} detail={metrics ? `${percent(metrics.api.errorRate * 100)} de réponses 5xx · période sélectionnée` : 'Mesures réelles indisponibles'} color="var(--fg)" />
        </div>
        <section className="card monitor-panel"><h2 className="monitor-panel-title">Ressources du serveur</h2><p className="monitor-sub" style={{ marginBottom: 18 }}>Collecte toutes les 30 secondes, même lorsque ce tableau est fermé.</p>{metrics ? <SystemChart history={metrics.history} /> : <div className="monitor-empty">Le collecteur de métriques est indisponible.</div>}</section>
        <section className="card" style={{ overflow: 'hidden' }}>
          <div className="monitor-panel"><h2 className="monitor-panel-title">Services</h2><p className="monitor-sub">Disponibilité externe et temps de réponse des sondes HTTP.</p></div>
          <div className="monitor-services-scroll">
            <table className="data-table monitor-services-table">
              <caption className="sr-only">État des services GymPass</caption>
              <colgroup><col /><col style={{ width: 132 }} /><col style={{ width: 104 }} /><col style={{ width: 76 }} /><col style={{ width: 140 }} /></colgroup>
              <thead><tr><th scope="col">Service</th><th scope="col">Statut</th><th scope="col" className="monitor-service-numeric">Latence</th><th scope="col" className="monitor-service-numeric">HTTP</th><th scope="col" className="monitor-service-action">Action</th></tr></thead>
              <tbody>{data.services.map(service => <tr key={service.uuid}>
                <td><div className="monitor-service-identity"><span className="monitor-service-icon"><Server size={17} color={stateColors[service.state]} /></span><div className="monitor-service-name"><div className="monitor-service-title">{labels[service.name] ?? service.name}</div>{service.fqdn ? <a className="monitor-service-domain" href={service.fqdn} target="_blank" rel="noreferrer" title={service.fqdn}>{service.fqdn.replace('https://', '')}</a> : <span className="monitor-service-domain">Réseau privé</span>}</div></div></td>
                <td><span className="monitor-service-state" style={{ color: stateColors[service.state] }}><span aria-hidden="true" />{stateLabels[service.state]}</span></td>
                <td className="monitor-service-numeric monitor-number">{ms(service.latencyMs)}</td>
                <td className="monitor-service-numeric monitor-number"><span className="monitor-service-http">{service.httpStatus ?? '—'}</span></td>
                <td className="monitor-service-action">{service.redeployable ? <button className="btn-ghost monitor-service-redeploy" aria-label={`Redéployer ${labels[service.name]}`} onClick={() => setConfirmation({ uuid: service.uuid, name: labels[service.name] })}><RotateCcw size={12} /> Redéployer</button> : <span className="monitor-service-unavailable" aria-label="Redéploiement non disponible">—</span>}</td>
              </tr>)}</tbody>
            </table>
          </div>
        </section>
      </>}
      {tab === 'api' && <>
        <div className="monitor-grid-4"><Stat label="Requêtes" value={metrics ? String(metrics.api.totalRequests) : '—'} detail="Sur la période sélectionnée" /><Stat label="Erreurs serveur" value={metrics ? String(metrics.api.totalErrors) : '—'} detail="Réponses HTTP 5xx" color="var(--danger)" /><Stat label="Taux d’erreur" value={metrics ? percent(metrics.api.errorRate * 100) : '—'} detail="5xx / nombre de requêtes" color="var(--blue)" /><Stat label="Routes mesurées" value={metrics ? String(metrics.api.routes.length) : '—'} detail="Paramètres et identifiants anonymisés" color="var(--fg)" /></div>
        <section className="card monitor-panel"><h2 className="monitor-panel-title">Trafic et durées</h2><p className="monitor-sub" style={{ marginBottom: 22 }}>Mesures côté backend ; résolution adaptée à la période sélectionnée. L’historique commence à l’activation de la collecte.</p>{metrics ? <RequestCharts history={metrics.api.history} /> : <div className="monitor-empty">Mesures indisponibles.</div>}</section>
        <section className="card" style={{ overflow: 'hidden' }}><div className="monitor-panel"><h2 className="monitor-panel-title">API les plus lentes</h2><p className="monitor-sub">Tri par p95. Les p95/p99 sont des estimations par histogrammes ; les moyennes et maxima sont mesurés.</p><input className="input-base" aria-label="Filtrer les routes API" placeholder="Rechercher une route…" value={search} onChange={e => setSearch(e.target.value)} style={{ marginTop: 15, maxWidth: 380 }} /></div>
          <div className="monitor-table-wrap"><table className="data-table"><thead><tr><th>Route</th><th>Requêtes</th><th>Moyenne</th><th>p95</th><th>p99</th><th>5xx</th><th>4xx</th></tr></thead><tbody>{routes.slice(0, 100).map(route => <tr key={`${route.method}:${route.route}`}><td><span className="badge badge-neutral" style={{ marginRight: 8 }}>{route.method}</span><code style={{ fontSize: 11 }}>{route.route}</code></td><td className="monitor-number">{route.count}</td><td className="monitor-number">{ms(route.avgMs)}</td><td className="monitor-number" style={{ color: route.p95Ms >= 1000 ? 'var(--warning)' : 'var(--fg)' }}>{ms(route.p95Ms)}</td><td className="monitor-number">{ms(route.p99Ms)}</td><td className="monitor-number" style={{ color: route.errors5xx ? 'var(--danger)' : 'var(--fg3)' }}>{route.errors5xx} · {percent(route.errorRate * 100)}</td><td className="monitor-number">{route.errors4xx}</td></tr>)}</tbody></table></div>{!routes.length && <div className="monitor-empty">Aucune route mesurée pour cette sélection.</div>}
        </section>
      </>}
      {tab === 'storage' && <>
        <div className="monitor-grid-2"><Stat label="Disque du serveur" value={percent(server?.diskPercent)} detail={`${formatBytes(server?.diskUsedBytes)} utilisés sur ${formatBytes(server?.diskTotalBytes)}`} progress={server?.diskPercent} color="var(--purple)" /><Stat label="Volumes suivis" value={metrics ? String(metrics.storage.length) : '—'} detail="Volumes rattachés aux conteneurs GymPass" color="var(--fg)" /></div>
        <section className="card monitor-panel"><h2 className="monitor-panel-title">Volumes et montages</h2><p className="monitor-sub">Les volumes partagent le disque de l’hôte. La taille des montages directs peut être indisponible.</p>{metrics?.storage.map((volume, index) => <div className="monitor-row" key={`${volume.name}:${index}`}><div style={{ minWidth: 0 }}><div style={{ fontWeight: 600, fontSize: 13, overflowWrap: 'anywhere' }}><Database size={13} style={{ marginRight: 7 }} />{volume.name}</div><div className="monitor-sub" style={{ overflowWrap: 'anywhere' }}>{volume.mountpoint}</div></div><span className="monitor-number" style={{ fontSize: 12, whiteSpace: 'nowrap' }}>{volume.available ? formatBytes(volume.usedBytes) : 'Taille indisponible'}</span></div>)}{!metrics?.storage.length && <div className="monitor-empty">Aucun volume remonté par le collecteur.</div>}</section>
        <section className="card monitor-panel"><h2 className="monitor-panel-title">Sauvegardes PostgreSQL</h2><p className="monitor-sub">Lecture de la configuration Coolify. Aucune sauvegarde ou restauration n’est lancée depuis ce tableau.</p>{data.backups?.map(backup => <div className="monitor-row" key={backup.uuid}><div><div style={{ fontWeight: 600 }}>{backup.enabled ? 'Planification active' : 'Planification désactivée'}</div><div className="monitor-sub">Fréquence : {backup.frequency}</div></div><div className="monitor-sub">Dernier résultat : {backup.lastStatus ?? 'Aucune exécution connue'}<br />{backup.lastAt ? date(backup.lastAt) : ''}</div></div>)}{!data.backups?.length && <div className="monitor-empty">{data.backups ? 'Aucune sauvegarde automatique configurée dans Coolify.' : 'Configuration des sauvegardes indisponible.'}</div>}</section>
      </>}
      {tab === 'security' && <>
        <section className="card monitor-panel"><h2 className="monitor-panel-title">Contrôles de configuration</h2><p className="monitor-sub">État vérifiable de l’infrastructure. Ces contrôles ne remplacent pas un audit de vulnérabilités.</p>{data.security.map(check => <div className="monitor-row" key={check.id}><div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>{check.status === 'ok' ? <CheckCircle2 size={18} color="var(--success)" /> : <AlertTriangle size={18} color={check.status === 'warning' ? 'var(--warning)' : 'var(--fg3)'} />}<div><div style={{ fontWeight: 600, fontSize: 13 }}>{check.title}</div><p className="monitor-sub">{check.detail}</p></div></div><span className="monitor-sub">{check.status === 'ok' ? 'Vérifié' : check.status === 'warning' ? 'À examiner' : 'Inconnu'}</span></div>)}</section>
        <section className="card monitor-panel"><h2 className="monitor-panel-title">Conteneurs suivis</h2><p className="monitor-sub">Utilisateur configuré, privilèges et ports publiés par Docker.</p>{metrics?.containers.map(container => <div className="monitor-row" key={container.id}><div style={{ minWidth: 0 }}><div style={{ fontSize: 12, fontWeight: 600, overflowWrap: 'anywhere' }}>{container.name}</div><div className="monitor-sub">Utilisateur : {container.user || 'root (défaut)'} · privilégié : {container.privileged ? 'oui' : 'non'} · {container.publishedPorts.length} port(s) publié(s)</div></div><span className="monitor-sub">{container.status}</span></div>)}{!metrics?.containers.length && <div className="monitor-empty">Données des conteneurs indisponibles.</div>}</section>
      </>}
      {tab === 'alerts' && <>
        <section className="card monitor-panel"><h2 className="monitor-panel-title">Alertes actives</h2><p className="monitor-sub">CPU/mémoire ≥ 85 %, disque ≥ 80 %, p95 API ≥ 1 s, erreurs 5xx ≥ 1 %. Les alertes sont affichées ici ; aucun message n’est envoyé automatiquement.</p></section>
        {data.alerts.map(alert => <div className="monitor-alert" key={alert.id}><AlertTriangle size={18} style={{ flexShrink: 0, color: alert.severity === 'critical' ? 'var(--danger)' : 'var(--warning)' }} /><div><div style={{ fontWeight: 600, fontSize: 13 }}>{alert.title}</div><p className="monitor-sub" style={{ overflowWrap: 'anywhere' }}>{alert.detail}</p></div></div>)}
        {stale && <div className="monitor-alert"><AlertTriangle size={18} color="var(--warning)" /><div><strong>Collecte à vérifier</strong><p className="monitor-sub">Dernier échantillon : {date(metrics?.collection.lastSampleAt)}. Les données peuvent être périmées.</p></div></div>}
        {!data.alerts.length && !stale && <div className="monitor-empty"><CheckCircle2 size={24} color="var(--success)" /><p>Aucune alerte sur les mesures disponibles.</p></div>}
      </>}
    </div>}
    {confirmation && <div role="dialog" aria-modal="true" aria-labelledby="redeploy-title" style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,.7)', display: 'grid', placeItems: 'center', padding: 20 }}><div className="card monitor-panel" style={{ width: '100%', maxWidth: 420 }}><h2 id="redeploy-title" className="monitor-panel-title">Redéployer {confirmation.name} ?</h2><p className="monitor-sub" style={{ margin: '14px 0 22px' }}>Coolify redémarrera ce service de production. Une interruption temporaire est possible.</p><div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}><button className="btn-ghost" disabled={!!redeploying} onClick={() => setConfirmation(null)}>Annuler</button><button className="btn-danger" disabled={!!redeploying} onClick={redeploy}>{redeploying ? 'Envoi…' : 'Confirmer'}</button></div></div></div>}
  </div></Shell>;
}
