/**
 * AIHF.io Platform SDK Type Definitions
 * Version 6.0.0
 *
 * These type definitions are aligned 1:1 with the gateway SDK implementation:
 *   - workers/gateway/src/platform-sdk/index.ts
 *   - workers/gateway/src/platform-sdk/utilities-manager.ts
 *   - workers/gateway/src/level3/types/utility-types.ts
 *   - workers/gateway/src/level3/types/workflow-types.ts
 *   - workers/gateway/src/level3/types/identity-type.ts
 *   - workers/gateway/src/level3/types/oauth-types.ts
 *   - workers/gateway/src/level3/types/preference-types.ts
 *   - workers/gateway/src/level3/types/payment-types.ts
 *   - workers/gateway/src/level3/core/file-manager-service.ts
 */

declare module '@aihf/platform-sdk' {

  // ============================================================================
  // CORE PLATFORM
  // ============================================================================

  /**
   * Main Platform SDK class
   * Provides access to all platform services via sub-managers
   */
  export class AIHFPlatform {
    readonly entities: EntityManager;
    readonly tasks: TaskManager;
    readonly workflows: WorkflowManager;
    readonly database: DatabaseManager;
    readonly emails: EmailManager;
    readonly credentials: CredentialsManager;
    readonly utilities: UtilitiesManager;
    readonly auth: AuthManager;
    readonly files: FileManager;
    readonly preferences: PreferencesManager;
    readonly billing: BillingManager;
    readonly containers: ContainersManager;

    /** Get the current entity from session */
    getSelfEntity(): Promise<AIHFEntity>;

    /** Get raw KV sync payload for a remote gateway. Requires 'kv.remote-sync' permission. */
    getRemoteKVSyncPayload(gatewayId: string): Promise<RemoteSyncPayload>;

    /** Acknowledge commands executed by a remote gateway. Requires 'kv.remote-sync' permission. */
    acknowledgeRemoteCommands(gatewayId: string, commandIds: string[]): Promise<void>;
  }

  // ============================================================================
  // ENTITY TYPES
  // ============================================================================

  export interface AIHFEntity {
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

  export interface AIHFEntityProfile {
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

  export interface AIHFRole {
    name: string;
    domain?: string;
    permissions?: string[];
  }

  export interface AIHFEntityCredentials {
    type: string;
    credential: string;
    created_at?: number;
    last_used_at?: number;
  }

  export interface AIHFEntityPaymentInfo {
    [key: string]: unknown;
  }

  // ============================================================================
  // ENTITY MANAGER
  // ============================================================================

  export class EntityManager {
    /** Get the current session entity */
    getCurrentEntity(): Promise<AIHFEntity | null>;

    /** Get entity by ID */
    getEntity(entityId: string): Promise<AIHFEntity | null>;

    /** Update entity fields */
    updateEntity(entityId: string, updates: Partial<AIHFEntity>): Promise<void>;

    /** Find entity by username (typically email). Requires admin permissions. */
    findByUsername(username: string): Promise<AIHFEntity | null>;

    /** Create a new entity. Requires admin permissions. */
    createEntity(data: Partial<AIHFEntity>): Promise<AIHFEntity>;

    /**
     * Self-register entity for JIT (Just-In-Time) provisioning via OAuth/SAML.
     * Requires a valid JIT context from OAuth callback flow.
     */
    selfRegisterEntity(
      data: {
        username: string;
        email: string;
        displayName?: string;
        oauthProvider: string;
        oauthSub: string;
      },
      jitContext: {
        tenantId: string;
        validatedByOAuthCallback: boolean;
      }
    ): Promise<AIHFEntity>;
  }

  // ============================================================================
  // TASK MANAGER
  // ============================================================================

  export class TaskManager {
    /** Set step data for the current workflow step */
    setStepData(stepData: string): void;

    /** Get step data for the current workflow step */
    getStepData(): string | undefined;

    /** Get task by ID */
    getTask(taskId: string): Promise<any>;
  }

  // ============================================================================
  // WORKFLOW MANAGER
  // ============================================================================

  export class WorkflowManager {
    /** List available workflows */
    listWorkflows(): Promise<any[]>;

    /** Get workflow by ID and version */
    getWorkflow(workflowId: string, version: number): Promise<any>;

    /** Get workflow config as raw JSON string */
    getWorkflowConfig(workflowNameOrId: string, workflowVersion: number): Promise<string>;

    /** Get workflow config as parsed helper object */
    getWorkflowConfigHelper(workflowNameOrId: string, workflowVersion: number): Promise<WorkflowConfigHelper>;
  }

  /**
   * Helper class for accessing workflow configuration values.
   * Parses the AIHF standard config format and provides typed access to field values.
   */
  export class WorkflowConfigHelper {
    constructor(configJson: string);

    /** Get a config field value by ID with type-safe default */
    get<T>(fieldId: string, defaultValue: T): T;

    /** Get a string config value */
    getString(fieldId: string, defaultValue?: string): string;

    /** Get a number config value */
    getNumber(fieldId: string, defaultValue?: number): number;

    /** Get a boolean config value */
    getBoolean(fieldId: string, defaultValue?: boolean): boolean;

    /** Get an array config value (for multiselect fields) */
    getArray<T>(fieldId: string, defaultValue?: T[]): T[];

    /** Check if a field exists in the config */
    hasField(fieldId: string): boolean;

    /** Get the raw config data */
    getRawConfig(): WorkflowConfigData;

    /** Get all field IDs */
    getFieldIds(): string[];
  }

  export interface WorkflowConfigData {
    name?: string;
    description?: string;
    version?: number;
    fields?: WorkflowConfigField[];
  }

  // ============================================================================
  // DATABASE MANAGER
  // ============================================================================

  /**
   * Tenant D1 Database Access.
   * Provides raw SQL operations against the tenant's scoped D1 database.
   * All operations require a workflowId for database scoping.
   */
  export class DatabaseManager {
    /** Execute a SQL query. Returns all rows. */
    query<T = any>(workflowId: string, sql: string, params?: any[]): Promise<T[]>;

    /** Execute a SQL query and return first row. Returns null if no results. */
    queryOne<T = any>(workflowId: string, sql: string, params?: any[]): Promise<T | null>;

    /** Execute a SQL statement (INSERT, UPDATE, DELETE). Returns metadata. */
    execute(workflowId: string, sql: string, params?: any[]): Promise<{
      success: boolean;
      meta: {
        rows_written?: number;
        rows_read?: number;
        duration?: number;
        last_row_id?: number;
        changes?: number;
      };
    }>;

    /** Execute multiple SQL statements in a transaction */
    batch(workflowId: string, statements: Array<{ sql: string; params?: any[] }>): Promise<{
      success: boolean;
      results: any[];
    }>;

    /** Dump the entire database */
    dump(workflowId: string): Promise<ArrayBuffer>;

    /** Helper: Insert a record. Returns last_row_id or null. */
    insert(workflowId: string, table: string, data: Record<string, any>): Promise<number | null>;

    /** Helper: Update records. Returns number of changes. */
    update(workflowId: string, table: string, data: Record<string, any>, where: string, whereParams: any[]): Promise<number>;

    /** Helper: Delete records. Returns number of changes. */
    delete(workflowId: string, table: string, where: string, whereParams: any[]): Promise<number>;

    /** Helper: Upsert a record (INSERT or UPDATE on conflict). Returns number of changes. */
    upsert(workflowId: string, table: string, data: Record<string, any>, conflictColumns: string[]): Promise<number>;
  }

  // ============================================================================
  // EMAIL MANAGER
  // ============================================================================

  export interface EmailSendRequest {
    to: string | string[];
    cc?: string[];
    bcc?: string[];
    subject: string;
    body: string;
    bodyHtml?: string;
    fromName?: string;
    replyTo?: string;
    priority?: 'high' | 'normal' | 'low';
    templateType?: 'notification' | 'task_assigned' | 'workflow_complete' | 'verification' | 'password_reset' | 'welcome' | 'custom';
    templateData?: Record<string, any>;
    attachments?: EmailAttachment[];
    metadata?: Record<string, string>;
  }

  export interface EmailAttachment {
    filename: string;
    content: string | ArrayBuffer;
    contentType: string;
    size: number;
  }

  export interface EmailSendResult {
    success: boolean;
    email_id?: string;
    error?: string;
  }

  export class EmailManager {
    /** Send an email */
    send(request: EmailSendRequest): Promise<EmailSendResult>;

    /** Send a password reset email using the 'password_reset' template */
    sendPasswordReset(toEmail: string, recipientName: string, resetUrl: string): Promise<EmailSendResult>;

    /** Send an email verification email using the 'verification' template */
    sendEmailVerification(toEmail: string, recipientName: string, verificationUrl: string): Promise<EmailSendResult>;

    /** Send a welcome email using the 'welcome' template */
    sendWelcomeEmail(toEmail: string, recipientName: string, supportEmail: string): Promise<EmailSendResult>;

    /** Send a task assignment notification email using the 'task_assigned' template */
    sendTaskAssignedEmail(
      toEmail: string,
      taskDetails: {
        recipientName: string;
        taskTitle: string;
        workflowName: string;
        dueDate?: string;
        taskUrl: string;
        unsubscribeUrl?: string;
      }
    ): Promise<EmailSendResult>;

    /** Send a workflow completion notification email using the 'workflow_complete' template */
    sendWorkflowCompleteEmail(
      toEmail: string,
      workflowDetails: {
        recipientName: string;
        workflowName: string;
        status: string;
        completedDate: string;
        workflowUrl?: string;
        unsubscribeUrl?: string;
      }
    ): Promise<EmailSendResult>;
  }

  // ============================================================================
  // CREDENTIALS MANAGER
  // ============================================================================

  export type OAuthProvider = 'google' | 'apple' | 'entraid';

  export interface InitiateOAuthResponse {
    authorizationUrl: string;
    state: string;
  }

  export interface CompleteOAuthResponse {
    success: boolean;
    entityId?: string;
    isNewEntity?: boolean;
    email?: string;
    error?: string;
    errorCode?: string;
  }

  export interface LinkOAuthResponse {
    success: boolean;
    verifiedEmail?: string;
    error?: string;
    errorCode?: string;
  }

  export interface CreateEntityWithOAuthResponse {
    entityId: string;
    email?: string;
  }

  export class CredentialsManager {
    /** Change the current entity's password */
    changeSelfPassword(newPassword: string): Promise<void>;

    /** Initiate OAuth flow. Returns authorization URL and state token. */
    initiateOAuth(
      provider: OAuthProvider,
      redirectUri: string,
      options?: {
        entityId?: string;
        expectedEmail?: string;
        workflowContext?: string;
      }
    ): Promise<InitiateOAuthResponse>;

    /** Complete OAuth flow after callback. Requires admin permissions. */
    completeOAuth(
      provider: OAuthProvider,
      code: string,
      state: string
    ): Promise<CompleteOAuthResponse>;

    /** Link OAuth provider to an existing entity */
    linkOAuthCredential(
      entityId: string,
      provider: OAuthProvider,
      code: string,
      redirectUri: string,
      expectedEmail?: string
    ): Promise<LinkOAuthResponse>;

    /** Create a new entity with OAuth authentication. Requires admin permissions. */
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
    ): Promise<CreateEntityWithOAuthResponse>;

    /** Get OAuth providers linked to an entity */
    getLinkedOAuthProviders(
      entityId?: string
    ): Promise<Array<{ provider: OAuthProvider; email?: string; name?: string; linkedAt: string }>>;

    /** Unlink an OAuth provider from an entity */
    unlinkOAuthProvider(provider: OAuthProvider, entityId?: string): Promise<void>;
  }

  // ============================================================================
  // AUTH MANAGER
  // ============================================================================

  export class AuthManager {
    /** Create a magic link for an entity to access a specific workflow step. Requires admin permissions. */
    createMagicLink(options: {
      entityId: string;
      workflowName: string;
      workflowVersion: number;
      stepId: string;
      expiresInMinutes?: number;
      metadata?: Record<string, any>;
      queryParams?: Record<string, string>;
    }): Promise<string | null>;
  }

  // ============================================================================
  // FILE MANAGER
  // ============================================================================

  export interface FileMetadata {
    path: string;
    name: string;
    size: number;
    modified: Date;
    isDirectory: boolean;
  }

  export interface FolderPermissions {
    canRead: boolean;
    canWrite: boolean;
    canDelete: boolean;
    canCreateFolders: boolean;
  }

  export class FileManager {
    /** List files in a folder */
    list(folderPath: string, options?: { prefix?: string; limit?: number }): Promise<FileMetadata[]>;

    /** Get metadata for a specific file */
    getMetadata(filePath: string): Promise<FileMetadata | null>;

    /** Download a file. Returns a ReadableStream or null. */
    download(filePath: string): Promise<ReadableStream<Uint8Array> | null>;

    /** Upload a file (only allowed in app/ folder) */
    upload(filePath: string, content: ArrayBuffer | ReadableStream): Promise<void>;

    /** Delete a file (only allowed in app/ folder) */
    delete(filePath: string): Promise<void>;

    /** Create a folder (only allowed in app/ folder) */
    createFolder(folderPath: string): Promise<void>;

    /** Delete a folder and all its contents (only allowed in app/ folder) */
    deleteFolder(folderPath: string): Promise<void>;

    /** Search for files by filename */
    search(folderPath: string, searchTerm: string): Promise<FileMetadata[]>;

    /** Get the list of root folders available to this tenant */
    getRootFolders(): Promise<Array<{ name: string; path: string; permissions: FolderPermissions }>>;
  }

  // ============================================================================
  // PREFERENCES MANAGER
  // ============================================================================

  export interface NotificationPreferences {
    inApp: {
      enabled: boolean;
      showBadge: 'always' | 'when_over_5' | 'never';
      types: {
        taskAssigned: boolean;
        taskStatusChanged: boolean;
        workerRequestedInfo: boolean;
        workerCompleted: boolean;
        customerSubmitted: boolean;
        systemAnnouncements: boolean;
        workflowUpdates: boolean;
      };
    };
    frequency: 'realtime' | 'every_15_min' | 'hourly' | 'daily' | 'never';
    doNotDisturb: {
      enabled: boolean;
      hours: {
        start: string;
        end: string;
      };
      days: number[];
    };
    email: {
      enabled: boolean;
    };
  }

  export interface WorkflowPreferences {
    favorites: string[];
    hidden: string[];
    defaultWorkflow: string | null;
    customOrder: string[];
  }

  export class PreferencesManager {
    /** Get entity notification preferences */
    getNotificationPreferences(entityId?: string): Promise<NotificationPreferences>;

    /** Update entity notification preferences */
    updateNotificationPreferences(updates: Partial<NotificationPreferences>, entityId?: string): Promise<void>;

    /** Get entity workflow preferences */
    getWorkflowPreferences(entityId?: string): Promise<WorkflowPreferences>;

    /** Update entity workflow preferences */
    updateWorkflowPreferences(updates: Partial<WorkflowPreferences>, entityId?: string): Promise<void>;
  }

  // ============================================================================
  // BILLING MANAGER
  // ============================================================================

  export interface AIHFSubscription {
    subscription_id: string;
    tenant_id: string;
    entity_id: string;
    stripe_subscription_id: string;
    stripe_customer_id: string;
    status: 'active' | 'past_due' | 'canceled' | 'trialing' | 'paused';
    plan: AIHFSubscriptionPlan;
    current_period_start: number;
    current_period_end: number;
    cancel_at_period_end: boolean;
    canceled_at?: number;
    trial_end?: number;
    metadata: Record<string, string>;
    created_at: number;
    updated_at: number;
  }

  export interface AIHFSubscriptionPlan {
    plan_id: string;
    tenant_id: string;
    name: string;
    description?: string;
    stripe_product_id: string;
    stripe_price_id: string;
    amount: number;
    currency: string;
    interval: 'day' | 'week' | 'month' | 'year';
    interval_count: number;
    usage_type: 'licensed' | 'metered';
    features: string[];
    is_active: boolean;
    created_at: number;
    updated_at: number;
  }

  export class BillingManager {
    /** Create a Stripe checkout session for subscription */
    createCheckoutSession(options: {
      entityId: string;
      planId: string;
      successUrl: string;
      cancelUrl: string;
    }): Promise<{ checkoutUrl: string; sessionId: string }>;

    /** Get subscription for an entity */
    getSubscription(entityId?: string): Promise<AIHFSubscription | null>;

    /** Create a Stripe customer portal session */
    createPortalSession(returnUrl: string): Promise<string>;

    /** List available subscription plans */
    listPlans(): Promise<AIHFSubscriptionPlan[]>;
  }

  // ============================================================================
  // CONTAINERS MANAGER
  // ============================================================================

  export type ContainerState = 'launching' | 'ready' | 'error' | 'stopped';

  export interface ContainerLaunchConfig {
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

  export interface ContainerSession {
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

  export interface ContainerFile {
    path: string;
    content: string;
    encoding?: 'utf8' | 'base64';
    mode?: string;
  }

  export interface ContainerStatus {
    sessionId: string;
    state: ContainerState;
    bootstrapReady: boolean;
    appReady: boolean;
    lastHeartbeat: number;
    cpuUsagePct?: number;
    memoryUsageMb?: number;
  }

  export interface RequirementsInstallConfig {
    requirements: string[];
    indexUrl?: string;
    extraIndexUrls?: string[];
    timeoutSeconds?: number;
  }

  export interface RequirementsInstallResult {
    success: boolean;
    installed: string[];
    failed: Array<{ package: string; error: string }>;
    stdout: string;
    stderr: string;
  }

  export type KernelState = 'idle' | 'busy' | 'starting' | 'error' | 'dead' | 'unknown';

  export interface KernelMessage {
    msgType: string;
    parentMsgId?: string;
    content: Record<string, unknown>;
    channel: string;
    receivedAt: number;
  }

  export interface KernelOutputBatch {
    messages: KernelMessage[];
    cursor: number;
    kernelState: KernelState;
  }

  export interface KernelConnectResult {
    kernelId: string;
    state: KernelState;
  }

  export interface KernelExecuteResult {
    executionId: string;
  }

  export interface KernelCompleteResult {
    matches: string[];
    cursorStart: number;
    cursorEnd: number;
  }

  export interface KernelStatusResult {
    kernelId: string;
    state: KernelState;
    bufferSize: number;
  }

  export class ContainersManager {
    /** Launch a new container session */
    launch(config: ContainerLaunchConfig): Promise<ContainerSession>;

    /** Write files into the container's /workspace directory */
    writeFiles(sessionId: string, files: ContainerFile[]): Promise<void>;

    /** Proxy an HTTP or WebSocket request to the container */
    proxy(sessionId: string, request: Request): Promise<Response>;

    /** Get the current status of a container session */
    status(sessionId: string): Promise<ContainerStatus>;

    /** Install Python packages inside the container */
    installRequirements(sessionId: string, cfg: RequirementsInstallConfig): Promise<RequirementsInstallResult>;

    /** Disable network egress from the container */
    disableInternet(sessionId: string): Promise<void>;

    /** Signal the bootstrap service to start the application */
    signalReady(sessionId: string): Promise<void>;

    /** Stop the container and free the underlying Durable Object */
    stop(sessionId: string): Promise<void>;

    /** Connect to the Jupyter kernel inside the container */
    connectKernel(sessionId: string): Promise<KernelConnectResult>;

    /** Submit code for execution on the kernel */
    execute(sessionId: string, code: string): Promise<KernelExecuteResult>;

    /** Read kernel output messages since the given cursor */
    getOutput(sessionId: string, cursor: number): Promise<KernelOutputBatch>;

    /** Interrupt the currently executing cell */
    interrupt(sessionId: string): Promise<void>;

    /** Request tab completion from the kernel */
    complete(sessionId: string, code: string, cursorPos: number): Promise<KernelCompleteResult>;

    /** Get kernel status including the DO output buffer size */
    kernelStatus(sessionId: string): Promise<KernelStatusResult>;

    /** Prune the kernel output buffer up to the given cursor */
    pruneOutput(sessionId: string, cursor: number): Promise<void>;
  }

  // ============================================================================
  // REMOTE SYNC TYPES (Private Remote Gateway)
  // ============================================================================

  /** Raw KV key/value pair for sync. Value is exact string from KV. */
  export interface SyncKeyValue {
    key: string;
    value: string;
  }

  /** Valid command types for remote gateway operations */
  export type OperationalCommandType =
    | 'db_assign'
    | 'db_unassign'
    | 'task_archive'
    | 'workflow_disable'
    | 'entity_suspend'
    | 'session_revoke'
    | 'config_update';

  /** Operational command to execute on remote gateway */
  export interface OperationalCommand {
    command_id: string;
    command_type: OperationalCommandType;
    payload: Record<string, unknown>;
    created_at: number;
    expires_at?: number;
  }

  /**
   * Complete sync payload from AIHF.io to remote gateway.
   * Contains raw KV data organized by namespace.
   */
  export interface RemoteSyncPayload {
    sync_timestamp: number;
    gateway_id: string;
    tenant_id: string;
    identity_keys: SyncKeyValue[];
    workflow_keys: SyncKeyValue[];
    config_keys: SyncKeyValue[];
    notification_keys: SyncKeyValue[];
    credential_keys?: SyncKeyValue[];
    commands: OperationalCommand[];
  }

  // ============================================================================
  // UTILITIES MANAGER
  // ============================================================================

  export class UtilitiesManager {
    readonly documents: DocumentsUtility;
    readonly spreadsheets: SpreadsheetsUtility;
    readonly pdfs: PDFsUtility;
    readonly images: ImagesUtility;
    readonly tensors: TensorsUtility;
    readonly diagrams: DiagramsUtility;
    readonly calendar: CalendarsUtility;
    readonly waves: WavesUtility;
    readonly ui: UIFragmentUtility;
  }

  // ============================================================================
  // DOCUMENTS UTILITY
  // ============================================================================

  export type DocumentFormat = 'docx' | 'rtf' | 'html' | 'txt';

  export interface DocumentParseResult {
    html: string;
    text: string;
    metadata: {
      title?: string;
      author?: string;
      createdAt?: string;
      modifiedAt?: string;
      pageCount?: number;
      wordCount?: number;
    };
    messages?: Array<{ type: 'warning' | 'info'; message: string }>;
  }

  export class DocumentsUtility {
    /** Parse a document and extract HTML/text content */
    parse(buffer: ArrayBuffer, format: DocumentFormat): Promise<DocumentParseResult>;
  }

  // ============================================================================
  // SPREADSHEETS UTILITY
  // ============================================================================

  export type SpreadsheetFormat = 'xlsx' | 'xls' | 'csv' | 'ods';
  export type CellValue = string | number | boolean | Date | null;

  export interface SpreadsheetParseResult {
    sheets: SpreadsheetSheet[];
    metadata: {
      sheetCount: number;
      author?: string;
      createdAt?: string;
      modifiedAt?: string;
    };
  }

  export interface SpreadsheetSheet {
    name: string;
    data: CellValue[][];
    headers?: string[];
    rowCount: number;
    columnCount: number;
  }

  export class SpreadsheetsUtility {
    /** Parse a spreadsheet and extract sheet data */
    parse(buffer: ArrayBuffer, format: SpreadsheetFormat): Promise<SpreadsheetParseResult>;

    /** Convert sheet data to CSV string */
    toCSV(data: CellValue[][], headers?: string[]): string;
  }

  // ============================================================================
  // PDFS UTILITY
  // ============================================================================

  export interface PDFExtractResult {
    pages: PDFPage[];
    metadata: {
      pageCount: number;
      title?: string;
      author?: string;
      subject?: string;
      creator?: string;
      producer?: string;
      createdAt?: string;
      modifiedAt?: string;
    };
  }

  export interface PDFPage {
    pageNumber: number;
    text: string;
    width: number;
    height: number;
  }

  export class PDFsUtility {
    /** Extract text and metadata from a PDF */
    extractPages(buffer: ArrayBuffer): Promise<PDFExtractResult>;

    /** Check if buffer is a valid PDF */
    isValidPdf(buffer: ArrayBuffer): boolean;

    /** Convert PDF data to base64 for client-side rendering */
    toBase64(buffer: ArrayBuffer): string;
  }

  // ============================================================================
  // IMAGES UTILITY
  // ============================================================================

  export type ImageFormat = 'png' | 'jpg' | 'jpeg' | 'gif' | 'webp' | 'svg';

  export interface ImageMetadataResult {
    format: ImageFormat;
    width: number;
    height: number;
    size: number;
    hasAlpha?: boolean;
    exif?: Record<string, unknown>;
  }

  export type AnnotationShape = 'rectangle' | 'circle' | 'arrow' | 'line' | 'freehand' | 'text';

  export interface ImageAnnotation {
    id: string;
    shape: AnnotationShape;
    bounds: {
      x: number;
      y: number;
      width?: number;
      height?: number;
      endX?: number;
      endY?: number;
    };
    style: {
      strokeColor?: string;
      fillColor?: string;
      strokeWidth?: number;
      opacity?: number;
    };
    text?: string;
    label?: string;
  }

  export class ImagesUtility {
    /** Get metadata from an image */
    getMetadata(buffer: ArrayBuffer): Promise<ImageMetadataResult>;

    /** Detect image format from buffer */
    detectFormat(buffer: ArrayBuffer): ImageFormat;

    /** Convert image to data URL */
    toDataUrl(buffer: ArrayBuffer, format: ImageFormat): string;

    /** Serialize annotations to JSON */
    serializeAnnotations(annotations: ImageAnnotation[]): string;

    /** Deserialize annotations from JSON */
    deserializeAnnotations(json: string): ImageAnnotation[];
  }

  // ============================================================================
  // TENSORS UTILITY
  // ============================================================================

  export type TensorDataType = 'float32' | 'float64' | 'int32' | 'int64' | 'uint8' | 'bool';

  export interface TensorData {
    values: number[];
    shape: number[];
    dtype: TensorDataType;
    labels?: {
      rows?: string[];
      columns?: string[];
    };
  }

  export interface TensorAnalysisResult {
    shape: number[];
    dtype: TensorDataType;
    stats: {
      min: number;
      max: number;
      mean: number;
      std: number;
      sum: number;
      nonZeroCount: number;
    };
    histogram?: {
      bins: number[];
      counts: number[];
    };
  }

  export class TensorsUtility {
    /** Analyze a tensor and compute statistics */
    analyze(tensor: TensorData): Promise<TensorAnalysisResult>;

    /** Reshape tensor to new dimensions */
    reshape(tensor: TensorData, newShape: number[]): TensorData;

    /** Convert tensor to 2D array for display */
    to2DArray(tensor: TensorData): number[][];

    /** Create tensor from 2D array */
    from2DArray(data: number[][], dtype?: TensorDataType): TensorData;
  }

  // ============================================================================
  // DIAGRAMS UTILITY
  // ============================================================================

  export type DiagramFormat = 'mermaid' | 'svg' | 'visual';

  export interface DiagramDefinition {
    format: DiagramFormat;
    source: string;
  }

  export interface DiagramCreateResult {
    svg: string;
    bounds: {
      width: number;
      height: number;
    };
  }

  export class DiagramsUtility {
    /** Create a diagram from definition */
    create(definition: DiagramDefinition): Promise<DiagramCreateResult>;

    /** Validate Mermaid syntax */
    validateMermaidSyntax(source: string): { valid: boolean; error?: string };

    /** Generate a flowchart from nodes and edges */
    generateFlowchart(
      nodes: Array<{ id: string; label: string; shape?: 'rect' | 'round' | 'diamond' }>,
      edges: Array<{ from: string; to: string; label?: string }>
    ): string;

    /** Generate a sequence diagram from messages */
    generateSequenceDiagram(
      participants: string[],
      messages: Array<{ from: string; to: string; text: string; type?: 'sync' | 'async' | 'reply' }>
    ): string;
  }

  // ============================================================================
  // CALENDARS UTILITY
  // ============================================================================

  export interface CalendarEvent {
    id: string;
    date: string | Date;
    endDate?: string | Date;
    title: string;
    category?: 'school' | 'sport' | 'medical' | 'social' | 'holiday' | 'handover' | 'custom';
    dotColor?: string;
    backgroundColor?: string;
    onClick?: string;
  }

  export interface CalendarDayTeam {
    team: 'A' | 'B';
    color: string;
    borderColor?: string;
    label?: string;
  }

  export interface CalendarMonthGrid {
    year: number;
    month: number;
    monthName: string;
    weeks: CalendarDay[][];
  }

  export interface CalendarDay {
    date: string;
    dayOfMonth: number;
    isCurrentMonth: boolean;
    isToday: boolean;
    events: CalendarEvent[];
    team?: CalendarDayTeam;
    isSelected?: boolean;
    isInRange?: boolean;
    isRangeStart?: boolean;
    isRangeEnd?: boolean;
    isDisabled?: boolean;
  }

  export class CalendarsUtility {
    /** Build month grid data for custom rendering */
    buildMonthGrid(
      year: number,
      month: number,
      options?: {
        events?: CalendarEvent[];
        teamMap?: Record<string, CalendarDayTeam>;
        selectedDates?: string[];
        selectedRange?: { start: string; end: string };
        minDate?: string;
        maxDate?: string;
        firstDayOfWeek?: 0 | 1;
      }
    ): CalendarMonthGrid;

    /** Get weekday names */
    getWeekdayNames(short?: boolean, firstDayOfWeek?: 0 | 1): string[];

    /** Get month name */
    getMonthName(month: number): string;

    /** Convert date to ISO date string (YYYY-MM-DD) */
    toISODate(date: string | Date): string;

    /** Check if date is in range (inclusive) */
    isDateInRange(date: string, start: string, end: string): boolean;

    /** Get number of days between two dates */
    daysBetween(start: string | Date, end: string | Date): number;

    /** Add days to a date */
    addDays(date: string | Date, days: number): string;

    /** Format date for display */
    formatDate(date: string | Date, format?: string): string;
  }

  // ============================================================================
  // WAVES UTILITY
  // ============================================================================

  export interface WaveData {
    values: number[] | Float64Array;
    sampleRate?: number;
    metadata?: Record<string, unknown>;
  }

  export interface WaveComparisonMetrics {
    correlation: number;
    rmse: number;
    maxDeviation: {
      index: number;
      difference: number;
    };
    areaBetween: number;
  }

  export interface WaveFFTResult {
    magnitudes: number[];
    phases: number[];
    frequencies?: number[];
  }

  export interface WavePeakInfo {
    index: number;
    value: number;
    prominence: number;
  }

  export interface WaveAlignmentResult {
    aligned: number[];
    offset: number;
    correlation: number;
  }

  export interface WaveNormalizationResult {
    normalized: number[];
    min: number;
    max: number;
  }

  export type WaveDownsampleMethod = 'average' | 'max' | 'min' | 'subsample';

  export class WavesUtility {
    /** Normalize wave values to 0-1 range */
    normalize(wave: number[] | WaveData): WaveNormalizationResult;

    /** Scale wave values by a constant factor */
    scale(wave: number[], factor: number): number[];

    /** Add a constant offset to wave values */
    offset(wave: number[], value: number): number[];

    /** Add two waves element-wise */
    add(a: number[], b: number[]): number[];

    /** Subtract wave b from wave a */
    subtract(a: number[], b: number[]): number[];

    /** Multiply two waves element-wise */
    multiply(a: number[], b: number[]): number[];

    /** Invert wave (flip vertically) */
    invert(wave: number[]): number[];

    /** Clip wave values to a range */
    clip(wave: number[], min: number, max: number): number[];

    /** Downsample wave to target length */
    downsample(wave: number[], targetLength: number, method?: WaveDownsampleMethod): number[];

    /** Upsample wave using linear interpolation */
    upsample(wave: number[], targetLength: number): number[];

    /** Resample wave to exact target length */
    resample(wave: number[], targetLength: number): number[];

    /** Apply moving average filter */
    movingAverage(wave: number[], windowSize: number): number[];

    /** Apply exponential moving average */
    ema(wave: number[], alpha?: number): number[];

    /** Apply Gaussian smoothing */
    gaussianSmooth(wave: number[], sigma?: number): number[];

    /** Convolve wave with kernel */
    convolve(wave: number[], kernel: number[]): number[];

    /** Remove DC offset (center around zero) */
    removeDC(wave: number[]): number[];

    /** Compute derivative (first difference) */
    derivative(wave: number[]): number[];

    /** Compute integral (cumulative sum) */
    integral(wave: number[]): number[];

    /** Compute FFT of a wave */
    fft(wave: number[], sampleRate?: number): WaveFFTResult;

    /** Inverse FFT - reconstruct signal from frequency components */
    ifft(magnitudes: number[], phases: number[]): number[];

    /** Compare two waves and compute similarity metrics */
    compare(a: number[], b: number[]): WaveComparisonMetrics;

    /** Compute Pearson correlation coefficient */
    pearsonCorrelation(a: number[], b: number[]): number;

    /** Compute Root Mean Square Error */
    rmse(a: number[], b: number[]): number;

    /** Find peaks in a wave */
    findPeaks(wave: number[], options?: {
      minProminence?: number;
      minDistance?: number;
      maxPeaks?: number;
    }): WavePeakInfo[];

    /** Find valleys (local minima) in a wave */
    findValleys(wave: number[], options?: {
      minProminence?: number;
      minDistance?: number;
      maxValleys?: number;
    }): WavePeakInfo[];

    /** Align wave b to wave a using cross-correlation */
    align(a: number[], b: number[]): WaveAlignmentResult;

    /** Compute cross-correlation of two signals */
    crossCorrelation(a: number[], b: number[]): number[];

    /** Compute basic statistics for a wave */
    stats(wave: number[]): {
      min: number;
      max: number;
      mean: number;
      std: number;
      rms: number;
      energy: number;
    };

    /** Generate a sine wave */
    sine(length: number, frequency: number, sampleRate?: number, amplitude?: number, phase?: number): number[];

    /** Generate a square wave */
    square(length: number, frequency: number, sampleRate?: number, amplitude?: number): number[];

    /** Generate a sawtooth wave */
    sawtooth(length: number, frequency: number, sampleRate?: number, amplitude?: number): number[];

    /** Generate white noise */
    noise(length: number, amplitude?: number): number[];
  }

  // ============================================================================
  // UI FRAGMENT UTILITY
  // ============================================================================

  export type UtilityComponent =
    | 'document-editor'
    | 'spreadsheet-viewer'
    | 'pdf-viewer'
    | 'image-annotator'
    | 'tensor-explorer'
    | 'diagram-builder'
    | 'calendar'
    | 'date-range-picker'
    | 'bottom-tabs'
    | 'slideover'
    | 'toast'
    | 'checkout-button'
    | 'subscription-portal'
    | 'subscription-status'
    | 'wave-viewer';

  // --- Document Editor Options ---

  export interface DocumentEditorOptions {
    content: string;
    editable?: boolean;
    theme?: 'minimal' | 'full';
    toolbar?: boolean;
    placeholder?: string;
    className?: string;
    onChangeCallback?: string;
  }

  // --- Spreadsheet Viewer Options ---

  export interface SpreadsheetViewerOptions {
    data: CellValue[][];
    headers?: string[];
    editable?: boolean;
    pagination?: {
      enabled: boolean;
      pageSize: number;
    };
    sortable?: boolean;
    filterable?: boolean;
    className?: string;
    maxHeight?: number;
  }

  // --- PDF Viewer Options ---

  export interface PDFViewerOptions {
    data: string | ArrayBuffer;
    initialPage?: number;
    zoom?: number;
    showNavigation?: boolean;
    showZoomControls?: boolean;
    showThumbnails?: boolean;
    className?: string;
    maxHeight?: number;
  }

  // --- Image Annotator Options ---

  export interface ImageAnnotatorOptions {
    src: string;
    annotations?: ImageAnnotation[];
    editable?: boolean;
    tools?: AnnotationShape[];
    defaultStrokeColor?: string;
    defaultStrokeWidth?: number;
    className?: string;
    onChangeCallback?: string;
  }

  // --- Tensor Explorer Options ---

  export type TensorVisualization = 'heatmap' | 'histogram' | 'line' | 'scatter' | 'surface';

  export interface TensorExplorerOptions {
    tensor: TensorData;
    visualization?: TensorVisualization;
    colorScale?: 'viridis' | 'plasma' | 'inferno' | 'magma' | 'grayscale' | 'redblue';
    showLabels?: boolean;
    showTooltip?: boolean;
    interactive?: boolean;
    className?: string;
    title?: string;
  }

  // --- Diagram Builder Options ---

  export interface DiagramBuilderOptions {
    source?: string;
    format?: DiagramFormat;
    editable?: boolean;
    theme?: 'default' | 'dark' | 'forest' | 'neutral';
    showEditor?: boolean;
    className?: string;
    onChangeCallback?: string;
  }

  // --- Calendar View Options ---

  export type CalendarViewMode = 'month' | 'week' | 'day';
  export type CalendarSelectionMode = 'single' | 'range' | 'multiple';

  export interface CalendarViewOptions {
    viewMode?: CalendarViewMode;
    selectionMode?: CalendarSelectionMode;
    initialDate?: string | Date;
    events?: CalendarEvent[];
    teamMap?: Record<string, CalendarDayTeam>;
    showNavigation?: boolean;
    showLegend?: boolean;
    legendItems?: Array<{ color: string; label: string }>;
    minDate?: string | Date;
    maxDate?: string | Date;
    selectedDates?: string[];
    selectedRange?: { start: string; end: string };
    firstDayOfWeek?: 0 | 1;
    onDateSelectCallback?: string;
    onRangeSelectCallback?: string;
    onMonthChangeCallback?: string;
    className?: string;
    theme?: {
      primaryColor?: string;
      todayBorderColor?: string;
      selectedColor?: string;
      rangeColor?: string;
      hoverColor?: string;
    };
  }

  // --- Date Range Picker Options ---

  export interface DateRangePickerOptions {
    mode?: 'inline' | 'modal' | 'dropdown';
    startDate?: string | Date;
    endDate?: string | Date;
    minDate?: string | Date;
    maxDate?: string | Date;
    presets?: Array<{
      label: string;
      startOffset: number;
      endOffset: number;
    }>;
    showTwoMonths?: boolean;
    showTime?: boolean;
    dateFormat?: string;
    placeholder?: string;
    validateCallback?: string;
    onSelectCallback?: string;
    className?: string;
    modalTitle?: string;
    submitText?: string;
    cancelText?: string;
  }

  // --- Wave Viewer Options ---

  export interface WaveSeries {
    data: number[];
    label?: string;
    color?: string;
    style?: 'line' | 'area' | 'points' | 'bars';
    lineWidth?: number;
    pointSize?: number;
    fillOpacity?: number;
  }

  export interface WaveAxisConfig {
    label?: string;
    values?: number[];
    min?: number;
    max?: number;
    format?: string;
    showGrid?: boolean;
  }

  export interface WaveViewerOptions {
    waves: WaveSeries[];
    xAxis?: WaveAxisConfig;
    yAxis?: WaveAxisConfig;
    showGrid?: boolean;
    showLegend?: boolean;
    legendPosition?: 'top' | 'bottom' | 'left' | 'right';
    interactive?: boolean;
    showPeaks?: boolean;
    peakThreshold?: number;
    editable?: boolean;
    drawColor?: string;
    onChangeCallback?: string;
    showCrosshair?: boolean;
    showTooltip?: boolean;
    className?: string;
    title?: string;
    width?: string | number;
    height?: string | number;
    backgroundColor?: string;
  }

  // --- Bottom Tabs Options ---

  export interface BottomTab {
    id: string;
    label: string;
    icon: string;
    href?: string;
    active?: boolean;
    badge?: number | boolean;
  }

  export interface BottomTabsOptions {
    tabs: BottomTab[];
    activeTab?: string;
    onTabClickCallback?: string;
    className?: string;
    theme?: {
      activeColor?: string;
      inactiveColor?: string;
      backgroundColor?: string;
      badgeColor?: string;
    };
    showOnDesktop?: boolean;
    safeAreaInset?: boolean;
  }

  // --- Slideover Options ---

  export type SlideoverPosition = 'left' | 'right' | 'bottom' | 'top';

  export interface SlideoverOptions {
    id?: string;
    title?: string;
    content: string;
    position?: SlideoverPosition;
    size?: string;
    open?: boolean;
    showBackdrop?: boolean;
    closeOnBackdrop?: boolean;
    showCloseButton?: boolean;
    className?: string;
    onCloseCallback?: string;
    headerActions?: string;
    footerContent?: string;
  }

  // --- Toast Options ---

  export type ToastType = 'info' | 'success' | 'warning' | 'error';
  export type ToastPosition =
    | 'top-left'
    | 'top-center'
    | 'top-right'
    | 'bottom-left'
    | 'bottom-center'
    | 'bottom-right';

  export interface ToastNotification {
    id?: string;
    message: string;
    type?: ToastType;
    duration?: number;
    dismissible?: boolean;
    actionLabel?: string;
    actionCallback?: string;
    icon?: string;
  }

  export interface ToastContainerOptions {
    position?: ToastPosition;
    maxToasts?: number;
    defaultDuration?: number;
    className?: string;
    theme?: {
      infoColor?: string;
      successColor?: string;
      warningColor?: string;
      errorColor?: string;
      backgroundColor?: string;
      textColor?: string;
    };
  }

  // --- Payment UI Options ---

  export interface CheckoutButtonOptions {
    planId: string;
    planName: string;
    price: string;
    interval: string;
    buttonText?: string;
    variant?: 'primary' | 'secondary' | 'outline';
    className?: string;
    successUrl?: string;
    cancelUrl?: string;
  }

  export interface SubscriptionPortalButtonOptions {
    returnUrl: string;
    buttonText?: string;
    variant?: 'primary' | 'secondary' | 'outline';
    className?: string;
  }

  export interface SubscriptionStatusInfo {
    subscriptionId?: string;
    status: 'active' | 'canceled' | 'past_due' | 'trialing' | 'incomplete' | 'none';
    planName?: string;
    currentPeriodEnd?: string;
    cancelAtPeriodEnd?: boolean;
  }

  export interface SubscriptionStatusOptions {
    subscription: SubscriptionStatusInfo | null;
    showManageButton?: boolean;
    returnUrl?: string;
    className?: string;
    showUpgradeButton?: boolean;
    upgradePlanId?: string;
    upgradePlanName?: string;
    upgradePrice?: string;
    upgradeInterval?: string;
  }

  // --- UI Fragment Utility Class ---

  export class UIFragmentUtility {
    documentEditor(options: DocumentEditorOptions): string;
    spreadsheetViewer(options: SpreadsheetViewerOptions): string;
    pdfViewer(options: PDFViewerOptions): string;
    imageAnnotator(options: ImageAnnotatorOptions): string;
    tensorExplorer(options: TensorExplorerOptions): string;
    diagramBuilder(options: DiagramBuilderOptions): string;
    calendar(options: CalendarViewOptions): string;
    dateRangePicker(options: DateRangePickerOptions): string;
    bottomTabs(options: BottomTabsOptions): string;
    slideover(options: SlideoverOptions): string;
    toastContainer(options?: ToastContainerOptions): string;
    toast(notification: ToastNotification): string;
    checkoutButton(options: CheckoutButtonOptions): string;
    subscriptionPortalButton(options: SubscriptionPortalButtonOptions): string;
    subscriptionStatus(options: SubscriptionStatusOptions): string;
    waveViewer(options: WaveViewerOptions): string;
    getStylesheet(component: UtilityComponent): string;
    getInlineStyles(component: UtilityComponent): string;
  }

  // ============================================================================
  // ERROR HANDLING
  // ============================================================================

  export class PlatformError extends Error {
    code: string;
    details?: any;
    constructor(code: string, message: string, details?: any);
  }

  // ============================================================================
  // WORKFLOW SCHEMA TYPES (bundle.yaml, workflow.yaml, config.json)
  // ============================================================================

  // --- workflow.yaml ---

  export interface WorkflowDefinition {
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

  export interface WorkflowMetadata {
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

  export interface WorkflowStep {
    id: string;
    workflowId: string;
    name: string;
    description?: string;
    type: 'workflow-entry' | 'workflow-step' | 'workflow-terminator' | 'sub-workflow-entry' | 'sub-workflow-invoke' | 'worker-initiate';
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

  export interface RetryConfig {
    max_attempts: number;
    backoff_strategy: 'linear' | 'exponential' | 'fixed';
    backoff_seconds: number;
    retry_on?: string[];
  }

  export interface WorkflowStepCondition {
    type: 'comparison' | 'options' | 'default' | 'terminator';
    operator?:
      | 'eq' | 'equals'
      | 'ne' | 'notEquals' | 'not_equals'
      | 'gt' | 'greaterThan' | 'greater_than'
      | 'gte' | 'greaterThanOrEquals' | 'greater_than_or_equals'
      | 'lt' | 'lessThan' | 'less_than'
      | 'lte' | 'lessThanOrEquals' | 'less_than_or_equals'
      | 'contains'
      | 'matches'
      | 'and'
      | 'or'
      | 'not';
    target_true: string;
    target_false?: string;
    variable?: string;
    constant?: string;
    options?: Array<{ option: string; target: string }>;
    target_dynamic?: boolean;
  }

  export interface WorkflowGroup {
    id: string;
    name: string;
    description: string;
    domain: string;
    role_match: string;
    type: 'custom' | 'virtual' | 'built-in';
  }

  // --- bundle.yaml ---

  export interface WorkflowManifest {
    workflowId: string;
    workflowVersion: number;
    name: string;
    version: number;
    steps?: WorkflowManifestStepHandler[];
    stepIds?: string[];
  }

  export interface WorkflowManifestStepHandler {
    id: string;
    route: string;
    domain?: 'app' | 'work';
    ui: WorkflowManifestStepUIComponent;
    api: WorkflowManifestStepAPIHandler[];
  }

  export interface WorkflowManifestStepUIComponent {
    css: string;
    script: string;
    dynamic: string;
  }

  export interface WorkflowManifestStepAPIHandler {
    route_match: string;
    file: string;
    input: WorkflowManifestStepAPIHandlerParameter[];
    output: WorkflowManifestStepAPIHandlerParameter[];
  }

  export interface WorkflowManifestStepAPIHandlerParameter {
    name: string;
    /**
     * Parameter type. `'Response'` is exclusively the SSE opt-in marker —
     * it must appear only as `output[0]` with `name === 'SSE'`. See
     * {@link InvokedByAIHFSSE} and the "Streaming API Handlers (SSE)"
     * section of BUNDLE_YAML.md.
     */
    type: 'string' | 'number' | 'boolean' | 'Response';
    enum?: string[];
    default?: string | number | boolean;
  }

  // --- config.json ---

  export interface WorkflowConfig {
    name: string;
    description: string;
    fields: WorkflowConfigField[];
  }

  export interface WorkflowConfigField {
    id: string;
    label: string;
    type: 'boolean' | 'number' | 'string' | 'textarea' | 'select' | 'multiselect';
    default: boolean | number | string | string[];
    value?: boolean | number | string | string[];
    description: string;
    placeholder?: string;
    options?: WorkflowConfigFieldOptions[];
    dependsOn?: WorkflowConfigFieldDependsOn;
    min?: number;
    max?: number;
    step?: number;
  }

  export interface WorkflowConfigFieldOptions {
    value: number | string;
    label: string;
  }

  export interface WorkflowConfigFieldDependsOn {
    field: string;
    value: boolean | number | string | string[];
  }
}

// ============================================================================
// HANDLER FUNCTION SIGNATURES
// ============================================================================

/**
 * API handler function signature.
 * Called by AIHF when a workflow step API endpoint is invoked.
 */
export type APIHandler = (
  sdk: import('@aihf/platform-sdk').AIHFPlatform,
  workflowName: string,
  workflowVersion: number,
  workflowStepId: string,
  taskId: string,
  sanitisedInput: string
) => Promise<Response | null>;

/**
 * UI handler function signature.
 * Called by AIHF when a workflow step UI needs to be rendered.
 */
export type UIHandler = (
  sdk: import('@aihf/platform-sdk').AIHFPlatform,
  workflowName: string,
  workflowVersion: number,
  stepRoute: string,
  taskId: string
) => Promise<Response | null>;

/**
 * Dynamic step resolution handler.
 * Called when a step condition has target_dynamic=true.
 * Returns the next step ID based on workflow state.
 */
export type GetNextAIHFStepId = (
  sdk: import('@aihf/platform-sdk').AIHFPlatform,
  workflowName: string,
  workflowVersion: number,
  workflowStepId: string,
  taskId: string,
  sanitisedInput: string
) => Promise<string>;

/**
 * Workflow initialization handler.
 * Called once when a workflow bundle is first deployed.
 * Typically used to create database tables, seed data, etc.
 */
export type InitWorkflow = (
  sdk: import('@aihf/platform-sdk').AIHFPlatform,
  workflowId: string,
  workflowName: string,
  workflowVersion: number
) => Promise<string>;

/**
 * Streaming (SSE) API handler function signature.
 *
 * Called by AIHF when a workflow step API endpoint declared as SSE is
 * invoked via `/api/v1/sse/app/<workflow>/<version>/<step>/<route>`.
 *
 * A handler is declared SSE by setting its `output` parameter in
 * bundle.yaml to exactly:
 *
 * ```yaml
 * output:
 *   - name: 'SSE'
 *     type: 'Response'
 * ```
 *
 * Implementation rules:
 * - Return a raw `Response` whose body is a `ReadableStream` of SSE frames.
 *   The platform wraps the response in `AIHFSSEBridge` which attaches the
 *   full SSE header set, CORS, rate limiting, and audit.
 * - SSE handlers are invoked via GET. Inputs come from the query string —
 *   the platform injects `taskId` and `cursor` (or `Last-Event-ID`)
 *   automatically.
 * - Do NOT participate in workflow step transitions. Use a normal
 *   (non-SSE) `APIHandler` on the same step for any action that must
 *   advance the workflow or mutate task state.
 * - On reconnect the browser's `EventSource` sends `Last-Event-ID`. Your
 *   handler receives it as `inputs.cursor` and should resume from there.
 */
export type InvokedByAIHFSSE = (
  sdk: import('@aihf/platform-sdk').AIHFPlatform,
  workflowName: string,
  workflowVersion: number,
  workflowStepId: string,
  taskId: string,
  inputs: Record<string, string>
) => Promise<Response>;
