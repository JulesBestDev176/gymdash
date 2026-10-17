import { NextRequest, NextResponse } from 'next/server';

const COOLIFY_BASE = 'http://185.182.9.36:8000';
const COOLIFY_TOKEN = '3|58Zp9qkocLwr5LFR4bdQXXCrmCvRW1oxIdiTyB8v2e2a64e3';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { uuid } = body;

    if (!uuid || typeof uuid !== 'string') {
      return NextResponse.json({ error: 'uuid requis' }, { status: 400 });
    }

    const coolifyRes = await fetch(
      `${COOLIFY_BASE}/api/v1/deploy?uuid=${encodeURIComponent(uuid)}&force=true`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${COOLIFY_TOKEN}`,
          'Content-Type': 'application/json',
        },
      }
    );

    const data = await coolifyRes.json().catch(() => ({}));

    if (!coolifyRes.ok) {
      return NextResponse.json(
        { error: 'Coolify a renvoyé une erreur', details: data },
        { status: coolifyRes.status }
      );
    }

    return NextResponse.json({ success: true, data });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? 'Erreur inconnue' }, { status: 500 });
  }
}
