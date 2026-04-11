/**
 * API Handler: OAuth Callback
 * Handles OAuth provider callback and creates/authenticates user
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
  const { code, state } = input;

  // Determine provider from URL
  const provider = workflowStepId.includes('google') ? 'google' : 'apple';

  if (!code || !state) {
    return new Response(JSON.stringify({
      success: false,
      error: 'Missing authorization code or state'
    }), { status: 400, headers: { 'Content-Type': 'application/json' } });
  }

  try {
    // Complete OAuth flow using CredentialsManager
    // This exchanges the code for tokens, validates state, and creates/finds the entity
    const result = await sdk.credentials.completeOAuth(provider, code, state);

    if (!result.success) {
      return new Response(JSON.stringify({
        success: false,
        error: result.error || 'OAuth authentication failed',
        errorCode: result.errorCode
      }), { status: 401, headers: { 'Content-Type': 'application/json' } });
    }

    // If this is a new entity, store in workflow database
    if (result.isNewEntity && result.entityId) {
      await sdk.database.insert(workflowName, 'users', {
        entity_id: result.entityId,
        email: result.email,
        oauth_provider: provider,
        created_at: new Date().toISOString()
      });
    }

    // Redirect to dashboard
    const configHelper = await sdk.workflows.getWorkflowConfigHelper(workflowName, workflowVersion);
    const baseUrl = configHelper.getString('app_url', 'https://app.example.com');

    return new Response(null, {
      status: 302,
      headers: {
        'Location': `${baseUrl}/dashboard`,
        'Set-Cookie': `oauth_state=; HttpOnly; Secure; SameSite=Lax; Max-Age=0; Path=/`
      }
    });

  } catch (error) {
    console.error('OAuth callback error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: 'Authentication failed'
    }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}
