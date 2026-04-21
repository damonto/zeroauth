import { ConfigurationError } from './errors.ts';
import type { Env, RuntimeConfig } from './types.ts';
import { assertAbsoluteUrl, parseBooleanFlag, parseRedirectUriList } from './utils.ts';

function assertNotPlaceholder(value: string, fieldName: string): void {
  if (value.includes('replace-me')) {
    throw new ConfigurationError(
      `${fieldName} is still using the template placeholder. Generate real values before starting ZeroAuth`,
    );
  }
}

function parsePositiveInteger(value: string | undefined, fallback: number, fieldName: string): number {
  if (value === undefined || value === '') {
    return fallback;
  }

  const parsed = Number.parseInt(value, 10);

  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new ConfigurationError(`${fieldName} must be a non-negative integer`);
  }

  return parsed;
}

export function readConfig(env: Env, request: Request): RuntimeConfig {
  if (!env.ZEROAUTH_CLIENT_ID) {
    throw new ConfigurationError('ZEROAUTH_CLIENT_ID is required');
  }
  assertNotPlaceholder(env.ZEROAUTH_CLIENT_ID, 'ZEROAUTH_CLIENT_ID');

  if (!env.ZEROAUTH_CLIENT_SECRET) {
    throw new ConfigurationError('ZEROAUTH_CLIENT_SECRET is required');
  }
  assertNotPlaceholder(env.ZEROAUTH_CLIENT_SECRET, 'ZEROAUTH_CLIENT_SECRET');

  if (!env.ZEROAUTH_PRIVATE_JWK) {
    throw new ConfigurationError('ZEROAUTH_PRIVATE_JWK is required');
  }
  assertNotPlaceholder(env.ZEROAUTH_PRIVATE_JWK, 'ZEROAUTH_PRIVATE_JWK');

  if (!env.ZEROAUTH_KID) {
    throw new ConfigurationError('ZEROAUTH_KID is required');
  }
  assertNotPlaceholder(env.ZEROAUTH_KID, 'ZEROAUTH_KID');

  if (!env.ZEROAUTH_ISSUER) {
    throw new ConfigurationError('ZEROAUTH_ISSUER is required');
  }
  assertNotPlaceholder(env.ZEROAUTH_ISSUER, 'ZEROAUTH_ISSUER');

  const issuer = assertAbsoluteUrl(env.ZEROAUTH_ISSUER, 'ZEROAUTH_ISSUER');

  let privateJwk: Record<string, unknown>;

  try {
    privateJwk = JSON.parse(env.ZEROAUTH_PRIVATE_JWK) as Record<string, unknown>;
  } catch {
    throw new ConfigurationError('ZEROAUTH_PRIVATE_JWK must be valid JSON');
  }

  try {
    return {
      allowAnyLoginHint: parseBooleanFlag(env.ZEROAUTH_ALLOW_ANY_LOGIN_HINT),
      allowedRedirectUris: parseRedirectUriList(env.ZEROAUTH_ALLOWED_REDIRECT_URIS),
      authCodeTtlSeconds: parsePositiveInteger(
        env.ZEROAUTH_AUTH_CODE_TTL_SECONDS,
        60,
        'ZEROAUTH_AUTH_CODE_TTL_SECONDS',
      ),
      clientId: env.ZEROAUTH_CLIENT_ID,
      clientSecret: env.ZEROAUTH_CLIENT_SECRET,
      issuer,
      kid: env.ZEROAUTH_KID,
      origin: issuer,
      privateJwk,
      tokenTtlSeconds: parsePositiveInteger(
        env.ZEROAUTH_TOKEN_TTL_SECONDS,
        3600,
        'ZEROAUTH_TOKEN_TTL_SECONDS',
      ),
    };
  } catch (error) {
    if (error instanceof ConfigurationError) {
      throw error;
    }

    throw new ConfigurationError(
      error instanceof Error ? error.message : 'Invalid ZeroAuth configuration',
    );
  }
}
