/**
 * UI Component: Welcome Page
 * Initial signup form
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
  <title>Welcome - Get Started</title>
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
      padding: 40px;
      width: 100%;
      max-width: 420px;
      box-shadow: 0 20px 60px rgba(0,0,0,0.2);
    }
    h1 {
      font-size: 28px;
      margin-bottom: 8px;
      color: #1f2937;
    }
    .subtitle {
      color: #6b7280;
      margin-bottom: 32px;
    }
    .form-group {
      margin-bottom: 20px;
    }
    label {
      display: block;
      margin-bottom: 8px;
      font-weight: 500;
      color: #374151;
    }
    input {
      width: 100%;
      padding: 12px 16px;
      border: 2px solid #e5e7eb;
      border-radius: 8px;
      font-size: 16px;
      transition: border-color 0.2s;
    }
    input:focus {
      outline: none;
      border-color: #667eea;
    }
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
      transition: transform 0.2s, box-shadow 0.2s;
    }
    button:hover {
      transform: translateY(-2px);
      box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
    }
    button:disabled {
      opacity: 0.6;
      cursor: not-allowed;
      transform: none;
    }
    .message {
      padding: 12px;
      border-radius: 8px;
      margin-top: 16px;
      text-align: center;
    }
    .message.success {
      background: #dcfce7;
      color: #166534;
    }
    .message.error {
      background: #fee2e2;
      color: #991b1b;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>Get Started</h1>
    <p class="subtitle">Create your account in just a few steps</p>

    <form id="signupForm">
      <div class="form-group">
        <label for="name">Full Name</label>
        <input type="text" id="name" name="name" required placeholder="John Doe">
      </div>

      <div class="form-group">
        <label for="email">Email Address</label>
        <input type="email" id="email" name="email" required placeholder="john@example.com">
      </div>

      <button type="submit" id="submitBtn">Continue</button>
    </form>

    <div id="message" class="message" style="display: none;"></div>
  </div>

  <script>
    document.getElementById('signupForm').addEventListener('submit', async (e) => {
      e.preventDefault();

      const btn = document.getElementById('submitBtn');
      const msg = document.getElementById('message');

      btn.disabled = true;
      btn.textContent = 'Creating account...';
      msg.style.display = 'none';

      const name = document.getElementById('name').value;
      const email = document.getElementById('email').value;

      try {
        const response = await fetch('/start/signup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, email })
        });

        const result = await response.json();

        msg.style.display = 'block';
        if (result.success) {
          msg.className = 'message success';
          msg.textContent = result.message;
          btn.textContent = 'Email sent!';
        } else {
          msg.className = 'message error';
          msg.textContent = result.message || 'Something went wrong';
          btn.disabled = false;
          btn.textContent = 'Continue';
        }
      } catch (error) {
        msg.style.display = 'block';
        msg.className = 'message error';
        msg.textContent = 'Network error. Please try again.';
        btn.disabled = false;
        btn.textContent = 'Continue';
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
