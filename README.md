# ZeroAuth

ZeroAuth is a minimal OpenID Connect identity provider for internal Google Workspace SSO testing. It is designed for the specific case where Google Workspace acts as the relying party and ZeroAuth immediately issues tokens for the email in `login_hint` without any password prompt, MFA, or user interaction.

This is intentionally unsafe for production use.

[![Deploy to Cloudflare Workers](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/damonto/zeroauth)

## What it implements

- Authorization Code Flow only
- `GET /.well-known/openid-configuration`
- `GET /jwks.json`
- `GET /authorize`
- `POST /token`
- `GET /userinfo`
- `GET /healthz`
- `GET /change-password`

## Security model

ZeroAuth can be configured into an explicit deny mode or an intentionally unsafe allow mode.

- If `ZEROAUTH_ALLOW_ANY_LOGIN_HINT=true`, any syntactically valid `login_hint` email is accepted and turned into tokens.
- If `ZEROAUTH_ALLOW_ANY_LOGIN_HINT` is omitted or set to anything else, `/authorize` refuses every request.
- There is no password, session, 2FA, account picker, or user directory.

Only use this for isolated internal testing against a dedicated Google Workspace OU or group.

## Prerequisites

- Node.js 24+
- A Cloudflare Workers account
- A Workers KV namespace bound to `ZEROAUTH_CODES`
- A Google Workspace admin account with access to `Security > Authentication > SSO with third party IdP`

## Install

```bash
npm install
```

## Local quick start

```bash
npm install
npm run dev -- --local --port 8787
```

This project now expects a `.dev.vars` file for local development. The workspace includes one, and the tracked template is [.dev.vars.example](/home/user/workspace/zeroauth/.dev.vars.example).

If you need to recreate it:

```bash
cp .dev.vars.example .dev.vars
npm run dev -- --local --port 8787
```

## Generate a signing key

Generate a private JWK and a random `kid`:

```bash
node scripts/generate-jwk.mjs
```

The script prints JSON like:

```json
{
  "kid": "9c9c1d2a-1f13-4f03-9705-a13a0e2798cf",
  "privateJwk": {
    "kty": "RSA",
    "n": "...",
    "e": "AQAB",
    "d": "...",
    "alg": "RS256",
    "use": "sig"
  }
}
```

For Google Workspace compatibility, use an RSA key and keep `alg` as `RS256`. Copy `kid` to `ZEROAUTH_KID` and stringify `privateJwk` into `ZEROAUTH_PRIVATE_JWK`.

## Configure Cloudflare

1. Create a KV namespace:

   ```bash
   npx wrangler kv namespace create ZEROAUTH_CODES
   npx wrangler kv namespace create ZEROAUTH_CODES --preview
   ```

2. Replace the placeholder IDs in [wrangler.toml](/home/user/workspace/zeroauth/wrangler.toml).
3. Copy [.dev.vars.example](/home/user/workspace/zeroauth/.dev.vars.example) to `.dev.vars` if you have not already.
4. For real Cloudflare deployment, set at least:

   - `ZEROAUTH_CLIENT_ID`
   - `ZEROAUTH_CLIENT_SECRET`
   - `ZEROAUTH_PRIVATE_JWK`
   - `ZEROAUTH_KID`
   - `ZEROAUTH_ISSUER`
   - `ZEROAUTH_ALLOW_ANY_LOGIN_HINT=true`

5. Leave `ZEROAUTH_ALLOWED_REDIRECT_URIS` empty for the first deploy if you do not yet know Google's callback URI.

## Deploy with GitHub Actions

This repository now includes [deploy.yml](/home/user/workspace/zeroauth/.github/workflows/deploy.yml).

- Pull requests run `npm test` and `npm run typecheck`.
- Pushes to `main` deploy ZeroAuth automatically.
- You can also trigger a deploy manually from GitHub Actions with `workflow_dispatch`.

Before the workflow can deploy successfully, do the one-time setup below:

1. Create the `ZEROAUTH_CODES` KV namespace and put the real IDs into [wrangler.toml](/home/user/workspace/zeroauth/wrangler.toml).
2. In GitHub repository settings, add these Actions secrets:

   - `CLOUDFLARE_API_TOKEN`
   - `CLOUDFLARE_ACCOUNT_ID`
   - `ZEROAUTH_CLIENT_ID`
   - `ZEROAUTH_CLIENT_SECRET`
   - `ZEROAUTH_PRIVATE_JWK`
   - `ZEROAUTH_KID`
   - `ZEROAUTH_ISSUER`
   - `ZEROAUTH_ALLOW_ANY_LOGIN_HINT`

3. Optional GitHub secrets you can add if needed:

   - `ZEROAUTH_ALLOWED_REDIRECT_URIS`
   - `ZEROAUTH_AUTH_CODE_TTL_SECONDS`
   - `ZEROAUTH_TOKEN_TTL_SECONDS`

The workflow uses `cloudflare/wrangler-action@v3` to run `wrangler deploy`, and it also syncs the `ZEROAUTH_*` values from GitHub Actions secrets into Cloudflare Worker secrets on every deployment.

That means you do not need to run `wrangler deploy` or `wrangler secret put` manually from your laptop once GitHub Actions is set up.

## Google Workspace setup

1. Deploy ZeroAuth once so the issuer URL is reachable.
2. In Google Admin, create a custom OIDC profile.
3. Enter:

   - Client ID: `ZEROAUTH_CLIENT_ID`
   - Client secret: `ZEROAUTH_CLIENT_SECRET`
   - Issuer URL: your Worker base URL, for example `https://zeroauth.example.workers.dev`
   - Change password URL: `https://zeroauth.example.workers.dev/change-password`

4. Save the profile.
5. Copy the Redirect URI shown by Google Admin.
6. Put that exact URI into `ZEROAUTH_ALLOWED_REDIRECT_URIS`.

If there are multiple redirect URIs, set `ZEROAUTH_ALLOWED_REDIRECT_URIS` to a comma-separated list or a JSON array string.

7. Deploy again.
8. Assign the SSO profile only to a dedicated test OU or group.

Google's documented requirements for custom OIDC inbound SSO include:

- The IdP must provide an `email` claim matching the user's primary Google Workspace address.
- The IdP must use the authorization code flow.

Source: [Google Workspace: Setting up SSO](https://support.google.com/a/answer/12032922?hl=en)

## Environment variables

| Variable | Required | Description |
| --- | --- | --- |
| `ZEROAUTH_CLIENT_ID` | Yes | Single allowed OAuth client ID |
| `ZEROAUTH_CLIENT_SECRET` | Yes | Single allowed OAuth client secret |
| `ZEROAUTH_ALLOWED_REDIRECT_URIS` | No | Comma-separated or JSON array allowlist of redirect URIs |
| `ZEROAUTH_PRIVATE_JWK` | Yes | Private signing JWK as a JSON string |
| `ZEROAUTH_KID` | Yes | Key ID used in JWT headers and JWKS |
| `ZEROAUTH_ISSUER` | Yes | Explicit public issuer URL; must exactly match what Google uses |
| `ZEROAUTH_AUTH_CODE_TTL_SECONDS` | No | Authorization code TTL, default `60` |
| `ZEROAUTH_TOKEN_TTL_SECONDS` | No | Access token and ID token TTL, default `3600` |
| `ZEROAUTH_ALLOW_ANY_LOGIN_HINT` | No | Must be `true` to enable unsafe no-auth behavior |

## Commands

```bash
npm test
npm run typecheck
npm run deploy
```

## Behavior notes

- `/authorize` requires `client_id`, `redirect_uri`, `response_type=code`, `scope` containing `openid`, and `login_hint`.
- `login_hint` is normalized to lowercase before token issuance.
- Authorization codes are single-use and stored in Workers KV.
- `sub` is the SHA-256 hex digest of the lowercase email address.
- `refresh_token` is never issued.
- `/userinfo` accepts only the JWT access token minted by ZeroAuth.

## References

- [Google Workspace: Setting up SSO](https://support.google.com/a/answer/12032922?hl=en)
- [OpenID Connect Discovery 1.0](https://openid.net/specs/openid-connect-discovery-1_0.html)
- [OpenID Connect Core 1.0](https://openid.net/specs/openid-connect-core-1_0-18.html)
- [Cloudflare Workers Web Crypto](https://developers.cloudflare.com/workers/runtime-apis/web-crypto/)
