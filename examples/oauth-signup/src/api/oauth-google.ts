/**
 * API Handler: Google OAuth
 * Initiates OAuth flow with Google
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
  const configHelper = await sdk.workflows.getWorkflowConfigHelper(workflowName, workflowVersion);
  const baseUrl = configHelper.getString('app_url', 'https://app.example.com');

  // Initiate OAuth flow using CredentialsManager
  // Returns { authorizationUrl, state } with platform-managed state for CSRF protection
  const oauthResponse = await sdk.credentials.initiateOAuth(
    'google',
    `${baseUrl}/oauth/callback/google`,
    { workflowContext: workflowName }
  );

  // Redirect to the OAuth provider's authorization page
  // State is managed by the platform for CSRF protection
  return new Response(null, {
    status: 302,
    headers: {
      'Location': oauthResponse.authorizationUrl,
      'Set-Cookie': `oauth_state=${oauthResponse.state}; HttpOnly; Secure; SameSite=Lax; Max-Age=600; Path=/`
    }
  });
}
