'use client';
import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { billingRequest, money, date, paymentLabels, type BillingGym, type BillingInvoice, type BillingSettings, type PaymentMode } from '@/lib/billing';
import { browserFinancialIntents, restoreFinancialFields, type FinancialPayload } from './intent';

export type Editor = { kind: 'invoice'; gym: BillingGym } | { kind: 'gym'; gym: BillingGym } | { kind: 'payment' | 'cancel' | 'detail'; invoice: BillingInvoice };
export function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="billing-field"><span>{label}</span>{children}</label>;
}
export function Status({ status, label }: { status: string; label: string }) {
  return <span className={`billing-status billing-status-${status.toLowerCase()}`}>{label}</span>;
}
export function BillingEditor({ editor, onClose, onSaved }: { editor: Editor; onClose: () => void; onSaved: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const invoice = 'invoice' in editor ? editor.invoice : null;
  const gym = 'gym' in editor ? editor.gym : null;
  const scope = `${editor.kind}:${gym?.gymId ?? invoice?.id}`;
  const [intents] = useState(browserFinancialIntents);
  const [restored] = useState(() => editor.kind === 'invoice' || editor.kind === 'payment' ? intents.read(scope) : null);
  const [initialFields] = useState(() => restoreFinancialFields(restored));
  const [resuming, setResuming] = useState(Boolean(restored));
  const intent = useRef(restored);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [months, setMonths] = useState(initialFields.months);
  const [paid, setPaid] = useState(initialFields.paid);
  const [mode, setMode] = useState<PaymentMode>(initialFields.mode as PaymentMode);
  const [reference, setReference] = useState(initialFields.reference);
  const [paidAt, setPaidAt] = useState(initialFields.paidAt);
  const [amount, setAmount] = useState(initialFields.amount || String(invoice ? invoice.totalFcfa - invoice.paidFcfa : 0));
  const [reason, setReason] = useState('');
  const [enabled, setEnabled] = useState(gym?.enabled ?? false);
  const [price, setPrice] = useState(gym?.priceOverrideFcfa?.toString() ?? '');
  const [identity, setIdentity] = useState({ billingName: gym?.billingName ?? '', billingAddress: gym?.billingAddress ?? '', billingEmail: gym?.billingEmail ?? '', billingPhone: gym?.billingPhone ?? '', billingTaxId: gym?.billingTaxId ?? '' });
  useEffect(() => { dialog.current?.showModal(); }, []);
  function edited() { intent.current = null; intents.clear(scope); setResuming(false); setError(''); }
  async function submit(event: React.FormEvent) {
    event.preventDefault(); if (busy) return;
    setBusy(true); setError('');
    try {
      let path: string; let payload: FinancialPayload; let method = 'POST';
      if (editor.kind === 'invoice') {
        path = '/invoices'; payload = { gymId: editor.gym.gymId, months: Number(months), paid, ...(paid ? { mode, reference: reference.trim() } : {}) };
      } else if (editor.kind === 'payment') {
        path = `/invoices/${encodeURIComponent(editor.invoice.id)}/payments`;
        payload = { amountFcfa: Number(amount), mode, reference: reference.trim(), ...(paidAt ? { paidAt: new Date(paidAt).toISOString() } : {}) };
      } else if (editor.kind === 'cancel') {
        path = `/invoices/${encodeURIComponent(editor.invoice.id)}/cancel`; payload = { reason: reason.trim() };
      } else if (editor.kind === 'gym') {
        path = `/gyms/${encodeURIComponent(editor.gym.gymId)}`; method = 'PUT';
        payload = { enabled, monthlyPriceFcfa: price === '' ? null : Number(price), ...identity };
      } else return;
      if (editor.kind === 'invoice' || editor.kind === 'payment') {
        // Without an actual field edit, replay the exact stored command, including paidAt precision.
        intent.current = intents.begin(scope, intent.current?.payload ?? payload);
        payload = { ...intent.current.payload, idempotencyKey: intent.current.key };
      }
      await billingRequest(path, method, payload);
      intents.clear(scope); intent.current = null; onSaved();
    } catch (err) { setError(err instanceof Error ? err.message : 'Opération impossible. Réessayez.'); }
    finally { setBusy(false); }
  }
  const title = { invoice: 'Nouvelle facture', gym: 'Facturation de la salle', payment: 'Enregistrer un paiement', cancel: 'Annuler la facture', detail: 'Détail de la facture' }[editor.kind];
  const estimated = (gym?.monthlyPriceFcfa ?? 0) * Number(months);
  return <dialog ref={dialog} className="billing-dialog" aria-labelledby={titleId} onCancel={e => { e.preventDefault(); if (!busy) onClose(); }}>
    <header><div><h2 id={titleId}>{title}</h2><p>{gym?.name ?? `${invoice?.number} · ${invoice?.gymName}`}</p></div><button type="button" className="billing-icon" aria-label="Fermer" disabled={busy} onClick={onClose}><X size={18} /></button></header>
    <form onSubmit={submit} onChange={edited}>
      <fieldset disabled={busy} className="billing-form-body">
        {resuming && <p role="status" className="billing-note billing-unpaid-warning">Une opération dont la réponse n’a pas été confirmée a été restaurée avec tous ses champs. Réessayez sans les modifier pour retrouver son résultat sans doublon. Modifier un champ prépare une nouvelle opération.</p>}
        {editor.kind === 'invoice' && <>
          <p className="billing-note">L’émission active le contrôle de l’abonnement de cette salle. La durée est ajoutée seulement lorsque la facture est intégralement payée.</p>
          <Field label="Durée (mois)"><input type="number" required min="1" max="120" step="1" value={months} onChange={e => setMonths(e.target.value)} /></Field>
          <div className="billing-total"><span>{gym?.monthlyPriceFcfa === null ? 'Tarif à configurer dans les paramètres' : `${money(gym?.monthlyPriceFcfa ?? 0)} / mois`}</span><strong>{money(estimated)}</strong></div>
          <label className="billing-check"><input type="checkbox" checked={paid} onChange={e => setPaid(e.target.checked)} /> Paiement déjà reçu intégralement</label>
          {!paid && <p className="billing-note billing-unpaid-warning">Attention : émettre une facture à payer active le contrôle de l’abonnement sans prolonger l’accès. Sans période payée, le délai de grâce configuré démarre puis les opérations sont bloquées. Une période payée existante conserve son échéance. Réactiver une salle exemptée dont l’échéance est dépassée peut la bloquer immédiatement.</p>}
        </>}
        {editor.kind === 'payment' && <>
          <div className="billing-total"><span>Solde de la facture</span><strong>{money(invoice!.totalFcfa - invoice!.paidFcfa)}</strong></div>
          <Field label="Montant reçu (FCFA)"><input type="number" min="1" max={resuming ? undefined : invoice!.totalFcfa - invoice!.paidFcfa} step="1" required value={amount} onChange={e => setAmount(e.target.value)} /></Field>
          <Field label="Date du paiement (facultatif, heure locale)"><input type="datetime-local" step="0.001" value={paidAt} onChange={e => setPaidAt(e.target.value)} /></Field>
          <p className="billing-note">Un paiement partiel est conservé au journal. Seul le règlement intégral prolonge l’abonnement.</p>
        </>}
        {(editor.kind === 'payment' || (editor.kind === 'invoice' && paid)) && <div className="billing-form-grid">
          <Field label="Moyen de paiement"><select value={mode} onChange={e => setMode(e.target.value as PaymentMode)}>{Object.entries(paymentLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></Field>
          <Field label="Référence (facultative)"><input maxLength={200} value={reference} onChange={e => setReference(e.target.value)} /></Field>
        </div>}
        {editor.kind === 'cancel' && <><p className="billing-note">Cette facture restera dans le journal avec son motif d’annulation. Aucune durée ne sera accordée.</p><Field label="Motif d’annulation"><textarea required minLength={1} maxLength={1000} value={reason} onChange={e => setReason(e.target.value)} /></Field></>}
        {editor.kind === 'gym' && <>
          <label className="billing-check"><input type="checkbox" checked={enabled} onChange={e => setEnabled(e.target.checked)} /> Activer le contrôle de l’abonnement</label>
          <p className="billing-note">L’activation sans période payée démarre le délai de grâce. Une salle exemptée ou non configurée reste accessible. Réactiver une salle dont la période payée est dépassée peut la bloquer immédiatement. Un changement de tarif s’applique aux prochaines factures ; les factures déjà émises conservent leur tarif.</p>
          <Field label="Tarif mensuel spécifique (FCFA, vide = tarif global)"><input type="number" min="1" max="2000000000" step="1" value={price} onChange={e => setPrice(e.target.value)} /></Field>
          <div className="billing-form-grid">{Object.entries({ billingName: 'Raison sociale', billingAddress: 'Adresse', billingEmail: 'Email', billingPhone: 'Téléphone', billingTaxId: 'Identifiant fiscal' }).map(([key, label]) => <Field key={key} label={label}><input type={key === 'billingEmail' ? 'email' : 'text'} maxLength={500} value={identity[key as keyof typeof identity]} onChange={e => setIdentity({ ...identity, [key]: e.target.value })} /></Field>)}</div>
        </>}
        {editor.kind === 'detail' && invoice && <>
          <div className="billing-total"><span>Total · {invoice.months} mois</span><strong>{money(invoice.totalFcfa)}</strong></div>
          <p>Émise le {date(invoice.issuedAt)} · Payé : {money(invoice.paidFcfa)}</p>
          <p>Couverture : {date(invoice.coveredFrom)} → {date(invoice.coveredUntil)}</p>
          <div className="billing-form-grid">{[['Émetteur', invoice.issuer], ['Client', invoice.customer]].map(([label, value]) => { const identity = value as BillingInvoice['issuer']; return <div className="billing-identity" key={label as string}><h3>{label as string}</h3><strong>{identity.name || '—'}</strong><p>{identity.address}</p><p>{identity.email} {identity.phone}</p><p>{identity.taxId}</p></div>; })}</div>
          <h3>Paiements enregistrés</h3>{invoice.payments.length === 0 ? <p className="billing-note">Aucun paiement.</p> : invoice.payments.map(p => <div className="billing-payment" key={p.id}><strong>{money(p.amountFcfa)}</strong><span>{paymentLabels[p.mode]} · {date(p.paidAt)}</span><span>{p.reference || 'Sans référence'}</span></div>)}
          {invoice.cancellationReason && <p className="billing-note">Motif d’annulation : {invoice.cancellationReason}</p>}
        </>}
        {error && <div role="alert" className="billing-error">{error}{(editor.kind === 'invoice' || editor.kind === 'payment') && <p>En cas de réponse incertaine, réessayez sans modifier les champs : la même opération sera reconnue.</p>}</div>}
      </fieldset>
      <footer><button type="button" className="billing-btn" disabled={busy} onClick={onClose}>{editor.kind === 'detail' ? 'Fermer' : 'Retour'}</button>{editor.kind !== 'detail' && <button className={`billing-btn ${editor.kind === 'cancel' ? 'billing-danger' : 'billing-primary'}`} disabled={busy || (editor.kind === 'invoice' && !resuming && (gym?.monthlyPriceFcfa === null || estimated > 2000000000))}>{busy ? 'Enregistrement…' : editor.kind === 'cancel' ? 'Confirmer l’annulation' : 'Enregistrer'}</button>}</footer>
    </form>
  </dialog>;
}
export function SettingsForm({ settings, onSaved }: { settings: BillingSettings; onSaved: () => void }) {
  const [form, setForm] = useState(settings);
  const [price, setPrice] = useState(settings.monthlyPriceFcfa?.toString() ?? '');
  const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  async function submit(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setError('');
    try { await billingRequest('/settings', 'PATCH', { ...form, monthlyPriceFcfa: price === '' ? null : Number(price) }); onSaved(); }
    catch (err) { setError(err instanceof Error ? err.message : 'Enregistrement impossible.'); } finally { setBusy(false); }
  }
  return <form className="billing-settings" onSubmit={submit}><section className="billing-panel"><h2>Tarif et accès</h2><p className="billing-note billing-unpaid-warning">Le délai de grâce modifié s’applique immédiatement aux échéances existantes. Le réduire peut bloquer des salles actuellement en grâce. Les changements de tarif concernent uniquement les prochaines factures ; les factures émises conservent leur tarif.</p><p className="billing-note">Le tarif global s’applique aux salles sans tarif spécifique. Les salles existantes restent accessibles tant que leur facturation n’est pas activée.</p><div className="billing-form-grid"><Field label="Tarif mensuel global (FCFA)"><input type="number" min="1" max="2000000000" step="1" value={price} onChange={e => setPrice(e.target.value)} placeholder="Non défini" /></Field><Field label="Délai de grâce (jours)"><input type="number" required min="0" max="90" step="1" value={form.graceDays} onChange={e => setForm({ ...form, graceDays: Number(e.target.value) })} /></Field></div></section><section className="billing-panel"><h2>Émetteur des factures</h2><p className="billing-note">Ces informations sont figées sur chaque facture à son émission.</p><div className="billing-form-grid">{Object.entries({ issuerName: 'Nom / raison sociale', issuerAddress: 'Adresse', issuerEmail: 'Email', issuerPhone: 'Téléphone', issuerTaxId: 'Identifiant fiscal' }).map(([key, label]) => <Field key={key} label={label}><input type={key === 'issuerEmail' ? 'email' : 'text'} maxLength={500} value={form[key as keyof BillingSettings] ?? ''} onChange={e => setForm({ ...form, [key]: e.target.value })} /></Field>)}</div><Field label="Pied de page des factures"><textarea maxLength={2000} value={form.invoiceFooter} onChange={e => setForm({ ...form, invoiceFooter: e.target.value })} /></Field></section>{error && <p role="alert" className="billing-error">{error}</p>}<button className="billing-btn billing-primary" disabled={busy}>{busy ? 'Enregistrement…' : 'Enregistrer les paramètres'}</button></form>;
}


