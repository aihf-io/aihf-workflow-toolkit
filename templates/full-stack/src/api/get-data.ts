/**
 * API Handler: Get Data
 * Retrieves user's items
 */

import { AIHFPlatform } from '@aihf/platform-sdk';

export async function invokedByAIHF(
  sdk: AIHFPlatform,
  workflowName: string,
  workflowVersion: number,
  workflowStepId: string,
  taskId: string,
  sanitisedInput: string
): Promise<Response | null> {
  const entity = await sdk.entities.getCurrentEntity();

  if (!entity) {
    return new Response(JSON.stringify({
      error: 'Authentication required'
    }), { status: 401, headers: { 'Content-Type': 'application/json' } });
  }

  const items = await sdk.database.query(workflowName,
    'SELECT * FROM items WHERE entity_id = ? ORDER BY created_at DESC LIMIT 50',
    [entity.entity_id]
  );

  return new Response(JSON.stringify({
    items
  }), {
    headers: { 'Content-Type': 'application/json' }
  });
}
