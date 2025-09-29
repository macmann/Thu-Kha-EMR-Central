let accessToken: string | null = null;
let listeners: Array<(token: string | null) => void> = [];

export class HttpError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

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

async function parseErrorMessage(response: Response) {
  const errText = await response.text();
  if (!errText) {
    return response.statusText;
  }

  try {
    const parsed = JSON.parse(errText);
    if (typeof parsed === 'string') {
      return parsed;
    }
    if (parsed && typeof parsed.error === 'string') {
      return parsed.error;
    }
  } catch {
    // ignore JSON parse errors
  }

  return errText;
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
        const message = await parseErrorMessage(retryRes);
        throw new HttpError(retryRes.status, message || retryRes.statusText);
      }
      return retryRes.json();
    }
    setAccessToken(null);
  }

  if (!response.ok) {
    if (response.status === 401) {
      setAccessToken(null);
    }
    const message = await parseErrorMessage(response);
    throw new HttpError(response.status, message || response.statusText);
  }
  return response.json();
}
