/**
 * API Handler: Complete Profile
 * Saves additional user information
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
      success: false,
      error: 'Authentication required'
    }), { status: 401, headers: { 'Content-Type': 'application/json' } });
  }

  // Update entity with profile data
  await sdk.entities.updateEntity(entity.entity_id, {
    profile: {
      ...entity.profile,
      mobile_number: input.phone,
      department: input.company,
      description: input.role
    }
  });

  // Update database record using correct signature:
  // update(workflowId, table, data, where, whereParams)
  await sdk.database.update(
    workflowName,
    'users',
    {
      phone: input.phone,
      company: input.company,
      role: input.role,
      status: 'active',
      completed_at: new Date().toISOString()
    },
    'entity_id = ?',
    [entity.entity_id]
  );

  // Store completion data as step data
  sdk.tasks.setStepData(JSON.stringify({
    entityId: entity.entity_id,
    completed: true
  }));

  return new Response(JSON.stringify({
    success: true
  }), {
    headers: { 'Content-Type': 'application/json' }
  });
}
