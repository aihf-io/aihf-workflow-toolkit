/**
 * API Handler: Verify Email
 * Validates magic link and activates user.
 * Magic link validation is handled by the platform before this handler runs.
 * The entity arrives pre-authenticated via the magic link session.
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
  // The magic link sets the entity session automatically.
  // getCurrentEntity() returns the entity that clicked the magic link.
  const entity = await sdk.entities.getCurrentEntity();

  if (!entity) {
    return new Response(JSON.stringify({
      verified: false,
      error: 'Invalid or expired verification link'
    }), { status: 401, headers: { 'Content-Type': 'application/json' } });
  }

  // Update user status using correct database.update() signature:
  // update(workflowId, table, data, where, whereParams)
  await sdk.database.update(
    workflowName,
    'users',
    {
      status: 'verified',
      verified_at: new Date().toISOString()
    },
    'entity_id = ?',
    [entity.entity_id]
  );

  // Store the verified entity ID as step data for downstream steps
  sdk.tasks.setStepData(JSON.stringify({
    entityId: entity.entity_id,
    email: entity.profile.email
  }));

  return new Response(JSON.stringify({
    verified: true,
    entityId: entity.entity_id
  }), {
    headers: { 'Content-Type': 'application/json' }
  });
}
