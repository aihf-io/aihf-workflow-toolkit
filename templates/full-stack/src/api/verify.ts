/**
 * API Handler: Verify Authentication
 * Checks if the current session is authenticated
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
  // Magic link verification is handled by the AIHF gateway automatically.
  // When a user clicks a magic link, the gateway validates the token,
  // establishes a session, and redirects to the target URL.
  // Handler code simply checks if the session is authenticated.

  const entity = await sdk.entities.getCurrentEntity();

  if (!entity) {
    return new Response(JSON.stringify({
      verified: false,
      error: 'Not authenticated'
    }), { status: 401, headers: { 'Content-Type': 'application/json' } });
  }

  return new Response(JSON.stringify({
    verified: true,
    entityId: entity.entity_id
  }), {
    headers: { 'Content-Type': 'application/json' }
  });
}
