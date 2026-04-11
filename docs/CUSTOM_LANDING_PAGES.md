# Custom Landing Pages

Tenant-specific App Portal landing pages that replace the default AIHF customer landing.

## Overview

When a user visits the App Portal root (`/`, `/customer`, or `/dashboard`), the platform normally renders the default customer landing page. **Custom landing pages** let tenants replace this with a fully dynamic, SDK-powered page tailored to their application.

Custom landing pages:

- Are **tenant-scoped** — each tenant can have its own landing module
- Receive a full `AIHFPlatform` SDK instance — same as workflow handlers
- Return HTML fragments (not full documents) that the platform injects into the base theme
- Fall back gracefully to the default landing if the custom module errors or times out

## How It Works

```
User visits app portal root
         │
         ▼
    app-router.ts
         │
         ▼
  tenantContext.customLandingUI set?
         │
    ┌────┴────┐
    No       Yes
    │         │
    ▼         ▼
  Default   serveDynamicCustomerUI()
  landing        │
                 ▼
          AIHFCustomerLandingEvaluation
                 │
                 ▼
          dynamic import(handlerPath)
                 │
                 ▼
          renderAIHFCustomerLanding(sdk, tenantId, entityId)
                 │
                 ▼
          CustomerLandingResult { heroContent, mainCardContent, ... }
                 │
                 ▼
          Platform renders into base theme shell
```

1. `app-router.ts` checks `tenantContext.customLandingUI`
2. If set, calls `serveDynamicCustomerUI()` from `customer-ui-server.ts`
3. The server creates an `AIHFCustomerLandingEvaluation` instance with a fresh SDK
4. The evaluator dynamically imports the tenant's module and calls `renderAIHFCustomerLanding()`
5. The returned HTML fragments are injected into the platform's base theme shell

## Module Contract

Your custom landing module must export a named function with this exact signature:

```typescript
import { AIHFPlatform } from '@aihf/platform-sdk';

export async function renderAIHFCustomerLanding(
  sdk: AIHFPlatform,
  tenantId: string,
  entityId: string
): Promise<CustomerLandingResult>;
```

### CustomerLandingResult

```typescript
interface CustomerLandingResult {
  /** HTML for the hero section (top banner area) */
  heroContent: string;
  /** HTML for the main card body (primary content area) */
  mainCardContent: string;
  /** Extra CSS appended to the base theme (optional) */
  additionalCSS?: string;
  /** Extra JavaScript appended to the page (optional) */
  additionalJS?: string;
}
```

**Required fields:**
- `heroContent` — rendered in the hero/banner section of the page
- `mainCardContent` — rendered in the main content card below the hero

**Optional fields:**
- `additionalCSS` — appended after the base theme styles
- `additionalJS` — appended as a `<script>` block at the end of the body

## SDK Access

Your landing module receives a full `AIHFPlatform` instance, the same SDK available to workflow handlers. You can use any manager:

```typescript
export async function renderAIHFCustomerLanding(
  sdk: AIHFPlatform,
  tenantId: string,
  entityId: string
): Promise<CustomerLandingResult> {
  // Fetch the current user
  const entity = await sdk.entities.getCurrentEntity();

  // Query your workflow's database
  const stats = await sdk.database.queryOne(
    'my-workflow',
    'SELECT COUNT(*) as total FROM orders WHERE entity_id = ?',
    [entityId]
  );

  // Use any SDK manager
  const config = await sdk.workflows.getWorkflowConfigHelper('my-workflow', 1);

  return {
    heroContent: `<h1>Welcome, ${entity?.profile?.display_name || 'there'}!</h1>`,
    mainCardContent: `<p>You have ${stats?.total || 0} orders.</p>`,
  };
}
```

## Constraints

| Constraint | Detail |
|-----------|--------|
| **Timeout** | 30 seconds — module must return within this window |
| **Export** | Must export `renderAIHFCustomerLanding` as a named function |
| **Return type** | Must return `{ heroContent: string, mainCardContent: string }` |
| **Error handling** | Errors fall back to the default landing page (not a 500) |
| **HTML format** | Return body fragments, NOT full HTML documents |
| **No `<head>`** | The platform controls `<head>` — put `<style>` in `additionalCSS` |

## Styling Guide

### Scope Your CSS

Use a unique prefix for all CSS classes to avoid conflicts with the platform shell:

```css
/* Good — scoped with prefix */
.kw-hero { font-size: 2.8rem; }
.kw-balance { text-align: center; }

/* Bad — conflicts with platform styles */
.hero { font-size: 2.8rem; }
.balance { text-align: center; }
```

### Use Platform CSS Variables

The base theme exposes CSS variables you can build on:

```css
/* Override gradients with your brand */
.gradient-background {
  background: linear-gradient(135deg,
    rgba(236, 72, 153, 0.08) 0%,
    rgba(59, 130, 246, 0.08) 50%);
}
```

### Wrap JavaScript in an IIFE

Prevent global scope pollution:

```javascript
(function() {
  class MyUIController {
    constructor() { this.initialize(); }
    initialize() { /* ... */ }
  }
  var ui = new MyUIController();
  window.myUI = ui;
})();
```

### Mobile Responsive

The platform renders on all screen sizes. Use responsive breakpoints:

```css
@media (max-width: 768px) {
  .kw-hero .hero-title { font-size: 2rem; }
}

/* Touch-friendly targets */
@media (pointer: coarse) {
  .kw-btn { min-height: 44px; min-width: 44px; }
}
```

## Custom CSS from R2

In addition to `additionalCSS` returned by your module, tenants can load a separate CSS file from R2 storage. This is useful for brand-level overrides that apply regardless of module logic.

Set `customLandingCSS` on the tenant config to a path in the `TENANT_WORKFLOWS_R2` bucket:

```
customLandingCSS: "tenants/acme/landing-overrides.css"
```

The platform loads this CSS via `AIHFCustomerLandingEvaluation.loadCustomCSS()` and appends it after the base theme and after `additionalCSS`. If the file is missing or fails to load, it is silently skipped.

## Configuration

Custom landing pages are configured via the owner portal's Domain Management:

| Field | Type | Description |
|-------|------|-------------|
| `customLandingUI` | `string` | Path to the landing module (dynamic import path) |
| `customLandingCSS` | `string` (optional) | Path to CSS file in `TENANT_WORKFLOWS_R2` bucket |

Both fields are stored on the tenant configuration object. When `customLandingUI` is set, the platform invokes the custom landing flow. When it is not set (or empty), the default customer landing is served.

## Complete Example

This example is based on the KidWeeks calendar landing page — a real implementation that demonstrates SDK data fetching, conditional rendering, tab navigation, and mobile responsiveness.

```typescript
import { AIHFPlatform } from '@aihf/platform-sdk';

export async function renderAIHFCustomerLanding(
  sdk: AIHFPlatform,
  tenantId: string,
  entityId: string
): Promise<{
  heroContent: string;
  mainCardContent: string;
  additionalCSS?: string;
  additionalJS?: string;
}> {
  // 1. Fetch user info via SDK
  const entity = await sdk.entities.getCurrentEntity();
  const displayName = entity?.profile?.display_name || 'there';

  // 2. Query workflow database for user-specific data
  let familyId = null;
  try {
    const result = await sdk.database.queryOne(
      'kidweeks-calendar',
      'SELECT family_id FROM adults WHERE entity_id = ?',
      [entityId]
    );
    familyId = result?.family_id;
  } catch (error) {
    console.log('No family found for entity:', entityId);
  }

  // 3. Return different content based on user state
  return {
    heroContent: `
      <div class="hero-section kw-hero">
        <div class="hero-content">
          <div class="kw-hero-badge">Welcome back, ${displayName}!</div>
          <h1 class="hero-title">
            <span class="kw-pink">KidWeeks</span> Calendar
          </h1>
          <p class="hero-subtitle">AI-powered coordination for co-parents</p>
        </div>
      </div>
    `,
    mainCardContent: familyId
      ? buildDashboardContent()   // Returning user — show dashboard
      : buildOnboardingContent(), // New user — show onboarding
    additionalCSS: `
      .kw-pink { color: #ec4899; }
      .kw-hero-badge {
        display: inline-block;
        padding: 0.5rem 1rem;
        background: rgba(255, 255, 255, 0.25);
        backdrop-filter: blur(10px);
        border-radius: 2rem;
        margin-bottom: 1rem;
      }
      /* ... more scoped styles ... */
    `,
    additionalJS: `
      (function() {
        class KidWeeksUIController {
          constructor() { this.initialize(); }
          initialize() { /* load calendar data, etc. */ }
          switchTab(tabName) { /* tab switching logic */ }
        }
        var ui = new KidWeeksUIController();
        window.kidweeksUI = ui;
      })();
    `
  };
}

function buildDashboardContent(): string {
  return `
    <div class="tab-navigation kw-tabs">
      <button class="tab-btn active" data-tab="calendar"
              onclick="kidweeksUI.switchTab('calendar')">Calendar</button>
      <button class="tab-btn" data-tab="balance"
              onclick="kidweeksUI.switchTab('balance')">Balance</button>
    </div>
    <div class="tab-content-area kw-content">
      <!-- Tab panels here -->
    </div>
  `;
}

function buildOnboardingContent(): string {
  return `
    <div class="kw-onboarding">
      <h2>Get Started with KidWeeks</h2>
      <p>Set up your family calendar in just a few steps.</p>
      <button class="kw-btn kw-btn-primary"
              onclick="window.location='/app/kidweeks-onboarding/1/start'">
        Create Your Family
      </button>
    </div>
  `;
}
```

### Key patterns demonstrated:

1. **SDK data fetching** — uses `sdk.entities.getCurrentEntity()` and `sdk.database.queryOne()` to personalize content
2. **Conditional rendering** — shows different content for new vs. returning users
3. **Scoped CSS** — all classes prefixed with `kw-` to avoid platform conflicts
4. **IIFE-wrapped JS** — JavaScript controller wrapped in `(function() { ... })()`
5. **Tab navigation** — desktop tabs + mobile bottom bar with shared controller
6. **Mobile responsive** — breakpoints at 768px and 480px, touch-friendly targets

## Related Documentation

- [SDK Reference](./SDK_REFERENCE.md) — Full API for all SDK managers
- [Bundle.yaml Reference](./BUNDLE_YAML.md) — Route and handler configuration
- [Getting Started](./GETTING_STARTED.md) — Build your first workflow
