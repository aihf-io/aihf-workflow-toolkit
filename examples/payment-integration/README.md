# Payment Integration Example

Stripe payment integration demonstrating:

- Subscription plan selection
- Stripe Checkout flow
- Subscription management
- Customer portal access

## Structure

```
payment-integration/
├── bundle.yaml
├── config/
│   └── config.json
└── src/
    ├── api/
    │   ├── get-plans.ts
    │   ├── create-checkout.ts
    │   ├── payment-success.ts
    │   └── billing-portal.ts
    └── ui/
        ├── pricing.ts
        └── billing.ts
```

## Workflow Steps

1. **Pricing** (`/pricing`) - Display available plans
2. **Checkout** (`/checkout`) - Redirect to Stripe
3. **Success** (`/success`) - Handle successful payment
4. **Billing** (`/billing`) - Manage subscription

## Key Concepts Demonstrated

### Creating Checkout Session

```typescript
const entity = await sdk.entities.getCurrentEntity();

const checkout = await sdk.billing.createCheckoutSession({
  entityId: entity.entity_id,
  planId: 'plan_monthly',
  successUrl: 'https://app.example.com/success',
  cancelUrl: 'https://app.example.com/pricing'
});

// Returns: { checkoutUrl, sessionId }
return Response.redirect(checkout.checkoutUrl, 302);
```

### Checking Subscription Status

```typescript
const entity = await sdk.entities.getCurrentEntity();
const subscription = await sdk.billing.getSubscription(entity.entity_id);

if (subscription?.status === 'active') {
  // User has active subscription
}
```

### Customer Portal

```typescript
const portalUrl = await sdk.billing.createPortalSession(
  'https://app.example.com/billing'
);
```
