import { AIHFPlatform } from '@aihf/platform-sdk';

/**
 * Workflow Initialization
 *
 * Called once during workflow deployment to set up required resources.
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
  console.log(`[${workflowName}] Initializing v${workflowVersion}...`);

  try {
    // Add database table creation here if your workflow uses sdk.database
    // Example:
    //
    // await sdk.database.execute(workflowName, `
    //   CREATE TABLE IF NOT EXISTS my_table (
    //     id TEXT PRIMARY KEY,
    //     name TEXT NOT NULL,
    //     created_at TEXT NOT NULL
    //   )
    // `);

    console.log(`[${workflowName}] Initialization complete`);
    return 'success';

  } catch (error) {
    console.error(`[${workflowName}] initWorkflow failed:`, error);
    return `error: ${error instanceof Error ? error.message : 'Unknown error'}`;
  }
}
