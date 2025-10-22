type PatientSessionPayload = {
  tokenType?: string;
  sub?: string;
  exp?: number;
  globalPatientId?: string;
  loginPhone?: string | null;
  loginEmail?: string | null;
};

function decodePayload(token: string): PatientSessionPayload | null {
  const segments = token.split('.');
  if (segments.length < 2) {
    return null;
  }

  try {
    const payloadSegment = segments[1];
    const decoded = Buffer.from(payloadSegment, 'base64url').toString('utf8');
    return JSON.parse(decoded) as PatientSessionPayload;
  } catch {
    return null;
  }
}

export function isPatientSessionActive(tokenValue: string | undefined | null): boolean {
  if (!tokenValue) {
    return false;
  }

  const payload = decodePayload(tokenValue);
  if (!payload) {
    return false;
  }

  if (payload.tokenType !== 'patient_access') {
    return false;
  }

  if (!payload.sub || !payload.globalPatientId) {
    return false;
  }

  if (typeof payload.exp === 'number' && Math.floor(Date.now() / 1000) >= payload.exp) {
    return false;
  }

  return true;
}

export type PatientSession = Required<Pick<PatientSessionPayload, 'sub' | 'globalPatientId'>> & {
  loginPhone: string | null;
  loginEmail: string | null;
  exp: number | null;
};

export function getPatientSession(tokenValue: string | undefined | null): PatientSession | null {
  if (!tokenValue) {
    return null;
  }

  const payload = decodePayload(tokenValue);
  if (!payload) {
    return null;
  }

  if (payload.tokenType !== 'patient_access') {
    return null;
  }

  if (!payload.sub || !payload.globalPatientId) {
    return null;
  }

  return {
    sub: payload.sub,
    globalPatientId: payload.globalPatientId,
    loginPhone: payload.loginPhone ?? null,
    loginEmail: payload.loginEmail ?? null,
    exp: typeof payload.exp === 'number' ? payload.exp : null,
  };
}
