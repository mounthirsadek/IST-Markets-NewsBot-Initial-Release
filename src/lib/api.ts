/**
 * Authenticated fetch helper — uses JWT from localStorage.
 * Replaces the old Firebase user.getIdToken() approach.
 */
export async function fetchWithAuth(url: string, options: RequestInit = {}): Promise<Response> {
  const token = localStorage.getItem('auth_token');

  if (!token) {
    window.location.href = '/login';
    throw new Error('Not authenticated');
  }

  // Don't override Content-Type if the caller set it (e.g. multipart/form-data)
  const isFormData = options.body instanceof FormData;
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    ...(options.headers as Record<string, string> || {}),
  };
  if (!isFormData && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }

  const response = await fetch(url, { ...options, headers });

  if (response.status === 401) {
    localStorage.removeItem('auth_token');
    window.location.href = '/login';
  }

  return response;
}

/** Convenience: GET with auth */
export async function getWithAuth(url: string): Promise<any> {
  const res = await fetchWithAuth(url);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || `Request failed: ${res.status}`);
  }
  return res.json();
}

/** Convenience: POST JSON with auth */
export async function postWithAuth(url: string, body: any): Promise<any> {
  const res = await fetchWithAuth(url, { method: 'POST', body: JSON.stringify(body) });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || `Request failed: ${res.status}`);
  }
  return res.json();
}

/** Convenience: PATCH JSON with auth */
export async function patchWithAuth(url: string, body: any): Promise<any> {
  const res = await fetchWithAuth(url, { method: 'PATCH', body: JSON.stringify(body) });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || `Request failed: ${res.status}`);
  }
  return res.json();
}

/** Convenience: DELETE with auth */
export async function deleteWithAuth(url: string): Promise<any> {
  const res = await fetchWithAuth(url, { method: 'DELETE' });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || `Request failed: ${res.status}`);
  }
  return res.json();
}
