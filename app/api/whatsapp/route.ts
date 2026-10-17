import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/server/admin-auth';
import { createRelayio, relayioConfig, RelayioError } from '@/lib/server/relayio';

export async function GET(req: Request) {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  const data = await createRelayio(relayioConfig()).snapshot();
  return NextResponse.json(data, { headers: { 'Cache-Control': 'no-store' } });
}

export async function POST(req: Request) {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  let input: unknown;
  try { input = await req.json(); }
  catch { return NextResponse.json({ error: 'Le message est illisible.' }, { status: 400 }); }
  try {
    const message = await createRelayio(relayioConfig()).send(input);
    return NextResponse.json({ message }, { status: 201, headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof RelayioError ? error.message : 'Envoi temporairement indisponible.' }, {
      status: error instanceof RelayioError ? error.status : 502,
    });
  }
}
