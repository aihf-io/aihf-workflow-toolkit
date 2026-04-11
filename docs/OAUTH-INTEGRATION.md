# AIHF Platform OAuth Integration

## Overview

The AIHF Platform supports OAuth 2.0 / OpenID Connect authentication with **Google**, **Apple**, and **Microsoft Entra ID** identity providers. This enables workflows to authenticate users via their existing Google, Apple, or Microsoft accounts instead of requiring password-based credentials.

**Key Features:**
- Tenant-isolated OAuth configuration
- Secure credential storage (AES-256-GCM encrypted)
- JWKS caching for efficient ID token validation
- Single-use state parameters (CSRF protection)
- Nonce validation (replay attack prevention)
- Audit logging for all OAuth operations

---

## Architecture

```
Workflow (e.g., myapp-onboarding)
    │
    ▼
Platform SDK (sdk.credentials.initiateOAuth / completeOAuth)
    │  Providers: 'google' | 'apple' | 'entraid'
    ▼
AIHFPlatform Functionality
```

---

## Custom Domain Tenant Resolution

The AIHF Platform supports custom domains for white-label deployments. OAuth login automatically resolves the tenant based on the domain, eliminating the need for users to enter an organization code.

### Supported Custom Domains

| Domain | Tenant |
|--------|--------|
| `app.myapp.com` | myapp |
| `app.aihf.io` | Shared (requires org_code) |

### How It Works

1. **Custom Domain Access** (e.g., `app.myapp.com/login`):
   - `TenantResolver.getTenantByCustomDomain()` looks up the domain
   - Returns the associated `tenant_id`
   - Login page hides the organization code field
   - OAuth buttons appear based on tenant's configured providers

2. **Shared Domain Access** (`app.aihf.io/login`):
   - No custom domain match found
   - User must enter their organization code
   - `TenantResolver.getTenantByOrgId()` resolves the tenant
   - OAuth buttons appear after tenant resolution

### Configuration

Custom domains are configured in the tenant config - via AIHF Platfrom Owner Team.

---

## AIHF Login Page OAuth Integration

The AIHF login page (`/login`) supports OAuth sign-in with Google and Apple. This provides an alternative to password-based authentication.

### Login Page Flow

1. User visits login page (e.g., `app.myapp.com/login`)
2. Page calls `POST /api/auth/oauth/providers` to check available providers
3. OAuth buttons (Google/Apple) appear based on tenant configuration
4. User clicks an OAuth button
5. Frontend calls `POST /api/auth/oauth/initiate` with provider and org_code
6. Backend returns authorization URL
7. Frontend redirects user to Google/Apple
8. After authentication, callback creates session and redirects to app

### OAuth Login Endpoints

#### Check Available Providers

```
POST /api/auth/oauth/providers
Content-Type: application/json

{
  "org_code": "myapp"  // Optional if on custom domain
}
```

**Response:**
```json
{
  "google": true,
  "apple": true,
  "requiresOrgCode": false
}
```

- `google`/`apple`: Whether provider is configured for tenant
- `requiresOrgCode`: `false` on custom domains, `true` on `app.aihf.io`

#### Initiate OAuth Flow

```
POST /api/auth/oauth/initiate
Content-Type: application/json

{
  "provider": "google",
  "org_code": "myapp",  // Optional if on custom domain
  "return_to": "/dashboard"  // Where to redirect after login
}
```

**Response:**
```json
{
  "success": true,
  "authorizationUrl": "https://accounts.google.com/o/oauth2/v2/auth?...",
  "state": "abc123...",
  "provider": "google"
}
```

---

## Sequence Diagrams

### OAuth Login Flow (Custom Domain)

```
┌──────────┐     ┌──────────────┐     ┌──────────────┐     ┌────────┐     ┌──────────────┐
│  User    │     │ Login Page   │     │ AIHF Gateway │     │ Google │     │ AIHF Callback│
│ Browser  │     │ (Frontend)   │     │ (Backend)    │     │ /Apple │     │   Handler    │
└────┬─────┘     └──────┬───────┘     └──────┬───────┘     └───┬────┘     └──────┬───────┘
     │                  │                    │                 │                  │
     │ Visit app.myapp.com/login             │                 │                  │
     │─────────────────>│                    │                 │                  │
     │                  │                    │                 │                  │
     │                  │ POST /api/auth/oauth/providers       │                  │
     │                  │ (no org_code - custom domain)        │                  │
     │                  │───────────────────>│                 │                  │
     │                  │                    │                 │                  │
     │                  │                    │ TenantResolver: │                  │
     │                  │                    │ getTenantByCustomDomain()          │
     │                  │                    │ ──────────┐     │                  │
     │                  │                    │           │     │                  │
     │                  │                    │ <─────────┘     │                  │
     │                  │                    │                 │                  │
     │                  │ { google: true, apple: true,        │                  │
     │                  │   requiresOrgCode: false }          │                  │
     │                  │<───────────────────│                 │                  │
     │                  │                    │                 │                  │
     │ Show OAuth buttons                    │                 │                  │
     │ (org_code field hidden)               │                 │                  │
     │<─────────────────│                    │                 │                  │
     │                  │                    │                 │                  │
     │ Click "Sign in with Google"           │                 │                  │
     │─────────────────>│                    │                 │                  │
     │                  │                    │                 │                  │
     │                  │ POST /api/auth/oauth/initiate        │                  │
     │                  │ { provider: "google" }               │                  │
     │                  │───────────────────>│                 │                  │
     │                  │                    │                 │                  │
     │                  │                    │ Generate state, │                  │
     │                  │                    │ store in KV     │                  │
     │                  │                    │ ──────────┐     │                  │
     │                  │                    │           │     │                  │
     │                  │                    │ <─────────┘     │                  │
     │                  │                    │                 │                  │
     │                  │ { authorizationUrl, state }         │                  │
     │                  │<───────────────────│                 │                  │
     │                  │                    │                 │                  │
     │ Redirect to Google                    │                 │                  │
     │<─────────────────│                    │                 │                  │
     │                  │                    │                 │                  │
     │ Google OAuth Consent                  │                 │                  │
     │─────────────────────────────────────────────────────────>│                  │
     │                  │                    │                 │                  │
     │ Redirect to /oauth/callback/google?code=...&state=...  │                  │
     │<─────────────────────────────────────────────────────────│                  │
     │                  │                    │                 │                  │
     │ GET /oauth/callback/google?code=...&state=...          │                  │
     │────────────────────────────────────────────────────────────────────────────>│
     │                  │                    │                 │                  │
     │                  │                    │                 │    Validate state│
     │                  │                    │                 │    Exchange code │
     │                  │                    │                 │    Validate JWT  │
     │                  │                    │                 │    Create/find   │
     │                  │                    │                 │    entity        │
     │                  │                    │                 │    Create session│
     │                  │                    │                 │ ──────────┐      │
     │                  │                    │                 │           │      │
     │                  │                    │                 │ <─────────┘      │
     │                  │                    │                 │                  │
     │ 302 Redirect to /                     │                 │                  │
     │ Set-Cookie: AIHF_session=...          │                 │                  │
     │<───────────────────────────────────────────────────────────────────────────│
     │                  │                    │                 │                  │
     │ User is now logged in                 │                 │                  │
     │                  │                    │                 │                  │
```

### OAuth Workflow Integration Flow (Invitation)

```
┌──────────┐     ┌──────────────┐     ┌──────────────┐     ┌────────┐     ┌──────────────┐
│  User    │     │  Workflow    │     │ Platform SDK │     │ Google │     │ AIHF Callback│
│ Browser  │     │  (Onboard)   │     │ + Gateway    │     │ /Apple │     │   Handler    │
└────┬─────┘     └──────┬───────┘     └──────┬───────┘     └───┬────┘     └──────┬───────┘
     │                  │                    │                 │                  │
     │ User clicks "Sign│up with Google"     │                 │                  │
     │ on invitation page                    │                 │                  │
     │─────────────────>│                    │                 │                  │
     │                  │                    │                 │                  │
     │                  │ sdk.credentials.initiateOAuth(       │                  │
     │                  │   'google', redirectUri,             │                  │
     │                  │   { entityId, expectedEmail }        │                  │
     │                  │ )                  │                 │                  │
     │                  │───────────────────>│                 │                  │
     │                  │                    │                 │                  │
     │                  │                    │ Pre-create entity                  │
     │                  │                    │ Store OAuth state                  │
     │                  │                    │ ──────────┐     │                  │
     │                  │                    │           │     │                  │
     │                  │                    │ <─────────┘     │                  │
     │                  │                    │                 │                  │
     │                  │ { authorizationUrl, state, entityId }│                  │
     │                  │<───────────────────│                 │                  │
     │                  │                    │                 │                  │
     │ Redirect to Google                    │                 │                  │
     │<─────────────────│                    │                 │                  │
     │                  │                    │                 │                  │
     │ User authenticates with Google        │                 │                  │
     │─────────────────────────────────────────────────────────>│                  │
     │                  │                    │                 │                  │
     │ Redirect to /oauth/callback/google    │                 │                  │
     │<─────────────────────────────────────────────────────────│                  │
     │                  │                    │                 │                  │
     │ Callback handles OAuth completion     │                 │                  │
     │────────────────────────────────────────────────────────────────────────────>│
     │                  │                    │                 │                  │
     │                  │                    │                 │    Validate state│
     │                  │                    │                 │    Exchange code │
     │                  │                    │                 │    Verify email  │
     │                  │                    │                 │    matches invite│
     │                  │                    │                 │    Link IdP cred │
     │                  │                    │                 │    to entity     │
     │                  │                    │                 │    Create session│
     │                  │                    │                 │ ──────────┐      │
     │                  │                    │                 │           │      │
     │                  │                    │                 │ <─────────┘      │
     │                  │                    │                 │                  │
     │ 302 Redirect to workflow returnTo URL │                 │                  │
     │ (e.g., /app/magic/kidweeks-onboarding/1/complete)       │                  │
     │<───────────────────────────────────────────────────────────────────────────│
     │                  │                    │                 │                  │
```

---

## Part 1: Google OAuth Setup

### 1.1 Create Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Note your **Project ID**

### 1.2 Configure OAuth Consent Screen

1. Navigate to **APIs & Services** → **OAuth consent screen**
2. Select **External** user type (unless using Google Workspace)
3. Fill in the required fields:
   - **App name**: Your application name (e.g., "KidWeeks")
   - **User support email**: Your support email
   - **Developer contact**: Your developer email
4. Add scopes:
   - `openid`
   - `email`
   - `profile`
5. Add test users if in testing mode
6. Submit for verification if going to production

### 1.3 Create OAuth 2.0 Credentials

1. Navigate to **APIs & Services** → **Credentials**
2. Click **Create Credentials** → **OAuth client ID**
3. Select **Web application**
4. Configure:
   - **Name**: e.g., "AIHF Platform - Production"
   - **Authorized JavaScript origins**:
     - `https://app.yourdomain.com`
     - `https://app.aihf.io` (if using AIHF domain)
   - **Authorized redirect URIs**:
     - `https://app.yourdomain.com/oauth/callback/google`
     - `https://app.aihf.io/oauth/callback/google`
5. Click **Create**
6. **Save** the following credentials:
   - **Client ID**: `xxxxxxxxxxxx-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx.apps.googleusercontent.com`
   - **Client Secret**: `GOCSPX-xxxxxxxxxxxxxxxxxxxxxxxx`

### 1.4 Required Credentials for AIHF

| Credential Name | Description | Example |
|-----------------|-------------|---------|
| `google_oauth_client_id` | OAuth 2.0 Client ID | `123456789-abc123.apps.googleusercontent.com` |
| `google_oauth_client_secret` | OAuth 2.0 Client Secret | `GOCSPX-abc123xyz789` |

---

## Part 2: Apple Sign-In Setup

### 2.1 Prerequisites

- Apple Developer Program membership ($99/year)
- Access to [Apple Developer Portal](https://developer.apple.com/)

### 2.2 Create App ID

1. Go to **Certificates, Identifiers & Profiles** → **Identifiers**
2. Click **+** to create a new identifier
3. Select **App IDs** → **Continue**
4. Select **App** type → **Continue**
5. Configure:
   - **Description**: e.g., "KidWeeks App"
   - **Bundle ID**: e.g., `com.yourdomain.kidweeks` (Explicit)
6. Under **Capabilities**, enable **Sign In with Apple**
7. Click **Continue** → **Register**

### 2.3 Create Services ID

1. Go to **Identifiers** → Click **+**
2. Select **Services IDs** → **Continue**
3. Configure:
   - **Description**: e.g., "KidWeeks Web"
   - **Identifier**: e.g., `com.yourdomain.kidweeks.web`
4. Click **Continue** → **Register**
5. Click on the newly created Services ID
6. Enable **Sign In with Apple** → Click **Configure**
7. Configure web authentication:
   - **Primary App ID**: Select the App ID created above
   - **Domains**: `app.yourdomain.com`, `app.aihf.io`
   - **Return URLs**:
     - `https://app.yourdomain.com/oauth/callback/apple`
     - `https://app.aihf.io/oauth/callback/apple`
8. Click **Save** → **Continue** → **Save**

### 2.4 Create Private Key

1. Go to **Keys** → Click **+**
2. Configure:
   - **Key Name**: e.g., "KidWeeks Sign In Key"
   - Enable **Sign In with Apple**
   - Click **Configure** → Select your Primary App ID
3. Click **Continue** → **Register**
4. **Download** the private key file (`.p8` file)
   - **Important**: This can only be downloaded once!
5. Note the **Key ID** displayed

### 2.5 Required Credentials for AIHF

| Credential Name | Description | Example |
|-----------------|-------------|---------|
| `apple_oauth_client_id` | Services ID Identifier | `com.yourdomain.myapp.web` |
| `apple_oauth_team_id` | Apple Developer Team ID | `ABC123XYZ9` |
| `apple_oauth_key_id` | Private Key ID | `KEYID12345` |
| `apple_oauth_private_key` | Private Key (PEM format) | See below |

**Private Key Format:**
```
-----BEGIN PRIVATE KEY-----
MIGTAgEAMBMGByqGSM49AgEGCCqGSM49AwEHBHkwdwIBAQQg...
...base64 encoded key data...
-----END PRIVATE KEY-----
```

> **Note**: The private key from Apple is in PKCS#8 format. Store the entire contents including the BEGIN/END markers.

---

## Part 3: AIHF Platform Configuration

### 3.1 Store Credentials via Admin API

Use the AIHF Admin API to store OAuth credentials for your tenant:

```bash
# Google OAuth credentials
curl -X POST "https://admin.aihf.io/api/v1/admin/credentials" \
  -H "Authorization: Bearer ${ADMIN_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "google_oauth_client_id",
    "value": "YOUR_GOOGLE_CLIENT_ID",
    "type": "oauth",
    "tags": ["oauth", "google"]
  }'

curl -X POST "https://admin.aihf.io/api/v1/admin/credentials" \
  -H "Authorization: Bearer ${ADMIN_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "google_oauth_client_secret",
    "value": "YOUR_GOOGLE_CLIENT_SECRET",
    "type": "oauth",
    "tags": ["oauth", "google"]
  }'

# Apple OAuth credentials
curl -X POST "https://admin.aihf.io/api/v1/admin/credentials" \
  -H "Authorization: Bearer ${ADMIN_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "apple_oauth_client_id",
    "value": "com.yourdomain.app.web",
    "type": "oauth",
    "tags": ["oauth", "apple"]
  }'

curl -X POST "https://admin.aihf.io/api/v1/admin/credentials" \
  -H "Authorization: Bearer ${ADMIN_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "apple_oauth_team_id",
    "value": "ABC123XYZ9",
    "type": "oauth",
    "tags": ["oauth", "apple"]
  }'

curl -X POST "https://admin.aihf.io/api/v1/admin/credentials" \
  -H "Authorization: Bearer ${ADMIN_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "apple_oauth_key_id",
    "value": "KEYID12345",
    "type": "oauth",
    "tags": ["oauth", "apple"]
  }'

curl -X POST "https://admin.aihf.io/api/v1/admin/credentials" \
  -H "Authorization: Bearer ${ADMIN_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "apple_oauth_private_key",
    "value": "-----BEGIN PRIVATE KEY-----\nMIGTAgEAMBM...\n-----END PRIVATE KEY-----",
    "type": "oauth",
    "tags": ["oauth", "apple"]
  }'
```

### 3.2 Credential Storage

All OAuth credentials are:
- Encrypted at rest using AES-256-GCM
- Tenant-isolated (each tenant has their own credentials)
- Access-controlled (only `oauth-service` can read them)
- Audit logged on access

---

## Part 4: Workflow Integration

### 4.1 Platform SDK Methods

The `CredentialsManager` exposes the following OAuth methods:

```typescript
type OAuthProvider = 'google' | 'apple' | 'entraid';

interface CredentialsManager {
  // Change the current entity's password
  changeSelfPassword(newPassword: string): Promise<void>;

  // Initiate OAuth flow - returns authorization URL
  initiateOAuth(
    provider: OAuthProvider,
    redirectUri: string,
    options?: {
      entityId?: string;        // Link to existing entity
      expectedEmail?: string;   // Verify email matches
      workflowContext?: string; // JSON context for redirect
    }
  ): Promise<{ authorizationUrl: string; state: string }>;

  // Complete OAuth flow after callback
  completeOAuth(
    provider: OAuthProvider,
    code: string,
    state: string
  ): Promise<{
    success: boolean;
    entityId?: string;
    isNewEntity?: boolean;
    email?: string;
    error?: string;
    errorCode?: string;
  }>;

  // Link OAuth to existing entity
  linkOAuthCredential(
    entityId: string,
    provider: OAuthProvider,
    code: string,
    redirectUri: string,
    expectedEmail?: string
  ): Promise<{
    success: boolean;
    verifiedEmail?: string;
    error?: string;
    errorCode?: string;
  }>;

  // Create new entity with OAuth
  createIdentityWithOAuth(
    provider: OAuthProvider,
    claims: {
      sub: string;
      email?: string;
      emailVerified?: boolean;
      name?: string;
      picture?: string;
    },
    profileData?: { displayName?: string; metadata?: Record<string, unknown> }
  ): Promise<{ entityId: string; email?: string }>;

  // Get linked OAuth providers for entity
  getLinkedOAuthProviders(entityId?: string): Promise<Array<{
    provider: OAuthProvider;
    email?: string;
    name?: string;
    linkedAt: string;
  }>>;

  // Unlink OAuth provider
  unlinkOAuthProvider(
    provider: OAuthProvider,
    entityId?: string
  ): Promise<void>;
}
```

### 4.2 Example: Onboarding Workflow with OAuth

```typescript
// setup-oauth.ts - Workflow step to initiate OAuth
import { AIHFPlatform } from '@aihf/platform-sdk';

export async function api(sdk: AIHFPlatform, inputs: any) {
  const { provider, entityId, invitedEmail } = inputs;

  // Get the redirect URI for this workflow
  const redirectUri = `https://app.aihf.io/oauth/callback/${provider}`;

  // Initiate OAuth flow
  const { authorizationUrl, state } = await sdk.credentials.initiateOAuth(
    provider,
    redirectUri,
    {
      entityId,                    // Link to pre-created invite entity
      expectedEmail: invitedEmail, // Verify OAuth email matches invite
      workflowContext: JSON.stringify({
        returnTo: `/app/magic/kidweeks-onboarding/1/oauth-complete?entityId=${entityId}`
      })
    }
  );

  return {
    success: true,
    authorizationUrl,
    state,
    message: `Redirect user to ${provider} for authentication`
  };
}
```

```typescript
// oauth-complete.ts - Workflow step after OAuth callback
import { AIHFPlatform } from '@aihf/platform-sdk';

export async function api(sdk: AIHFPlatform, inputs: any) {
  const { entityId } = inputs;

  // Get linked OAuth providers to verify linking succeeded
  const providers = await sdk.credentials.getLinkedOAuthProviders(entityId);

  if (providers.length === 0) {
    return {
      success: false,
      error: 'OAuth linking failed - no providers found'
    };
  }

  const linkedProvider = providers[0];

  return {
    success: true,
    provider: linkedProvider.provider,
    email: linkedProvider.email,
    linkedAt: linkedProvider.linkedAt,
    message: `Successfully linked ${linkedProvider.provider} account`
  };
}
```

### 4.3 Example: Login with OAuth

```typescript
// login-oauth.ts - Initiate OAuth login
import { AIHFPlatform } from '@aihf/platform-sdk';

export async function api(sdk: AIHFPlatform, inputs: any) {
  const { provider } = inputs;

  const redirectUri = `https://app.aihf.io/oauth/callback/${provider}`;

  // Initiate OAuth flow (no entityId = login/signup flow)
  const { authorizationUrl } = await sdk.credentials.initiateOAuth(
    provider,
    redirectUri
  );

  return {
    success: true,
    authorizationUrl
  };
}
```

---

## Part 5: OAuth Callback Flow

### 5.1 Callback Routes

The platform handles OAuth callbacks at:
- **Google**: `GET /oauth/callback/google?code=...&state=...`
- **Apple**: `POST /oauth/callback/apple` (form data with code, state, user)

### 5.2 Callback Processing

1. **Extract parameters**: Code and state from query (Google) or form (Apple)
2. **Validate state**: Single-use, tenant-matched, not expired (10 min TTL)
3. **Exchange code**: Trade authorization code for tokens
4. **Validate ID token**: Verify JWT signature using provider's JWKS
5. **Extract claims**: Get user info (sub, email, name)
6. **Find/create entity**: Match by OAuth sub or create new
7. **Link credential**: Store IdP credential for entity
8. **Create session**: Issue level-1 session with cookies
9. **Redirect**: Send user to workflow or dashboard

### 5.3 Error Handling

OAuth errors redirect to `/login?oauth_error=<code>&provider=<provider>`

Common error codes:
| Code | Description |
|------|-------------|
| `invalid_state` | State expired or already used |
| `token_exchange_failed` | Failed to exchange code for tokens |
| `invalid_id_token` | ID token signature verification failed |
| `email_mismatch` | OAuth email doesn't match expected |
| `provider_not_configured` | OAuth credentials not set up |

---

## Part 6: Security Considerations

### 6.1 State Parameter

- Cryptographically random (32 bytes, hex encoded)
- Single-use (deleted after validation)
- 10 minute TTL
- Stored in AIHF_SESSION_STORE KV
- Includes tenant ID, nonce, redirect URI

### 6.2 Nonce Validation

- Included in authorization request
- Verified in ID token claims
- Prevents replay attacks

### 6.3 JWKS Caching

- JWKS keys cached for 1 hour
- Automatic refresh on cache miss
- Handles key rotation gracefully

### 6.4 Credential Security

- All OAuth secrets encrypted with AES-256-GCM
- Service-based access control
- Apple private key never logged
- Apple client secret regenerated per request

### 6.5 Audit Logging

All OAuth operations are logged:
- `oauth.initiate` - Flow started
- `oauth.complete` - Flow completed
- `oauth.link` - Credential linked
- `oauth.create_entity` - New entity created
- `oauth.unlink` - Credential unlinked

---

## Part 7: Troubleshooting

### Common Issues

**"Provider not configured"**
- Verify OAuth credentials are stored for the tenant
- Check credential names match exactly (case-sensitive)
- Ensure credentials are not expired

**"Invalid redirect URI"**
- Verify redirect URI is registered in Google/Apple console
- Check for trailing slashes or protocol mismatches
- Ensure domain is authorized

**"ID token validation failed"**
- Check system clock is synchronized
- Verify client ID matches token audience
- Ensure JWKS endpoint is accessible

**"State validation failed"**
- User took too long (>10 minutes)
- State was already used (browser back button)
- Tenant mismatch between initiate and callback

### Debug Logging

OAuth operations log to console with prefixes:
- `[OAuthProviderService]` - Core OAuth operations
- `[JWKSManagerService]` - Key fetching and caching
- `[AIHFEntityCredentialManager]` - IdP credential storage

---

## Appendix: Credential Reference

### Google OAuth Credentials

| Name | Required | Description |
|------|----------|-------------|
| `google_oauth_client_id` | Yes | OAuth 2.0 Client ID from Google Cloud Console |
| `google_oauth_client_secret` | Yes | OAuth 2.0 Client Secret |

### Apple OAuth Credentials

| Name | Required | Description |
|------|----------|-------------|
| `apple_oauth_client_id` | Yes | Services ID Identifier (e.g., `com.domain.app.web`) |
| `apple_oauth_team_id` | Yes | Apple Developer Team ID (10 characters) |
| `apple_oauth_key_id` | Yes | Private Key ID from Apple Developer Portal |
| `apple_oauth_private_key` | Yes | Private Key contents (PEM format, including headers) |

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.2.0 | 2025-06 | Added Microsoft Entra ID (`entraid`) provider support, `errorCode` in responses, `emailVerified`/`picture` in claims, `metadata` in profileData, `changeSelfPassword` method |
| 1.1.0 | 2025-01 | Added AIHF login page OAuth integration, custom domain tenant resolution, sequence diagrams |
| 1.0.0 | 2025-01 | Initial OAuth integration for Google and Apple |
