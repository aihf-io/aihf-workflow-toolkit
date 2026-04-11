# AI Worker Task Example

Document analysis workflow demonstrating:

- Document upload and parsing
- Work domain processing (AI Worker Service or human)
- Human review for low-confidence results
- Task progression between app and work domains

## Structure

```
ai-worker-task/
├── workflow.yaml           # Step flow and routing logic
├── bundle.yaml             # Implementation manifest
├── config/
│   └── config.json
└── src/
    ├── api/
    │   ├── submit-document.ts
    │   ├── ai-analyze.ts
    │   └── approve-analysis.ts
    └── ui/
        ├── upload.ts
        ├── review.ts
        └── results.ts
```

## Workflow Steps

1. **Upload** (`/upload`, domain: `app`) - User uploads document
2. **Analyze** (`/analyze`, domain: `work`) - Worker analyzes content
3. **Review** (`/review`, domain: `work`) - Human reviews low-confidence results
4. **Results** (`/results`, domain: `app`) - User views analysis

## Key Concepts Demonstrated

### Domain Separation

- `app` domain: Customer-facing steps
- `work` domain: Internal processing (AI Worker Service or human workers)

### Work Domain Processing

Work domain steps are processed by any worker with appropriate group membership. The AI Worker Service polls these steps and executes handler code automatically:

```typescript
// src/api/ai-analyze.ts
export async function invokedByAIHF(
  sdk: AIHFPlatform,
  workflowName: string,
  workflowVersion: number,
  workflowStepId: string,
  taskId: string,
  sanitisedInput: string
): Promise<Response | null> {
  const { documentId } = JSON.parse(sanitisedInput);

  // Query document text from the database
  const doc = await sdk.database.queryOne(workflowName,
    'SELECT text_content FROM documents WHERE id = ?',
    [documentId]
  );

  // Your analysis logic here
  const analysis = analyzeContent(doc.text_content);

  // Store results for downstream steps
  sdk.tasks.setStepData(JSON.stringify({ documentId, analysis }));

  // Return hasWork: true to indicate work was done
  return new Response(JSON.stringify({
    hasWork: true,
    analysis
  }));
}
```

### Confidence-Based Routing

```typescript
if (analysis.confidence >= 0.85) {
  // High confidence - auto-approve, store step data for results step
  sdk.tasks.setStepData(JSON.stringify({ documentId, analysis, autoApproved: true }));
} else {
  // Needs human review, store step data for review step
  sdk.tasks.setStepData(JSON.stringify({ documentId, analysis, needsReview: true }));
}
```

### The hasWork Pattern

Work domain handlers must return `hasWork` to indicate completion status:

| hasWork | What Happens |
|---------|--------------|
| `true` | Task completes, moves to next step |
| `false` | Task is deferred, retried later |

### Human Review

```typescript
// In review handler - store result data for next step
if (approved) {
  sdk.tasks.setStepData(JSON.stringify({ analysis: finalAnalysis, approved: true }));
} else {
  // Store feedback for re-analysis
  sdk.tasks.setStepData(JSON.stringify({ documentId, feedback: corrections }));
}
```

## AIHF Equality Model

AI and human workers are treated identically in AIHF. Both can process work domain steps based on group membership. The AI Worker Service simply processes tasks faster (cron schedule, parallel execution), but a human worker with the right permissions could process the same "analyze" step manually.
