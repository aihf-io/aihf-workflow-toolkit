/**
 * UI Component: Home / Login Page
 */

import { AIHFPlatform } from '@aihf/platform-sdk';

export async function renderAIHFWorkflowStepUI(
  sdk: AIHFPlatform,
  workflowName: string,
  workflowVersion: number,
  stepRoute: string,
  taskId: string
): Promise<Response | null> {
  const config = await sdk.workflows.getWorkflowConfigHelper(workflowName, workflowVersion);
  const appName = config.getString('app_name', 'My App');

  // Check if already logged in
  const entity = await sdk.entities.getCurrentEntity();
  if (entity) {
    return Response.redirect('/dashboard', 302);
  }

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${appName}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .container {
      background: white;
      border-radius: 16px;
      padding: 48px;
      width: 100%;
      max-width: 400px;
      box-shadow: 0 20px 60px rgba(0,0,0,0.3);
      text-align: center;
    }
    h1 { font-size: 32px; margin-bottom: 8px; color: #1f2937; }
    .subtitle { color: #6b7280; margin-bottom: 32px; }
    .form-group { margin-bottom: 16px; text-align: left; }
    label { display: block; margin-bottom: 8px; font-weight: 500; }
    input {
      width: 100%;
      padding: 14px;
      border: 2px solid #e5e7eb;
      border-radius: 8px;
      font-size: 16px;
    }
    input:focus { outline: none; border-color: #667eea; }
    button {
      width: 100%;
      padding: 14px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      border: none;
      border-radius: 8px;
      font-size: 16px;
      font-weight: 600;
      cursor: pointer;
      margin-top: 8px;
    }
    button:hover { transform: translateY(-2px); box-shadow: 0 4px 12px rgba(102,126,234,0.4); }
    button:disabled { opacity: 0.6; transform: none; cursor: not-allowed; }
    .message { margin-top: 16px; padding: 12px; border-radius: 8px; }
    .success { background: #dcfce7; color: #166534; }
    .error { background: #fee2e2; color: #991b1b; }
  </style>
</head>
<body>
  <div class="container">
    <h1>${appName}</h1>
    <p class="subtitle">Enter your email to get started</p>
    <form id="loginForm">
      <div class="form-group">
        <label for="email">Email Address</label>
        <input type="email" id="email" name="email" required placeholder="you@example.com">
      </div>
      <button type="submit" id="submitBtn">Send Login Link</button>
    </form>
    <div id="message" class="message" style="display: none;"></div>
  </div>
  <script>
    document.getElementById('loginForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn = document.getElementById('submitBtn');
      const msg = document.getElementById('message');
      const email = document.getElementById('email').value;

      btn.disabled = true;
      btn.textContent = 'Sending...';
      msg.style.display = 'none';

      try {
        const res = await fetch('/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email })
        });
        const result = await res.json();
        msg.style.display = 'block';
        msg.className = result.success ? 'message success' : 'message error';
        msg.textContent = result.message || result.error;
        if (result.success) btn.textContent = 'Check your email!';
        else { btn.disabled = false; btn.textContent = 'Send Login Link'; }
      } catch {
        msg.style.display = 'block';
        msg.className = 'message error';
        msg.textContent = 'Network error';
        btn.disabled = false;
        btn.textContent = 'Send Login Link';
      }
    });
  </script>
</body>
</html>
  `;

  return new Response(html, { headers: { 'Content-Type': 'text/html' } });
}
