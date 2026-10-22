'use client';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { KeyRound, Phone, X } from 'lucide-react';
import { adminApi, User } from '@/lib/api';
import './staff-account-actions.css';

export default function StaffAccountActions({ user, gymId, onUpdated }: {
  user: User; gymId: string; onUpdated: (user: User) => void;
}) {
  const [action, setAction] = useState<'phone' | 'password' | null>(null);
  const [phone, setPhone] = useState(user.telephone ?? '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    if (!action) return;
    const dialog = dialogRef.current;
    if (!dialog) return;
    dialog.showModal();
    return () => { if (dialog.open) dialog.close(); };
  }, [action]);

  function open(next: 'phone' | 'password') {
    setPhone(user.telephone ?? ''); setError(''); setNotice(''); setAction(next);
  }
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (loading || notice) return;
    if (action === 'phone' && !/^(?:(?:\+|00)?221)?0?7[05678]\d{7}$/.test(phone.replace(/[\s().-]/g, ''))) {
      setError('Saisissez un numéro WhatsApp sénégalais valide.'); return;
    }
    setLoading(true); setError('');
    try {
      if (action === 'phone') {
        const response = await adminApi.patch(`/api/v1/users/admin/${encodeURIComponent(user.id)}/contact`, { gymId, telephone: phone });
        onUpdated(response.data); setAction(null);
      } else {
        const response = await adminApi.post(`/api/v1/users/admin/${encodeURIComponent(user.id)}/reset-password`, { gymId });
        onUpdated(response.data.user);
        setNotice(response.data.whatsapp?.status === 'accepted'
          ? 'Mot de passe renouvelé. Les identifiants ont été transmis à Relayio pour envoi WhatsApp.'
          : 'Mot de passe renouvelé, mais l’envoi WhatsApp n’est pas confirmé. Vérifiez Relayio avant de recommencer.');
      }
    } catch (exception: unknown) {
      const message = (exception as { response?: { data?: { message?: string | string[] } } })?.response?.data?.message;
      setError(Array.isArray(message) ? message.join(' ') : message || 'Action impossible. Réessayez.');
    } finally { setLoading(false); }
  }

  return <>
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
      <button type="button" className="btn-icon" title={user.telephone ? 'Modifier le téléphone WhatsApp' : 'Ajouter le téléphone WhatsApp'} onClick={() => open('phone')} aria-label={`Modifier le numéro de ${user.prenom} ${user.nom}`}>
        <Phone size={15} />
      </button>
      <span title={!user.actif ? 'Activez ce compte pour renouveler son mot de passe' : !user.telephone ? 'Renseignez d’abord le numéro WhatsApp' : 'Renouveler le mot de passe'} style={{ display: 'inline-flex' }}>
      <button type="button" className="btn-icon" aria-label={`Renouveler le mot de passe de ${user.prenom} ${user.nom}`} disabled={!user.actif || !user.telephone} onClick={() => open('password')} style={{ opacity: !user.actif || !user.telephone ? 0.4 : 1 }}>
        <KeyRound size={15} />
      </button>
      </span>
    </div>
    {action && createPortal(<dialog ref={dialogRef} className="staff-account-dialog"
      aria-labelledby={`staff-title-${user.id}`}
      onCancel={(event) => { event.preventDefault(); if (!loading) setAction(null); }}>
      <header className="staff-account-header">
        <div className="staff-account-heading">
          <span className="staff-account-headingIcon">{action === 'phone' ? <Phone size={18} /> : <KeyRound size={18} />}</span>
          <h2 id={`staff-title-${user.id}`}>{action === 'phone' ? 'Téléphone WhatsApp' : 'Renouveler le mot de passe'}</h2>
        </div>
        <button type="button" className="staff-account-close" aria-label="Fermer" disabled={loading} onClick={() => setAction(null)}><X size={18} /></button>
      </header>
      <form onSubmit={submit} className="staff-account-form">
        <div className="staff-account-identity">
          <strong>{user.prenom} {user.nom}</strong>
          <span>{user.email}</span>
        </div>
        {notice ? <p role="status" className="staff-account-message">{notice}</p> : action === 'phone'
          ? <div className="staff-account-field">
            <label htmlFor={`staff-phone-${user.id}`}>Numéro WhatsApp</label>
            <input id={`staff-phone-${user.id}`} type="tel" inputMode="tel" autoComplete="tel" autoFocus required disabled={loading} className="input-base"
              aria-describedby={`staff-phone-hint-${user.id}`} placeholder="77 123 45 67" value={phone} onChange={(event) => setPhone(event.target.value)} />
            <p id={`staff-phone-hint-${user.id}`} className="staff-account-hint">Indicatif facultatif</p>
          </div>
          : <p className="staff-account-message">Un mot de passe temporaire sera envoyé au {user.telephone} via WhatsApp. Les anciennes sessions seront déconnectées. L’utilisateur devra choisir son propre mot de passe à la connexion.</p>}
        {error && <p role="alert" className="staff-account-error">{error}</p>}
        <footer className="staff-account-footer">
          {notice ? <button type="button" className="btn-primary" onClick={() => setAction(null)}>Fermer</button>
            : <>
              <button type="button" className="staff-account-cancel" disabled={loading} onClick={() => setAction(null)}>Annuler</button>
              <button type="submit" className="btn-primary" disabled={loading}>{loading ? 'Traitement…' : action === 'phone' ? 'Enregistrer' : 'Confirmer'}</button>
            </>}
        </footer>
      </form>
    </dialog>, document.body)}
  </>;
}
