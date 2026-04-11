# Authentication Guide

The AIHF.io Platform provides two SDK managers for authentication and credential management:

- **`sdk.auth`** (AuthManager) -- Magic link generation for passwordless workflow access
- **`sdk.credentials`** (CredentialsManager) -- Password management and full OAuth lifecycle (Google, Apple, EntraID)

```
┌──────────────────────────────────────────────────────────────────┐
│                   Authentication Architecture                     │
├──────────────────────────────┬───────────────────────────────────┤
│     sdk.auth (AuthManager)   │  sdk.credentials                  │
│                              │  (CredentialsManager)             │
│  createMagicLink()           │                                   │
│    - Passwordless access     │  changeSelfPassword()             │
│    - Targets a workflow step │  initiateOAuth()                  │
│    - Level-zero sessions     │  completeOAuth()        (admin)   │
│    - Admin permission needed │  linkOAuthCredential()            │
│                              │  createIdentityWithOAuth() (admin)│
│                              │  getLinkedOAuthProviders()        │
│                              │  unlinkOAuthProvider()            │
└──────────────────────────────┴───────────────────────────────────┘
```

---

## AuthManager API Reference

The `AuthManager` has a single method. It requires admin permissions (`magic.link`).

### `createMagicLink(options)`

Creates a magic link URI that grants a specific entity level-zero session access to a specific workflow step. Typically used for email verification, password reset, or onboarding flows.

```typescript
sdk.auth.createMagicLink(options: {
  entityId: string;             // Entity to grant access to
  workflowName: string;         // Target workflow name
  workflowVersion: number;      // Target workflow version
  stepId: string;               // Target step within the workflow
  expiresInMinutes?: number;    // Optional expiry (reserved for future use)
  metadata?: Record<string, any>;       // Optional metadata (reserved for future use)
  queryParams?: Record<string, string>; // Query params forwarded to the step
}): Promise<string | null>
```

Returns a magic link URI (e.g., `/magic?token=...`) or `null` if creation failed.

---

## CredentialsManager API Reference

The `CredentialsManager` handles password changes and the full OAuth lifecycle.

**Supported OAuth providers:**

```typescript
type OAuthProvider = 'google' | 'apple' | 'entraid';
```

### `changeSelfPassword(newPassword)`

Changes the current session entity's password. The password is hashed using tenant-specific security policies. Previous password is invalidated.

```typescript
sdk.credentials.changeSelfPassword(newPassword: string): Promise<void>
```

### `initiateOAuth(provider, redirectUri, options?)`

Starts an OAuth flow by generating an authorization URL. Redirect the user to this URL.

```typescript
sdk.credentials.initiateOAuth(
  provider: OAuthProvider,
  redirectUri: string,
  options?: {
    entityId?: string;        // Link to a specific entity
    expectedEmail?: string;   // Verify returned email matches
    workflowContext?: string; // Context for callback routing
  }
): Promise<InitiateOAuthResponse>

// Response:
interface InitiateOAuthResponse {
  authorizationUrl: string;  // URL to redirect user to
  state: string;             // State token for CSRF validation
}
```

### `completeOAuth(provider, code, state)`

Completes an OAuth flow after the user returns from the provider. Requires admin permissions. Exchanges the authorization code for tokens, validates the ID token, and either links to an existing entity, creates a new entity, or returns the already-linked entity.

```typescript
sdk.credentials.completeOAuth(
  provider: OAuthProvider,
  code: string,
  state: string
): Promise<CompleteOAuthResponse>

// Response:
interface CompleteOAuthResponse {
  success: boolean;
  entityId?: string;
  isNewEntity?: boolean;
  email?: string;
  error?: string;
  errorCode?: string;
}
```

### `linkOAuthCredential(entityId, provider, code, redirectUri, expectedEmail?)`

Links an OAuth provider to an existing entity. Used in onboarding workflows where a user needs to connect their Google/Apple/EntraID account to a pre-created entity (e.g., from an invitation).

```typescript
sdk.credentials.linkOAuthCredential(
  entityId: string,
  provider: OAuthProvider,
  code: string,
  redirectUri: string,
  expectedEmail?: string
): Promise<LinkOAuthResponse>

// Response:
interface LinkOAuthResponse {
  success: boolean;
  verifiedEmail?: string;
  error?: string;
  errorCode?: string;
}
```

### `createIdentityWithOAuth(provider, claims, profileData?)`

Creates a new entity with OAuth authentication in one operation. Requires admin permissions.

```typescript
sdk.credentials.createIdentityWithOAuth(
  provider: OAuthProvider,
  claims: {
    sub: string;
    email?: string;
    emailVerified?: boolean;
    name?: string;
    picture?: string;
  },
  profileData?: {
    displayName?: string;
    metadata?: Record<string, unknown>;
  }
): Promise<CreateEntityWithOAuthResponse>

// Response:
interface CreateEntityWithOAuthResponse {
  entityId: string;
  email?: string;
}
```

### `getLinkedOAuthProviders(entityId?)`

Returns which OAuth providers are linked to an entity. Defaults to the current session entity if no `entityId` is given.

```typescript
sdk.credentials.getLinkedOAuthProviders(
  entityId?: string
): Promise<Array<{
  provider: OAuthProvider;
  email?: string;
  name?: string;
  linkedAt: string;
}>>
```

### `unlinkOAuthProvider(provider, entityId?)`

Removes an OAuth credential link from an entity. The entity must retain at least one other authentication method (password or another OAuth provider).

```typescript
sdk.credentials.unlinkOAuthProvider(
  provider: OAuthProvider,
  entityId?: string
): Promise<void>
```

---

## Examples

### Magic Link: Password Reset Flow

Create a magic link that sends the user to a password-reset workflow step where they can call `changeSelfPassword`.

```typescript
// src/api/send-reset-link.ts
export async function invokedByAIHF(
  sdk: AIHFPlatform,
  workflowName: string,
  workflowVersion: number,
  workflowStepId: string,
  taskId: string,
  sanitisedInput: string
): Promise<Response | null> {
  const { email } = JSON.parse(sanitisedInput);

  // Look up the entity by username (email)
  const entity = await sdk.entities.findByUsername(email);
  if (!entity) {
    // Return success even if not found (prevents user enumeration)
    return new Response(JSON.stringify({ success: true }));
  }

  // Create a magic link targeting the credential-setup step
  const magicLinkUri = await sdk.auth.createMagicLink({
    entityId: entity.entity_id,
    workflowName: 'password-reset',
    workflowVersion: 1,
    stepId: 'credential-setup',
    queryParams: { email }
  });

  if (magicLinkUri) {
    // Build full URL and email it
    const resetUrl = `https://app.example.com${magicLinkUri}`;
    await sdk.emails.sendPasswordReset(email, entity.profile.display_name || 'User', resetUrl);
  }

  return new Response(JSON.stringify({ success: true }), {
    headers: { 'Content-Type': 'application/json' }
  });
}
```

### Magic Link: Onboarding Invitation

Create a magic link with query parameters to carry invitation context.

```typescript
// src/api/send-invite.ts
export async function invokedByAIHF(
  sdk: AIHFPlatform,
  workflowName: string,
  workflowVersion: number,
  workflowStepId: string,
  taskId: string,
  sanitisedInput: string
): Promise<Response | null> {
  const { invitedEmail, invitationId } = JSON.parse(sanitisedInput);

  // Create entity for the invited user
  const newEntity = await sdk.entities.createEntity({
    profile: {
      username: invitedEmail,
      email: invitedEmail,
      type: 'human'
    },
    roles: [{ name: 'customer', permissions: [] }]
  });

  // Create magic link with invitation context
  const magicLinkUri = await sdk.auth.createMagicLink({
    entityId: newEntity.entity_id,
    workflowName: 'onboarding',
    workflowVersion: 1,
    stepId: 'credential-setup',
    queryParams: {
      invitationId,
      email: invitedEmail
    }
  });

  if (magicLinkUri) {
    const onboardingUrl = `https://app.example.com${magicLinkUri}`;
    await sdk.emails.sendWelcomeEmail(invitedEmail, 'New User', 'support@example.com');
  }

  return new Response(JSON.stringify({ success: true, entityId: newEntity.entity_id }), {
    headers: { 'Content-Type': 'application/json' }
  });
}
```

### OAuth: Google Sign-In with Redirect

```typescript
// src/api/oauth-start.ts
export async function invokedByAIHF(
  sdk: AIHFPlatform,
  workflowName: string,
  workflowVersion: number,
  workflowStepId: string,
  taskId: string,
  sanitisedInput: string
): Promise<Response | null> {
  // Initiate Google OAuth flow
  const { authorizationUrl, state } = await sdk.credentials.initiateOAuth(
    'google',
    'https://app.example.com/oauth/callback/google'
  );

  // Redirect user to Google's consent screen
  return new Response(null, {
    status: 302,
    headers: {
      'Location': authorizationUrl,
      'Set-Cookie': `oauth_state=${state}; HttpOnly; Secure; SameSite=Lax; Max-Age=600`
    }
  });
}
```

### OAuth: Handling the Callback

```typescript
// src/api/oauth-callback.ts
export async function invokedByAIHF(
  sdk: AIHFPlatform,
  workflowName: string,
  workflowVersion: number,
  workflowStepId: string,
  taskId: string,
  sanitisedInput: string
): Promise<Response | null> {
  const { code, state } = JSON.parse(sanitisedInput);

  // Complete the OAuth flow (admin permission required)
  const result = await sdk.credentials.completeOAuth('google', code, state);

  if (!result.success) {
    return new Response(JSON.stringify({
      error: result.error,
      errorCode: result.errorCode
    }), { status: 400, headers: { 'Content-Type': 'application/json' } });
  }

  return new Response(JSON.stringify({
    success: true,
    entityId: result.entityId,
    isNewEntity: result.isNewEntity,
    email: result.email
  }), { headers: { 'Content-Type': 'application/json' } });
}
```

### OAuth: Link Provider to Existing Entity (Onboarding)

```typescript
// src/api/link-google.ts
export async function invokedByAIHF(
  sdk: AIHFPlatform,
  workflowName: string,
  workflowVersion: number,
  workflowStepId: string,
  taskId: string,
  sanitisedInput: string
): Promise<Response | null> {
  const { entityId, code, invitedEmail } = JSON.parse(sanitisedInput);

  const result = await sdk.credentials.linkOAuthCredential(
    entityId,
    'google',
    code,
    'https://app.example.com/oauth/callback/google',
    invitedEmail  // Verify the OAuth email matches the invitation
  );

  if (!result.success) {
    return new Response(JSON.stringify({ error: result.error }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  return new Response(JSON.stringify({
    success: true,
    verifiedEmail: result.verifiedEmail
  }), { headers: { 'Content-Type': 'application/json' } });
}
```

### OAuth: View and Manage Linked Providers

```typescript
// src/api/account-settings.ts
export async function invokedByAIHF(
  sdk: AIHFPlatform,
  workflowName: string,
  workflowVersion: number,
  workflowStepId: string,
  taskId: string,
  sanitisedInput: string
): Promise<Response | null> {
  // Get linked providers for current user
  const providers = await sdk.credentials.getLinkedOAuthProviders();
  // => [{ provider: 'google', email: 'user@gmail.com', linkedAt: '2025-...' }]

  return new Response(JSON.stringify({ providers }), {
    headers: { 'Content-Type': 'application/json' }
  });
}
```

```typescript
// src/api/unlink-provider.ts
export async function invokedByAIHF(
  sdk: AIHFPlatform,
  workflowName: string,
  workflowVersion: number,
  workflowStepId: string,
  taskId: string,
  sanitisedInput: string
): Promise<Response | null> {
  const { provider } = JSON.parse(sanitisedInput);

  // Unlink the provider from the current user's account
  await sdk.credentials.unlinkOAuthProvider(provider);

  return new Response(JSON.stringify({ success: true }), {
    headers: { 'Content-Type': 'application/json' }
  });
}
```

### Password: Self-Service Change

```typescript
// src/api/set-new-password.ts
export async function invokedByAIHF(
  sdk: AIHFPlatform,
  workflowName: string,
  workflowVersion: number,
  workflowStepId: string,
  taskId: string,
  sanitisedInput: string
): Promise<Response | null> {
  const { newPassword } = JSON.parse(sanitisedInput);

  await sdk.credentials.changeSelfPassword(newPassword);

  return new Response(JSON.stringify({ success: true }), {
    headers: { 'Content-Type': 'application/json' }
  });
}
```

---

## Bundle Configuration

### Password Reset Workflow

```yaml
steps:
  - id: "send-link"
    route: '/reset'
    domain: 'app'
    api:
      - route_match: '/send'
        file: 'api/send-reset-link.ts'
        input:
          - name: 'email'
            type: 'string'
        output:
          - name: 'success'
            type: 'boolean'

  - id: "credential-setup"
    route: '/reset/set-password'
    domain: 'app'
    ui:
      dynamic: 'ui/set-password.ts'
    api:
      - route_match: '/set'
        file: 'api/set-new-password.ts'
        input:
          - name: 'newPassword'
            type: 'string'
        output:
          - name: 'success'
            type: 'boolean'
```

### OAuth Login Workflow

```yaml
steps:
  - id: "login"
    route: '/login'
    domain: 'app'
    ui:
      dynamic: 'ui/login.ts'
    api:
      - route_match: '/oauth/start'
        file: 'api/oauth-start.ts'
        input:
          - name: 'provider'
            type: 'string'
        output: []

  - id: "oauth-callback"
    route: '/oauth/callback'
    domain: 'app'
    api:
      - route_match: '/google'
        file: 'api/oauth-callback.ts'
        input:
          - name: 'code'
            type: 'string'
          - name: 'state'
            type: 'string'
        output:
          - name: 'success'
            type: 'boolean'
          - name: 'entityId'
            type: 'string'
```

---

## Session Management

### Getting Current User

```typescript
const entity = await sdk.entities.getCurrentEntity();

if (!entity) {
  // Not authenticated
  return new Response(JSON.stringify({ error: 'Login required' }), { status: 401 });
}

// entity.entity_id - unique user ID
// entity.profile.email - user's email
// entity.profile.display_name - user's display name
```

### Protecting Routes

```typescript
export async function invokedByAIHF(sdk: AIHFPlatform, ...args): Promise<Response | null> {
  const entity = await sdk.entities.getCurrentEntity();
  if (!entity) {
    return Response.redirect('/login', 302);
  }

  // User is authenticated -- proceed with protected logic
  // ...
}
```

---

## Security Best Practices

1. **Always use HTTPS** -- OAuth redirect URIs and magic links require secure connections.
2. **State parameter validation** -- The `initiateOAuth` method generates a `state` token; `completeOAuth` validates it automatically.
3. **Email verification with `expectedEmail`** -- When linking OAuth to an invited entity, pass the expected email to prevent account takeover.
4. **Magic link expiry** -- Magic links grant level-zero sessions scoped to a single workflow step.
5. **Use HttpOnly cookies** -- Store session tokens securely; never expose them to client-side JavaScript.
6. **Audit logging** -- All auth operations are audit-logged by the platform automatically.

## Methods That Do NOT Exist

The following methods were documented in previous versions but have never existed in the platform SDK. Do not use them:

- `sdk.auth.verifyMagicLink()` -- Magic link verification is handled internally by the gateway.
- `sdk.auth.getOAuthUrl()` -- Use `sdk.credentials.initiateOAuth()` instead.
- `sdk.auth.handleOAuthCallback()` -- Use `sdk.credentials.completeOAuth()` instead.
- `sdk.auth.generateTOTPSecret()` -- TOTP is not supported.
- `sdk.auth.verifyTOTP()` -- TOTP is not supported.

## Related Documentation

- [Platform SDK Reference](./SDK_REFERENCE.md) - Full API documentation
- [Bundle.yaml Reference](./BUNDLE_YAML.md) - Workflow configuration
