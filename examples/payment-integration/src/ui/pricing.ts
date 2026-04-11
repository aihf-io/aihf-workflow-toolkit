/**
 * UI Component: Pricing Page
 * Display subscription plans and initiate checkout
 */

import { AIHFPlatform } from '@aihf/platform-sdk';

export async function renderAIHFWorkflowStepUI(
  sdk: AIHFPlatform,
  workflowName: string,
  workflowVersion: number,
  stepRoute: string,
  taskId: string
): Promise<Response | null> {
  // Get available plans
  const plans = await sdk.billing.listPlans();

  const formatPrice = (amount: number, currency: string, interval: string) => {
    const price = new Intl.NumberFormat('en-AU', {
      style: 'currency',
      currency: currency.toUpperCase()
    }).format(amount / 100);
    return `${price}/${interval}`;
  };

  const planCards = plans.map(plan => `
    <div class="plan-card ${plan.plan_id.includes('yearly') ? 'featured' : ''}">
      ${plan.plan_id.includes('yearly') ? '<div class="badge">Best Value</div>' : ''}
      <h3>${plan.name}</h3>
      <div class="price">${formatPrice(plan.amount, plan.currency, plan.interval)}</div>
      <p class="description">${plan.description || ''}</p>
      <ul class="features">
        ${(plan.features || []).map(f => `<li>${f}</li>`).join('')}
      </ul>
      <button onclick="selectPlan('${plan.plan_id}')" class="btn-primary">
        Get Started
      </button>
    </div>
  `).join('');

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Pricing</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #f9fafb;
      min-height: 100vh;
      padding: 40px 20px;
    }
    .container {
      max-width: 1000px;
      margin: 0 auto;
    }
    h1 {
      text-align: center;
      font-size: 36px;
      margin-bottom: 12px;
      color: #1f2937;
    }
    .subtitle {
      text-align: center;
      color: #6b7280;
      margin-bottom: 48px;
    }
    .plans-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
      gap: 24px;
    }
    .plan-card {
      background: white;
      border-radius: 16px;
      padding: 32px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.05);
      position: relative;
      transition: transform 0.2s, box-shadow 0.2s;
    }
    .plan-card:hover {
      transform: translateY(-4px);
      box-shadow: 0 12px 24px rgba(0,0,0,0.1);
    }
    .plan-card.featured {
      border: 2px solid #3b82f6;
    }
    .plan-card .badge {
      position: absolute;
      top: -12px;
      left: 50%;
      transform: translateX(-50%);
      background: #3b82f6;
      color: white;
      padding: 4px 16px;
      border-radius: 20px;
      font-size: 12px;
      font-weight: 600;
    }
    .plan-card h3 {
      font-size: 24px;
      margin-bottom: 8px;
      color: #1f2937;
    }
    .plan-card .price {
      font-size: 36px;
      font-weight: 700;
      color: #3b82f6;
      margin-bottom: 16px;
    }
    .plan-card .description {
      color: #6b7280;
      margin-bottom: 24px;
    }
    .plan-card .features {
      list-style: none;
      margin-bottom: 24px;
    }
    .plan-card .features li {
      padding: 8px 0;
      color: #374151;
      display: flex;
      align-items: center;
    }
    .plan-card .features li::before {
      content: "✓";
      color: #22c55e;
      font-weight: bold;
      margin-right: 12px;
    }
    .btn-primary {
      width: 100%;
      padding: 14px;
      background: #3b82f6;
      color: white;
      border: none;
      border-radius: 8px;
      font-size: 16px;
      font-weight: 600;
      cursor: pointer;
      transition: background 0.2s;
    }
    .btn-primary:hover {
      background: #2563eb;
    }
    .btn-primary:disabled {
      background: #9ca3af;
      cursor: not-allowed;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>Choose Your Plan</h1>
    <p class="subtitle">Start free, upgrade when you're ready</p>

    <div class="plans-grid">
      ${planCards}
    </div>
  </div>

  <script>
    async function selectPlan(planId) {
      const buttons = document.querySelectorAll('.btn-primary');
      buttons.forEach(btn => {
        btn.disabled = true;
        if (btn.onclick?.toString().includes(planId)) {
          btn.textContent = 'Redirecting...';
        }
      });

      try {
        const response = await fetch('/checkout/create', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ planId })
        });

        const result = await response.json();

        if (result.checkoutUrl) {
          window.location.href = result.checkoutUrl;
        } else {
          throw new Error(result.error || 'Checkout failed');
        }
      } catch (error) {
        alert(error.message);
        buttons.forEach(btn => {
          btn.disabled = false;
          btn.textContent = 'Get Started';
        });
      }
    }
  </script>
</body>
</html>
  `;

  return new Response(html, {
    headers: { 'Content-Type': 'text/html' }
  });
}
