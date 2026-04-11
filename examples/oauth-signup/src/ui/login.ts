/**
 * UI Component: Login Page
 * OAuth login options
 */

import { AIHFPlatform } from '@aihf/platform-sdk';

export async function renderAIHFWorkflowStepUI(
  sdk: AIHFPlatform,
  workflowName: string,
  workflowVersion: number,
  stepRoute: string,
  taskId: string
): Promise<Response | null> {
  const configHelper = await sdk.workflows.getWorkflowConfigHelper(workflowName, workflowVersion);
  const companyName = configHelper.getString('company_name', 'My App');

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Login</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #f9fafb;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .login-container {
      background: white;
      border-radius: 16px;
      padding: 40px;
      width: 100%;
      max-width: 400px;
      box-shadow: 0 4px 24px rgba(0,0,0,0.1);
    }
    h1 {
      font-size: 24px;
      text-align: center;
      margin-bottom: 8px;
      color: #1f2937;
    }
    .subtitle {
      text-align: center;
      color: #6b7280;
      margin-bottom: 32px;
    }
    .oauth-btn {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 12px;
      width: 100%;
      padding: 14px;
      border: 2px solid #e5e7eb;
      border-radius: 8px;
      background: white;
      cursor: pointer;
      font-size: 16px;
      font-weight: 500;
      color: #374151;
      text-decoration: none;
      transition: all 0.2s;
      margin-bottom: 12px;
    }
    .oauth-btn:hover {
      border-color: #3b82f6;
      background: #f9fafb;
    }
    .oauth-btn svg {
      width: 24px;
      height: 24px;
    }
    .divider {
      display: flex;
      align-items: center;
      margin: 24px 0;
      color: #9ca3af;
      font-size: 14px;
    }
    .divider::before,
    .divider::after {
      content: "";
      flex: 1;
      height: 1px;
      background: #e5e7eb;
    }
    .divider span {
      padding: 0 16px;
    }
    .email-form input {
      width: 100%;
      padding: 14px;
      border: 2px solid #e5e7eb;
      border-radius: 8px;
      font-size: 16px;
      margin-bottom: 12px;
    }
    .email-form input:focus {
      outline: none;
      border-color: #3b82f6;
    }
    .email-form button {
      width: 100%;
      padding: 14px;
      background: #3b82f6;
      color: white;
      border: none;
      border-radius: 8px;
      font-size: 16px;
      font-weight: 500;
      cursor: pointer;
    }
    .email-form button:hover {
      background: #2563eb;
    }
  </style>
</head>
<body>
  <div class="login-container">
    <h1>Welcome back</h1>
    <p class="subtitle">Sign in to continue</p>

    <!-- Google OAuth -->
    <a href="/oauth/google" class="oauth-btn">
      <svg viewBox="0 0 24 24">
        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
      </svg>
      Continue with Google
    </a>

    <!-- Apple OAuth -->
    <a href="/oauth/apple" class="oauth-btn">
      <svg viewBox="0 0 24 24">
        <path fill="#000" d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09l.01-.01zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/>
      </svg>
      Continue with Apple
    </a>

    <div class="divider"><span>or</span></div>

    <!-- Magic Link Form -->
    <form class="email-form" id="magicLinkForm">
      <input type="email" name="email" placeholder="Enter your email" required>
      <button type="submit">Send Magic Link</button>
    </form>
  </div>

  <script>
    document.getElementById('magicLinkForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = e.target.email.value;

      try {
        const response = await fetch('/login/magic-link', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email })
        });

        if (response.ok) {
          alert('Check your email for the login link!');
        } else {
          alert('Something went wrong. Please try again.');
        }
      } catch (error) {
        alert('Network error. Please try again.');
      }
    });
  </script>
</body>
</html>
  `;

  return new Response(html, {
    headers: { 'Content-Type': 'text/html' }
  });
}
