import { AIHFPlatform } from '@aihf/platform-sdk';

/**
 * Workflow Initialization
 *
 * Called once during workflow deployment to set up required database tables.
 * This runs automatically when the bundle is deployed via admin.aihf.io.
 *
 * The gateway calls this function with:
 *   - sdk: Platform SDK instance for this tenant
 *   - workflowId: Unique ID of the deployed workflow
 *   - workflowName: Name from bundle.yaml
 *   - workflowVersion: Version from bundle.yaml
 *
 * Return 'success' on success, or 'error: <message>' on failure.
 * Init failure does NOT fail the deployment — admin can re-run init via the UI.
 */
export async function initWorkflow(
  sdk: AIHFPlatform,
  workflowId: string,
  workflowName: string,
  workflowVersion: number
): Promise<string> {
  console.log(`[${workflowName}] Initializing database schema v${workflowVersion}...`);

  try {
    // Create your application tables here using sdk.database.execute()
    // All tables use D1 (SQLite) syntax with CREATE TABLE IF NOT EXISTS

    // Example: Items table for the dashboard
    await sdk.database.execute(workflowName, `
      CREATE TABLE IF NOT EXISTS items (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        content TEXT,
        created_by TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'active',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )
    `);

    // Example: Create indexes for common queries
    await sdk.database.execute(workflowName,
      `CREATE INDEX IF NOT EXISTS idx_items_created_by ON items(created_by)`
    );
    await sdk.database.execute(workflowName,
      `CREATE INDEX IF NOT EXISTS idx_items_status ON items(status)`
    );

    console.log(`[${workflowName}] Database schema created successfully`);
    return 'success';

  } catch (error) {
    console.error(`[${workflowName}] initWorkflow failed:`, error);
    return `error: ${error instanceof Error ? error.message : 'Unknown error'}`;
  }
}
