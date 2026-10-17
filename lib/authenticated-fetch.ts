'use client';

/** Requests to the private Next.js routes use the same JWT as the API client. */
export function authenticatedFetch(input: RequestInfo | URL, options: RequestInit = {}) {
  const headers = new Headers(options.headers);
  const token = typeof window !== 'undefined' ? localStorage.getItem('gymdash_token') : null;
  if (token) headers.set('Authorization', `Bearer ${token}`);
  return fetch(input, { ...options, headers, cache: 'no-store' });
}
