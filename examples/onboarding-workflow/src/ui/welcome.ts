/**
 * UI Component: Welcome Page
 * Initial signup form
 *
 * IMPORTANT: Return body fragments, NOT full HTML documents.
 * The platform wraps your output in a shell page and extracts <body> content
 * via regex — any <head>/<style> outside the body will be stripped.
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
<style>
  .ob-wrap * { box-sizing: border-box; }
  .ob-wrap {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    max-width: 420px;
    margin: 40px auto;
    padding: 40px;
    background: white;
    border-radius: 16px;
    box-shadow: 0 20px 60px rgba(0,0,0,0.1);
  }
  .ob-wrap h1 {
    font-size: 28px;
    margin: 0 0 8px;
    color: #1f2937;
  }
  .ob-wrap .subtitle {
    color: #6b7280;
    margin: 0 0 32px;
  }
  .ob-form-group {
    margin-bottom: 20px;
  }
  .ob-form-group label {
    display: block;
    margin-bottom: 8px;
    font-weight: 500;
    color: #374151;
  }
  .ob-form-group input {
    width: 100%;
    padding: 12px 16px;
    border: 2px solid #e5e7eb;
    border-radius: 8px;
    font-size: 16px;
    box-sizing: border-box;
    transition: border-color 0.2s;
  }
  .ob-form-group input:focus {
    outline: none;
    border-color: #667eea;
  }
  .ob-submit {
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
  .ob-submit:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
  }
  .ob-submit:disabled {
    opacity: 0.6;
    cursor: not-allowed;
    transform: none;
  }
  .ob-message {
    padding: 12px;
    border-radius: 8px;
    margin-top: 16px;
    text-align: center;
    display: none;
  }
  .ob-message.success {
    background: #dcfce7;
    color: #166534;
  }
  .ob-message.error {
    background: #fee2e2;
    color: #991b1b;
  }
</style>

<div class="ob-wrap">
  <h1>Get Started</h1>
  <p class="subtitle">Create your account in just a few steps</p>

  <form id="obSignupForm">
    <div class="ob-form-group">
      <label for="obName">Full Name</label>
      <input type="text" id="obName" name="name" required placeholder="John Doe">
    </div>

    <div class="ob-form-group">
      <label for="obEmail">Email Address</label>
      <input type="email" id="obEmail" name="email" required placeholder="john@example.com">
    </div>

    <button type="submit" class="ob-submit" id="obSubmitBtn">Continue</button>
  </form>

  <div id="obMessage" class="ob-message"></div>
</div>

<script>
(function() {
  document.getElementById('obSignupForm').addEventListener('submit', async function(e) {
    e.preventDefault();

    var btn = document.getElementById('obSubmitBtn');
    var msg = document.getElementById('obMessage');

    btn.disabled = true;
    btn.textContent = 'Creating account...';
    msg.style.display = 'none';

    var name = document.getElementById('obName').value;
    var email = document.getElementById('obEmail').value;

    try {
      var response = await fetch('/start/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name,
          email: email,
          taskId: window.AIHF_TASK_ID || ''
        })
      });

      var result = await response.json();

      msg.style.display = 'block';
      if (result.success) {
        msg.className = 'ob-message success';
        msg.textContent = result.message;
        btn.textContent = 'Email sent!';
      } else {
        msg.className = 'ob-message error';
        msg.textContent = result.message || 'Something went wrong';
        btn.disabled = false;
        btn.textContent = 'Continue';
      }
    } catch (error) {
      msg.style.display = 'block';
      msg.className = 'ob-message error';
      msg.textContent = 'Network error. Please try again.';
      btn.disabled = false;
      btn.textContent = 'Continue';
    }
  });
})();
</script>
  `;

  return new Response(html, {
    headers: { 'Content-Type': 'text/html' }
  });
}
