/**
 * UI Component: Main Page
 * Simple form with message input
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
  const primaryColor = config.getString('branding.primary_color', '#3b82f6');

  const html = `
<style>
  .bw-wrap * { box-sizing: border-box; }
  .bw-wrap {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    max-width: 400px;
    margin: 40px auto;
    padding: 32px;
    background: white;
    border-radius: 12px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.1);
  }
  .bw-wrap h1 {
    font-size: 24px;
    color: #1f2937;
    margin: 0 0 24px;
    text-align: center;
  }
  .bw-form-group { margin-bottom: 16px; }
  .bw-form-group label {
    display: block;
    margin-bottom: 8px;
    font-weight: 500;
    color: #374151;
  }
  .bw-form-group input {
    width: 100%;
    padding: 12px;
    border: 2px solid #e5e7eb;
    border-radius: 8px;
    font-size: 16px;
    box-sizing: border-box;
  }
  .bw-form-group input:focus {
    outline: none;
    border-color: ${primaryColor};
  }
  .bw-submit {
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
  .bw-submit:hover { opacity: 0.9; }
  .bw-submit:disabled { opacity: 0.5; cursor: not-allowed; }
  .bw-response {
    margin-top: 16px;
    padding: 16px;
    background: #f0fdf4;
    border-radius: 8px;
    color: #166534;
    display: none;
  }
  .bw-response.visible { display: block; }
  .bw-response.error {
    background: #fef2f2;
    color: #991b1b;
  }
</style>

<div class="bw-wrap">
  <h1>${appName}</h1>
  <form id="bwMainForm">
    <div class="bw-form-group">
      <label for="bwMessage">Your Message</label>
      <input type="text" id="bwMessage" name="message" placeholder="Enter a message..." required>
    </div>
    <button type="submit" class="bw-submit" id="bwSubmitBtn">Submit</button>
  </form>
  <div class="bw-response" id="bwResponse"></div>
</div>

<script>
(function() {
  document.getElementById('bwMainForm').addEventListener('submit', async function(e) {
    e.preventDefault();

    var btn = document.getElementById('bwSubmitBtn');
    var response = document.getElementById('bwResponse');
    var message = document.getElementById('bwMessage').value;

    btn.disabled = true;
    btn.textContent = 'Submitting...';
    response.classList.remove('visible', 'error');

    try {
      var res = await fetch('/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: message,
          taskId: window.AIHF_TASK_ID || ''
        })
      });

      var result = await res.json();

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
})();
</script>
  `;

  return new Response(html, {
    headers: { 'Content-Type': 'text/html' }
  });
}
