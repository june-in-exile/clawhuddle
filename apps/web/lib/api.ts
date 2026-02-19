const API_BASE = process.env.NEXT_PUBLIC_API_URL || '';

export async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const headers: Record<string, string> = { ...options?.headers as Record<string, string> };
  if (options?.body) {
    headers['Content-Type'] = headers['Content-Type'] || 'application/json';
  }
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    const error = new Error(err.message || 'API request failed') as Error & { code?: string; data?: any };
    error.code = err.error;
    error.data = err;
    throw error;
  }

  return res.json();
}

// Org-scoped fetch helper — prepends /api/orgs/{orgId}
export function createOrgFetch(orgId: string, userId: string) {
  return function orgFetch<T>(path: string, options?: RequestInit): Promise<T> {
    const headers: Record<string, string> = {
      'x-user-id': userId,
      ...options?.headers as Record<string, string>,
    };
    return apiFetch<T>(`/api/orgs/${orgId}${path}`, { ...options, headers });
  };
}
