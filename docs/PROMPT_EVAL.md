# Prompt Evaluation Guide

Test and tune AI instruction prompts before deploying to production.

## Overview

AIHF workflows use instruction YAML files to define AI cognitive tasks — each containing `task_instructions`, `business_rules`, `expected_output_schema`, and `confidence_threshold`. These instructions are sent to Claude via the AI Worker Service to power automated workflow steps.

The `aihf eval` command lets you:

1. Load an instruction YAML + sample test data
2. Assemble prompts exactly as the AI Worker Service does in production
3. Call the Claude API directly with the same prompt structure
4. Run multiple iterations per test case to measure consistency
5. Validate outputs against the instruction's `expected_output_schema`
6. Report metrics: schema compliance, confidence distribution, token usage, consistency

```
┌─────────────────────────────────────────────────────────────┐
│                    aihf eval Pipeline                         │
│                                                              │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐   │
│  │ Instruction  │    │  Test Data   │    │  Claude API  │   │
│  │    YAML      │───▶│  (N cases)   │───▶│  (N x runs)  │   │
│  └──────────────┘    └──────────────┘    └──────┬───────┘   │
│                                                  │           │
│                                           ┌──────▼───────┐  │
│                                           │   Validate   │  │
│                                           │   + Report   │  │
│                                           └──────────────┘  │
│                                                              │
│  Metrics: Schema compliance · Assertion pass rate            │
│           Confidence distribution · Consistency scoring      │
│           Token usage · Cost estimate                        │
└─────────────────────────────────────────────────────────────┘
```

## Quick Start

```bash
# 1. Create a test dataset for your instruction
# 2. Run eval with 3 iterations per test case (default)
aihf eval ./my-workflow \
  --instructions src/instructions/analysis.instruction.yaml \
  --dataset test-data/scenarios.json

# 3. Compare across models
aihf eval ./my-workflow \
  -i src/instructions/analysis.instruction.yaml \
  -d test-data/scenarios.json \
  -m claude-haiku-4-5-20251001

# 4. Save JSON report for comparison
aihf eval ./my-workflow \
  -i src/instructions/analysis.instruction.yaml \
  -d test-data/scenarios.json \
  -o report-sonnet.json
```

## Command Reference

```
aihf eval [bundle-path]
```

| Option | Short | Default | Description |
|--------|-------|---------|-------------|
| `--instructions <file>` | `-i` | *required* | Instruction YAML to evaluate (relative to bundle path) |
| `--dataset <file>` | `-d` | *required* | Test dataset JSON file |
| `--model <model>` | `-m` | `claude-sonnet-4-5-20250929` | Claude model ID |
| `--temperature <n>` | `-t` | `0.1` | Temperature (0.0–1.0) |
| `--runs <n>` | `-r` | `3` | Iterations per test case |
| `--max-tokens <n>` | | `4096` | Max output tokens |
| `--output <file>` | `-o` | | Save report to JSON file |
| `--api-key <key>` | | `$ANTHROPIC_API_KEY` | Anthropic API key |
| `--verbose` | | `false` | Show full Claude responses |
| `--grade` | | `false` | Enable model-based grading (LLM-as-judge) |
| `--grader-model <model>` | | same as `--model` | Model to use for grading |

### API Key

The eval command requires an Anthropic API key. Provide it via:

1. Environment variable: `export ANTHROPIC_API_KEY=sk-ant-...`
2. Command flag: `--api-key sk-ant-...`

## Instruction YAML Format

The eval command uses the same instruction YAML files that the AI Worker Service uses in production. These are typically located in `src/instructions/` within your workflow bundle.

```yaml
# src/instructions/invoice-validation.instruction.yaml
assigned_to: "ai-workers"

task_instructions: |
  Review the submitted invoice data for compliance.

  For each line item:
  1. Check that the amount is within the approved range
  2. Verify the category is valid
  3. Flag any duplicate entries
  4. Calculate total and compare with stated total

business_rules: |
  - Maximum single line item: $10,000
  - Valid categories: travel, office, software, consulting
  - Duplicate entries must be flagged
  - Total variance > $1.00 requires escalation

expected_output_schema:
  type: object
  required: [validation_passed, issues, total_calculated, confidence]
  properties:
    validation_passed:
      type: boolean
    issues:
      type: array
      items:
        type: object
        properties:
          severity:
            type: string
            enum: [critical, high, medium, low]
          description:
            type: string
    total_calculated:
      type: number
    confidence:
      type: number
      minimum: 0
      maximum: 1

confidence_threshold: 0.85
```

## Test Dataset Format

Test datasets are JSON files containing test cases that mirror the data structure your workflow handlers receive.

```json
{
  "description": "Invoice validation test scenarios",
  "system_prompt_override": null,
  "test_cases": [
    {
      "name": "Valid simple invoice",
      "inputs": {
        "invoice_number": "INV-001",
        "vendor": "Acme Corp",
        "line_items": [
          { "description": "Software license", "category": "software", "amount": 499.99 },
          { "description": "Cloud hosting", "category": "software", "amount": 199.00 }
        ],
        "stated_total": 698.99
      },
      "previous_steps_output": {
        "upload": { "uploaded_by": "user-123", "filename": "invoice.xlsx" }
      },
      "expected": {
        "validation_passed": true,
        "confidence": { "min": 0.8 }
      }
    },
    {
      "name": "Invoice with invalid category",
      "inputs": {
        "invoice_number": "INV-002",
        "vendor": "Widget Inc",
        "line_items": [
          { "description": "Party supplies", "category": "entertainment", "amount": 250.00 }
        ],
        "stated_total": 250.00
      },
      "previous_steps_output": {},
      "expected": {
        "validation_passed": false,
        "issues": { "contains": "category" }
      }
    },
    {
      "name": "Invoice exceeding line item limit",
      "inputs": {
        "invoice_number": "INV-003",
        "vendor": "Big Consulting",
        "line_items": [
          { "description": "Strategy engagement", "category": "consulting", "amount": 15000.00 }
        ],
        "stated_total": 15000.00
      },
      "previous_steps_output": {},
      "expected": {
        "validation_passed": false,
        "issues": { "contains": "10,000" },
        "confidence": { "min": 0.7 }
      }
    }
  ]
}
```

### Test Case Fields

| Field | Required | Description |
|-------|----------|-------------|
| `name` | Yes | Human-readable test case name |
| `inputs` | Yes | Maps to `WorkflowStepContext.taskData.inputs` — the data your handler receives |
| `previous_steps_output` | No | Maps to `WorkflowStepContext.previousStepsOutput` — data from prior steps |
| `expected` | No | Optional assertions for automated pass/fail checking |

### Expected Assertions

The `expected` field supports several assertion types using dot-notation paths into the response:

| Assertion | Example | Meaning |
|-----------|---------|---------|
| Exact match | `"validation_passed": true` | Value must equal `true` |
| Dot-path | `"recommended_schedule.type": "WEEKLY"` | Traverse nested objects |
| Minimum | `"confidence": { "min": 0.7 }` | Number must be >= 0.7 |
| Maximum | `"risk_score": { "max": 50 }` | Number must be <= 50 |
| Contains (string) | `"reasoning": { "contains": "category" }` | String includes substring |
| Contains (array) | `"issues": { "contains": "duplicate" }` | Array item includes substring |

### System Prompt Override

Set `system_prompt_override` to replace the default AIHF system prompt with a custom one for testing. Set to `null` to use the production system prompt (recommended for realistic evaluation).

## Understanding the Report

### Console Output

```
─────────────────────────────────────────────────────────────────
  AIHF Prompt Evaluation Report
  Model: claude-sonnet-4-5-20250929  Temperature: 0.1
  Instruction: invoice-validation.instruction.yaml
  Test cases: 3  Runs per case: 3  Total calls: 9
─────────────────────────────────────────────────────────────────
  Schema Compliance:  9/9 (100.0%)
  Assertion Pass:     8/9 (88.9%)
  Avg Confidence:     0.87 (σ=0.04)
  Avg Latency:        2.1s
  Total Tokens:       36,100 in / 9,300 out
  Est. Cost:          $0.25

  Per Test Case:
  Test Case                           Schema    Assert    Conf
  ───────────────────────────────────────────────────────────────
  Valid simple invoice                 3/3       3/3       0.92
  Invoice with invalid category        3/3       3/3       0.88
  Invoice exceeding line item limit    3/3       2/3       0.81

  Consistency (across all runs):
  validation_passed                    9/9 (100.0%)
  total_calculated                     9/9 (100.0%)
  issues                               7/9 (77.8%)

  Tip: Low consistency fields — consider lower temperature or more specific prompts

  Schema Violations: None
─────────────────────────────────────────────────────────────────
```

### Metrics Explained

| Metric | What It Measures | Why It Matters |
|--------|-----------------|----------------|
| **Schema Compliance** | How many responses match `expected_output_schema` | Ensures Claude returns parseable, structurally valid output |
| **Assertion Pass** | How many responses pass `expected` checks | Measures correctness against known-good answers |
| **Avg Confidence** | Mean of the `confidence` field across all runs | Indicates how certain the model is about its output |
| **Confidence StdDev (σ)** | Variation in confidence across runs | High σ means the model is inconsistent in its self-assessment |
| **Consistency** | For each output field, how often runs produce the same value | The key metric for prompt tuning — low consistency means the prompt is ambiguous |
| **Est. Cost** | Estimated API cost based on token usage and model pricing | Helps plan budget for production usage |

### Consistency Scoring

Consistency is the most important metric for prompt tuning. For each output field, it counts how many runs produced the most common value:

- **100% consistency**: Every run produces the same value — the prompt is deterministic for this field
- **80-99% consistency**: Mostly stable, occasional variation — acceptable for most use cases
- **Below 80%**: The prompt is ambiguous for this field — consider:
  - Lowering temperature (e.g., `--temperature 0.0`)
  - Making business rules more specific
  - Adding examples to `task_instructions`
  - Simplifying the expected output schema

## Model-Based Grading

Deterministic checks (schema validation, assertions) catch structural issues but can't evaluate whether the *content* of a response is correct — whether reasoning is sound, analysis is accurate, or business rules were applied properly.

Model-based grading (LLM-as-judge) adds a second Claude call per run that evaluates the response against user-defined criteria and produces scores + qualitative feedback. This is opt-in via `--grade` to avoid doubling API cost by default.

### Enabling Grading

```bash
# Grade with the same model used for evaluation
aihf eval . -i src/instructions/analysis.yaml -d test-data/scenarios.json --grade

# Use a different (cheaper or more capable) model for grading
aihf eval . -i src/instructions/analysis.yaml -d test-data/scenarios.json \
  --grade --grader-model claude-haiku-4-5-20251001
```

### Dataset Format for Grading

Add a `grading` field to your test dataset JSON:

```json
{
  "description": "Invoice validation scenarios",
  "grading": {
    "criteria": [
      "Correctly identifies all line item issues",
      "Total calculation is accurate",
      "Severity levels are appropriate",
      "Reasoning clearly references business rules"
    ],
    "grader_instructions": "Focus on whether the AI applied the $10,000 line item limit correctly"
  },
  "test_cases": [
    {
      "name": "Over-limit invoice",
      "inputs": { "..." : "..." },
      "expected": { "validation_passed": false },
      "ideal_response": "Optional reference answer the grader can compare against"
    }
  ]
}
```

| Field | Required | Description |
|-------|----------|-------------|
| `grading.criteria` | Yes (for grading) | List of rubric criteria, each scored 1–5 |
| `grading.grader_instructions` | No | Extra context or focus areas for the grader |
| `test_cases[].ideal_response` | No | Per-case reference answer the grader can compare against |

If `--grade` is enabled but the dataset has no `grading.criteria`, a warning is shown and grading is skipped.

### Grading Report Output

When `--grade` is active, the console report adds a grading section:

```
  Schema Compliance:  9/9 (100.0%)
  Assertion Pass:     8/9 (88.9%)
  Model Grading:      avg 4.2/5.0

  Per Test Case:
  Test Case                           Schema    Assert    Conf    Grade
  ─────────────────────────────────────────────────────────────────────
  Valid simple invoice                 3/3       3/3       0.92    4.7
  Invoice with invalid category        3/3       3/3       0.88    4.3
  Invoice exceeding line item limit    3/3       2/3       0.81    3.5

  Grading Breakdown:
  Correctly identifies all issues       avg 4.3/5
  Total calculation is accurate         avg 4.8/5
  Severity levels are appropriate       avg 3.9/5
  Reasoning references business rules   avg 3.7/5
```

The JSON report adds `gradingResult` per run and `gradingSummary` in the top-level report object.

### Grading Tips

- **Criteria should be specific and measurable** — "Correctly identifies all line item issues" is better than "Good analysis"
- **Use `grader_instructions`** to focus the grader on what matters most for your use case
- **`ideal_response`** is most useful for complex reasoning tasks where the grader benefits from a reference
- **Grading adds ~1 extra API call per run** — use `--grader-model claude-haiku-4-5-20251001` to reduce cost
- **Grading scores below 3.0** indicate the prompt needs significant improvement for that criterion

## Common Workflows

### Tuning Temperature

Run the same dataset at different temperatures to find the sweet spot:

```bash
# Very deterministic
aihf eval . -i src/instructions/analysis.yaml -d test-data/scenarios.json -t 0.0 -o report-t0.json

# Slightly creative (default)
aihf eval . -i src/instructions/analysis.yaml -d test-data/scenarios.json -t 0.1 -o report-t01.json

# More creative
aihf eval . -i src/instructions/analysis.yaml -d test-data/scenarios.json -t 0.3 -o report-t03.json
```

Compare the JSON reports to find the temperature that maximizes consistency while maintaining accuracy.

### Comparing Models

Test the same prompt across model families to balance cost vs. quality:

```bash
# Sonnet (balanced)
aihf eval . -i src/instructions/analysis.yaml -d test-data/scenarios.json \
  -m claude-sonnet-4-5-20250929 -o report-sonnet.json

# Haiku (fast, cheap)
aihf eval . -i src/instructions/analysis.yaml -d test-data/scenarios.json \
  -m claude-haiku-4-5-20251001 -o report-haiku.json
```

If Haiku achieves similar schema compliance and consistency at 1/4 the cost, it may be the right choice for your workflow.

### Iterating on Prompts

1. Write your instruction YAML with initial `task_instructions` and `business_rules`
2. Create a test dataset with 3-5 representative scenarios including edge cases
3. Run eval with 5 runs per case:
   ```bash
   aihf eval . -i src/instructions/analysis.yaml -d test-data/scenarios.json -r 5
   ```
4. Check the report — low consistency or failed assertions indicate prompt issues
5. Refine `task_instructions` or `business_rules` in the instruction YAML
6. Re-run eval — compare reports to measure improvement
7. Deploy when schema compliance is 100% and consistency exceeds 90%

### Verbose Mode for Debugging

Use `--verbose` to see full Claude responses for each run. This helps diagnose why assertions fail or schema violations occur:

```bash
aihf eval . -i src/instructions/analysis.yaml -d test-data/scenarios.json --verbose
```

Verbose output includes:
- Full parsed JSON response for each run
- Individual schema violations with field paths
- Failed assertion details with expected vs. actual values

## JSON Report Format

When using `--output report.json`, the full report is saved for programmatic analysis:

```json
{
  "timestamp": "2025-03-15T10:30:00.000Z",
  "instruction": "analysis.instruction.yaml",
  "model": "claude-sonnet-4-5-20250929",
  "temperature": 0.1,
  "runsPerCase": 3,
  "totalCalls": 9,
  "summary": {
    "schemaCompliance": { "passed": 9, "total": 9, "rate": 1.0 },
    "assertionPass": { "passed": 8, "total": 9, "rate": 0.889 },
    "avgConfidence": 0.87,
    "confidenceStdDev": 0.04,
    "avgLatencyMs": 2100,
    "totalInputTokens": 36100,
    "totalOutputTokens": 9300,
    "estimatedCost": 0.25
  },
  "testCases": [
    {
      "name": "Valid simple invoice",
      "schemaPass": 3,
      "schemaTotal": 3,
      "assertionPass": 3,
      "assertionTotal": 3,
      "avgConfidence": 0.92,
      "consistency": {
        "validation_passed": { "agreed": 3, "total": 3, "values": ["true", "true", "true"] }
      },
      "runs": [
        {
          "runIndex": 0,
          "success": true,
          "parsedJson": { "...": "full response" },
          "schemaViolations": [],
          "assertionResults": [
            { "path": "validation_passed", "passed": true, "expected": true, "actual": true }
          ],
          "latencyMs": 2100,
          "inputTokens": 4011,
          "outputTokens": 1033
        }
      ]
    }
  ],
  "consistencySummary": {
    "validation_passed": { "agreed": 9, "total": 9, "rate": 1.0 },
    "total_calculated": { "agreed": 9, "total": 9, "rate": 1.0 }
  }
}
```

## How It Works

### Prompt Assembly

The eval command assembles prompts using the exact same template as the AI Worker Service's `buildContextAwarePrompt()` in `task-executor.ts`. This ensures evaluation results are representative of production behavior:

```
# Workflow Task Execution

You are executing step "{step-name}" in an evaluation run.

## Task Instructions
{from instruction YAML}

## Business Rules
{from instruction YAML}

## Task Input Data
{from test case inputs}

## Previous Steps Output
{from test case previous_steps_output}

## Expected Output Schema
{from instruction YAML}

## Confidence Threshold (if set)
{from instruction YAML}

## Your Task
Execute this cognitive task...
```

The system prompt matches `PromptTemplates.SYSTEM_PROMPT_BUSINESS_TASKS` from the production AI Worker Service.

### Schema Validation

The eval command validates each Claude response against the instruction's `expected_output_schema` using a built-in JSON Schema validator. It checks:

- **type** — `string`, `number`, `boolean`, `object`, `array`
- **required** — required object properties
- **enum** — allowed values
- **minimum / maximum** — numeric bounds
- **items** — array item schema (recursive)
- **minItems / maxItems** — array length constraints
- **properties** — nested object schemas (recursive)

## Tips

- **Start with 3 runs** — enough to spot inconsistencies without excessive API cost
- **Use 5+ runs for final validation** — more runs give a clearer consistency picture
- **Temperature 0.0–0.1** is typical for business rule tasks — higher values increase creativity but reduce consistency
- **Edge cases matter** — include boundary conditions and unusual inputs in your test dataset
- **Schema compliance should be 100%** — if Claude can't produce valid JSON, the instruction needs clearer output format guidance
- **Compare costs across models** — Haiku is ~4x cheaper than Sonnet and often sufficient for structured extraction tasks

## Related Documentation

- [AI Workers](./AI_WORKERS.md) - How the AI Worker Service executes instructions in production
- [Workflow.yaml Reference](./WORKFLOW_YAML.md) - Steps, conditions, and routing logic
- [Bundle.yaml Reference](./BUNDLE_YAML.md) - Routes, domains, UI, and API handlers
- [SDK Reference](./SDK_REFERENCE.md) - Full API documentation
