/**
 * Frontend API Client
 * Facilitates typed communication with the backend services.
 */

const API_BASE = process.env.NEXT_PUBLIC_BACKEND_URL || '';

export async function fetchApi<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const url = endpoint.startsWith('http') ? endpoint : `${API_BASE}${endpoint}`;
  
  const headers = new Headers(options.headers || {});
  if (!headers.has('Content-Type') && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  const res = await fetch(url, {
    ...options,
    headers,
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || `API request failed with status ${res.status}`);
  }

  return data;
}
