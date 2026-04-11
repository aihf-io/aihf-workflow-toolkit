/**
 * UI Component: Home / Login Page
 *
 * IMPORTANT: Return body fragments, NOT full HTML documents.
 * The platform wraps your output in a shell page and extracts <body> content
 * via regex — any <head>/<style> outside the body will be stripped.
 * Put <style> inline inside the body fragment.
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
<style>
  .fs-login * { box-sizing: border-box; }
  .fs-login {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    max-width: 400px;
    margin: 60px auto;
    padding: 48px;
    background: white;
    border-radius: 16px;
    box-shadow: 0 20px 60px rgba(0,0,0,0.1);
    text-align: center;
  }
  .fs-login h1 { font-size: 32px; margin: 0 0 8px; color: #1f2937; }
  .fs-login .subtitle { color: #6b7280; margin: 0 0 32px; }
  .fs-login .form-group { margin-bottom: 16px; text-align: left; }
  .fs-login label { display: block; margin-bottom: 8px; font-weight: 500; }
  .fs-login input {
    width: 100%;
    padding: 14px;
    border: 2px solid #e5e7eb;
    border-radius: 8px;
    font-size: 16px;
    box-sizing: border-box;
  }
  .fs-login input:focus { outline: none; border-color: #667eea; }
  .fs-login button {
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
  .fs-login button:hover { transform: translateY(-2px); box-shadow: 0 4px 12px rgba(102,126,234,0.4); }
  .fs-login button:disabled { opacity: 0.6; transform: none; cursor: not-allowed; }
  .fs-login .message { margin-top: 16px; padding: 12px; border-radius: 8px; display: none; }
  .fs-login .success { background: #dcfce7; color: #166534; }
  .fs-login .error { background: #fee2e2; color: #991b1b; }
</style>

<div class="fs-login">
  <h1>${appName}</h1>
  <p class="subtitle">Enter your email to get started</p>
  <form id="fsLoginForm">
    <div class="form-group">
      <label for="fsEmail">Email Address</label>
      <input type="email" id="fsEmail" name="email" required placeholder="you@example.com">
    </div>
    <button type="submit" id="fsSubmitBtn">Send Login Link</button>
  </form>
  <div id="fsMessage" class="message"></div>
</div>

<script>
(function() {
  document.getElementById('fsLoginForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    var btn = document.getElementById('fsSubmitBtn');
    var msg = document.getElementById('fsMessage');
    var email = document.getElementById('fsEmail').value;

    btn.disabled = true;
    btn.textContent = 'Sending...';
    msg.style.display = 'none';

    try {
      var res = await fetch('/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email,
          taskId: window.AIHF_TASK_ID || ''
        })
      });
      var result = await res.json();
      msg.style.display = 'block';
      msg.className = result.success ? 'message success' : 'message error';
      msg.textContent = result.message || result.error;
      if (result.success) btn.textContent = 'Check your email!';
      else { btn.disabled = false; btn.textContent = 'Send Login Link'; }
    } catch (err) {
      msg.style.display = 'block';
      msg.className = 'message error';
      msg.textContent = 'Network error';
      btn.disabled = false;
      btn.textContent = 'Send Login Link';
    }
  });
})();
</script>
  `;

  return new Response(html, { headers: { 'Content-Type': 'text/html' } });
}
