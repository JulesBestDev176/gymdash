import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/server/admin-auth';
import { createRelayio, relayioConfig, RelayioError } from '@/lib/server/relayio';

// POST /api/whatsapp/connect — request a pairing code for a phone number
export async function POST(req: Request) {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  let input: unknown;
  try { input = await req.json(); }
  catch { return NextResponse.json({ error: 'Requête illisible.' }, { status: 400 }); }
  const phone = typeof (input as Record<string, unknown>)?.phone === 'string'
    ? (input as Record<string, unknown>).phone as string : '';
  if (!phone.trim()) return NextResponse.json({ error: 'Numéro de téléphone requis.' }, { status: 400 });
  try {
    const { code, expiresAt } = await createRelayio(relayioConfig()).pairPhone(phone.trim());
    return NextResponse.json({ code, expiresAt }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof RelayioError ? error.message : 'Impossible d\'obtenir le code de jumelage.' },
      { status: error instanceof RelayioError ? error.status : 502, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}

// POST /api/whatsapp/connect?action=reconnect — restart disconnected session
export async function PUT(req: Request) {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  try {
    await createRelayio(relayioConfig()).reconnect();
    return NextResponse.json({ ok: true }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof RelayioError ? error.message : 'Reconnexion impossible.' },
      { status: error instanceof RelayioError ? error.status : 502, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}
