/**
 * API Handler: Login
 * Sends magic link for authentication
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
  const existingUser = await sdk.entities.findByUsername(input.email);

  if (!existingUser) {
    // Create new entity for this email
    await sdk.entities.createEntity({
      email: input.email,
      profile: { type: 'human' }
    });
  }

  // Create magic link
  const magicLink = await sdk.auth.createMagicLink({
    email: input.email,
    redirectUrl: '/dashboard',
    expiresInMinutes: 60
  });

  // Send email
  const config = await sdk.workflows.getWorkflowConfigHelper(workflowName, workflowVersion);
  const appName = config.getString('app_name', 'My App');

  await sdk.emails.send({
    to: input.email,
    subject: `Login to ${appName}`,
    bodyHtml: `
      <h1>Login to ${appName}</h1>
      <p>Click the link below to log in:</p>
      <a href="${magicLink.url}" style="display:inline-block;padding:12px 24px;background:#3b82f6;color:white;text-decoration:none;border-radius:8px;">
        Log In
      </a>
      <p><small>This link expires in 1 hour.</small></p>
    `,
    bodyText: `Login to ${appName}: ${magicLink.url}`
  });

  return new Response(JSON.stringify({
    success: true,
    message: 'Check your email for the login link'
  }), {
    headers: { 'Content-Type': 'application/json' }
  });
}
