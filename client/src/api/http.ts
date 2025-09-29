let accessToken: string | null = null;
let listeners: Array<(token: string | null) => void> = [];

export function getAccessToken() {
  return accessToken;
}

export function setAccessToken(token: string | null) {
  accessToken = token;
  listeners.forEach((cb) => cb(token));
}

export function subscribeAccessToken(cb: (token: string | null) => void) {
  listeners.push(cb);
  return () => {
    listeners = listeners.filter((fn) => fn !== cb);
  };
}

export async function fetchJSON(
  path: string,
  options: RequestInit = {},
  retry = true,
) {
  const headers = new Headers(options.headers || {});
  if (accessToken) headers.set('Authorization', `Bearer ${accessToken}`);

  const response = await fetch(`/api${path}`, { ...options, headers });

  if (response.status === 401 && retry) {
    const refreshRes = await fetch('/api/auth/token/refresh', {
      method: 'POST',
      credentials: 'include',
    });
    if (refreshRes.ok) {
      const refreshData = await refreshRes.json();
      setAccessToken(refreshData.accessToken);
      headers.set('Authorization', `Bearer ${refreshData.accessToken}`);
      const retryRes = await fetch(`/api${path}`, { ...options, headers });
      if (!retryRes.ok) {
        const errText = await retryRes.text();
        throw new Error(errText || retryRes.statusText);
      }
      return retryRes.json();
    }
    setAccessToken(null);
  }

  if (!response.ok) {
    if (response.status === 401) {
      setAccessToken(null);
    }
    const errText = await response.text();
    throw new Error(errText || response.statusText);
  }
  return response.json();
}
