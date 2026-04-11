# OAuth Signup Example

Google and Apple OAuth authentication demonstrating:

- OAuth provider configuration
- Authorization redirect flow
- Callback handling
- User creation from OAuth profile

## Structure

```
oauth-signup/
├── bundle.yaml
├── config/
│   └── config.json
└── src/
    ├── api/
    │   ├── oauth-google.ts
    │   ├── oauth-apple.ts
    │   └── oauth-callback.ts
    └── ui/
        └── login.ts
```

## Workflow Steps

1. **Login** (`/login`) - Login options page
2. **OAuth Redirect** (`/oauth/:provider`) - Redirect to provider
3. **Callback** (`/oauth/callback`) - Handle OAuth response

## Key Concepts Demonstrated

### Initiating OAuth Flow

```typescript
// initiateOAuth(provider, redirectUri, options?)
// Provider: 'google' | 'apple' | 'entraid'
const oauthResponse = await sdk.credentials.initiateOAuth(
  'google',
  'https://app.example.com/oauth/callback/google',
  { workflowContext: workflowName }
);

// Returns: { authorizationUrl, state }
// State is platform-managed for CSRF protection
return Response.redirect(oauthResponse.authorizationUrl, 302);
```

### Handling OAuth Callback

```typescript
// completeOAuth(provider, code, state)
const result = await sdk.credentials.completeOAuth('google', code, state);

// result contains:
// - success: boolean
// - entityId?: string (created or existing entity)
// - isNewEntity?: boolean
// - email?: string
// - error?: string
// - errorCode?: string
```

### Linking OAuth to Existing Entity

```typescript
// Link an OAuth provider to an existing entity
const linkResult = await sdk.credentials.linkOAuthCredential(
  entityId,
  'google',
  code,
  redirectUri,
  expectedEmail
);

// Get linked providers for an entity
const providers = await sdk.credentials.getLinkedOAuthProviders(entityId);
```
