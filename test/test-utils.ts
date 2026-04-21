import { exportJWK, generateKeyPair } from 'jose';

import type { Env } from '../src/types.ts';

type StoredValue = {
  expiresAt?: number;
  value: string;
};

class MockKVNamespace {
  private readonly store = new Map<string, StoredValue>();

  async delete(key: string): Promise<void> {
    this.store.delete(key);
  }

  async get(key: string): Promise<string | null> {
    const entry = this.store.get(key);

    if (!entry) {
      return null;
    }

    if (entry.expiresAt !== undefined && Date.now() >= entry.expiresAt) {
      this.store.delete(key);
      return null;
    }

    return entry.value;
  }

  async put(
    key: string,
    value: string,
    options?: {
      expirationTtl?: number;
    },
  ): Promise<void> {
    const expiresAt =
      options?.expirationTtl === undefined ? undefined : Date.now() + options.expirationTtl * 1000;

    this.store.set(key, { expiresAt, value });
  }
}

export async function createTestEnv(overrides: Partial<Env> = {}): Promise<Env> {
  const { privateKey } = await generateKeyPair('RS256', { extractable: true });
  const privateJwk = await exportJWK(privateKey);
  privateJwk.alg = 'RS256';
  privateJwk.use = 'sig';

  return {
    AUTH_CODES: new MockKVNamespace() as unknown as KVNamespace,
    ZEROAUTH_ALLOW_ANY_LOGIN_HINT: 'true',
    ZEROAUTH_ALLOWED_REDIRECT_URIS: 'https://client.example/callback',
    ZEROAUTH_AUTH_CODE_TTL_SECONDS: '60',
    ZEROAUTH_CLIENT_ID: 'test-client-id',
    ZEROAUTH_CLIENT_SECRET: 'test-client-secret',
    ZEROAUTH_ISSUER: 'https://zeroauth.example',
    ZEROAUTH_KID: 'test-kid',
    ZEROAUTH_PRIVATE_JWK: JSON.stringify(privateJwk),
    ZEROAUTH_TOKEN_TTL_SECONDS: '3600',
    ...overrides,
  };
}

export function basicAuthHeader(clientId: string, clientSecret: string): string {
  return `Basic ${btoa(`${clientId}:${clientSecret}`)}`;
}

export function parseLocation(url: string): URL {
  return new URL(url);
}
