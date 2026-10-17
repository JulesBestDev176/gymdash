import { NextResponse } from 'next/server';

const COOLIFY_BASE = 'http://185.182.9.36:8000';
const COOLIFY_TOKEN = '3|58Zp9qkocLwr5LFR4bdQXXCrmCvRW1oxIdiTyB8v2e2a64e3';
const SERVER_UUID = '0zhymvsiqxum66mzs3v79yoj';

const COOLIFY_HEADERS = {
  Authorization: `Bearer ${COOLIFY_TOKEN}`,
  'Content-Type': 'application/json',
};

// Only these 3 services belong to GymPass — all others are ignored
const GYMPASS_SERVICES: Record<string, string> = {
  'm3tc4qsecffvu3cfqqcfsspc': 'gympass-backend',
  'ijpluezkha433o1szxfxaqzp': 'gymdash',
  'i7bypsb5mxs0id639a60wjw9': 'gympass-postgres',
};

function isGymPass(uuid: string, name: string): boolean {
  if (GYMPASS_SERVICES[uuid]) return true;
  const n = name.toLowerCase();
  return n.includes('gympass') || n.includes('gymdash');
}

async function pingLatency(fqdn: string): Promise<number | null> {
  try {
    const url = fqdn.startsWith('http') ? fqdn : `https://${fqdn}`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);
    const t0 = Date.now();
    await fetch(`${url}/`, { signal: controller.signal, method: 'HEAD' });
    clearTimeout(timeout);
    return Date.now() - t0;
  } catch {
    return null;
  }
}

export async function GET() {
  const timestamp = new Date().toISOString();

  // Check server reachability
  let serverReachable = false;
  try {
    const ctrl = new AbortController();
    const to = setTimeout(() => ctrl.abort(), 4000);
    const res = await fetch(`${COOLIFY_BASE}/api/v1/version`, {
      headers: COOLIFY_HEADERS,
      signal: ctrl.signal,
    });
    clearTimeout(to);
    serverReachable = res.ok;
  } catch {
    serverReachable = false;
  }

  // Fetch server resources + global resources in parallel
  let serverResources: any[] = [];
  let allResources: any[] = [];

  try {
    const [srvRes, allRes] = await Promise.allSettled([
      fetch(`${COOLIFY_BASE}/api/v1/servers/${SERVER_UUID}/resources`, { headers: COOLIFY_HEADERS }),
      fetch(`${COOLIFY_BASE}/api/v1/resources`, { headers: COOLIFY_HEADERS }),
    ]);

    if (srvRes.status === 'fulfilled' && srvRes.value.ok) {
      serverResources = await srvRes.value.json();
    }
    if (allRes.status === 'fulfilled' && allRes.value.ok) {
      const body = await allRes.value.json();
      allResources = Array.isArray(body) ? body : (body.data ?? []);
    }
  } catch {
    // continue with empty
  }

  // Merge, deduplicate by uuid
  const merged = new Map<string, any>();
  for (const s of [...serverResources, ...allResources]) {
    if (s.uuid && !merged.has(s.uuid)) merged.set(s.uuid, s);
  }

  const services: any[] = [];

  // Keep only GymPass services
  const entries = Array.from(merged.values()).filter((s) =>
    isGymPass(s.uuid ?? '', s.name ?? '')
  );

  const pinged = await Promise.all(
    entries.map(async (s) => {
      const fqdn: string | null = s.fqdn ?? s.domains ?? null;
      const latencyMs = fqdn ? await pingLatency(fqdn) : null;
      const label = GYMPASS_SERVICES[s.uuid] ?? s.name;
      return {
        uuid: s.uuid,
        name: label,
        fqdn: fqdn ?? null,
        status: s.status ?? s.human_status ?? 'unknown',
        image: s.docker_registry_image_name ?? s.image ?? null,
        latencyMs,
        group: 'GymPass',
      };
    })
  );

  services.push(...pinged);

  return NextResponse.json({
    services,
    serverStatus: { reachable: serverReachable, ip: '185.182.9.36' },
    timestamp,
  });
}
