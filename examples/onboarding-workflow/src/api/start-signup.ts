/**
 * API Handler: Start Signup
 * Creates user entity and sends verification email
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
  if (!input.email || !input.name) {
    return new Response(JSON.stringify({
      success: false,
      message: 'Email and name are required'
    }), { status: 400, headers: { 'Content-Type': 'application/json' } });
  }

  // Check if user already exists (findByUsername looks up by email/username)
  const existing = await sdk.entities.findByUsername(input.email);
  if (existing) {
    return new Response(JSON.stringify({
      success: false,
      message: 'An account with this email already exists'
    }), { status: 400, headers: { 'Content-Type': 'application/json' } });
  }

  // Create user entity
  const entity = await sdk.entities.createEntity({
    profile: {
      username: input.email,
      type: 'human',
      email: input.email,
      full_name: input.name,
      display_name: input.name
    }
  } as any);

  // Store in database
  await sdk.database.insert(workflowName, 'users', {
    entity_id: entity.entity_id,
    email: input.email,
    name: input.name,
    status: 'pending_verification',
    created_at: new Date().toISOString()
  });

  // Create magic link for email verification
  const magicLinkUrl = await sdk.auth.createMagicLink({
    entityId: entity.entity_id,
    workflowName,
    workflowVersion,
    stepId: 'verify',
    expiresInMinutes: 60
  });

  if (!magicLinkUrl) {
    return new Response(JSON.stringify({
      success: false,
      message: 'Failed to generate verification link'
    }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }

  // Send verification email using correct EmailSendRequest shape
  await sdk.emails.send({
    to: input.email,
    subject: 'Verify your email to continue',
    body: `Welcome, ${input.name}! Verify your email: ${magicLinkUrl}`,
    bodyHtml: `
      <h1>Welcome, ${input.name}!</h1>
      <p>Please verify your email address to continue with your account setup.</p>
      <a href="${magicLinkUrl}" style="
        display: inline-block;
        padding: 12px 24px;
        background: #3b82f6;
        color: white;
        text-decoration: none;
        border-radius: 8px;
      ">Verify Email</a>
      <p><small>This link expires in 1 hour.</small></p>
    `
  });

  return new Response(JSON.stringify({
    success: true,
    message: 'Check your email for a verification link'
  }), {
    headers: { 'Content-Type': 'application/json' }
  });
}
