import { createAuthorizationCode } from '../code-store.ts';
import { OAuthError } from '../errors.ts';
import type { Env, RuntimeConfig } from '../types.ts';
import {
  appendQueryParameters,
  includesOpenIdScope,
  isValidEmail,
  normalizeEmail,
  normalizeScope,
} from '../utils.ts';

function redirectError(
  redirectUri: string,
  state: string | undefined,
  error: string,
  description: string,
): never {
  throw new OAuthError({
    description,
    error,
    redirectUri,
    state,
    status: 302,
  });
}

export async function handleAuthorize(
  request: Request,
  env: Env,
  config: RuntimeConfig,
): Promise<Response> {
  const url = new URL(request.url);
  const clientId = url.searchParams.get('client_id');
  const redirectUri = url.searchParams.get('redirect_uri');
  const responseType = url.searchParams.get('response_type');
  const scope = url.searchParams.get('scope');
  const state = url.searchParams.get('state') ?? undefined;
  const nonce = url.searchParams.get('nonce') ?? undefined;
  const loginHint = url.searchParams.get('login_hint');
  const codeChallenge = url.searchParams.get('code_challenge') ?? undefined;
  const codeChallengeMethod = url.searchParams.get('code_challenge_method') ?? undefined;

  if (!config.allowAnyLoginHint) {
    throw new OAuthError({
      description:
        'ZeroAuth is disabled until ZEROAUTH_ALLOW_ANY_LOGIN_HINT=true is explicitly configured',
      error: 'invalid_request',
      status: 400,
    });
  }

  if (clientId !== config.clientId) {
    throw new OAuthError({
      description: 'Unknown client_id',
      error: 'invalid_request',
      status: 400,
    });
  }

  if (!redirectUri || !config.allowedRedirectUris.has(redirectUri)) {
    throw new OAuthError({
      description: 'redirect_uri is not allowed',
      error: 'invalid_request',
      status: 400,
    });
  }

  if (responseType !== 'code') {
    redirectError(redirectUri, state, 'unsupported_response_type', 'Only response_type=code is supported');
  }

  if (!scope || !includesOpenIdScope(scope)) {
    redirectError(redirectUri, state, 'invalid_scope', 'scope must include openid');
  }

  if (!loginHint) {
    redirectError(redirectUri, state, 'invalid_request', 'login_hint is required');
  }

  const email = normalizeEmail(loginHint);

  if (!isValidEmail(email)) {
    redirectError(redirectUri, state, 'invalid_request', 'login_hint must be a valid email address');
  }

  let normalizedCodeChallengeMethod: 'plain' | 'S256' | undefined;
  if (codeChallenge) {
    normalizedCodeChallengeMethod =
      codeChallengeMethod === 'S256' || codeChallengeMethod === 'plain'
        ? codeChallengeMethod
        : codeChallengeMethod === undefined
          ? 'plain'
          : undefined;

    if (!normalizedCodeChallengeMethod) {
      redirectError(
        redirectUri,
        state,
        'invalid_request',
        'code_challenge_method must be plain or S256',
      );
    }
  } else if (codeChallengeMethod) {
    redirectError(
      redirectUri,
      state,
      'invalid_request',
      'code_challenge_method requires code_challenge',
    );
  }

  const normalizedScope = normalizeScope(scope);
  const code = await createAuthorizationCode(
    env.AUTH_CODES,
    {
      authTime: Math.floor(Date.now() / 1000),
      clientId: config.clientId,
      codeChallenge,
      codeChallengeMethod: normalizedCodeChallengeMethod,
      email,
      nonce,
      redirectUri,
      scope: normalizedScope,
    },
    config.authCodeTtlSeconds,
  );

  return Response.redirect(
    appendQueryParameters(redirectUri, {
      code,
      state,
    }),
    302,
  );
}
