/**
 * API Handler: Create Item
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
  const input = JSON.parse(sanitisedInput);
  const entity = await sdk.entities.getCurrentEntity();

  if (!entity) {
    return new Response(JSON.stringify({
      error: 'Authentication required'
    }), { status: 401, headers: { 'Content-Type': 'application/json' } });
  }

  if (!input.title) {
    return new Response(JSON.stringify({
      error: 'Title is required'
    }), { status: 400, headers: { 'Content-Type': 'application/json' } });
  }

  const itemId = crypto.randomUUID();

  await sdk.database.insert(workflowName, 'items', {
    id: itemId,
    entity_id: entity.entity_id,
    title: input.title,
    content: input.content || '',
    created_at: new Date().toISOString()
  });

  return new Response(JSON.stringify({
    item: {
      id: itemId,
      title: input.title,
      content: input.content || '',
      created_at: new Date().toISOString()
    }
  }), {
    headers: { 'Content-Type': 'application/json' }
  });
}
