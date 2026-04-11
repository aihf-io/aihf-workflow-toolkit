/**
 * UI Component: Dashboard
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
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Dashboard - ${appName}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #f3f4f6;
      min-height: 100vh;
    }
    .header {
      background: white;
      padding: 16px 24px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .header h1 { font-size: 20px; color: #1f2937; }
    .user-info { color: #6b7280; font-size: 14px; }
    .container { max-width: 800px; margin: 32px auto; padding: 0 20px; }
    .card {
      background: white;
      border-radius: 12px;
      padding: 24px;
      margin-bottom: 24px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
    }
    .card h2 { font-size: 18px; margin-bottom: 16px; color: #1f2937; }
    .form-row { display: flex; gap: 12px; margin-bottom: 12px; }
    .form-row input { flex: 1; padding: 12px; border: 1px solid #e5e7eb; border-radius: 6px; }
    .form-row button {
      padding: 12px 24px;
      background: #3b82f6;
      color: white;
      border: none;
      border-radius: 6px;
      cursor: pointer;
    }
    .items-list { list-style: none; }
    .items-list li {
      padding: 16px;
      border-bottom: 1px solid #f3f4f6;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .items-list li:last-child { border-bottom: none; }
    .item-title { font-weight: 500; color: #1f2937; }
    .item-date { font-size: 12px; color: #9ca3af; }
    .empty { text-align: center; padding: 40px; color: #9ca3af; }
  </style>
</head>
<body>
  <div class="header">
    <h1>${appName}</h1>
    <span class="user-info">${entity.email}</span>
  </div>

  <div class="container">
    <div class="card">
      <h2>Create New Item</h2>
      <form id="createForm">
        <div class="form-row">
          <input type="text" id="title" placeholder="Title" required>
          <button type="submit">Add</button>
        </div>
      </form>
    </div>

    <div class="card">
      <h2>Your Items</h2>
      <ul class="items-list" id="itemsList">
        <li class="empty">Loading...</li>
      </ul>
    </div>
  </div>

  <script>
    const itemsList = document.getElementById('itemsList');

    async function loadItems() {
      const res = await fetch('/dashboard/data');
      const { items } = await res.json();

      if (items.length === 0) {
        itemsList.innerHTML = '<li class="empty">No items yet. Create one above!</li>';
        return;
      }

      itemsList.innerHTML = items.map(item => \`
        <li>
          <div>
            <div class="item-title">\${item.title}</div>
            <div class="item-date">\${new Date(item.created_at).toLocaleDateString()}</div>
          </div>
        </li>
      \`).join('');
    }

    document.getElementById('createForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const title = document.getElementById('title').value;

      await fetch('/dashboard/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title })
      });

      document.getElementById('title').value = '';
      loadItems();
    });

    loadItems();
  </script>
</body>
</html>
  `;

  return new Response(html, { headers: { 'Content-Type': 'text/html' } });
}
