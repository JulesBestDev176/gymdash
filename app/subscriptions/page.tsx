'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Building2, ReceiptText, Settings2, Plus, Download, RefreshCw, Search, ArrowRight, CircleCheck, Clock3, ShieldAlert } from 'lucide-react';
import Shell from '@/components/shell';
import { browserFinancialIntents } from '@/components/billing/intent';
import { BillingEditor, SettingsForm, Status, type Editor } from '@/components/billing/forms';
import { billingRequest, downloadInvoice, money, date, gymLabels, invoiceLabels, type BillingOverview, type BillingGymStatus, type BillingInvoiceStatus, type BillingInvoicePage } from '@/lib/billing';
import './subscriptions.css';

type Tab = 'gyms' | 'invoices' | 'settings';
function BillingContent() {
  const [tab, setTab] = useState<Tab>('gyms');
  const [overview, setOverview] = useState<BillingOverview | null>(null);
  const [loading, setLoading] = useState(true); const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [search, setSearch] = useState(''); const [status, setStatus] = useState(''); const [gymPage, setGymPage] = useState(1);
  const [invoiceGym, setInvoiceGym] = useState(''); const [invoiceStatus, setInvoiceStatus] = useState('');
  const [invoicePage, setInvoicePage] = useState(1); const [invoices, setInvoices] = useState<BillingInvoicePage | null>(null);
  const [invoiceLoading, setInvoiceLoading] = useState(false); const [invoiceError, setInvoiceError] = useState('');
  const [revision, setRevision] = useState(0); const [editor, setEditor] = useState<Editor | null>(null);
  const [downloadId, setDownloadId] = useState<string | null>(null);
  const reload = useCallback(() => setRevision(n => n + 1), []);
  useEffect(() => {
    const abort = new AbortController();
    billingRequest<BillingOverview>('/overview', 'GET', undefined, abort.signal).then(data => { setOverview(data); setError(''); }).catch(err => { if (!abort.signal.aborted) setError(err.message || 'Impossible de charger la facturation.'); }).finally(() => { if (!abort.signal.aborted) setLoading(false); });
    return () => abort.abort();
  }, [revision]);
  useEffect(() => {
    if (tab !== 'invoices') return;
    const abort = new AbortController();
    const query = new URLSearchParams({ page: String(invoicePage) });
    if (invoiceGym) query.set('gymId', invoiceGym); if (invoiceStatus) query.set('status', invoiceStatus);
    billingRequest<BillingInvoicePage>(`/invoices?${query}`, 'GET', undefined, abort.signal).then(data => { setInvoices(data); setInvoiceError(''); }).catch(err => { if (!abort.signal.aborted) setInvoiceError(err.message || 'Impossible de charger les factures.'); }).finally(() => { if (!abort.signal.aborted) setInvoiceLoading(false); });
    return () => abort.abort();
  }, [tab, invoicePage, invoiceGym, invoiceStatus, revision]);
  const filtered = useMemo(() => overview?.gyms.filter(gym => (!status || gym.status === status) && `${gym.name} ${gym.city}`.toLocaleLowerCase('fr').includes(search.toLocaleLowerCase('fr'))) ?? [], [overview, search, status]);
  function saved() { setEditor(null); setNotice('Enregistrement confirmé. Les données sont en cours d’actualisation.'); setInvoiceLoading(true); reload(); }
  function viewInvoices(gymId: string) { setInvoiceGym(gymId); setInvoicePage(1); setInvoiceLoading(true); setTab('invoices'); }
  async function pdf(invoice: NonNullable<BillingInvoicePage['items']>[number]) {
    setDownloadId(invoice.id); setNotice('');
    try { await downloadInvoice(invoice); } catch (err) { setNotice(err instanceof Error ? err.message : 'Téléchargement impossible.'); } finally { setDownloadId(null); }
  }
  return <div className="billing-page fade-up">
    <div className="billing-heading"><div><div className="section-label">Facturation de la plateforme</div><h1 className="page-title">Abonnements salles</h1><p className="page-sub">Tarifs, renouvellements et paiements manuels des salles GymPass.</p></div><button className="billing-btn" onClick={() => { setNotice(''); reload(); }}><RefreshCw size={15} /> Actualiser</button></div>
    {notice && <div className="billing-notice" role="status">{notice}<button className="billing-btn" onClick={() => setNotice('')}>Fermer</button></div>}
    {error && <div className="billing-error" role="alert">{error} {overview && 'Les données affichées peuvent être anciennes.'}<button className="billing-btn" onClick={reload}>Réessayer</button></div>}
    {loading && <div className="billing-empty" role="status">Chargement de la facturation…</div>}
    {overview && <>
      <div className="billing-summary">
        <article><span>Encaissements enregistrés</span><strong className="billing-money">{money(overview.summary.collectedFcfa)}</strong><small>Paiements des salles · cumul</small></article>
        <article><span>Reste à encaisser</span><strong>{money(overview.summary.outstandingFcfa)}</strong><small>Factures non soldées</small></article>
        <article><span><CircleCheck size={14} /> Salles actives</span><strong>{overview.summary.activeGyms}</strong><small>Abonnement en cours</small></article>
        <article><span><Clock3 size={14} /> Délai de grâce</span><strong>{overview.summary.graceGyms}</strong><small>À renouveler</small></article>
        <article><span><ShieldAlert size={14} /> Salles bloquées</span><strong>{overview.summary.blockedGyms}</strong><small>Échéance dépassée</small></article>
      </div>
      <div className="billing-tabs" aria-label="Sections de facturation">{([{ id: 'gyms', label: 'Salles', icon: Building2 }, { id: 'invoices', label: 'Factures', icon: ReceiptText }, { id: 'settings', label: 'Paramètres', icon: Settings2 }] as const).map(({ id, label, icon: Icon }) => <button key={id} aria-pressed={tab === id} className={tab === id ? 'active' : ''} onClick={() => { if (id === 'invoices' && tab !== id) setInvoiceLoading(true); setTab(id); }}><Icon size={16} />{label}</button>)}</div>
      {tab === 'gyms' && <section className="billing-panel" aria-label="Abonnements des salles">
        <div className="billing-section-heading"><div><h2>Suivi des salles <span className="billing-count">{filtered.length}</span></h2><p className="billing-note">Les salles non configurées sont accessibles. Le contrôle commence à l’activation ou à l’émission de la première facture.</p></div><span className="billing-note">Tarif global : {overview.settings.monthlyPriceFcfa === null ? 'non défini' : `${money(overview.settings.monthlyPriceFcfa)} / mois`}</span></div>
        {(!overview.settings.issuerName || overview.settings.monthlyPriceFcfa === null) && <div className="billing-info">Complétez le nom de l’émetteur et le tarif global dans les paramètres pour émettre des factures. Un tarif spécifique peut être défini par salle.<button className="billing-btn" onClick={() => setTab('settings')}>Paramètres <ArrowRight size={14} /></button></div>}
        <div className="billing-filters"><label className="billing-search"><Search size={16} /><input aria-label="Rechercher une salle" placeholder="Rechercher par nom ou ville…" value={search} onChange={e => { setSearch(e.target.value); setGymPage(1); }} /></label><select aria-label="Statut de l’abonnement" value={status} onChange={e => { setStatus(e.target.value); setGymPage(1); }}><option value="">Tous les statuts</option>{Object.entries(gymLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div>
        {filtered.length === 0 ? <div className="billing-empty"><Building2 size={28} /><h3>Aucune salle à afficher</h3><p>{overview.gyms.length ? 'Modifiez votre recherche ou les filtres.' : 'Les salles du réseau apparaîtront ici.'}</p></div> : <div className="billing-table-wrap"><table><thead><tr><th>Salle</th><th>Abonnement</th><th>Tarif mensuel</th><th>Échéances</th><th>À encaisser</th><th>Actions</th></tr></thead><tbody>{filtered.slice((gymPage - 1) * 20, gymPage * 20).map(gym => <tr key={gym.gymId}><td><strong>{gym.name}</strong><small>{gym.city || 'Ville non renseignée'}</small></td><td><Status status={gym.status} label={gymLabels[gym.status as BillingGymStatus]} />{gym.daysRemaining !== null && <small>{gym.daysRemaining >= 0 ? `${gym.daysRemaining} jour(s) restant(s)` : `${Math.abs(gym.daysRemaining)} jour(s) dépassé(s)`}</small>}</td><td><strong>{gym.monthlyPriceFcfa === null ? 'Non défini' : money(gym.monthlyPriceFcfa)}</strong><small>{gym.priceOverrideFcfa === null ? 'Tarif global' : 'Tarif spécifique'}</small></td><td><small>Payé jusqu’au <b>{date(gym.paidUntil)}</b></small><small>Fin de grâce <b>{date(gym.graceEndsAt)}</b></small></td><td className="num">{money(gym.outstandingFcfa)}</td><td><div className="billing-row-actions"><button className="billing-btn billing-primary" onClick={() => setEditor({ kind: 'invoice', gym })} disabled={!browserFinancialIntents().read('invoice:' + gym.gymId) && (gym.monthlyPriceFcfa === null || !overview.settings.issuerName)}><Plus size={13} /> {browserFinancialIntents().read('invoice:' + gym.gymId) ? 'Reprendre' : 'Facturer'}</button><button className="billing-btn" onClick={() => setEditor({ kind: 'gym', gym })}>Configurer</button><button className="billing-link" onClick={() => viewInvoices(gym.gymId)}>Factures <ArrowRight size={12} /></button></div></td></tr>)}</tbody></table></div>}
        {filtered.length > 20 && <div className="billing-pagination"><button className="billing-btn" disabled={gymPage === 1} onClick={() => setGymPage(p => p - 1)}>Précédent</button><span>Page {gymPage} / {Math.ceil(filtered.length / 20)}</span><button className="billing-btn" disabled={gymPage * 20 >= filtered.length} onClick={() => setGymPage(p => p + 1)}>Suivant</button></div>}
      </section>}
      {tab === 'invoices' && <section className="billing-panel" aria-label="Journal des factures"><div className="billing-section-heading"><div><h2>Journal des factures</h2><p className="billing-note">Factures et règlements conservés. Les montants émis ne peuvent pas être modifiés.</p></div></div><div className="billing-filters"><select aria-label="Filtrer les factures par salle" value={invoiceGym} onChange={e => { setInvoiceGym(e.target.value); setInvoicePage(1); setInvoiceLoading(true); }}><option value="">Toutes les salles</option>{overview.gyms.map(gym => <option key={gym.gymId} value={gym.gymId}>{gym.name}</option>)}</select><select aria-label="Filtrer les factures par statut" value={invoiceStatus} onChange={e => { setInvoiceStatus(e.target.value); setInvoicePage(1); setInvoiceLoading(true); }}><option value="">Tous les statuts</option>{Object.entries(invoiceLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div>
        {invoiceError ? <div role="alert" className="billing-error">{invoiceError}<button className="billing-btn" onClick={() => { setInvoiceLoading(true); reload(); }}>Réessayer</button></div> : invoiceLoading || !invoices ? <div className="billing-empty" role="status">Chargement des factures…</div> : invoices.items.length === 0 ? <div className="billing-empty"><ReceiptText size={28} /><h3>Aucune facture</h3><p>Créez une facture depuis l’onglet Salles ou ajustez les filtres.</p></div> : <><div className="billing-table-wrap"><table><thead><tr><th>Facture</th><th>Salle</th><th>Durée / Total</th><th>Statut / Solde</th><th>Actions</th></tr></thead><tbody>{invoices.items.map(invoice => <tr key={invoice.id}><td><button className="billing-link" onClick={() => setEditor({ kind: 'detail', invoice })}>{invoice.number}</button><small>{date(invoice.issuedAt)}</small></td><td><strong>{invoice.gymName}</strong><small>{invoice.coveredUntil ? `Couvert jusqu’au ${date(invoice.coveredUntil)}` : 'Couverture non accordée'}</small></td><td><strong>{money(invoice.totalFcfa)}</strong><small>{invoice.months} mois × {money(invoice.unitPriceFcfa)}</small></td><td><Status status={invoice.status} label={invoiceLabels[invoice.status as BillingInvoiceStatus]} /><small>Solde : {money(invoice.status === 'CANCELLED' ? 0 : invoice.totalFcfa - invoice.paidFcfa)}</small></td><td><div className="billing-row-actions"><button className="billing-btn" onClick={() => pdf(invoice)} disabled={downloadId !== null}><Download size={13} /> {downloadId === invoice.id ? 'PDF…' : 'PDF'}</button>{(invoice.status === 'UNPAID' || invoice.status === 'PARTIALLY_PAID' || browserFinancialIntents().read('payment:' + invoice.id)) && <button className="billing-btn billing-primary" onClick={() => setEditor({ kind: 'payment', invoice })}>{browserFinancialIntents().read('payment:' + invoice.id) ? 'Reprendre' : 'Encaisser'}</button>}{invoice.status === 'UNPAID' && <button className="billing-link billing-danger-text" onClick={() => setEditor({ kind: 'cancel', invoice })}>Annuler</button>}</div></td></tr>)}</tbody></table></div><div className="billing-pagination"><span>{invoices.total} facture(s)</span><button className="billing-btn" disabled={invoicePage <= 1} onClick={() => { setInvoicePage(p => p - 1); setInvoiceLoading(true); }}>Précédent</button><span>Page {invoicePage} / {Math.max(1, Math.ceil(invoices.total / invoices.pageSize))}</span><button className="billing-btn" disabled={invoicePage * invoices.pageSize >= invoices.total} onClick={() => { setInvoicePage(p => p + 1); setInvoiceLoading(true); }}>Suivant</button></div></>}
      </section>}
      {tab === 'settings' && <SettingsForm key={overview.generatedAt} settings={overview.settings} onSaved={saved} />}
      <p className="billing-updated">Dernière actualisation : {new Date(overview.generatedAt).toLocaleString('fr-FR')} · Montants en FCFA · Dates d’abonnement en UTC</p>
    </>}
    {editor && <BillingEditor editor={editor} onClose={() => setEditor(null)} onSaved={saved} />}
  </div>;
}
export default function SubscriptionsPage() { return <Shell><BillingContent /></Shell>; }


