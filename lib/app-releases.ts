'use client';
import { useEffect, useState } from 'react';
import { authenticatedFetch } from './authenticated-fetch';

export interface AppRelease {
  id: string; versionName: string; versionCode: number; packageName: string;
  notes: string; sizeBytes: number; sha256: string; status: 'DRAFT' | 'PUBLISHED';
  createdAt: string; publishedAt: string | null; apkUrl: string | null;
}
export interface ReleasePage { items: AppRelease[]; nextCursor: string | null }
export async function releaseRequest<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await authenticatedFetch(`/api/app-releases/${path}`, options);
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || 'Gestion des versions indisponible.');
  return result;
}
export function useReleaseAccess() {
  const [access, setAccess] = useState<'loading' | 'allowed' | 'denied' | 'error'>('loading');
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    const abort = new AbortController();
    authenticatedFetch('/api/app-releases/access', { signal: abort.signal }).then(response => {
      if (!abort.signal.aborted) setAccess(response.ok ? 'allowed' : response.status === 401 || response.status === 403 ? 'denied' : 'error');
    }).catch(() => { if (!abort.signal.aborted) setAccess('error'); });
    return () => abort.abort();
  }, [revision]);
  return { access, retry: () => setRevision(n => n + 1) };
}
