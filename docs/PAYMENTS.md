# Payment Integration Guide

Integrate Stripe payments into your AIHF.io workflows for subscriptions, one-time payments, and billing management.

## Overview

The AIHF.io Platform provides seamless Stripe integration through the `sdk.billing` manager (BillingManager) and pre-built UI fragments via `sdk.utilities.ui`.

```
+-----------------------------------------------------------+
|                   Payment Flow                            |
|                                                           |
|  User selects plan -> Stripe Checkout -> Webhook -> Access|
|                                                           |
|  +----------+    +-----------+    +------------------+    |
|  | Plan     |--->| Checkout  |--->| Active           |    |
|  | Selection|    | Session   |    | Subscription     |    |
|  +----------+    +-----------+    +------------------+    |
+-----------------------------------------------------------+
```

## BillingManager API

The `BillingManager` class provides four methods:

```typescript
class BillingManager {
  /** Create a Stripe checkout session for subscription */
  createCheckoutSession(options: {
    entityId: string;
    planId: string;
    successUrl: string;
    cancelUrl: string;
  }): Promise<{ checkoutUrl: string; sessionId: string }>;

  /** Get subscription for an entity (defaults to current entity if omitted) */
  getSubscription(entityId?: string): Promise<AIHFSubscription | null>;

  /** Create a Stripe customer portal session */
  createPortalSession(returnUrl: string): Promise<string>;

  /** List available subscription plans */
  listPlans(): Promise<AIHFSubscriptionPlan[]>;
}
```

### Key Types

```typescript
interface AIHFSubscription {
  subscription_id: string;
  tenant_id: string;
  entity_id: string;
  stripe_subscription_id: string;
  stripe_customer_id: string;
  status: 'active' | 'past_due' | 'canceled' | 'trialing' | 'paused';
  plan: AIHFSubscriptionPlan;
  current_period_start: number;
  current_period_end: number;
  cancel_at_period_end: boolean;
  canceled_at?: number;
  trial_end?: number;
  metadata: Record<string, string>;
  created_at: number;
  updated_at: number;
}

interface AIHFSubscriptionPlan {
  plan_id: string;
  tenant_id: string;
  name: string;
  description?: string;
  stripe_product_id: string;
  stripe_price_id: string;
  amount: number;          // In cents
  currency: string;        // e.g., 'aud'
  interval: 'day' | 'week' | 'month' | 'year';
  interval_count: number;
  usage_type: 'licensed' | 'metered';
  features: string[];
  is_active: boolean;
  created_at: number;
  updated_at: number;
}
```

---

## Quick Start

### 1. Create Checkout Session

```typescript
// src/api/checkout.ts
import { AIHFPlatform } from '@aihf/platform-sdk';

export async function invokedByAIHF(
  sdk: AIHFPlatform,
  workflowName: string,
  workflowVersion: number,
  workflowStepId: string,
  taskId: string,
  sanitisedInput: string
): Promise<Response | null> {
  const { planId } = JSON.parse(sanitisedInput);
  const initiator = await sdk.entities.getCurrentEntity();

  const checkout = await sdk.billing.createCheckoutSession({
    entityId: initiator.entity_id,
    planId,
    successUrl: `https://app.example.com/payment/success?session_id={CHECKOUT_SESSION_ID}`,
    cancelUrl: 'https://app.example.com/payment/cancel'
  });

  return new Response(JSON.stringify({
    action: 'redirect',
    redirectUrl: checkout.checkoutUrl
  }));
}
```

### 2. Handle Success

```typescript
// src/api/payment-success.ts
export async function invokedByAIHF(sdk: AIHFPlatform, ...args): Promise<Response | null> {
  const initiator = await sdk.entities.getCurrentEntity();

  // Verify subscription is active
  const subscription = await sdk.billing.getSubscription(initiator.entity_id);

  if (subscription?.status === 'active') {
    // Grant access, update user record, etc.
    await sdk.entities.updateEntity(initiator.entity_id, {
      active_subscription: true
    });

    return Response.redirect('/dashboard', 302);
  }

  return Response.redirect('/payment?error=pending', 302);
}
```

---

## Subscription Plans

### Listing Available Plans

```typescript
// src/api/get-plans.ts
export async function invokedByAIHF(sdk: AIHFPlatform, ...args): Promise<Response | null> {
  const plans = await sdk.billing.listPlans();

  // Returns array of AIHFSubscriptionPlan:
  // {
  //   plan_id: 'plan_monthly',
  //   tenant_id: 'tenant-123',
  //   name: 'Pro Monthly',
  //   description: 'Full access, billed monthly',
  //   stripe_product_id: 'prod_xxx',
  //   stripe_price_id: 'price_xxx',
  //   amount: 2900, // cents
  //   currency: 'aud',
  //   interval: 'month',
  //   interval_count: 1,
  //   usage_type: 'licensed',
  //   features: ['Unlimited projects', '24/7 support'],
  //   is_active: true,
  //   created_at: 1704067200000,
  //   updated_at: 1704067200000
  // }

  return new Response(JSON.stringify({ plans }), {
    headers: { 'Content-Type': 'application/json' }
  });
}
```

---

## Subscription Management

### Checking Subscription Status

```typescript
// src/api/subscription-status.ts
export async function invokedByAIHF(sdk: AIHFPlatform, ...args): Promise<Response | null> {
  const initiator = await sdk.entities.getCurrentEntity();
  const subscription = await sdk.billing.getSubscription(initiator.entity_id);

  if (!subscription) {
    return new Response(JSON.stringify({
      hasSubscription: false
    }));
  }

  return new Response(JSON.stringify({
    hasSubscription: true,
    status: subscription.status,
    plan: subscription.plan?.name,
    currentPeriodEnd: new Date(subscription.current_period_end).toISOString(),
    cancelAtPeriodEnd: subscription.cancel_at_period_end
  }));
}
```

### Subscription Status Types

| Status | Description |
|--------|-------------|
| `active` | Subscription is active and paid |
| `trialing` | In free trial period |
| `past_due` | Payment failed, grace period |
| `canceled` | Subscription has been canceled |
| `paused` | Subscription is paused |

### Customer Portal Access

Allow users to manage their subscription via Stripe's Customer Portal:

```typescript
// src/api/billing-portal.ts
export async function invokedByAIHF(sdk: AIHFPlatform, ...args): Promise<Response | null> {
  const portalUrl = await sdk.billing.createPortalSession(
    'https://app.example.com/billing'
  );

  return new Response(JSON.stringify({
    action: 'redirect',
    portalUrl
  }));
}
```

The Customer Portal allows users to:
- Update payment method
- View invoices and billing history
- Change subscription plan
- Cancel subscription

---

## UI Fragments for Payments

The `sdk.utilities.ui` (UIFragmentUtility) provides three pre-built payment components that generate HTML strings. These are part of the AIHF UI fragment system and eliminate the need to build payment UI from scratch.

### checkoutButton

Renders a styled checkout button that initiates a Stripe checkout session:

```typescript
interface CheckoutButtonOptions {
  planId: string;
  planName: string;
  price: string;
  interval: string;
  buttonText?: string;
  variant?: 'primary' | 'secondary' | 'outline';
  className?: string;
  successUrl?: string;
  cancelUrl?: string;
}
```

Usage:

```typescript
export async function renderAIHFWorkflowStepUI(sdk: AIHFPlatform, ...args): Promise<Response | null> {
  const plans = await sdk.billing.listPlans();
  const styles = sdk.utilities.ui.getStylesheet('checkout-button');

  const planButtons = plans.map(plan =>
    sdk.utilities.ui.checkoutButton({
      planId: plan.plan_id,
      planName: plan.name,
      price: `$${(plan.amount / 100).toFixed(2)}`,
      interval: plan.interval,
      buttonText: `Subscribe to ${plan.name}`,
      variant: 'primary',
      successUrl: '/payment/success',
      cancelUrl: '/pricing'
    })
  ).join('');

  const html = `
<!DOCTYPE html>
<html>
<head><title>Choose a Plan</title>${styles}</head>
<body>
  <h1>Choose Your Plan</h1>
  <div class="plans">${planButtons}</div>
</body>
</html>`;

  return new Response(html, { headers: { 'Content-Type': 'text/html' } });
}
```

### subscriptionPortalButton

Renders a button that opens the Stripe Customer Portal for subscription management:

```typescript
interface SubscriptionPortalButtonOptions {
  returnUrl: string;
  buttonText?: string;
  variant?: 'primary' | 'secondary' | 'outline';
  className?: string;
}
```

Usage:

```typescript
const portalButton = sdk.utilities.ui.subscriptionPortalButton({
  returnUrl: '/billing',
  buttonText: 'Manage Subscription',
  variant: 'secondary'
});
```

### subscriptionStatus

Renders a subscription status card showing the current plan, status, and period:

```typescript
interface SubscriptionStatusOptions {
  subscription: SubscriptionStatusInfo | null;
  showManageButton?: boolean;
  returnUrl?: string;
  className?: string;
  showUpgradeButton?: boolean;
  upgradePlanId?: string;
  upgradePlanName?: string;
  upgradePrice?: string;
  upgradeInterval?: string;
}

interface SubscriptionStatusInfo {
  subscriptionId?: string;
  status: 'active' | 'canceled' | 'past_due' | 'trialing' | 'incomplete' | 'none';
  planName?: string;
  currentPeriodEnd?: string;
  cancelAtPeriodEnd?: boolean;
}
```

Usage:

```typescript
export async function renderAIHFWorkflowStepUI(sdk: AIHFPlatform, ...args): Promise<Response | null> {
  const initiator = await sdk.entities.getCurrentEntity();
  const subscription = await sdk.billing.getSubscription(initiator.entity_id);

  const statusStyles = sdk.utilities.ui.getStylesheet('subscription-status');

  const statusCard = sdk.utilities.ui.subscriptionStatus({
    subscription: subscription ? {
      subscriptionId: subscription.subscription_id,
      status: subscription.status,
      planName: subscription.plan?.name,
      currentPeriodEnd: new Date(subscription.current_period_end).toISOString(),
      cancelAtPeriodEnd: subscription.cancel_at_period_end
    } : null,
    showManageButton: true,
    returnUrl: '/billing',
    showUpgradeButton: !subscription,
    upgradePlanId: 'plan_pro',
    upgradePlanName: 'Pro',
    upgradePrice: '$29.00',
    upgradeInterval: 'month'
  });

  const html = `
<!DOCTYPE html>
<html>
<head><title>Billing</title>${statusStyles}</head>
<body>
  <h1>Billing</h1>
  ${statusCard}
</body>
</html>`;

  return new Response(html, { headers: { 'Content-Type': 'text/html' } });
}
```

### Combined Example: Full Billing Page

```typescript
export async function renderAIHFWorkflowStepUI(sdk: AIHFPlatform, ...args): Promise<Response | null> {
  const initiator = await sdk.entities.getCurrentEntity();
  const subscription = await sdk.billing.getSubscription(initiator.entity_id);

  // Build subscription status info
  const statusInfo = subscription ? {
    subscriptionId: subscription.subscription_id,
    status: subscription.status as any,
    planName: subscription.plan?.name,
    currentPeriodEnd: new Date(subscription.current_period_end).toISOString(),
    cancelAtPeriodEnd: subscription.cancel_at_period_end
  } : null;

  // Render UI fragments
  const statusCard = sdk.utilities.ui.subscriptionStatus({
    subscription: statusInfo,
    showManageButton: !!subscription,
    returnUrl: '/billing'
  });

  const portalButton = subscription
    ? sdk.utilities.ui.subscriptionPortalButton({
        returnUrl: '/billing',
        buttonText: 'Manage Subscription',
        variant: 'secondary'
      })
    : '';

  // Get styles for all used components
  const styles = [
    sdk.utilities.ui.getStylesheet('subscription-status'),
    sdk.utilities.ui.getStylesheet('subscription-portal'),
    sdk.utilities.ui.getStylesheet('checkout-button')
  ].join('\n');

  const html = `
<!DOCTYPE html>
<html>
<head><title>Billing</title>${styles}</head>
<body>
  <div class="billing-container">
    <h1>Billing</h1>
    ${statusCard}
    ${portalButton}
  </div>
</body>
</html>`;

  return new Response(html, { headers: { 'Content-Type': 'text/html' } });
}
```

---

## Free Trials

### Offering a Trial Period

```typescript
export async function invokedByAIHF(sdk: AIHFPlatform, ...args): Promise<Response | null> {
  const { planType } = JSON.parse(args[4]);
  const initiator = await sdk.entities.getCurrentEntity();

  if (planType === 'FREE_TRIAL') {
    // Create trial without Stripe checkout
    await sdk.entities.updateEntity(initiator.entity_id, {
      active_subscription: true
    });

    await sdk.database.insert('my-workflow', 'subscriptions', {
      entity_id: initiator.entity_id,
      status: 'trialing',
      plan_type: 'trial',
      trial_end: new Date(Date.now() + (14 * 24 * 60 * 60 * 1000)).toISOString()
    });

    return new Response(JSON.stringify({ action: 'continue' }));
  }

  // Paid plan - redirect to Stripe
  const checkout = await sdk.billing.createCheckoutSession({
    entityId: initiator.entity_id,
    planId: planType,
    successUrl: 'https://app.example.com/success',
    cancelUrl: 'https://app.example.com/cancel'
  });

  return new Response(JSON.stringify({
    action: 'redirect',
    redirectUrl: checkout.checkoutUrl
  }));
}
```

---

## Bundle Configuration

```yaml
workflowId: 'wf-payment-001'
workflowVersion: 1
name: payment-workflow
version: 1

steps:
  - id: "pricing"
    route: '/pricing'
    domain: 'app'
    ui:
      css: 'static/pricing.css'
      script: 'static/pricing.js'
      dynamic: 'ui/pricing.ts'
    api:
      - route_match: '/plans'
        file: 'api/get-plans.ts'
        input: []
        output:
          - name: 'plans'
            type: 'string'

  - id: "checkout"
    route: '/payment'
    domain: 'app'
    ui:
      css: ''
      script: ''
      dynamic: ''
    api:
      - route_match: '/checkout'
        file: 'api/checkout.ts'
        input:
          - name: 'planId'
            type: 'string'
        output:
          - name: 'action'
            type: 'string'
          - name: 'redirectUrl'
            type: 'string'
      - route_match: '/success'
        file: 'api/payment-success.ts'
        input:
          - name: 'session_id'
            type: 'string'
        output: []

  - id: "billing"
    route: '/billing'
    domain: 'app'
    ui:
      css: 'static/billing.css'
      script: ''
      dynamic: 'ui/billing.ts'
    api:
      - route_match: '/portal'
        file: 'api/billing-portal.ts'
        input: []
        output:
          - name: 'portalUrl'
            type: 'string'
      - route_match: '/status'
        file: 'api/subscription-status.ts'
        input: []
        output:
          - name: 'hasSubscription'
            type: 'string'
          - name: 'status'
            type: 'string'
```

---

## Best Practices

1. **Always verify payments server-side**: Never trust client-side payment confirmation
2. **Handle webhook events**: Stripe webhooks notify you of subscription changes
3. **Provide clear pricing**: Display prices in local currency with tax information
4. **Offer trial periods**: Let users try before they buy
5. **Make cancellation easy**: Use Stripe Customer Portal for transparency
6. **Store subscription metadata**: Keep local records for quick access checks
7. **Use UI fragments**: Leverage `sdk.utilities.ui` for consistent, pre-built payment UI components

## Related Documentation

- [Platform SDK Reference](./SDK_REFERENCE.md) - Full API documentation
- [Authentication Guide](./AUTHENTICATION.md) - User authentication
- [Bundle.yaml Reference](./BUNDLE_YAML.md) - Workflow bundle implementation
