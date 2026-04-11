# Platform SDK Reference

Complete API reference for the AIHF.io Platform SDK (v6.0.0).

## Overview

The `AIHFPlatform` SDK is passed to your handlers and provides access to all platform services:

```typescript
import { AIHFPlatform } from '@aihf/platform-sdk';

export async function invokedByAIHF(
  sdk: AIHFPlatform,
  workflowName: string,
  workflowVersion: number,
  workflowStepId: string,
  taskId: string,
  sanitisedInput: string
): Promise<Response | null> {
  // Use sdk.* to access platform services
}
```

The SDK also exposes a top-level convenience method:

```typescript
const self = await sdk.getSelfEntity();
// Returns: AIHFEntity (the current session entity)
```

## SDK Managers

| Manager | Description |
|---------|-------------|
| `sdk.entities` | User and entity management |
| `sdk.database` | D1 database operations (raw SQL) |
| `sdk.emails` | Transactional email sending |
| `sdk.billing` | Stripe payments and subscriptions |
| `sdk.auth` | Authentication (Magic Links) |
| `sdk.files` | R2 file storage (path-based) |
| `sdk.utilities` | Document, spreadsheet, PDF, image, tensor, diagram, calendar, wave, and UI tools |
| `sdk.tasks` | Workflow step data management |
| `sdk.workflows` | Workflow listing, config, and config helpers |
| `sdk.preferences` | Notification and workflow preferences |
| `sdk.credentials` | Passwords and full OAuth lifecycle |
| `sdk.containers` | Sandboxed container environments (Jupyter, Python, Node.js) |

---

## EntityManager

Manage users and entities within your workflow.

### getCurrentEntity()

Get the current authenticated user/entity from the session.

```typescript
const entity = await sdk.entities.getCurrentEntity();
// Returns: AIHFEntity | null
```

### getEntity(entityId)

Retrieve a specific entity by ID.

```typescript
const entity = await sdk.entities.getEntity('ent_abc123');
// Returns: AIHFEntity | null
```

### updateEntity(entityId, updates)

Update an existing entity.

```typescript
await sdk.entities.updateEntity('ent_abc123', {
  profile: { display_name: 'Jane Doe' },
  status: 'active'
});
```

### findByUsername(username)

Find an entity by username (typically email). Requires admin permissions.

```typescript
const entity = await sdk.entities.findByUsername('user@example.com');
// Returns: AIHFEntity | null
```

### createEntity(data)

Create a new entity. Requires admin permissions. Accepts `Partial<AIHFEntity>`.

```typescript
const newEntity = await sdk.entities.createEntity({
  profile: {
    username: 'user@example.com',
    type: 'human',
    email: 'user@example.com',
    full_name: 'John Doe'
  },
  roles: [{ name: 'member' }],
  groups: ['default']
});
// Returns: AIHFEntity
```

### selfRegisterEntity(data, jitContext)

Self-register an entity for JIT (Just-In-Time) provisioning via OAuth/SAML. Requires a valid JIT context from an OAuth callback flow.

```typescript
const entity = await sdk.entities.selfRegisterEntity(
  {
    username: 'user@example.com',
    email: 'user@example.com',
    displayName: 'John Doe',
    oauthProvider: 'google',
    oauthSub: '1234567890'
  },
  {
    tenantId: 'tenant_abc',
    validatedByOAuthCallback: true
  }
);
// Returns: AIHFEntity
```

### AIHFEntity Type

```typescript
interface AIHFEntity {
  entity_id: string;
  tenant_id: string;
  locked_until?: number;
  status: 'active' | 'suspended' | 'pending';
  disable_password_credential?: boolean;
  active_subscription?: boolean;
  credentials: AIHFEntityCredentials[];
  sessions?: string[];
  roles: AIHFRole[];
  groups: string[];
  profile: AIHFEntityProfile;
  payment_info: AIHFEntityPaymentInfo[];
  created_at: number;
  created_by: string;
  last_login?: number;
  last_updated: number;
}

interface AIHFEntityProfile {
  username: string;
  type: 'human' | 'ai';
  email?: string;
  full_name?: string;
  display_name?: string;
  avatar_url?: string;
  mobile_number?: string;
  time_zone?: string;
  language?: string;
  manager_id?: string;
  department?: string;
  cost_center?: string;
  employee_id?: string;
  gateway_id?: string;
  social?: {
    slack?: string;
    linkedin?: string;
    github?: string;
    reddit?: string;
    discord?: string;
    face?: string;
    insta?: string;
    custom?: string;
  };
  description?: string;
  capabilities?: string[];
}

interface AIHFRole {
  name: string;
  domain?: string;
  permissions?: string[];
}
```

---

## DatabaseManager

Raw SQL access to Cloudflare D1 databases with tenant isolation. All operations require a `workflowId` as the first parameter for database scoping.

### query(workflowId, sql, params?)

Execute a SQL query. Returns all rows.

```typescript
const users = await sdk.database.query(
  'my-workflow',
  'SELECT * FROM users WHERE status = ?',
  ['active']
);
// Returns: any[] (array of row objects)
```

### queryOne(workflowId, sql, params?)

Execute a SQL query and return the first row only. Returns `null` if no results.

```typescript
const user = await sdk.database.queryOne(
  'my-workflow',
  'SELECT * FROM users WHERE email = ?',
  ['user@example.com']
);
// Returns: any | null
```

### execute(workflowId, sql, params?)

Execute a SQL statement (INSERT, UPDATE, DELETE). Returns metadata.

```typescript
const result = await sdk.database.execute(
  'my-workflow',
  'INSERT INTO users (email, name, created_at) VALUES (?, ?, ?)',
  ['user@example.com', 'John Doe', Date.now()]
);
// Returns: {
//   success: boolean;
//   meta: {
//     rows_written?: number;
//     rows_read?: number;
//     duration?: number;
//     last_row_id?: number;
//     changes?: number;
//   };
// }
```

### batch(workflowId, statements)

Execute multiple SQL statements in a transaction.

```typescript
const result = await sdk.database.batch('my-workflow', [
  { sql: 'INSERT INTO users (email, name) VALUES (?, ?)', params: ['a@b.com', 'Alice'] },
  { sql: 'INSERT INTO users (email, name) VALUES (?, ?)', params: ['c@d.com', 'Bob'] }
]);
// Returns: { success: boolean; results: any[] }
```

### dump(workflowId)

Dump the entire database contents.

```typescript
const buffer = await sdk.database.dump('my-workflow');
// Returns: ArrayBuffer
```

### insert(workflowId, table, data)

Helper: Insert a record. Returns `last_row_id` or `null`.

```typescript
const rowId = await sdk.database.insert('my-workflow', 'users', {
  email: 'user@example.com',
  name: 'John Doe',
  created_at: Date.now()
});
// Returns: number | null
```

### update(workflowId, table, data, where, whereParams)

Helper: Update records. Returns number of changes.

```typescript
const changes = await sdk.database.update(
  'my-workflow',
  'users',
  { status: 'inactive', updated_at: Date.now() },
  'id = ?',
  ['user_123']
);
// Returns: number
```

### delete(workflowId, table, where, whereParams)

Helper: Delete records. Returns number of changes.

```typescript
const changes = await sdk.database.delete(
  'my-workflow',
  'users',
  'status = ?',
  ['deleted']
);
// Returns: number
```

### upsert(workflowId, table, data, conflictColumns)

Helper: Upsert a record (INSERT or UPDATE on conflict). Returns number of changes.

```typescript
const changes = await sdk.database.upsert(
  'my-workflow',
  'users',
  { email: 'user@example.com', name: 'John Doe', status: 'active' },
  ['email']
);
// Returns: number
```

---

## TaskManager

Workflow step data management. Provides a minimal API for storing and retrieving data associated with the current workflow step.

### setStepData(stepData)

Set step data for the current workflow step.

```typescript
sdk.tasks.setStepData(JSON.stringify({ progress: 50, lastAction: 'email_verified' }));
```

### getStepData()

Get step data for the current workflow step.

```typescript
const raw = sdk.tasks.getStepData();
// Returns: string | undefined
if (raw) {
  const data = JSON.parse(raw);
}
```

### getTask(taskId)

Get a task by its ID.

```typescript
const task = await sdk.tasks.getTask('task_abc123');
// Returns: any
```

---

## WorkflowManager

Access workflow listing, configuration, and metadata.

### listWorkflows()

List available workflows.

```typescript
const workflows = await sdk.workflows.listWorkflows();
// Returns: any[]
```

### getWorkflow(workflowId, version)

Get a specific workflow by ID and version.

```typescript
const workflow = await sdk.workflows.getWorkflow('my-workflow', 1);
// Returns: any
```

### getWorkflowConfig(nameOrId, version)

Get workflow configuration as a raw JSON string.

```typescript
const configJson = await sdk.workflows.getWorkflowConfig('my-workflow', 1);
// Returns: string (raw JSON)
```

### getWorkflowConfigHelper(nameOrId, version)

Get workflow configuration wrapped in a `WorkflowConfigHelper` for typed access to field values.

```typescript
const config = await sdk.workflows.getWorkflowConfigHelper('my-workflow', 1);

const apiUrl = config.getString('api_base_url', 'https://api.example.com');
const maxRetries = config.getNumber('max_retries', 3);
const darkMode = config.getBoolean('features.darkMode', false);
const selectedTags = config.getArray<string>('tags', []);

if (config.hasField('custom_setting')) {
  const value = config.get('custom_setting', 'default');
}

const allFieldIds = config.getFieldIds();
const rawData = config.getRawConfig();
```

### WorkflowConfigHelper

```typescript
class WorkflowConfigHelper {
  constructor(configJson: string);

  get<T>(fieldId: string, defaultValue: T): T;
  getString(fieldId: string, defaultValue?: string): string;
  getNumber(fieldId: string, defaultValue?: number): number;
  getBoolean(fieldId: string, defaultValue?: boolean): boolean;
  getArray<T>(fieldId: string, defaultValue?: T[]): T[];
  hasField(fieldId: string): boolean;
  getRawConfig(): WorkflowConfigData;
  getFieldIds(): string[];
}
```

---

## EmailManager

Send transactional emails through the platform.

### send(request)

Send an email using the `EmailSendRequest` interface.

```typescript
const result = await sdk.emails.send({
  to: 'user@example.com',           // string or string[]
  cc: ['manager@example.com'],      // optional
  bcc: ['audit@example.com'],       // optional
  subject: 'Welcome to Our App',
  body: 'Welcome! Thanks for signing up.',
  bodyHtml: '<h1>Welcome!</h1><p>Thanks for signing up.</p>',
  fromName: 'ACME Support',         // optional
  replyTo: 'support@example.com',   // optional
  priority: 'normal',               // 'high' | 'normal' | 'low'
  templateType: 'welcome',          // optional
  templateData: { name: 'John' },   // optional
  attachments: [{                   // optional
    filename: 'invoice.pdf',
    content: pdfBuffer,
    contentType: 'application/pdf',
    size: 12345
  }],
  metadata: { campaign: 'onboarding' } // optional
});
// Returns: EmailSendResult { success: boolean; email_id?: string; error?: string }
```

### sendPasswordReset(toEmail, recipientName, resetUrl)

Send a password reset email using the `password_reset` template.

```typescript
await sdk.emails.sendPasswordReset(
  'user@example.com',
  'John Doe',
  'https://app.example.com/reset?token=abc123'
);
```

### sendEmailVerification(toEmail, recipientName, verificationUrl)

Send an email verification email using the `verification` template.

```typescript
await sdk.emails.sendEmailVerification(
  'user@example.com',
  'John Doe',
  'https://app.example.com/verify?token=abc123'
);
```

### sendWelcomeEmail(toEmail, recipientName, supportEmail)

Send a welcome email using the `welcome` template.

```typescript
await sdk.emails.sendWelcomeEmail(
  'user@example.com',
  'John Doe',
  'support@example.com'
);
```

### sendTaskAssignedEmail(toEmail, taskDetails)

Send a task assignment notification email using the `task_assigned` template.

```typescript
await sdk.emails.sendTaskAssignedEmail('user@example.com', {
  recipientName: 'John Doe',
  taskTitle: 'Review Document',
  workflowName: 'Document Approval',
  dueDate: '2026-02-15',
  taskUrl: 'https://app.example.com/tasks/task_123',
  unsubscribeUrl: 'https://app.example.com/unsubscribe'
});
```

### sendWorkflowCompleteEmail(toEmail, workflowDetails)

Send a workflow completion notification email using the `workflow_complete` template.

```typescript
await sdk.emails.sendWorkflowCompleteEmail('user@example.com', {
  recipientName: 'John Doe',
  workflowName: 'Document Approval',
  status: 'approved',
  completedDate: '2026-02-10',
  workflowUrl: 'https://app.example.com/workflows/wf_123',
  unsubscribeUrl: 'https://app.example.com/unsubscribe'
});
```

---

## CredentialsManager

Full OAuth lifecycle management and password operations.

### changeSelfPassword(newPassword)

Change the current entity's password.

```typescript
await sdk.credentials.changeSelfPassword('newSecurePassword123!');
```

### initiateOAuth(provider, redirectUri, options?)

Initiate an OAuth flow. Returns an authorization URL and state token.

```typescript
const { authorizationUrl, state } = await sdk.credentials.initiateOAuth(
  'google',                                      // 'google' | 'apple' | 'entraid'
  'https://app.example.com/oauth/callback',
  {
    entityId: 'ent_abc123',                      // optional
    expectedEmail: 'user@example.com',           // optional
    workflowContext: 'onboarding'                // optional
  }
);
// Returns: InitiateOAuthResponse { authorizationUrl: string; state: string }

return Response.redirect(authorizationUrl, 302);
```

### completeOAuth(provider, code, state)

Complete an OAuth flow after the callback. Requires admin permissions.

```typescript
const result = await sdk.credentials.completeOAuth('google', code, state);
// Returns: CompleteOAuthResponse {
//   success: boolean;
//   entityId?: string;
//   isNewEntity?: boolean;
//   email?: string;
//   error?: string;
//   errorCode?: string;
// }
```

### linkOAuthCredential(entityId, provider, code, redirectUri, expectedEmail?)

Link an OAuth provider to an existing entity.

```typescript
const result = await sdk.credentials.linkOAuthCredential(
  'ent_abc123',
  'google',
  authCode,
  'https://app.example.com/oauth/callback',
  'user@example.com'
);
// Returns: LinkOAuthResponse {
//   success: boolean;
//   verifiedEmail?: string;
//   error?: string;
//   errorCode?: string;
// }
```

### createIdentityWithOAuth(provider, claims, profileData?)

Create a new entity with OAuth authentication. Requires admin permissions.

```typescript
const result = await sdk.credentials.createIdentityWithOAuth(
  'google',
  {
    sub: '1234567890',
    email: 'user@example.com',
    emailVerified: true,
    name: 'John Doe',
    picture: 'https://example.com/photo.jpg'
  },
  {
    displayName: 'John D.',
    metadata: { source: 'oauth-signup' }
  }
);
// Returns: CreateEntityWithOAuthResponse { entityId: string; email?: string }
```

### getLinkedOAuthProviders(entityId?)

Get OAuth providers linked to an entity.

```typescript
const providers = await sdk.credentials.getLinkedOAuthProviders('ent_abc123');
// Returns: Array<{ provider: OAuthProvider; email?: string; name?: string; linkedAt: string }>
```

### unlinkOAuthProvider(provider, entityId?)

Unlink an OAuth provider from an entity.

```typescript
await sdk.credentials.unlinkOAuthProvider('google', 'ent_abc123');
```

---

## AuthManager

Authentication utilities for Magic Links.

### createMagicLink(options)

Generate a magic link for an entity to access a specific workflow step. Requires admin permissions.

```typescript
const magicLink = await sdk.auth.createMagicLink({
  entityId: 'ent_abc123',
  workflowName: 'onboarding',
  workflowVersion: 1,
  stepId: 'verify-email',
  expiresInMinutes: 60,                          // optional
  metadata: { source: 'signup' },                 // optional
  queryParams: { returnTo: '/dashboard' }         // optional
});
// Returns: string | null (the magic link URL)

// Send via email
await sdk.emails.send({
  to: 'user@example.com',
  subject: 'Your Login Link',
  body: 'Click to login',
  bodyHtml: `<a href="${magicLink}">Click to login</a>`
});
```

---

## FileManager

Path-based R2 file storage operations.

### list(folderPath, options?)

List files in a folder.

```typescript
const files = await sdk.files.list('documents/', { prefix: 'report', limit: 20 });
// Returns: FileMetadata[]
```

### getMetadata(filePath)

Get metadata for a specific file.

```typescript
const metadata = await sdk.files.getMetadata('documents/report.pdf');
// Returns: FileMetadata | null
// FileMetadata: { path: string; name: string; size: number; modified: Date; isDirectory: boolean }
```

### download(filePath)

Download a file. Returns a ReadableStream or `null`.

```typescript
const stream = await sdk.files.download('documents/report.pdf');
// Returns: ReadableStream<Uint8Array> | null
```

### upload(filePath, content)

Upload a file. Only allowed in the `app/` folder.

```typescript
await sdk.files.upload('app/documents/report.pdf', fileBuffer);
// content: ArrayBuffer | ReadableStream
```

### delete(filePath)

Delete a file. Only allowed in the `app/` folder.

```typescript
await sdk.files.delete('app/documents/report.pdf');
```

### createFolder(folderPath)

Create a folder. Only allowed in the `app/` folder.

```typescript
await sdk.files.createFolder('app/documents/invoices');
```

### deleteFolder(folderPath)

Delete a folder and all its contents. Only allowed in the `app/` folder.

```typescript
await sdk.files.deleteFolder('app/documents/old');
```

### search(folderPath, searchTerm)

Search for files by filename.

```typescript
const results = await sdk.files.search('documents/', 'report');
// Returns: FileMetadata[]
```

### getRootFolders()

Get the list of root folders available to this tenant.

```typescript
const roots = await sdk.files.getRootFolders();
// Returns: Array<{ name: string; path: string; permissions: FolderPermissions }>
// FolderPermissions: { canRead: boolean; canWrite: boolean; canDelete: boolean; canCreateFolders: boolean }
```

---

## PreferencesManager

Entity notification and workflow preference management.

### getNotificationPreferences(entityId?)

Get entity notification preferences.

```typescript
const prefs = await sdk.preferences.getNotificationPreferences();
// Returns: NotificationPreferences
// {
//   inApp: {
//     enabled: boolean;
//     showBadge: 'always' | 'when_over_5' | 'never';
//     types: {
//       taskAssigned: boolean;
//       taskStatusChanged: boolean;
//       workerRequestedInfo: boolean;
//       workerCompleted: boolean;
//       customerSubmitted: boolean;
//       systemAnnouncements: boolean;
//       workflowUpdates: boolean;
//     };
//   };
//   frequency: 'realtime' | 'every_15_min' | 'hourly' | 'daily' | 'never';
//   doNotDisturb: { enabled: boolean; hours: { start: string; end: string }; days: number[] };
//   email: { enabled: boolean };
// }
```

### updateNotificationPreferences(updates, entityId?)

Update entity notification preferences (partial updates supported).

```typescript
await sdk.preferences.updateNotificationPreferences({
  frequency: 'hourly',
  email: { enabled: false }
});
```

### getWorkflowPreferences(entityId?)

Get entity workflow preferences.

```typescript
const prefs = await sdk.preferences.getWorkflowPreferences();
// Returns: WorkflowPreferences
// {
//   favorites: string[];
//   hidden: string[];
//   defaultWorkflow: string | null;
//   customOrder: string[];
// }
```

### updateWorkflowPreferences(updates, entityId?)

Update entity workflow preferences (partial updates supported).

```typescript
await sdk.preferences.updateWorkflowPreferences({
  favorites: ['workflow-1', 'workflow-2'],
  defaultWorkflow: 'workflow-1'
});
```

---

## BillingManager

Stripe payment and subscription management.

### createCheckoutSession(options)

Create a Stripe Checkout session for subscription signup.

```typescript
const checkout = await sdk.billing.createCheckoutSession({
  entityId: 'ent_abc123',
  planId: 'plan_monthly',
  successUrl: 'https://app.example.com/success',
  cancelUrl: 'https://app.example.com/cancel'
});
// Returns: { checkoutUrl: string; sessionId: string }

return Response.redirect(checkout.checkoutUrl, 302);
```

### getSubscription(entityId?)

Get the current subscription for an entity.

```typescript
const subscription = await sdk.billing.getSubscription();
// Returns: AIHFSubscription | null

// AIHFSubscription structure:
// {
//   subscription_id: string;
//   tenant_id: string;
//   entity_id: string;
//   stripe_subscription_id: string;
//   stripe_customer_id: string;
//   status: 'active' | 'past_due' | 'canceled' | 'trialing' | 'paused';
//   plan: AIHFSubscriptionPlan;
//   current_period_start: number;
//   current_period_end: number;
//   cancel_at_period_end: boolean;
//   canceled_at?: number;
//   trial_end?: number;
//   metadata: Record<string, string>;
//   created_at: number;
//   updated_at: number;
// }
```

### createPortalSession(returnUrl)

Create a Stripe Customer Portal session for subscription management.

```typescript
const portalUrl = await sdk.billing.createPortalSession(
  'https://app.example.com/billing'
);
// Returns: string (portal URL)

return Response.redirect(portalUrl, 302);
```

### listPlans()

List available subscription plans.

```typescript
const plans = await sdk.billing.listPlans();
// Returns: AIHFSubscriptionPlan[]

// AIHFSubscriptionPlan structure:
// {
//   plan_id: string;
//   tenant_id: string;
//   name: string;
//   description?: string;
//   stripe_product_id: string;
//   stripe_price_id: string;
//   amount: number;
//   currency: string;
//   interval: 'day' | 'week' | 'month' | 'year';
//   interval_count: number;
//   usage_type: 'licensed' | 'metered';
//   features: string[];
//   is_active: boolean;
//   created_at: number;
//   updated_at: number;
// }
```

---

## ContainersManager

Sandboxed compute containers (Jupyter, Python, Node.js). See [Containers](./CONTAINERS.md) for the full guide with lifecycle diagrams and complete examples.

### Lifecycle Methods (8)

#### launch(config)

Launch a new container session.

```typescript
const session = await sdk.containers.launch({
  image: 'jupyter-science',
  taskId: 'task_abc123',
  blockId: 'jupyter-block',
  envVars: { MODEL: 'gpt-4' },
});
// Returns: ContainerSession { sessionId, status, orgId, entityId, ... }
```

#### writeFiles(sessionId, files)

Write files into the container's `/workspace` directory.

```typescript
await sdk.containers.writeFiles(sessionId, [
  { path: 'notebook.ipynb', content: notebookJson },
  { path: 'data.csv', content: csvData },
  { path: 'image.png', content: base64Data, encoding: 'base64' },
]);
```

#### proxy(sessionId, request)

Proxy an HTTP or WebSocket request to the container's application port.

```typescript
return sdk.containers.proxy(sessionId, request);
// Returns: Response
```

#### status(sessionId)

Get the current status of a container session.

```typescript
const status = await sdk.containers.status(sessionId);
// Returns: ContainerStatus { sessionId, state, bootstrapReady, appReady, lastHeartbeat, cpuUsagePct?, memoryUsageMb? }
```

#### installRequirements(sessionId, cfg)

Install Python packages inside the container via pip.

```typescript
const result = await sdk.containers.installRequirements(sessionId, {
  requirements: ['numpy', 'pandas==2.1.0'],
  timeoutSeconds: 300,
});
// Returns: RequirementsInstallResult { success, installed, failed, stdout, stderr }
```

#### disableInternet(sessionId)

Disable network egress from the container. Call after `installRequirements()`.

```typescript
await sdk.containers.disableInternet(sessionId);
```

#### signalReady(sessionId)

Signal the bootstrap service to start the application (e.g., Jupyter on port 8888).

```typescript
await sdk.containers.signalReady(sessionId);
```

#### stop(sessionId)

Stop the container and free the Durable Object. Idempotent.

```typescript
await sdk.containers.stop(sessionId);
```

### Kernel Methods (7)

#### connectKernel(sessionId)

Connect to the Jupyter kernel. Creates a kernel if none exists.

```typescript
const { kernelId, state } = await sdk.containers.connectKernel(sessionId);
// Returns: KernelConnectResult { kernelId, state }
```

#### execute(sessionId, code)

Submit code for execution on the kernel.

```typescript
const { executionId } = await sdk.containers.execute(sessionId, 'print(1+1)');
// Returns: KernelExecuteResult { executionId }
```

#### getOutput(sessionId, cursor)

Read kernel output messages since the given cursor.

```typescript
const batch = await sdk.containers.getOutput(sessionId, lastCursor);
for (const msg of batch.messages) { handle(msg); }
lastCursor = batch.cursor;
// Returns: KernelOutputBatch { messages: KernelMessage[], cursor, kernelState }
```

#### interrupt(sessionId)

Interrupt the currently executing cell.

```typescript
await sdk.containers.interrupt(sessionId);
```

#### complete(sessionId, code, cursorPos)

Request tab completion from the kernel.

```typescript
const { matches } = await sdk.containers.complete(sessionId, 'np.arr', 6);
// Returns: KernelCompleteResult { matches, cursorStart, cursorEnd }
```

#### kernelStatus(sessionId)

Get kernel status including output buffer size.

```typescript
const { kernelId, state, bufferSize } = await sdk.containers.kernelStatus(sessionId);
// Returns: KernelStatusResult { kernelId, state, bufferSize }
```

#### pruneOutput(sessionId, cursor)

Prune the output buffer up to the given cursor. Call periodically to bound storage.

```typescript
await sdk.containers.pruneOutput(sessionId, lastAcknowledgedCursor);
```

---

## UtilitiesManager

Rich document, data, and UI processing tools. The UtilitiesManager exposes 9 sub-managers:

| Sub-manager | Access | Description |
|-------------|--------|-------------|
| Documents | `sdk.utilities.documents` | Parse DOCX, RTF, HTML, TXT |
| Spreadsheets | `sdk.utilities.spreadsheets` | Parse XLSX, XLS, CSV, ODS; convert to CSV |
| PDFs | `sdk.utilities.pdfs` | Extract pages, validate, convert to base64 |
| Images | `sdk.utilities.images` | Metadata, format detection, annotations |
| Tensors | `sdk.utilities.tensors` | Analyze, reshape, convert tensor data |
| Diagrams | `sdk.utilities.diagrams` | Mermaid/SVG diagrams, flowcharts, sequence diagrams |
| Calendar | `sdk.utilities.calendar` | Month grids, date math, formatting |
| Waves | `sdk.utilities.waves` | Signal processing, FFT, peaks, comparison |
| UI | `sdk.utilities.ui` | HTML fragment generation for all UI components |

### Documents (`sdk.utilities.documents`)

```typescript
const parsed = await sdk.utilities.documents.parse(fileBuffer, 'docx');
// format: 'docx' | 'rtf' | 'html' | 'txt'
// Returns: DocumentParseResult {
//   html: string;
//   text: string;
//   metadata: { title?, author?, createdAt?, modifiedAt?, pageCount?, wordCount? };
//   messages?: Array<{ type: 'warning' | 'info'; message: string }>;
// }
```

### Spreadsheets (`sdk.utilities.spreadsheets`)

```typescript
const parsed = await sdk.utilities.spreadsheets.parse(fileBuffer, 'xlsx');
// format: 'xlsx' | 'xls' | 'csv' | 'ods'
// Returns: SpreadsheetParseResult {
//   sheets: Array<{
//     name: string;
//     data: CellValue[][];
//     headers?: string[];
//     rowCount: number;
//     columnCount: number;
//   }>;
//   metadata: { sheetCount: number; author?; createdAt?; modifiedAt? };
// }

const csvString = sdk.utilities.spreadsheets.toCSV(data, headers);
```

### PDFs (`sdk.utilities.pdfs`)

```typescript
const result = await sdk.utilities.pdfs.extractPages(pdfBuffer);
// Returns: PDFExtractResult {
//   pages: Array<{ pageNumber: number; text: string; width: number; height: number }>;
//   metadata: { pageCount, title?, author?, subject?, creator?, producer?, createdAt?, modifiedAt? };
// }

const isValid = sdk.utilities.pdfs.isValidPdf(buffer);
const base64 = sdk.utilities.pdfs.toBase64(buffer);
```

### Images (`sdk.utilities.images`)

```typescript
const metadata = await sdk.utilities.images.getMetadata(imageBuffer);
// Returns: ImageMetadataResult { format, width, height, size, hasAlpha?, exif? }

const format = sdk.utilities.images.detectFormat(buffer);
// Returns: 'png' | 'jpg' | 'jpeg' | 'gif' | 'webp' | 'svg'

const dataUrl = sdk.utilities.images.toDataUrl(buffer, 'png');
const json = sdk.utilities.images.serializeAnnotations(annotations);
const annotations = sdk.utilities.images.deserializeAnnotations(json);
```

### Tensors (`sdk.utilities.tensors`)

```typescript
const analysis = await sdk.utilities.tensors.analyze(tensorData);
// Returns: TensorAnalysisResult {
//   shape: number[];
//   dtype: TensorDataType;
//   stats: { min, max, mean, std, sum, nonZeroCount };
//   histogram?: { bins: number[]; counts: number[] };
// }

const reshaped = sdk.utilities.tensors.reshape(tensorData, [3, 4]);
const array2d = sdk.utilities.tensors.to2DArray(tensorData);
const tensor = sdk.utilities.tensors.from2DArray([[1, 2], [3, 4]], 'float32');
```

### Diagrams (`sdk.utilities.diagrams`)

```typescript
const result = await sdk.utilities.diagrams.create({
  format: 'mermaid',  // 'mermaid' | 'svg'
  source: 'graph TD; A-->B; B-->C;'
});
// Returns: DiagramCreateResult { svg: string; bounds: { width, height } }

const validation = sdk.utilities.diagrams.validateMermaidSyntax(source);
// Returns: { valid: boolean; error?: string }

const flowchartSource = sdk.utilities.diagrams.generateFlowchart(
  [{ id: 'A', label: 'Start', shape: 'round' }, { id: 'B', label: 'End' }],
  [{ from: 'A', to: 'B', label: 'next' }]
);

const sequenceSource = sdk.utilities.diagrams.generateSequenceDiagram(
  ['Client', 'Server'],
  [{ from: 'Client', to: 'Server', text: 'Request', type: 'sync' }]
);
```

### Calendar (`sdk.utilities.calendar`)

```typescript
const grid = sdk.utilities.calendar.buildMonthGrid(2026, 2, {
  events: [{ id: '1', date: '2026-02-14', title: 'Valentine\'s Day', category: 'social' }],
  teamMap: { '2026-02-10': { team: 'A', color: '#3b82f6' } },
  selectedDates: ['2026-02-10'],
  firstDayOfWeek: 1
});
// Returns: CalendarMonthGrid { year, month, monthName, weeks: CalendarDay[][] }

const weekdays = sdk.utilities.calendar.getWeekdayNames(true, 1);
const monthName = sdk.utilities.calendar.getMonthName(2);
const isoDate = sdk.utilities.calendar.toISODate(new Date());
const inRange = sdk.utilities.calendar.isDateInRange('2026-02-10', '2026-02-01', '2026-02-28');
const days = sdk.utilities.calendar.daysBetween('2026-02-01', '2026-02-28');
const newDate = sdk.utilities.calendar.addDays('2026-02-10', 7);
const formatted = sdk.utilities.calendar.formatDate('2026-02-10', 'DD MMM YYYY');
```

### Waves (`sdk.utilities.waves`)

Comprehensive signal processing utility.

```typescript
// Normalization and arithmetic
const { normalized, min, max } = sdk.utilities.waves.normalize(waveData);
const scaled = sdk.utilities.waves.scale(wave, 2.0);
const shifted = sdk.utilities.waves.offset(wave, 0.5);
const sum = sdk.utilities.waves.add(waveA, waveB);
const diff = sdk.utilities.waves.subtract(waveA, waveB);
const product = sdk.utilities.waves.multiply(waveA, waveB);
const inverted = sdk.utilities.waves.invert(wave);
const clipped = sdk.utilities.waves.clip(wave, -1, 1);

// Resampling
const downsampled = sdk.utilities.waves.downsample(wave, 100, 'average');
const upsampled = sdk.utilities.waves.upsample(wave, 1000);
const resampled = sdk.utilities.waves.resample(wave, 500);

// Filtering and smoothing
const smoothed = sdk.utilities.waves.movingAverage(wave, 5);
const emaResult = sdk.utilities.waves.ema(wave, 0.3);
const gaussian = sdk.utilities.waves.gaussianSmooth(wave, 1.5);
const convolved = sdk.utilities.waves.convolve(wave, kernel);
const centered = sdk.utilities.waves.removeDC(wave);

// Calculus
const deriv = sdk.utilities.waves.derivative(wave);
const integ = sdk.utilities.waves.integral(wave);

// Frequency analysis
const fftResult = sdk.utilities.waves.fft(wave, 44100);
// Returns: WaveFFTResult { magnitudes, phases, frequencies? }
const reconstructed = sdk.utilities.waves.ifft(magnitudes, phases);

// Comparison and correlation
const metrics = sdk.utilities.waves.compare(waveA, waveB);
// Returns: WaveComparisonMetrics { correlation, rmse, maxDeviation, areaBetween }
const r = sdk.utilities.waves.pearsonCorrelation(waveA, waveB);
const error = sdk.utilities.waves.rmse(waveA, waveB);

// Peak and valley detection
const peaks = sdk.utilities.waves.findPeaks(wave, { minProminence: 0.1, maxPeaks: 10 });
const valleys = sdk.utilities.waves.findValleys(wave, { minProminence: 0.1 });
// Returns: WavePeakInfo[] { index, value, prominence }

// Alignment
const alignment = sdk.utilities.waves.align(waveA, waveB);
// Returns: WaveAlignmentResult { aligned, offset, correlation }
const xcorr = sdk.utilities.waves.crossCorrelation(waveA, waveB);

// Statistics
const s = sdk.utilities.waves.stats(wave);
// Returns: { min, max, mean, std, rms, energy }

// Wave generation
const sine = sdk.utilities.waves.sine(1024, 440, 44100, 1.0, 0);
const square = sdk.utilities.waves.square(1024, 440);
const saw = sdk.utilities.waves.sawtooth(1024, 440);
const white = sdk.utilities.waves.noise(1024, 0.5);
```

### UI Fragments (`sdk.utilities.ui`)

Generate HTML fragments for rich UI components. Each method returns an HTML string.

```typescript
// Document editor
const html = sdk.utilities.ui.documentEditor({
  content: '<p>Hello world</p>',
  editable: true,
  theme: 'full',
  toolbar: true
});

// Spreadsheet viewer
const html = sdk.utilities.ui.spreadsheetViewer({
  data: [['Name', 'Age'], ['John', 30]],
  headers: ['Name', 'Age'],
  sortable: true,
  filterable: true
});

// PDF viewer
const html = sdk.utilities.ui.pdfViewer({
  data: pdfBase64OrBuffer,
  showNavigation: true,
  showZoomControls: true
});

// Image annotator
const html = sdk.utilities.ui.imageAnnotator({
  src: 'https://example.com/image.png',
  editable: true,
  tools: ['rectangle', 'arrow', 'text']
});

// Tensor explorer
const html = sdk.utilities.ui.tensorExplorer({
  tensor: tensorData,
  visualization: 'heatmap',
  colorScale: 'viridis'
});

// Diagram builder
const html = sdk.utilities.ui.diagramBuilder({
  source: 'graph TD; A-->B;',
  format: 'mermaid',
  editable: true,
  showEditor: true
});

// Calendar
const html = sdk.utilities.ui.calendar({
  viewMode: 'month',
  selectionMode: 'single',
  events: calendarEvents,
  showNavigation: true,
  showLegend: true
});

// Date range picker
const html = sdk.utilities.ui.dateRangePicker({
  mode: 'dropdown',
  showTwoMonths: true,
  presets: [{ label: 'Last 7 days', startOffset: -7, endOffset: 0 }]
});

// Wave viewer
const html = sdk.utilities.ui.waveViewer({
  waves: [{ data: waveData, label: 'Signal A', color: '#3b82f6', style: 'line' }],
  showGrid: true,
  showLegend: true,
  interactive: true,
  showPeaks: true
});

// Bottom tabs
const html = sdk.utilities.ui.bottomTabs({
  tabs: [
    { id: 'home', label: 'Home', icon: 'home', active: true },
    { id: 'tasks', label: 'Tasks', icon: 'check-circle', badge: 3 }
  ]
});

// Slideover panel
const html = sdk.utilities.ui.slideover({
  title: 'Details',
  content: '<p>Panel content</p>',
  position: 'right',
  open: true
});

// Toast notifications
const containerHtml = sdk.utilities.ui.toastContainer({ position: 'top-right', maxToasts: 5 });
const toastHtml = sdk.utilities.ui.toast({ message: 'Saved!', type: 'success', duration: 3000 });

// Payment UI components
const checkoutHtml = sdk.utilities.ui.checkoutButton({
  planId: 'plan_monthly',
  planName: 'Pro Monthly',
  price: '$9.99',
  interval: 'month'
});

const portalHtml = sdk.utilities.ui.subscriptionPortalButton({
  returnUrl: 'https://app.example.com/billing',
  buttonText: 'Manage Subscription'
});

const statusHtml = sdk.utilities.ui.subscriptionStatus({
  subscription: { status: 'active', planName: 'Pro', currentPeriodEnd: '2026-03-10' },
  showManageButton: true,
  returnUrl: 'https://app.example.com/billing'
});

// Get component styles
const css = sdk.utilities.ui.getStylesheet('calendar');
const inlineCss = sdk.utilities.ui.getInlineStyles('wave-viewer');
```

---

## Error Handling

All SDK methods throw `PlatformError` on failure:

```typescript
import { PlatformError } from '@aihf/platform-sdk';

try {
  await sdk.billing.createCheckoutSession({ ... });
} catch (error) {
  if (error instanceof PlatformError) {
    console.error(`Error ${error.code}: ${error.message}`);
    // error.code: string (e.g. 'AUTH_REQUIRED', 'NOT_FOUND', 'PERMISSION_DENIED')
    // error.details?: any (additional context)
  }
}
```

---

## Handler Function Signatures

The platform invokes your workflow code using four handler signatures:

### APIHandler

Called when a workflow step API endpoint is invoked.

```typescript
export type APIHandler = (
  sdk: AIHFPlatform,
  workflowName: string,
  workflowVersion: number,
  workflowStepId: string,
  taskId: string,
  sanitisedInput: string
) => Promise<Response | null>;
```

### UIHandler

Called when a workflow step UI needs to be rendered.

```typescript
export type UIHandler = (
  sdk: AIHFPlatform,
  workflowName: string,
  workflowVersion: number,
  stepRoute: string,
  taskId: string
) => Promise<Response | null>;
```

### GetNextAIHFStepId

Called when a step condition has `target_dynamic=true`. Returns the next step ID based on workflow state.

```typescript
export type GetNextAIHFStepId = (
  sdk: AIHFPlatform,
  workflowName: string,
  workflowVersion: number,
  workflowStepId: string,
  taskId: string,
  sanitisedInput: string
) => Promise<string>;
```

### InitWorkflow

Called once when a workflow bundle is first deployed. Used for database table creation, seed data, etc.

```typescript
export type InitWorkflow = (
  sdk: AIHFPlatform,
  workflowId: string,
  workflowName: string,
  workflowVersion: number
) => Promise<string>;
```

---

## Workflow Schema Types

Types for `workflow.yaml`, `bundle.yaml`, and `config.json` definitions.

### WorkflowDefinition (workflow.yaml)

```typescript
interface WorkflowDefinition {
  id: string;
  name: string;
  internal?: boolean;
  metadata: WorkflowMetadata;
  status: {
    enabled: boolean;
    visible: boolean;
    workerVisible?: boolean;
  };
  spec: {
    services: {
      notification_rules: string[];
      cost_limits: { max: number; alertAt: number };
      features?: string[];
    };
    groups: WorkflowGroup[];
    steps?: WorkflowStep[];
    stepIds?: string[];
  };
}

interface WorkflowMetadata {
  title: string;
  version: number;
  description: string;
  author: string;
  category: string;
  tags: string[];
  icon: string;
  created: string;
  updated: string;
}

interface WorkflowGroup {
  id: string;
  name: string;
  description: string;
  domain: string;
  role_match: string;
  type: 'custom' | 'virtual' | 'built-in';
}

interface WorkflowStep {
  id: string;
  workflowId: string;
  name: string;
  description?: string;
  type: 'workflow-entry' | 'workflow-step' | 'workflow-terminator'
      | 'sub-workflow-entry' | 'sub-workflow-invoke' | 'worker-initiate';
  permissions: {
    required_groups: string[];
    allow_virtual_group: boolean;
    required_level?: number;
  };
  timeout_minutes?: number;
  retry_policy?: RetryConfig;
  condition?: WorkflowStepCondition[];
  conditions?: WorkflowStepCondition[];
}

interface WorkflowStepCondition {
  type: 'comparison' | 'options' | 'default' | 'terminator';
  operator?: 'eq' | 'equals' | 'ne' | 'notEquals' | 'not_equals'
           | 'gt' | 'greaterThan' | 'greater_than'
           | 'gte' | 'greaterThanOrEquals' | 'greater_than_or_equals'
           | 'lt' | 'lessThan' | 'less_than'
           | 'lte' | 'lessThanOrEquals' | 'less_than_or_equals'
           | 'contains' | 'matches' | 'and' | 'or' | 'not';
  target_true: string;
  target_false?: string;
  variable?: string;
  constant?: string;
  options?: Array<{ option: string; target: string }>;
  target_dynamic?: boolean;
}

interface RetryConfig {
  max_attempts: number;
  backoff_strategy: 'linear' | 'exponential' | 'fixed';
  backoff_seconds: number;
  retry_on?: string[];
}
```

### WorkflowManifest (bundle.yaml)

```typescript
interface WorkflowManifest {
  workflowId: string;
  workflowVersion: number;
  name: string;
  version: number;
  steps?: WorkflowManifestStepHandler[];
  stepIds?: string[];
}

interface WorkflowManifestStepHandler {
  id: string;
  route: string;
  domain?: 'app' | 'work';
  ui: WorkflowManifestStepUIComponent;
  api: WorkflowManifestStepAPIHandler[];
}

interface WorkflowManifestStepUIComponent {
  css: string;
  script: string;
  dynamic: string;
}

interface WorkflowManifestStepAPIHandler {
  route_match: string;
  file: string;
  input: WorkflowManifestStepAPIHandlerParameter[];
  output: WorkflowManifestStepAPIHandlerParameter[];
}

interface WorkflowManifestStepAPIHandlerParameter {
  name: string;
  type: 'string' | 'number';
  enum?: string[];
  default?: string | number;
}
```

### WorkflowConfig (config.json)

```typescript
interface WorkflowConfig {
  name: string;
  description: string;
  fields: WorkflowConfigField[];
}

interface WorkflowConfigField {
  id: string;
  label: string;
  type: 'boolean' | 'number' | 'string' | 'textarea' | 'select' | 'multiselect';
  default: boolean | number | string | string[];
  value?: boolean | number | string | string[];
  description: string;
  placeholder?: string;
  options?: Array<{ value: number | string; label: string }>;
  dependsOn?: { field: string; value: boolean | number | string | string[] };
  min?: number;
  max?: number;
  step?: number;
}
```

---

### Container Types

Types for the `sdk.containers` manager. See [Containers](./CONTAINERS.md) for full documentation.

```typescript
type ContainerState = 'launching' | 'ready' | 'error' | 'stopped';

interface ContainerLaunchConfig {
  image: string;
  taskId: string;
  blockId: string;
  envVars?: Record<string, string>;
  cpu?: number;
  memoryMb?: number;
  timeoutSeconds?: number;
  allowedIndexUrls?: string[];
  deniedPackages?: string[];
}

interface ContainerSession {
  sessionId: string;
  orgId: string;
  entityId: string;
  taskId: string;
  blockId: string;
  doId: string;
  status: ContainerState;
  createdAt: number;
  lastActiveAt: number;
  internetDisabled: boolean;
  image: string;
  bootstrapPort: number;
  appPort: number;
}

interface ContainerFile {
  path: string;
  content: string;
  encoding?: 'utf8' | 'base64';
  mode?: string;
}

interface ContainerStatus {
  sessionId: string;
  state: ContainerState;
  bootstrapReady: boolean;
  appReady: boolean;
  lastHeartbeat: number;
  cpuUsagePct?: number;
  memoryUsageMb?: number;
}

interface RequirementsInstallConfig {
  requirements: string[];
  indexUrl?: string;
  extraIndexUrls?: string[];
  timeoutSeconds?: number;
}

interface RequirementsInstallResult {
  success: boolean;
  installed: string[];
  failed: Array<{ package: string; error: string }>;
  stdout: string;
  stderr: string;
}

type KernelState = 'idle' | 'busy' | 'starting' | 'error' | 'dead' | 'unknown';

interface KernelConnectResult {
  kernelId: string;
  state: KernelState;
}

interface KernelExecuteResult {
  executionId: string;
}

interface KernelOutputBatch {
  messages: KernelMessage[];
  cursor: number;
  kernelState: KernelState;
}

interface KernelMessage {
  msgType: string;
  parentMsgId?: string;
  content: Record<string, unknown>;
  channel: string;
  receivedAt: number;
}

interface KernelCompleteResult {
  matches: string[];
  cursorStart: number;
  cursorEnd: number;
}

interface KernelStatusResult {
  kernelId: string;
  state: KernelState;
  bufferSize: number;
}
```

---

## Type Definitions

See [types/index.d.ts](../types/index.d.ts) for complete TypeScript definitions.
