# Workflow Initialization (initWorkflow.ts)

How to set up database schemas, seed data, and provision resources when your workflow is deployed.

## Overview

Every AIHF workflow bundle can include an **`src/initWorkflow.ts`** file. The gateway runs this function automatically during deployment (Step 9 of the bundle deployment pipeline). It is designed for:

- Creating D1 database tables and indexes
- Seeding reference data or default configuration rows
- Uploading initial files to R2 storage (templates, default assets)
- Migrating data when deploying a new version of an existing workflow

Init failure **does not** fail the deployment. The workflow is still deployed and accessible. If init fails (e.g. the tenant didn't have a D1 database attached yet), the admin can re-run it from the **admin.aihf.io Workflow Management console** at any time.

## Function Signature

```typescript
import { AIHFPlatform } from '@aihf/platform-sdk';

export async function initWorkflow(
  sdk: AIHFPlatform,
  workflowId: string,
  workflowName: string,
  workflowVersion: number
): Promise<string> {
  // Return 'success' on success
  // Return 'error: <message>' on failure
}
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `sdk` | `AIHFPlatform` | Full Platform SDK instance scoped to the deploying tenant |
| `workflowId` | `string` | Unique identifier of the deployed workflow |
| `workflowName` | `string` | The `name` field from `bundle.yaml` |
| `workflowVersion` | `number` | The `version` field from `bundle.yaml` |

**Return value:** A string. Return `'success'` when initialization completes. Return `'error: <message>'` if something fails. The gateway logs this result and surfaces it in the admin UI.

## File Location

Place the file at `src/initWorkflow.ts` in your bundle:

```
my-workflow/
├── bundle.yaml
├── config/config.json
├── src/
│   ├── initWorkflow.ts    <-- Initialization script
│   ├── api/
│   │   └── submit.ts
│   └── ui/
│       └── main.ts
```

The compiled output lands at `dist/src/initWorkflow.js`. The gateway imports it via:
```
workflows/{workflowName}/{version}/dist/src/initWorkflow.js
```

No entry in `bundle.yaml` is required. The gateway discovers `initWorkflow.js` by convention.

## When Init Runs

| Trigger | Context |
|---------|---------|
| **Bundle deployment** | Runs automatically as Step 9 after the bundle is extracted, validated, and registered. The deploying admin's entity ID is used for the SDK session. |
| **Re-run from admin.aihf.io** | The Workflow Management console shows a **"Re-run Init"** button for every deployed workflow. Clicking it calls `POST /api/admin/workflows/{workflowId}/init?version={version}` which re-executes the same function. |

Re-running is safe and expected. Design your init script to be **idempotent** — use `CREATE TABLE IF NOT EXISTS`, `INSERT OR IGNORE`, and check-before-write patterns.

## Database Initialization

The most common use case is creating D1 tables. Use `sdk.database.execute()` with `CREATE TABLE IF NOT EXISTS`:

```typescript
export async function initWorkflow(
  sdk: AIHFPlatform,
  workflowId: string,
  workflowName: string,
  workflowVersion: number
): Promise<string> {
  try {
    // Create tables
    await sdk.database.execute(workflowName, `
      CREATE TABLE IF NOT EXISTS customers (
        id TEXT PRIMARY KEY,
        email TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'active',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )
    `);

    await sdk.database.execute(workflowName, `
      CREATE TABLE IF NOT EXISTS orders (
        id TEXT PRIMARY KEY,
        customer_id TEXT NOT NULL,
        total_amount REAL NOT NULL,
        currency TEXT NOT NULL DEFAULT 'AUD',
        status TEXT NOT NULL DEFAULT 'pending',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (customer_id) REFERENCES customers(id)
      )
    `);

    // Create indexes for common query patterns
    await sdk.database.execute(workflowName,
      `CREATE INDEX IF NOT EXISTS idx_customers_email ON customers(email)`
    );
    await sdk.database.execute(workflowName,
      `CREATE INDEX IF NOT EXISTS idx_orders_customer ON orders(customer_id)`
    );
    await sdk.database.execute(workflowName,
      `CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status)`
    );

    return 'success';
  } catch (error) {
    console.error(`[${workflowName}] initWorkflow failed:`, error);
    return `error: ${error instanceof Error ? error.message : 'Unknown error'}`;
  }
}
```

### D1 (SQLite) Tips

- All types are `TEXT`, `INTEGER`, `REAL`, or `BLOB`. There is no `DATETIME` — store dates as ISO 8601 strings.
- Use `TEXT PRIMARY KEY` with application-generated UUIDs (crypto.randomUUID()).
- Foreign keys are supported but not enforced by default in SQLite. Include them for documentation.
- `CREATE INDEX IF NOT EXISTS` is idempotent and safe to re-run.

## Seeding Reference Data

Use `INSERT OR IGNORE` to seed rows that should exist from the start:

```typescript
// Seed default configuration
await sdk.database.execute(workflowName, `
  INSERT OR IGNORE INTO settings (id, key, value, created_at)
  VALUES (?, ?, ?, ?)
`, ['default-timezone', 'timezone', 'Australia/Sydney', new Date().toISOString()]);

// Seed lookup data
const categories = ['general', 'urgent', 'review', 'archive'];
for (const cat of categories) {
  await sdk.database.execute(workflowName, `
    INSERT OR IGNORE INTO categories (id, name, created_at)
    VALUES (?, ?, ?)
  `, [cat, cat.charAt(0).toUpperCase() + cat.slice(1), new Date().toISOString()]);
}
```

For bulk inserts, use `sdk.database.batch()` to run multiple statements in a single transaction:

```typescript
await sdk.database.batch(workflowName, [
  { sql: 'INSERT OR IGNORE INTO roles (id, name) VALUES (?, ?)', params: ['admin', 'Administrator'] },
  { sql: 'INSERT OR IGNORE INTO roles (id, name) VALUES (?, ?)', params: ['user', 'Standard User'] },
  { sql: 'INSERT OR IGNORE INTO roles (id, name) VALUES (?, ?)', params: ['reviewer', 'Reviewer'] },
]);
```

## File Storage Initialization (R2)

Upload default templates, assets, or configuration files to R2 during init:

```typescript
// Upload a default email template
const templateHtml = `
  <html><body>
    <h1>Welcome to {{app_name}}</h1>
    <p>Your account has been created.</p>
  </body></html>
`;
await sdk.files.upload(
  'templates/welcome-email.html',
  new TextEncoder().encode(templateHtml)
);

// Upload a default logo from a base64 string
const logoBytes = Uint8Array.from(atob(DEFAULT_LOGO_BASE64), c => c.charCodeAt(0));
await sdk.files.upload('assets/logo.png', logoBytes);
```

## Version Migrations

When deploying a new version of a workflow, use the `workflowVersion` parameter to apply schema migrations incrementally:

```typescript
export async function initWorkflow(
  sdk: AIHFPlatform,
  workflowId: string,
  workflowName: string,
  workflowVersion: number
): Promise<string> {
  try {
    // Version 1: Initial schema
    await sdk.database.execute(workflowName, `
      CREATE TABLE IF NOT EXISTS items (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        created_at TEXT NOT NULL
      )
    `);

    // Version 2: Add status column
    if (workflowVersion >= 2) {
      try {
        await sdk.database.execute(workflowName,
          `ALTER TABLE items ADD COLUMN status TEXT NOT NULL DEFAULT 'active'`
        );
      } catch (e: any) {
        // Column already exists — safe to ignore on re-run
        if (!e.message?.includes('duplicate column')) throw e;
      }
    }

    // Version 3: Add priority and index
    if (workflowVersion >= 3) {
      try {
        await sdk.database.execute(workflowName,
          `ALTER TABLE items ADD COLUMN priority INTEGER NOT NULL DEFAULT 0`
        );
      } catch (e: any) {
        if (!e.message?.includes('duplicate column')) throw e;
      }
      await sdk.database.execute(workflowName,
        `CREATE INDEX IF NOT EXISTS idx_items_priority ON items(priority)`
      );
    }

    return 'success';
  } catch (error) {
    return `error: ${error instanceof Error ? error.message : 'Unknown error'}`;
  }
}
```

### Migration Tips

- SQLite `ALTER TABLE` only supports `ADD COLUMN` and `RENAME`. To drop or change columns, create a new table, copy data, drop the old one, and rename.
- Wrap `ALTER TABLE ADD COLUMN` in try/catch — it throws if the column already exists, which happens on re-run.
- Migrations should always be additive and backwards-compatible. Existing handler code runs alongside the migration.

## Data Population from External Sources

If your workflow needs to import or sync data from an external system during setup:

```typescript
export async function initWorkflow(
  sdk: AIHFPlatform,
  workflowId: string,
  workflowName: string,
  workflowVersion: number
): Promise<string> {
  try {
    // 1. Create schema
    await sdk.database.execute(workflowName, `
      CREATE TABLE IF NOT EXISTS products (
        id TEXT PRIMARY KEY,
        sku TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL,
        price REAL NOT NULL,
        imported_at TEXT NOT NULL
      )
    `);

    // 2. Check if data already populated (idempotent)
    const existing = await sdk.database.queryOne(workflowName,
      'SELECT COUNT(*) as count FROM products'
    );
    if (existing && existing.count > 0) {
      console.log(`[${workflowName}] Products already populated (${existing.count} rows), skipping import`);
      return 'success';
    }

    // 3. Fetch from external API
    const response = await fetch('https://api.example.com/products');
    const products = await response.json();

    // 4. Batch insert
    const now = new Date().toISOString();
    const statements = products.map((p: any) => ({
      sql: 'INSERT OR IGNORE INTO products (id, sku, name, price, imported_at) VALUES (?, ?, ?, ?, ?)',
      params: [crypto.randomUUID(), p.sku, p.name, p.price, now]
    }));

    // D1 batch has a limit — chunk large imports
    const CHUNK_SIZE = 50;
    for (let i = 0; i < statements.length; i += CHUNK_SIZE) {
      await sdk.database.batch(workflowName, statements.slice(i, i + CHUNK_SIZE));
    }

    console.log(`[${workflowName}] Imported ${products.length} products`);
    return 'success';
  } catch (error) {
    return `error: ${error instanceof Error ? error.message : 'Unknown error'}`;
  }
}
```

## Re-running Init from admin.aihf.io

The **Workflow Management** page at `admin.aihf.io` displays all deployed workflows in a table. Each row has a **"Re-run Init"** button that triggers the same `initWorkflow` function.

Common reasons to re-run:

| Scenario | What Happens |
|----------|--------------|
| D1 database wasn't attached during first deploy | Init failed silently. Attach the database, then re-run. |
| Schema migration for a new version | Deploy the new bundle version, then re-run to apply migrations. |
| Seed data needs refreshing | Re-run after updating the init script to add new seed rows. |
| External data import failed | Fix the external API issue, then re-run to retry the import. |
| Testing init locally before deploy | You can't run init locally — use re-run after deploying to a test environment. |

Because init can be re-run at any time, **always write idempotent init scripts**:

- `CREATE TABLE IF NOT EXISTS` — never fails on re-run
- `CREATE INDEX IF NOT EXISTS` — never fails on re-run
- `INSERT OR IGNORE` — skips rows that already exist (by primary key or unique constraint)
- Check row counts before bulk imports
- Wrap `ALTER TABLE ADD COLUMN` in try/catch

## Multi-Part Suites

In a multi-part suite, each workflow bundle has its own `src/initWorkflow.ts`. If multiple workflows share the same database tables, designate one bundle as the schema owner (like kidweeks-calendar owns the unified kidweeks schema) and have others check for table existence rather than recreating.

```
my-product/
├── aihf-suite.yaml
├── shared/
│   └── types/
│       └── entities.ts       # Shared type definitions
└── workflows/
    ├── signup/
    │   └── src/
    │       └── initWorkflow.ts   # Creates shared schema
    ├── dashboard/
    │   └── src/
    │       └── initWorkflow.ts   # Skips if tables exist
    └── reports/
        └── src/
            └── initWorkflow.ts   # Adds report-specific tables only
```

## Available SDK Services in Init

The `sdk` parameter provides the full `AIHFPlatform` instance. During init, the most commonly used managers are:

| Manager | Use Case in Init |
|---------|------------------|
| `sdk.database.execute()` | Create tables, indexes, seed data |
| `sdk.database.batch()` | Bulk insert seed/migration data in transactions |
| `sdk.database.query()` | Check existing state before migrating |
| `sdk.files.upload()` | Upload default templates, assets, config files to R2 |
| `sdk.files.createFolder()` | Set up folder structure in R2 |

All 11 SDK managers are available, but init scripts should focus on data setup. Avoid sending emails, creating entities, or initiating OAuth flows during init.
