/**
 * API Handler: Create Checkout Session
 * Initiates Stripe Checkout for subscription signup
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
  const { planId } = JSON.parse(sanitisedInput);
  const entity = await sdk.entities.getCurrentEntity();

  if (!entity) {
    return new Response(JSON.stringify({
      error: 'Authentication required'
    }), { status: 401, headers: { 'Content-Type': 'application/json' } });
  }

  if (!planId) {
    return new Response(JSON.stringify({
      error: 'Plan ID is required'
    }), { status: 400, headers: { 'Content-Type': 'application/json' } });
  }

  // Get base URL from config
  const configHelper = await sdk.workflows.getWorkflowConfigHelper(workflowName, workflowVersion);
  const baseUrl = configHelper.getString('app_url', 'https://app.example.com');

  try {
    // Create Stripe Checkout session using correct SDK signature:
    // createCheckoutSession({ entityId, planId, successUrl, cancelUrl })
    const checkout = await sdk.billing.createCheckoutSession({
      entityId: entity.entity_id,
      planId,
      successUrl: `${baseUrl}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancelUrl: `${baseUrl}/pricing?cancelled=true`
    });

    // Log checkout creation
    await sdk.database.insert(workflowName, 'checkout_sessions', {
      entity_id: entity.entity_id,
      session_id: checkout.sessionId,
      plan_id: planId,
      status: 'created',
      created_at: new Date().toISOString()
    });

    return new Response(JSON.stringify({
      action: 'redirect',
      checkoutUrl: checkout.checkoutUrl
    }), {
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Checkout creation failed:', error);
    return new Response(JSON.stringify({
      error: 'Failed to create checkout session'
    }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}
