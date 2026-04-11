# Configuration Guide

How to configure your AIHF.io tenant and workflows.

## Configuration Layers

AIHF.io uses three configuration layers:

| Layer | Location | Purpose |
|-------|----------|---------|
| Tenant Settings | admin.aihf.io | Organization-wide settings, secrets |
| Workflow Config | config.json | Workflow-specific settings |
| Bundle Definition | bundle.yaml | Workflow structure and steps |

```
┌─────────────────────────────────────────────────────────────┐
│                     Configuration Hierarchy                  │
│                                                              │
│  ┌─────────────────────────────────────────────────────┐    │
│  │               Tenant Settings                        │    │
│  │           (admin.aihf.io)                           │    │
│  │                                                      │    │
│  │   • Stripe API keys                                 │    │
│  │   • OAuth client credentials                        │    │
│  │   • AI Worker provisioning                          │    │
│  │   • Domain configuration                            │    │
│  └─────────────────────────────────────────────────────┘    │
│                           │                                  │
│                           ▼                                  │
│  ┌─────────────────────────────────────────────────────┐    │
│  │               Workflow Config                        │    │
│  │             (config.json)                           │    │
│  │                                                      │    │
│  │   • Branding (colors, logos)                        │    │
│  │   • Feature flags                                   │    │
│  │   • Localization settings                           │    │
│  │   • Non-secret API URLs                             │    │
│  └─────────────────────────────────────────────────────┘    │
│                           │                                  │
│                           ▼                                  │
│  ┌─────────────────────────────────────────────────────┐    │
│  │               Bundle Definition                      │    │
│  │             (bundle.yaml)                           │    │
│  │                                                      │    │
│  │   • Workflow steps                                  │    │
│  │   • Routes and domains                              │    │
│  │   • API input/output schemas                        │    │
│  └─────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
```

## Tenant Settings (admin.aihf.io)

Configure these in your tenant's admin portal.

### Accessing Admin Portal

1. Go to [admin.aihf.io](https://admin.aihf.io)
2. Log in with your admin credentials
3. Select your organization

### Payment Configuration

**Settings → Payments → Stripe**

| Setting | Description |
|---------|-------------|
| Stripe Publishable Key | `pk_live_...` or `pk_test_...` |
| Stripe Secret Key | `sk_live_...` or `sk_test_...` (stored securely) |
| Webhook Signing Secret | `whsec_...` for verifying webhooks |

**Setting up Stripe:**

1. Create a Stripe account at [stripe.com](https://stripe.com)
2. Get your API keys from Dashboard → Developers → API keys
3. Enter keys in admin.aihf.io
4. Configure webhook endpoint: `https://gateway.aihf.io/webhooks/stripe`

### OAuth Configuration

**Settings → Authentication → OAuth Providers**

#### Google OAuth

| Setting | Description |
|---------|-------------|
| Client ID | From Google Cloud Console |
| Client Secret | Stored securely |
| Redirect URI | Auto-configured by platform |

**Setting up Google OAuth:**

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create a new project or select existing
3. Enable "Google+ API" or "People API"
4. Go to Credentials → Create Credentials → OAuth Client ID
5. Application type: Web application
6. Add authorized redirect URI: `https://*.aihf.app/oauth/google/callback`
7. Copy Client ID and Secret to admin.aihf.io

#### Apple OAuth

| Setting | Description |
|---------|-------------|
| Service ID | Your Apple Service ID |
| Team ID | Your Apple Team ID |
| Key ID | Your private key ID |
| Private Key | Your .p8 private key contents |

### AI Worker Provisioning

**Settings → AI Workers**

Provision AI entities to automate work domain steps:

1. **Create AI Entity**
   - Name: e.g., "Claude Worker"
   - Type: `ai`
   - Role: `ai-worker`

2. **Generate Token Credential**
   - Click "Generate Token"
   - Token is auto-created: `aihf_{org}_{level}_{random}`

3. **Store Anthropic API Key** (if using Claude)
   - Credential name: `anthropic_{entity_username}`
   - Value: Your Claude API key from [Anthropic Console](https://console.anthropic.com)

4. **Click "Provision AI Worker"**
   - Worker starts polling within 30 seconds

### Domain Configuration

**Settings → Domains**

| Domain Type | Pattern | Purpose |
|-------------|---------|---------|
| App Domain | `*.{tenant}.aihf.app` | Customer-facing |
| Work Domain | `*.{tenant}.aihf.work` | Internal/AI workers |
| Custom Domain | `app.yourcompany.com` | Optional custom domains |

**Custom Domain Setup:**

1. Add your domain in admin.aihf.io
2. Add CNAME record: `app.yourcompany.com → {tenant}.aihf.app`
3. Wait for SSL certificate provisioning
4. Verify in admin portal

### Email Configuration

**Settings → Email**

| Setting | Description |
|---------|-------------|
| From Name | Display name for outgoing emails |
| From Address | `noreply@yourcompany.com` |
| Reply-To | Optional reply-to address |

**Custom Domain Email (Optional):**

1. Verify your domain with SPF/DKIM records
2. Configure in admin.aihf.io
3. Emails will be sent from your domain

## Workflow Config (config.json)

Tenant-editable settings for your workflow, using the AIHF standard fields-based format.

### Location

```
your-workflow/
├── bundle.yaml
├── config/
│   └── config.json    ← This file
└── src/
```

### Structure

Config files use the `WorkflowConfig` schema — a flat array of typed fields, not freeform nested objects:

```json
{
  "name": "My Workflow Configuration",
  "description": "Tenant-configurable settings",
  "version": 1,
  "fields": [
    {
      "id": "company_name",
      "label": "Company Name",
      "type": "string",
      "default": "Acme Corp",
      "description": "Company name displayed in the UI",
      "value": "Acme Corp"
    },
    {
      "id": "dark_mode",
      "label": "Dark Mode",
      "type": "boolean",
      "default": false,
      "description": "Enable dark mode for all UI pages",
      "value": false
    },
    {
      "id": "max_uploads",
      "label": "Maximum Uploads",
      "type": "number",
      "default": 10,
      "min": 1,
      "max": 100,
      "description": "Maximum files per session",
      "value": 10
    }
  ]
}
```

See [Config.json Guide](./CONFIG_JSON.md) for the full field type reference.

### Accessing Config in Handlers

```typescript
export async function invokedByAIHF(
  sdk: AIHFPlatform,
  workflowName: string,
  workflowVersion: number,
  ...args
) {
  // Get the WorkflowConfigHelper for typed access
  const config = await sdk.workflows.getWorkflowConfigHelper(workflowName, workflowVersion);

  // Access fields by their 'id' with typed accessors
  const companyName = config.getString('company_name', 'Company');
  const maxUploads = config.getNumber('max_uploads', 5);
  const darkMode = config.getBoolean('dark_mode', false);

  // Check if a field exists
  if (config.hasField('company_name')) {
    const rawConfig = config.getRawConfig();
  }
}
```

### What Goes in config.json vs admin.aihf.io

| Type | Location | Examples |
|------|----------|----------|
| Secrets | admin.aihf.io | API keys, tokens, passwords |
| Credentials | admin.aihf.io | OAuth secrets, Stripe keys |
| Branding | config.json | Colors, logos, company name |
| Feature flags | config.json | Enable/disable features |
| Localization | config.json | Timezone, currency, formats |
| External URLs | config.json | Non-secret API endpoints |

**Never put in config.json:**
- API keys
- Passwords
- OAuth secrets
- Anything you wouldn't commit to Git

## Environment-Specific Config

Maintain different configs for different environments:

```
your-workflow/
├── config.json              # Default (development)
├── config.staging.json      # Staging
├── config.production.json   # Production
└── src/
```

During bundle upload, select the appropriate config file.

## Secrets and Credentials

### Storing Secrets

Secrets are stored in admin.aihf.io under **Settings → Credentials**.

```
┌─────────────────────────────────────────────────────────────┐
│                    Credential Storage                        │
│                                                              │
│  Name                    Type        Entity                  │
│  ────────────────────────────────────────────────────       │
│  stripe_secret_key       secret      system                  │
│  google_oauth_secret     secret      system                  │
│  anthropic_claude1       secret      claude1 (AI entity)    │
│  api_token_user123       token       user123                 │
└─────────────────────────────────────────────────────────────┘
```

### Accessing Secrets in Handlers

Secrets are accessed through the platform (not directly):

```typescript
// Stripe is pre-configured - just use sdk.billing
const checkout = await sdk.billing.createCheckoutSession({...});

// OAuth is managed through the Credentials Manager
const { authorizationUrl } = await sdk.credentials.initiateOAuth('google', redirectUri);

// Check linked OAuth providers for current entity
const providers = await sdk.credentials.getLinkedOAuthProviders();
```

You don't access secrets directly - the platform handles this securely.

### Security Model

```
┌─────────────────────────────────────────────────────────────┐
│                    Security Boundaries                       │
│                                                              │
│  Your Handler Code                                           │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  // You CAN do:                                     │    │
│  │  await sdk.billing.createCheckout(...)              │    │
│  │  await sdk.credentials.initiateOAuth(...)           │    │
│  │                                                      │    │
│  │  // You CANNOT do:                                  │    │
│  │  const key = env.STRIPE_SECRET; // Not exposed     │    │
│  │  fetch('stripe.com', { key: ... }); // Use SDK     │    │
│  └─────────────────────────────────────────────────────┘    │
│                           │                                  │
│                           ▼                                  │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  Platform SDK Layer                                 │    │
│  │                                                      │    │
│  │  • Validates permissions                            │    │
│  │  • Injects secrets as needed                        │    │
│  │  • Enforces tenant isolation                        │    │
│  │  • Logs for audit trail                             │    │
│  └─────────────────────────────────────────────────────┘    │
│                           │                                  │
│                           ▼                                  │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  External Services                                  │    │
│  │                                                      │    │
│  │  Stripe, Google, Anthropic, etc.                   │    │
│  └─────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
```

## Database Tables

Tables are created using `src/initWorkflow.ts`, which runs automatically during bundle deployment. Use `CREATE TABLE IF NOT EXISTS` for idempotent initialization:

```typescript
// In src/initWorkflow.ts
await sdk.database.execute(workflowName, `
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    created_at TEXT NOT NULL
  )
`);
```

Then reference tables in your handlers:

```typescript
// In your API handler
await sdk.database.insert(workflowName, 'users', {
  id: crypto.randomUUID(),
  email: 'user@example.com',
  name: 'Jane',
  created_at: new Date().toISOString()
});

// Query using raw SQL
const users = await sdk.database.query(workflowName,
  'SELECT * FROM users WHERE email = ?',
  ['user@example.com']
);
```

See [Workflow Initialization](./INIT_WORKFLOW.md) for database setup patterns, version migrations, and data seeding.

### Naming Conventions

- Table names: lowercase with underscores (`user_messages`, `order_items`)
- Workflow-scoped: Each workflow has its own D1 database
- All types are `TEXT`, `INTEGER`, `REAL`, or `BLOB` (D1/SQLite)
- Store dates as ISO 8601 strings (no `DATETIME` type)

## File Storage Paths

Files are stored in tenant-isolated R2 buckets:

```
tenant-files/{tenant_id}/
├── {workflow_name}/
│   ├── documents/
│   │   └── {document_id}/
│   │       └── file.pdf
│   ├── images/
│   └── exports/
└── shared/
    └── logos/
```

### Accessing Files

```typescript
// Upload (path-based)
await sdk.files.upload('documents/invoice-123.pdf', fileBuffer);

// Download (returns ReadableStream)
const stream = await sdk.files.download('documents/invoice-123.pdf');

// Get file metadata
const metadata = await sdk.files.getMetadata('documents/invoice-123.pdf');

// List files in a folder
const files = await sdk.files.list('documents/');
```

## Configuration Best Practices

1. **Keep secrets in admin.aihf.io** - Never in code or config.json
2. **Use config.json for theming** - Colors, logos, feature flags
3. **Always provide defaults** - Every field must have a `default` value
4. **Use the fields-based format** - Flat fields array, not freeform nested objects
5. **Validate early** - Check required config at handler start
6. **Use initWorkflow.ts** - Create database tables on deployment, not on first access

## Related Documentation

- [Bundle.yaml Reference](./BUNDLE_YAML.md) - Workflow structure
- [Config.json Guide](./CONFIG_JSON.md) - Detailed config field types and schema
- [Workflow Initialization](./INIT_WORKFLOW.md) - Database setup and data migration
- [SDK Reference](./SDK_REFERENCE.md) - Full API documentation
- [Authentication](./AUTHENTICATION.md) - OAuth and Magic Links
- [Payments](./PAYMENTS.md) - Stripe integration
