# Containers API

Sandboxed compute environments (Jupyter, Python, Node.js) launched from workflow handlers via `sdk.containers`.

## Overview

The Containers API lets workflow handlers launch isolated compute containers, write files into them, install packages, execute code on Jupyter kernels, and stream output back to users. Containers run as Cloudflare Durable Objects with per-tenant isolation.

```typescript
// Launch a Jupyter container from a workflow handler
const session = await sdk.containers.launch({
  image: 'jupyter-science',
  taskId,
  blockId: 'analysis-block',
});

// Write files, install packages, sandbox, start Jupyter
await sdk.containers.writeFiles(session.sessionId, [
  { path: 'notebook.ipynb', content: notebookJson },
]);
await sdk.containers.installRequirements(session.sessionId, {
  requirements: ['numpy', 'pandas'],
});
await sdk.containers.disableInternet(session.sessionId);
await sdk.containers.signalReady(session.sessionId);

// Execute code on the kernel
await sdk.containers.connectKernel(session.sessionId);
const { executionId } = await sdk.containers.execute(session.sessionId, 'print(1+1)');
const output = await sdk.containers.getOutput(session.sessionId, 0);
```

## Available Images

| Image | Description | App Port |
|-------|-------------|----------|
| `jupyter-science` | Python 3.12 with scientific stack (NumPy, Pandas, SciPy, Matplotlib, etc.) | 8888 |
| `python-minimal` | Lightweight Python runtime | 8888 |
| `node` | Node.js 22 runtime | 8888 |

Each image maps to a separate Durable Object class and Dockerfile in the container service.

## Container Lifecycle

```
launch() ──▶ writeFiles() ──▶ installRequirements() ──▶ disableInternet() ──▶ signalReady()
                                                                                    │
                                                                                    ▼
                                                                            Container ready
                                                                                    │
                                                                                    ▼
                                                                    connectKernel() / execute()
                                                                    getOutput() / interrupt()
                                                                    complete() / kernelStatus()
                                                                                    │
                                                                                    ▼
                                                                                 stop()
```

1. **`launch()`** — Create a new container session. Returns a `ContainerSession` with `sessionId`.
2. **`writeFiles()`** — Write files into the container's `/workspace` directory.
3. **`installRequirements()`** — Install Python packages via pip (optional).
4. **`disableInternet()`** — Drop network egress for sandboxed execution (optional).
5. **`signalReady()`** — Tell the bootstrap service to start the application (e.g., Jupyter).
6. **Use the container** — Connect to the kernel, execute code, poll output, proxy requests.
7. **`stop()`** — Stop the container and free the Durable Object.

## Lifecycle Methods

### launch(config)

Launch a new container session.

**Permission:** `containers.launch`

```typescript
const session = await sdk.containers.launch({
  image: 'jupyter-science',
  taskId: 'task_abc123',
  blockId: 'jupyter-block',
  envVars: { MODEL: 'gpt-4' },
  cpu: 2,
  memoryMb: 1024,
  timeoutSeconds: 3600,
  allowedIndexUrls: ['https://pypi.org/simple/'],
  deniedPackages: ['os', 'subprocess'],
});
```

**Parameters:**

```typescript
interface ContainerLaunchConfig {
  image: string;                    // Container image: 'jupyter-science' | 'python-minimal' | 'node'
  taskId: string;                   // AIHF task ID
  blockId: string;                  // Logical block identifier
  envVars?: Record<string, string>; // Environment variables injected into container
  cpu?: number;                     // CPU allocation
  memoryMb?: number;                // Memory allocation in MB
  timeoutSeconds?: number;          // Container timeout
  allowedIndexUrls?: string[];      // Allowed pip index URLs
  deniedPackages?: string[];        // Blocked package names
}
```

**Returns:** `ContainerSession`

```typescript
interface ContainerSession {
  sessionId: string;          // Unique session identifier
  orgId: string;              // Tenant organization ID
  entityId: string;           // Entity that launched the container
  taskId: string;             // Associated AIHF task
  blockId: string;            // Logical block identifier
  doId: string;               // Durable Object ID
  status: ContainerState;     // 'launching' | 'ready' | 'error' | 'stopped'
  createdAt: number;          // Unix timestamp
  lastActiveAt: number;       // Unix timestamp of last activity
  internetDisabled: boolean;  // Whether egress is disabled
  image: string;              // Container image name
  bootstrapPort: number;      // Bootstrap service port (9999)
  appPort: number;            // Application port (8888 for Jupyter)
}
```

---

### writeFiles(sessionId, files)

Write a batch of files into the container's `/workspace` directory.

**Permission:** `containers.write`

```typescript
await sdk.containers.writeFiles(session.sessionId, [
  { path: 'notebook.ipynb', content: notebookJson },
  { path: 'data/input.csv', content: csvData },
  { path: 'requirements.txt', content: 'numpy\npandas==2.1.0' },
  { path: 'image.png', content: base64Data, encoding: 'base64' },
]);
```

**Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `sessionId` | `string` | Container session ID |
| `files` | `ContainerFile[]` | Files to write |

```typescript
interface ContainerFile {
  path: string;                     // File path relative to /workspace
  content: string;                  // File content (UTF-8 or base64)
  encoding?: 'utf8' | 'base64';    // Content encoding (default: 'utf8')
  mode?: string;                    // POSIX mode bits, e.g. '0644'
}
```

**Returns:** `void`

---

### proxy(sessionId, request)

Proxy an HTTP or WebSocket request to the container's application port (8888 for Jupyter).

**Permission:** `containers.proxy`

```typescript
// Inside a workflow API handler:
return sdk.containers.proxy(session.sessionId, request);
```

Use this to expose Jupyter Lab/Server to users through the AIHF gateway, including kernel WebSocket channels.

**Returns:** `Response`

---

### status(sessionId)

Get the current status of a container session.

```typescript
const status = await sdk.containers.status(session.sessionId);
if (status.appReady) {
  // Jupyter is up and ready
}
```

**Returns:** `ContainerStatus`

```typescript
interface ContainerStatus {
  sessionId: string;          // Session ID
  state: ContainerState;      // 'launching' | 'ready' | 'error' | 'stopped'
  bootstrapReady: boolean;    // Bootstrap service is up
  appReady: boolean;          // Application (e.g. Jupyter) is up
  lastHeartbeat: number;      // Unix timestamp
  cpuUsagePct?: number;       // CPU usage percentage (if available)
  memoryUsageMb?: number;     // Memory usage in MB (if available)
}
```

---

### installRequirements(sessionId, cfg)

Install Python packages inside the container via pip.

**Permission:** `containers.install`

Per-tenant package allowlists (`allowedIndexUrls`) and blocklists (`deniedPackages`) configured at launch time are enforced by the container's bootstrap service.

```typescript
const result = await sdk.containers.installRequirements(session.sessionId, {
  requirements: ['numpy', 'pandas==2.1.0', 'scikit-learn'],
  timeoutSeconds: 300,
});

if (!result.success) {
  console.error('Failed packages:', result.failed);
}
```

**Parameters:**

```typescript
interface RequirementsInstallConfig {
  requirements: string[];       // Package specifiers (pip format)
  indexUrl?: string;            // Custom pip index URL
  extraIndexUrls?: string[];    // Additional pip index URLs
  timeoutSeconds?: number;      // Installation timeout
}
```

**Returns:** `RequirementsInstallResult`

```typescript
interface RequirementsInstallResult {
  success: boolean;                                  // All packages installed
  installed: string[];                               // Successfully installed packages
  failed: Array<{ package: string; error: string }>; // Failed packages with errors
  stdout: string;                                    // pip stdout
  stderr: string;                                    // pip stderr
}
```

---

### disableInternet(sessionId)

Drop network egress from the container. Call this after `installRequirements()` to create a network-isolated execution sandbox.

```typescript
await sdk.containers.installRequirements(session.sessionId, {
  requirements: ['numpy'],
});
await sdk.containers.disableInternet(session.sessionId); // Sandbox the kernel
await sdk.containers.signalReady(session.sessionId);
```

Best-effort: relies on iptables/ip route inside the container. The orchestrator should also enforce egress at the network layer in production.

**Returns:** `void`

---

### signalReady(sessionId)

Signal the bootstrap service to start the application (e.g., Jupyter on port 8888). Call this after `writeFiles()`, `installRequirements()`, and (optionally) `disableInternet()` have completed.

```typescript
await sdk.containers.signalReady(session.sessionId);
```

**Returns:** `void`

---

### stop(sessionId)

Stop the container and free the underlying Durable Object. Idempotent — safe to call on an already-stopped session.

```typescript
try {
  await runWorkflowSteps(session.sessionId);
} finally {
  await sdk.containers.stop(session.sessionId);
}
```

**Returns:** `void`

---

## Kernel Methods

The kernel methods provide a Jupyter kernel bridge for executing code and streaming output. The bridge buffers output messages in a Durable Object SQLite store, allowing clients to poll with a cursor.

### connectKernel(sessionId)

Connect to the Jupyter kernel inside the container. Creates a kernel if none exists and opens the DO-side WebSocket bridge to buffer output.

**Permission:** `containers.connect`

```typescript
const { kernelId, state } = await sdk.containers.connectKernel(session.sessionId);
// kernelId: unique kernel identifier
// state: 'idle' | 'busy' | 'starting' | 'error' | 'dead' | 'unknown'
```

**Returns:** `KernelConnectResult`

```typescript
interface KernelConnectResult {
  kernelId: string;
  state: KernelState;  // 'idle' | 'busy' | 'starting' | 'error' | 'dead' | 'unknown'
}
```

---

### execute(sessionId, code)

Submit code for execution on the container's Jupyter kernel.

**Permission:** `containers.execute`

```typescript
const { executionId } = await sdk.containers.execute(
  session.sessionId,
  'import numpy as np\nprint(np.array([1, 2, 3]))'
);
```

**Returns:** `KernelExecuteResult`

```typescript
interface KernelExecuteResult {
  executionId: string;  // Unique execution ID for tracking
}
```

---

### getOutput(sessionId, cursor)

Read kernel output messages since the given cursor. Returns a batch of messages plus the new cursor position and current kernel state.

Callers should poll with exponential backoff when the batch is empty.

```typescript
let cursor = 0;
const batch = await sdk.containers.getOutput(session.sessionId, cursor);
for (const msg of batch.messages) {
  console.log(msg.msgType, msg.content);
}
cursor = batch.cursor; // Use for next poll
```

**Returns:** `KernelOutputBatch`

```typescript
interface KernelOutputBatch {
  messages: KernelMessage[];  // Output messages since cursor
  cursor: number;             // New cursor position
  kernelState: KernelState;   // Current kernel state
}

interface KernelMessage {
  msgType: string;                    // Jupyter message type (e.g. 'stream', 'execute_result')
  parentMsgId?: string;               // Parent message ID
  content: Record<string, unknown>;   // Message content (varies by type)
  channel: string;                    // Jupyter channel ('iopub', 'shell', etc.)
  receivedAt: number;                 // Unix timestamp
}
```

---

### interrupt(sessionId)

Interrupt the currently executing cell. Sends a `KeyboardInterrupt` to the kernel via the Jupyter REST API.

**Permission:** `containers.interrupt`

```typescript
await sdk.containers.interrupt(session.sessionId);
```

**Returns:** `void`

---

### complete(sessionId, code, cursorPos)

Request tab completion from the kernel at the given cursor position.

**Permission:** `containers.execute`

```typescript
const { matches, cursorStart, cursorEnd } = await sdk.containers.complete(
  session.sessionId,
  'np.arr',
  6
);
// matches: ['array', 'array_equal', 'array_repr', ...]
```

**Returns:** `KernelCompleteResult`

```typescript
interface KernelCompleteResult {
  matches: string[];    // Completion suggestions
  cursorStart: number;  // Start position of the token being completed
  cursorEnd: number;    // End position of the token being completed
}
```

---

### kernelStatus(sessionId)

Get kernel status including the DO output buffer size.

```typescript
const { kernelId, state, bufferSize } = await sdk.containers.kernelStatus(
  session.sessionId
);
```

**Returns:** `KernelStatusResult`

```typescript
interface KernelStatusResult {
  kernelId: string;     // Kernel identifier
  state: KernelState;   // Current kernel state
  bufferSize: number;   // Number of buffered output messages
}
```

---

### pruneOutput(sessionId, cursor)

Prune the kernel output buffer up to (and including) the given cursor. Call this periodically (e.g., every 30 seconds) with your last acknowledged cursor to keep DO SQLite storage bounded.

```typescript
await sdk.containers.pruneOutput(session.sessionId, lastAcknowledgedCursor);
```

**Returns:** `void`

---

## Lifecycle Limits

| Constant | Value | Description |
|----------|-------|-------------|
| `MAX_CONTAINER_TTL_MS` | 4 hours | Maximum container lifetime before forced shutdown |
| `IDLE_TIMEOUT_MS` | 30 minutes | Containers idle beyond this are stopped |
| `STOPPED_GRACE_MS` | 5 minutes | Stopped session registry entries pruned after this |

A housekeeper cron job enforces these limits. Containers that exceed `MAX_CONTAINER_TTL_MS` or sit idle beyond `IDLE_TIMEOUT_MS` are automatically stopped. Session registry entries for stopped containers are pruned after `STOPPED_GRACE_MS`.

## SSE Streaming Pattern

For real-time kernel output in the browser, use the SSE handler pattern. Declare an SSE handler in `bundle.yaml`:

```yaml
api:
  - route_match: '/jupyter/output'
    file: 'api/jupyter-output.ts'
    input:
      - name: 'sessionId'
        type: 'string'
      - name: 'cursor'
        type: 'string'
        default: '0'
    output:
      - name: 'SSE'
        type: 'Response'
```

The handler exports `invokedByAIHFSSE` and streams kernel output:

```typescript
export async function invokedByAIHFSSE(
  sdk: AIHFPlatform,
  workflowName: string,
  workflowVersion: number,
  workflowStepId: string,
  taskId: string,
  inputs: Record<string, string>
): Promise<Response> {
  const sessionId = inputs.sessionId;
  const startCursor = parseInt(inputs.cursor || '0', 10);

  const { readable, writable } = new TransformStream();
  const writer = writable.getWriter();
  const enc = new TextEncoder();

  (async () => {
    let cursor = startCursor;
    try {
      while (true) {
        const batch = await sdk.containers.getOutput(sessionId, cursor);
        for (const msg of batch.messages) {
          await writer.write(enc.encode(
            `event: kernel_message\nid: ${batch.cursor}\ndata: ${JSON.stringify(msg)}\n\n`
          ));
        }
        cursor = batch.cursor;
        if (batch.messages.length === 0) {
          await new Promise(r => setTimeout(r, 250));
        }
        const status = await sdk.containers.status(sessionId);
        if (status.state === 'stopped' || status.state === 'error') break;
      }
    } catch (e) {
      await writer.write(enc.encode(`event: error\ndata: ${(e as Error).message}\n\n`));
    } finally {
      await writer.close();
    }
  })();

  return new Response(readable, {
    headers: { 'Content-Type': 'text/event-stream' },
  });
}
```

See [Bundle.yaml Reference — Streaming API Handlers (SSE)](./BUNDLE_YAML.md#streaming-api-handlers-sse) for full SSE handler documentation.

## Error Handling

All container methods throw `PlatformError` on failure:

```typescript
import { PlatformError } from '@aihf/platform-sdk';

try {
  const session = await sdk.containers.launch(config);
} catch (error) {
  if (error instanceof PlatformError) {
    console.error('Container launch failed:', error.message);
  }
}
```

Common errors:

| Error | Cause |
|-------|-------|
| Container launch failed | Invalid image, tenant quota exceeded, or service unavailable |
| Session not found | Invalid `sessionId` or session already stopped/pruned |
| Kernel not connected | Called `execute()` before `connectKernel()` |
| Installation timeout | Package install exceeded `timeoutSeconds` |
| Permission denied | Missing required permission (e.g., `containers.launch`) |

## Complete Example

A full Jupyter notebook workflow: launch container, write a notebook, install packages, sandbox, execute cells, and poll output.

```typescript
import { AIHFPlatform } from '@aihf/platform-sdk';

export async function invokedByAIHF(
  sdk: AIHFPlatform,
  workflowName: string,
  workflowVersion: number,
  workflowStepId: string,
  taskId: string,
  sanitisedInput: string
): Promise<Response> {
  // 1. Launch a Jupyter container
  const session = await sdk.containers.launch({
    image: 'jupyter-science',
    taskId,
    blockId: 'data-analysis',
  });

  try {
    // 2. Write files into the container
    await sdk.containers.writeFiles(session.sessionId, [
      {
        path: 'analysis.py',
        content: `
import numpy as np
import pandas as pd

data = pd.DataFrame({'x': np.random.randn(100)})
print(data.describe())
        `.trim(),
      },
    ]);

    // 3. Install additional packages
    const installResult = await sdk.containers.installRequirements(
      session.sessionId,
      { requirements: ['seaborn', 'statsmodels'] }
    );
    if (!installResult.success) {
      throw new Error('Package install failed: ' + JSON.stringify(installResult.failed));
    }

    // 4. Disable internet for sandboxed execution
    await sdk.containers.disableInternet(session.sessionId);

    // 5. Start Jupyter
    await sdk.containers.signalReady(session.sessionId);

    // 6. Connect to the kernel
    const { kernelId } = await sdk.containers.connectKernel(session.sessionId);

    // 7. Execute code
    const { executionId } = await sdk.containers.execute(
      session.sessionId,
      'exec(open("analysis.py").read())'
    );

    // 8. Poll for output
    let cursor = 0;
    let output = '';
    for (let i = 0; i < 60; i++) {
      const batch = await sdk.containers.getOutput(session.sessionId, cursor);
      for (const msg of batch.messages) {
        if (msg.msgType === 'stream') {
          output += (msg.content as { text: string }).text;
        }
      }
      cursor = batch.cursor;
      if (batch.kernelState === 'idle' && batch.messages.length === 0) break;
      await new Promise(r => setTimeout(r, 500));
    }

    // 9. Prune output buffer
    await sdk.containers.pruneOutput(session.sessionId, cursor);

    // 10. Store results
    await sdk.tasks.setStepData({ analysisOutput: output });

    return new Response(JSON.stringify({ success: true, output }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } finally {
    // Always stop the container
    await sdk.containers.stop(session.sessionId);
  }
}
```

## Related Documentation

- [SDK Reference](./SDK_REFERENCE.md) — Full API for all SDK managers including ContainersManager
- [Bundle.yaml Reference](./BUNDLE_YAML.md) — SSE handler declaration for streaming output
- [Workflow Concepts](./WORKFLOW_CONCEPTS.md) — Tasks, steps, and the workflow model
