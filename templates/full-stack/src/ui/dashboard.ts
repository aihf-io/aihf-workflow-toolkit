/**
 * UI Component: Dashboard
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
  const entity = await sdk.entities.getCurrentEntity();

  if (!entity) {
    return Response.redirect('/', 302);
  }

  const config = await sdk.workflows.getWorkflowConfigHelper(workflowName, workflowVersion);
  const appName = config.getString('app_name', 'My App');

  const html = `
<style>
  .fs-dash * { box-sizing: border-box; margin: 0; padding: 0; }
  .fs-dash-header {
    background: white;
    padding: 16px 24px;
    box-shadow: 0 1px 3px rgba(0,0,0,0.1);
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  .fs-dash-header h1 { font-size: 20px; color: #1f2937; }
  .fs-dash-header .user-info { color: #6b7280; font-size: 14px; }
  .fs-dash-container { max-width: 800px; margin: 32px auto; padding: 0 20px; }
  .fs-dash-card {
    background: white;
    border-radius: 12px;
    padding: 24px;
    margin-bottom: 24px;
    box-shadow: 0 1px 3px rgba(0,0,0,0.1);
  }
  .fs-dash-card h2 { font-size: 18px; margin-bottom: 16px; color: #1f2937; }
  .fs-form-row { display: flex; gap: 12px; margin-bottom: 12px; }
  .fs-form-row input {
    flex: 1;
    padding: 12px;
    border: 1px solid #e5e7eb;
    border-radius: 6px;
    font-size: 14px;
  }
  .fs-form-row button {
    padding: 12px 24px;
    background: #3b82f6;
    color: white;
    border: none;
    border-radius: 6px;
    cursor: pointer;
    font-size: 14px;
  }
  .fs-items-list { list-style: none; padding: 0; }
  .fs-items-list li {
    padding: 16px;
    border-bottom: 1px solid #f3f4f6;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  .fs-items-list li:last-child { border-bottom: none; }
  .fs-item-title { font-weight: 500; color: #1f2937; }
  .fs-item-date { font-size: 12px; color: #9ca3af; }
  .fs-empty { text-align: center; padding: 40px; color: #9ca3af; }
</style>

<div class="fs-dash">
  <div class="fs-dash-header">
    <h1>${appName}</h1>
    <span class="user-info">${entity.email}</span>
  </div>

  <div class="fs-dash-container">
    <div class="fs-dash-card">
      <h2>Create New Item</h2>
      <form id="fsDashCreateForm">
        <div class="fs-form-row">
          <input type="text" id="fsDashTitle" placeholder="Title" required>
          <button type="submit">Add</button>
        </div>
      </form>
    </div>

    <div class="fs-dash-card">
      <h2>Your Items</h2>
      <ul class="fs-items-list" id="fsDashItemsList">
        <li class="fs-empty">Loading...</li>
      </ul>
    </div>
  </div>
</div>

<script>
(function() {
  var itemsList = document.getElementById('fsDashItemsList');

  function getTaskId() {
    return window.AIHF_TASK_ID || '';
  }

  async function loadItems() {
    var res = await fetch('/dashboard/data');
    var data = await res.json();
    var items = data.items || [];

    if (items.length === 0) {
      itemsList.innerHTML = '<li class="fs-empty">No items yet. Create one above!</li>';
      return;
    }

    itemsList.innerHTML = items.map(function(item) {
      return '<li>' +
        '<div>' +
          '<div class="fs-item-title">' + item.title + '</div>' +
          '<div class="fs-item-date">' + new Date(item.created_at).toLocaleDateString() + '</div>' +
        '</div>' +
      '</li>';
    }).join('');
  }

  document.getElementById('fsDashCreateForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    var title = document.getElementById('fsDashTitle').value;

    await fetch('/dashboard/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: title,
        taskId: getTaskId()
      })
    });

    document.getElementById('fsDashTitle').value = '';
    loadItems();
  });

  loadItems();
})();
</script>
  `;

  return new Response(html, { headers: { 'Content-Type': 'text/html' } });
}
