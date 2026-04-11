/**
 * API Handler: Billing Portal
 * Creates Stripe Customer Portal session for subscription management
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

  // Get base URL from config
  const configHelper = await sdk.workflows.getWorkflowConfigHelper(workflowName, workflowVersion);
  const baseUrl = configHelper.getString('app_url', 'https://app.example.com');

  try {
    // Create Stripe Customer Portal session
    const portalUrl = await sdk.billing.createPortalSession(
      `${baseUrl}/billing`
    );

    return new Response(JSON.stringify({
      portalUrl
    }), {
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Portal session failed:', error);
    return new Response(JSON.stringify({
      error: 'Failed to access billing portal'
    }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}
