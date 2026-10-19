import { authenticatedFetch } from './authenticated-fetch';

export type BillingGymStatus = 'NOT_CONFIGURED' | 'DISABLED' | 'ACTIVE' | 'GRACE' | 'BLOCKED';
export type BillingInvoiceStatus = 'UNPAID' | 'PARTIALLY_PAID' | 'PAID' | 'CANCELLED';
export type PaymentMode = 'ESPECES' | 'WAVE' | 'ORANGE_MONEY' | 'VIREMENT' | 'CHEQUE' | 'AUTRE';
export interface BillingSettings {
  monthlyPriceFcfa: number | null; graceDays: number; issuerName: string; issuerAddress: string;
  issuerEmail: string; issuerPhone: string; issuerTaxId: string; invoiceFooter: string;
}
export interface BillingGym {
  gymId: string; name: string; city: string; status: BillingGymStatus; enabled: boolean;
  monthlyPriceFcfa: number | null; priceOverrideFcfa: number | null; paidUntil: string | null;
  graceEndsAt: string | null; daysRemaining: number | null; outstandingFcfa: number;
  billingName: string; billingAddress: string; billingEmail: string; billingPhone: string; billingTaxId: string;
}
export interface BillingIdentity { name: string; address: string; email: string; phone: string; taxId: string }
export interface BillingInvoice {
  id: string; number: string; gymId: string; gymName: string; months: number; unitPriceFcfa: number;
  totalFcfa: number; paidFcfa: number; status: BillingInvoiceStatus; issuedAt: string;
  coveredFrom: string | null; coveredUntil: string | null; issuer: BillingIdentity; customer: BillingIdentity;
  payments: { id: string; amountFcfa: number; mode: PaymentMode; reference: string | null; paidAt: string }[];
  cancellationReason: string | null;
}
export interface BillingOverview {
  settings: BillingSettings;
  summary: { collectedFcfa: number; outstandingFcfa: number; activeGyms: number; graceGyms: number; blockedGyms: number };
  gyms: BillingGym[]; generatedAt: string;
}
export interface BillingInvoicePage { items: BillingInvoice[]; total: number; page: number; pageSize: number }
export async function billingRequest<T>(path: string, method = 'GET', body?: unknown, signal?: AbortSignal): Promise<T> {
  const response = await authenticatedFetch(`/api/billing${path}`, {
    method, signal, ...(body === undefined ? {} : { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }),
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new Error(typeof data?.error === 'string' ? data.error : typeof data?.message === 'string' ? data.message : `La demande a échoué (${response.status}). Réessayez.`);
  if (data === null) throw new Error('Réponse serveur illisible. Réessayez la même opération.');
  return data as T;
}
export async function downloadInvoice(invoice: BillingInvoice) {
  const response = await authenticatedFetch(`/api/billing/invoices/${encodeURIComponent(invoice.id)}/pdf`);
  if (!response.ok || !response.headers.get('content-type')?.includes('application/pdf')) {
    throw new Error('Impossible de télécharger la facture. Réessayez.');
  }
  const url = URL.createObjectURL(await response.blob());
  const link = document.createElement('a'); link.href = url;
  link.download = `${invoice.number.replace(/[^A-Za-z0-9_-]/g, '_')}.pdf`; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export const money = (value: number) => `${new Intl.NumberFormat('fr-FR').format(value)} FCFA`;
export const date = (value: string | null) => value ? new Date(value).toLocaleDateString('fr-FR', { timeZone: 'UTC', day: '2-digit', month: 'short', year: 'numeric' }) : '—';
export const gymLabels: Record<BillingGymStatus, string> = { NOT_CONFIGURED: 'Non configuré', DISABLED: 'Exempté', ACTIVE: 'Actif', GRACE: 'Délai de grâce', BLOCKED: 'Bloqué' };
export const invoiceLabels: Record<BillingInvoiceStatus, string> = { UNPAID: 'À payer', PARTIALLY_PAID: 'Partiellement payée', PAID: 'Payée', CANCELLED: 'Annulée' };
export const paymentLabels: Record<PaymentMode, string> = { ESPECES: 'Espèces', WAVE: 'Wave', ORANGE_MONEY: 'Orange Money', VIREMENT: 'Virement', CHEQUE: 'Chèque', AUTRE: 'Autre' };
