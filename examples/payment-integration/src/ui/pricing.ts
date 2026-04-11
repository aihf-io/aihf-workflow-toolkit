/**
 * UI Component: Pricing Page
 * Display subscription plans and initiate checkout
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
    <div class="pp-plan-card ${plan.plan_id.includes('yearly') ? 'pp-featured' : ''}">
      ${plan.plan_id.includes('yearly') ? '<div class="pp-badge">Best Value</div>' : ''}
      <h3>${plan.name}</h3>
      <div class="pp-price">${formatPrice(plan.amount, plan.currency, plan.interval)}</div>
      <p class="pp-description">${plan.description || ''}</p>
      <ul class="pp-features">
        ${(plan.features || []).map(f => `<li>${f}</li>`).join('')}
      </ul>
      <button onclick="ppSelectPlan('${plan.plan_id}')" class="pp-btn-primary">
        Get Started
      </button>
    </div>
  `).join('');

  const html = `
<style>
  .pp-wrap * { box-sizing: border-box; }
  .pp-wrap {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    max-width: 1000px;
    margin: 0 auto;
    padding: 40px 20px;
  }
  .pp-wrap h1 {
    text-align: center;
    font-size: 36px;
    margin: 0 0 12px;
    color: #1f2937;
  }
  .pp-wrap .pp-subtitle {
    text-align: center;
    color: #6b7280;
    margin: 0 0 48px;
  }
  .pp-plans-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
    gap: 24px;
  }
  .pp-plan-card {
    background: white;
    border-radius: 16px;
    padding: 32px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.05);
    position: relative;
    transition: transform 0.2s, box-shadow 0.2s;
  }
  .pp-plan-card:hover {
    transform: translateY(-4px);
    box-shadow: 0 12px 24px rgba(0,0,0,0.1);
  }
  .pp-plan-card.pp-featured {
    border: 2px solid #3b82f6;
  }
  .pp-badge {
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
  .pp-plan-card h3 {
    font-size: 24px;
    margin: 0 0 8px;
    color: #1f2937;
  }
  .pp-price {
    font-size: 36px;
    font-weight: 700;
    color: #3b82f6;
    margin-bottom: 16px;
  }
  .pp-description {
    color: #6b7280;
    margin-bottom: 24px;
  }
  .pp-features {
    list-style: none;
    margin: 0 0 24px;
    padding: 0;
  }
  .pp-features li {
    padding: 8px 0;
    color: #374151;
    display: flex;
    align-items: center;
  }
  .pp-features li::before {
    content: "\\2713";
    color: #22c55e;
    font-weight: bold;
    margin-right: 12px;
  }
  .pp-btn-primary {
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
  .pp-btn-primary:hover { background: #2563eb; }
  .pp-btn-primary:disabled { background: #9ca3af; cursor: not-allowed; }
</style>

<div class="pp-wrap">
  <h1>Choose Your Plan</h1>
  <p class="pp-subtitle">Start free, upgrade when you're ready</p>

  <div class="pp-plans-grid">
    ${planCards}
  </div>
</div>

<script>
(function() {
  window.ppSelectPlan = async function(planId) {
    var buttons = document.querySelectorAll('.pp-btn-primary');
    buttons.forEach(function(btn) {
      btn.disabled = true;
    });

    try {
      var response = await fetch('/checkout/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          planId: planId,
          taskId: window.AIHF_TASK_ID || ''
        })
      });

      var result = await response.json();

      if (result.checkoutUrl) {
        window.location.href = result.checkoutUrl;
      } else {
        throw new Error(result.error || 'Checkout failed');
      }
    } catch (error) {
      alert(error.message);
      buttons.forEach(function(btn) {
        btn.disabled = false;
      });
    }
  };
})();
</script>
  `;

  return new Response(html, {
    headers: { 'Content-Type': 'text/html' }
  });
}
