/**
 * API Handler: Login
 * Sends magic link for authentication
 *
 * createMagicLink() signature:
 *   sdk.auth.createMagicLink({ entityId, workflowName, workflowVersion, stepId, queryParams? })
 *   Returns: Promise<string | null>  (the magic link URI, e.g. "/magic?token=...")
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

  if (!input.email) {
    return new Response(JSON.stringify({
      success: false,
      error: 'Email is required'
    }), { status: 400, headers: { 'Content-Type': 'application/json' } });
  }

  // Check if user exists by email (using username lookup)
  let user = await sdk.entities.findByUsername(input.email);

  if (!user) {
    // Create new entity for this email
    user = await sdk.entities.createEntity({
      email: input.email,
      profile: { type: 'human' }
    });
  }

  // Create magic link — targets the "dashboard" step of this workflow
  // Returns a URI string like "/magic?token=..." or null on failure
  const magicLinkUri = await sdk.auth.createMagicLink({
    entityId: user.entity_id,
    workflowName,
    workflowVersion,
    stepId: 'dashboard',
  });

  if (!magicLinkUri) {
    return new Response(JSON.stringify({
      success: false,
      error: 'Failed to create login link. Please try again.'
    }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }

  // Send email with magic link
  const config = await sdk.workflows.getWorkflowConfigHelper(workflowName, workflowVersion);
  const appName = config.getString('app_name', 'My App');

  // Build the full URL — the platform host is available from the request context
  // In production, use your actual app domain
  const magicLinkUrl = magicLinkUri;

  await sdk.emails.send({
    to: input.email,
    subject: `Login to ${appName}`,
    bodyHtml: `
      <h1>Login to ${appName}</h1>
      <p>Click the link below to log in:</p>
      <a href="${magicLinkUrl}" style="display:inline-block;padding:12px 24px;background:#3b82f6;color:white;text-decoration:none;border-radius:8px;">
        Log In
      </a>
      <p><small>This link is single-use and will expire after your session idle timeout.</small></p>
    `,
    bodyText: `Login to ${appName}: ${magicLinkUrl}`
  });

  return new Response(JSON.stringify({
    success: true,
    message: 'Check your email for the login link'
  }), {
    headers: { 'Content-Type': 'application/json' }
  });
}
