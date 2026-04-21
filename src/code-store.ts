import type { AuthorizationCodeRecord } from './types.ts';
import { randomToken } from './utils.ts';

const AUTH_CODE_PREFIX = 'auth_code:';

function codeKey(code: string): string {
  return `${AUTH_CODE_PREFIX}${code}`;
}

export async function createAuthorizationCode(
  namespace: KVNamespace,
  record: AuthorizationCodeRecord,
  ttlSeconds: number,
): Promise<string> {
  const code = randomToken();

  await namespace.put(codeKey(code), JSON.stringify(record), {
    expirationTtl: ttlSeconds,
  });

  return code;
}

export async function consumeAuthorizationCode(
  namespace: KVNamespace,
  code: string,
): Promise<AuthorizationCodeRecord | null> {
  const rawRecord = await namespace.get(codeKey(code));

  if (!rawRecord) {
    return null;
  }

  await namespace.delete(codeKey(code));

  try {
    return JSON.parse(rawRecord) as AuthorizationCodeRecord;
  } catch {
    return null;
  }
}
