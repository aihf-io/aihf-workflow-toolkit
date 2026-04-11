/**
 * API Handler: Submit
 * Handles form submission
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

  // Validate input
  if (!input.message) {
    return new Response(JSON.stringify({
      success: false,
      error: 'Message is required'
    }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  // Get config value
  const config = await sdk.workflows.getWorkflowConfigHelper(workflowName, workflowVersion);
  const appName = config.getString('app_name', 'My App');

  // Store in database
  await sdk.database.insert(workflowName, 'messages', {
    content: input.message,
    created_at: new Date().toISOString()
  });

  return new Response(JSON.stringify({
    success: true,
    response: `Hello from ${appName}! You said: ${input.message}`
  }), {
    headers: { 'Content-Type': 'application/json' }
  });
}
