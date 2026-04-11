/**
 * UI Component: Main Page
 * Simple form with message input
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
  const primaryColor = config.getString('branding.primary_color', '#3b82f6');

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
      background: #f9fafb;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
    }
    .container {
      background: white;
      border-radius: 12px;
      padding: 32px;
      width: 100%;
      max-width: 400px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.1);
    }
    h1 {
      font-size: 24px;
      color: #1f2937;
      margin-bottom: 24px;
      text-align: center;
    }
    .form-group { margin-bottom: 16px; }
    label {
      display: block;
      margin-bottom: 8px;
      font-weight: 500;
      color: #374151;
    }
    input, textarea {
      width: 100%;
      padding: 12px;
      border: 2px solid #e5e7eb;
      border-radius: 8px;
      font-size: 16px;
    }
    input:focus, textarea:focus {
      outline: none;
      border-color: ${primaryColor};
    }
    button {
      width: 100%;
      padding: 14px;
      background: ${primaryColor};
      color: white;
      border: none;
      border-radius: 8px;
      font-size: 16px;
      font-weight: 500;
      cursor: pointer;
    }
    button:hover { opacity: 0.9; }
    button:disabled { opacity: 0.5; cursor: not-allowed; }
    .response {
      margin-top: 16px;
      padding: 16px;
      background: #f0fdf4;
      border-radius: 8px;
      color: #166534;
      display: none;
    }
    .response.visible { display: block; }
    .error {
      background: #fef2f2;
      color: #991b1b;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>${appName}</h1>
    <form id="mainForm">
      <div class="form-group">
        <label for="message">Your Message</label>
        <input type="text" id="message" name="message" placeholder="Enter a message..." required>
      </div>
      <button type="submit" id="submitBtn">Submit</button>
    </form>
    <div class="response" id="response"></div>
  </div>

  <script>
    document.getElementById('mainForm').addEventListener('submit', async (e) => {
      e.preventDefault();

      const btn = document.getElementById('submitBtn');
      const response = document.getElementById('response');
      const message = document.getElementById('message').value;

      btn.disabled = true;
      btn.textContent = 'Submitting...';
      response.classList.remove('visible', 'error');

      try {
        const res = await fetch('/submit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message })
        });

        const result = await res.json();

        response.classList.add('visible');
        if (result.success) {
          response.textContent = result.response;
        } else {
          response.classList.add('error');
          response.textContent = result.error || 'Something went wrong';
        }
      } catch (error) {
        response.classList.add('visible', 'error');
        response.textContent = 'Network error. Please try again.';
      } finally {
        btn.disabled = false;
        btn.textContent = 'Submit';
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
