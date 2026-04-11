# Onboarding Workflow Example

A complete multi-step user onboarding workflow demonstrating:

- Magic link authentication
- Multi-step form collection
- Email verification
- Database operations
- Task progression

## Structure

```
onboarding-workflow/
├── bundle.yaml           # Workflow definition
├── config/
│   └── config.json       # Tenant settings
└── src/
    ├── api/
    │   ├── start-signup.ts
    │   ├── verify-email.ts
    │   ├── complete-profile.ts
    │   └── finish-onboarding.ts
    └── ui/
        ├── welcome.ts
        ├── verify.ts
        └── profile.ts
```

## Workflow Steps

1. **Welcome** (`/start`) - Initial signup form
2. **Verify Email** (`/verify`) - Email verification via magic link
3. **Profile** (`/profile`) - Collect additional information
4. **Complete** (`/complete`) - Onboarding finished

## Running the Example

```bash
# Build the workflow
aihf build

# Deploy to your tenant
aihf deploy

# Access at https://your-tenant.aihf.io/start
```

## Key Concepts Demonstrated

### Magic Link Authentication

```typescript
// Create magic link for entity verification
const magicLinkUrl = await sdk.auth.createMagicLink({
  entityId: entity.entity_id,
  workflowName,
  workflowVersion,
  stepId: 'verify',
  expiresInMinutes: 60
});

await sdk.emails.send({
  to: input.email,
  subject: 'Verify your email',
  body: `Click to verify: ${magicLinkUrl}`,
  bodyHtml: `<a href="${magicLinkUrl}">Click to verify</a>`
});
```

### Entity Lookup and Creation

```typescript
// Check if entity exists by username
const existing = await sdk.entities.findByUsername(input.email);

// Get the current authenticated entity
const entity = await sdk.entities.getCurrentEntity();

// Create a new entity
const newEntity = await sdk.entities.createEntity({
  profile: {
    username: input.email,
    type: 'human',
    email: input.email,
    full_name: input.name
  }
});
```

### Database Operations

```typescript
// Store onboarding data (insert helper)
await sdk.database.insert('onboarding', 'users', {
  entity_id: entity.entity_id,
  email: input.email,
  status: 'pending_verification',
  created_at: new Date().toISOString()
});

// Update records: update(workflowId, table, data, where, whereParams)
await sdk.database.update(workflowName, 'users',
  { status: 'verified' },
  'entity_id = ?',
  [entity.entity_id]
);

// Raw SQL query
const rows = await sdk.database.query(workflowName,
  'SELECT * FROM users WHERE status = ?',
  ['active']
);
```

### Step Data

```typescript
// Store data for downstream workflow steps
sdk.tasks.setStepData(JSON.stringify({
  entityId: entity.entity_id,
  email: input.email
}));

// Retrieve step data
const stepData = sdk.tasks.getStepData();
```
