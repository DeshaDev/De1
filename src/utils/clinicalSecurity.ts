import crypto from 'crypto';

export type ClinicalRole = 'clinician' | 'educator_readonly';

export type ClinicalScope =
  | 'students:read'
  | 'students:write'
  | 'students:delete'
  | 'ai:use'
  | 'ai:analyze';

export interface VerifiedClinicalSession {
  token: string;
  role: ClinicalRole;
  clinicianName: string;
  scopes: ClinicalScope[];
  issuedAt: number;
  expiresAt: number;
}

const ROLE_SCOPES: Record<ClinicalRole, ClinicalScope[]> = {
  clinician: [
    'students:read',
    'students:write',
    'students:delete',
    'ai:use',
    'ai:analyze',
  ],
  educator_readonly: ['students:read', 'ai:use'],
};

export function getScopesForRole(role: ClinicalRole): ClinicalScope[] {
  return ROLE_SCOPES[role] || ROLE_SCOPES.educator_readonly;
}

/**
 * Issues a cryptographically signed HMAC-SHA256 session token for an authenticated clinician or educator.
 */
export function issueClinicalSessionToken(
  role: ClinicalRole,
  clinicianName: string,
  secret: string,
  ttlMs: number = 12 * 60 * 60 * 1000
): VerifiedClinicalSession {
  const issuedAt = Date.now();
  const expiresAt = issuedAt + ttlMs;
  const scopes = getScopesForRole(role);
  const nonce = crypto.randomBytes(12).toString('hex');

  const payloadObj = {
    role,
    clinicianName: clinicianName.trim() || 'أخصائي التقييم المعتمد',
    scopes,
    issuedAt,
    expiresAt,
    nonce,
  };

  const payloadBase64 = Buffer.from(JSON.stringify(payloadObj), 'utf8').toString(
    'base64url'
  );
  const signature = crypto
    .createHmac('sha256', secret)
    .update(payloadBase64)
    .digest('base64url');

  return {
    token: `${payloadBase64}.${signature}`,
    role,
    clinicianName: payloadObj.clinicianName,
    scopes,
    issuedAt,
    expiresAt,
  };
}

/**
 * Verifies an HMAC-SHA256 signed session token and checks expiration.
 */
export function verifyClinicalSessionToken(
  rawToken: string | undefined | null,
  secret: string,
  nowMs: number = Date.now()
): VerifiedClinicalSession | null {
  if (!rawToken || typeof rawToken !== 'string') return null;
  const trimmed = rawToken.replace(/^Bearer\s+/i, '').trim();
  const parts = trimmed.split('.');
  if (parts.length !== 2) return null;

  const [payloadBase64, signature] = parts;
  const expectedSig = crypto
    .createHmac('sha256', secret)
    .update(payloadBase64)
    .digest('base64url');

  const sigBuf = Buffer.from(signature, 'utf8');
  const expBuf = Buffer.from(expectedSig, 'utf8');
  if (
    sigBuf.length !== expBuf.length ||
    !crypto.timingSafeEqual(sigBuf, expBuf)
  ) {
    return null;
  }

  try {
    const parsed = JSON.parse(
      Buffer.from(payloadBase64, 'base64url').toString('utf8')
    );
    if (!parsed || typeof parsed.expiresAt !== 'number') return null;
    if (parsed.expiresAt <= nowMs) return null;
    return {
      token: trimmed,
      role: parsed.role,
      clinicianName: parsed.clinicianName,
      scopes: Array.isArray(parsed.scopes) ? parsed.scopes : [],
      issuedAt: parsed.issuedAt,
      expiresAt: parsed.expiresAt,
    };
  } catch {
    return null;
  }
}

/**
 * Checks whether a verified session possesses the required RBAC scope.
 */
export function authorizeSessionScope(
  session: VerifiedClinicalSession | null,
  requiredScope: ClinicalScope
): { allowed: boolean; statusCode: 200 | 401 | 403; errorAr?: string } {
  if (!session) {
    return {
      allowed: false,
      statusCode: 401,
      errorAr:
        'غير مصرح بالوصول (401): يلزم تقديم رمز جلسة أخصائي/معلم صالح للوصول إلى سجلات الأطفال.',
    };
  }
  if (!session.scopes.includes(requiredScope)) {
    return {
      allowed: false,
      statusCode: 403,
      errorAr: `صلاحيات غير كافية (403): الدور الحالي (${session.role}) لا يملك الصلاحية المطلوبة (${requiredScope}).`,
    };
  }
  return { allowed: true, statusCode: 200 };
}

/**
 * Strict Default-Deny Guardian Consent Validator:
 * Rejects any request where `guardianConsentGiven` is missing (`undefined`), `null`, `false`, or non-boolean.
 * Only explicit boolean `true` is accepted.
 */
export function validateExplicitGuardianConsent(
  consentField: unknown
): { valid: boolean; errorAr?: string } {
  if (consentField !== true) {
    return {
      valid: false,
      errorAr:
        'مرفوض أمنياً (Default-Deny): يجب تقديم إقرار صريح ومؤكد بموافقة ولي الأمر (guardianConsentGiven: true) قبل حفظ أو تحليل بيانات الطفل.',
    };
  }
  return { valid: true };
}
