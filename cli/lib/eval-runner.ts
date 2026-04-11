/**
 * Eval Runner — Orchestrates evaluation loop and generates reports
 *
 * For each test case × N runs:
 *   1. Build prompt from instruction + test case
 *   2. Call Claude API
 *   3. Parse JSON response
 *   4. Validate against expected_output_schema
 *   5. Check expected assertions (if any)
 *   6. Record metrics
 */

import chalk from 'chalk';
import { EvalClaudeClient, EvalClaudeResult } from './eval-claude-client.js';
import { validateSchema, checkAssertions, SchemaViolation, AssertionResult } from './schema-validator.js';

// ── Types ──

export interface InstructionYAML {
  assigned_to?: string;
  task_instructions: string;
  business_rules: string;
  expected_output_schema: any;
  confidence_threshold?: number;
}

export interface TestCase {
  name: string;
  inputs: any;
  previous_steps_output?: any;
  expected?: Record<string, any>;
  ideal_response?: string;
}

export interface GradingConfig {
  criteria: string[];
  grader_instructions?: string;
}

export interface CriterionScore {
  score: number;
  reasoning: string;
}

export interface GradingResult {
  overall_score: number;
  criteria_scores: Record<string, CriterionScore>;
  strengths: string[];
  weaknesses: string[];
}

export interface EvalDataset {
  description?: string;
  system_prompt_override?: string | null;
  grading?: GradingConfig;
  test_cases: TestCase[];
}

export interface EvalConfig {
  model: string;
  temperature: number;
  runs: number;
  maxTokens: number;
  verbose: boolean;
  gradeEnabled?: boolean;
  graderModel?: string;
}

interface RunResult {
  runIndex: number;
  claudeResult: EvalClaudeResult;
  schemaViolations: SchemaViolation[];
  assertionResults: AssertionResult[];
  gradingResult?: GradingResult;
}

interface TestCaseResult {
  testCase: TestCase;
  runs: RunResult[];
}

export interface EvalReport {
  timestamp: string;
  instruction: string;
  model: string;
  temperature: number;
  runsPerCase: number;
  totalCalls: number;
  summary: {
    schemaCompliance: { passed: number; total: number; rate: number };
    assertionPass: { passed: number; total: number; rate: number };
    avgConfidence: number;
    confidenceStdDev: number;
    avgLatencyMs: number;
    totalInputTokens: number;
    totalOutputTokens: number;
    estimatedCost: number;
  };
  testCases: {
    name: string;
    schemaPass: number;
    schemaTotal: number;
    assertionPass: number;
    assertionTotal: number;
    avgConfidence: number;
    avgGrade?: number;
    consistency: Record<string, { agreed: number; total: number; values: any[] }>;
    runs: {
      runIndex: number;
      success: boolean;
      parsedJson: any;
      schemaViolations: SchemaViolation[];
      assertionResults: AssertionResult[];
      gradingResult?: GradingResult;
      latencyMs: number;
      inputTokens: number;
      outputTokens: number;
    }[];
  }[];
  consistencySummary: Record<string, { agreed: number; total: number; rate: number }>;
  gradingSummary?: {
    avgScore: number;
    criteriaAverages: Record<string, number>;
    gradingCalls: number;
    gradingTokens: { input: number; output: number };
    gradingCost: number;
  };
}

// ── System Prompt (mirrors prompt-templates.ts SYSTEM_PROMPT_BUSINESS_TASKS) ──

const SYSTEM_PROMPT = `You are an AI assistant integrated into the AIHF (AI-Human-Framework) platform, helping to automate workflow tasks.

Your role:
- Analyze data objectively and accurately
- Follow business rules and validation criteria strictly
- Provide structured JSON responses for easy parsing
- Escalate to humans when uncertain or when data doesn't meet criteria
- Be concise and professional in your analysis

Key principles:
1. Accuracy over speed - if unsure, escalate
2. Follow the exact validation rules provided
3. Never make assumptions about missing data
4. Provide clear reasons for your decisions
5. Structure outputs as valid JSON

When to escalate:
- Data is incomplete or ambiguous
- Validation rules are not met
- Unusual patterns that need human judgment
- Any situation where you're not 100% confident`;

// ── Prompt Builder (mirrors task-executor.ts buildContextAwarePrompt) ──

export function buildEvalPrompt(
  instructions: InstructionYAML,
  testCase: TestCase,
  stepName: string
): string {
  return `# Workflow Task Execution

You are executing step "${stepName}" in an evaluation run.

## Task Instructions
${instructions.task_instructions}

## Business Rules
${instructions.business_rules}

## Task Input Data
\`\`\`json
${JSON.stringify(testCase.inputs, null, 2)}
\`\`\`

## Previous Steps Output
\`\`\`json
${JSON.stringify(testCase.previous_steps_output || {}, null, 2)}
\`\`\`

## Expected Output Schema
\`\`\`json
${JSON.stringify(instructions.expected_output_schema, null, 2)}
\`\`\`

${instructions.confidence_threshold ? `## Confidence Threshold
Minimum confidence required: ${instructions.confidence_threshold}
If your confidence is below this threshold, indicate that the task should be escalated.
` : ''}
## Your Task
Execute this cognitive task by analyzing the input data and previous outputs according to the task instructions and business rules. Return your output in JSON format matching the expected output schema exactly.

Include your confidence level (0.0 to 1.0) and reasoning for your decision.`;
}

// ── Grading Prompt Builder ──

function buildGradingPrompt(
  instructions: InstructionYAML,
  testCase: TestCase,
  response: any,
  grading: GradingConfig
): string {
  const criteriaList = grading.criteria
    .map((c, i) => `${i + 1}. ${c}`)
    .join('\n');

  const idealSection = testCase.ideal_response
    ? `\n## Reference Answer\n${testCase.ideal_response}\n`
    : '';

  const graderInstructions = grading.grader_instructions
    ? `\n${grading.grader_instructions}\n`
    : '';

  return `You are evaluating an AI assistant's response to a workflow task.

## Original Task Instructions
${instructions.task_instructions}

## Business Rules
${instructions.business_rules}

## Input Data Provided
\`\`\`json
${JSON.stringify(testCase.inputs, null, 2)}
\`\`\`

## Expected Output Schema
\`\`\`json
${JSON.stringify(instructions.expected_output_schema, null, 2)}
\`\`\`
${idealSection}
## AI Response Being Graded
\`\`\`json
${JSON.stringify(response, null, 2)}
\`\`\`

## Grading Criteria
Grade each criterion on a scale of 1-5:
  1 = Completely wrong/missing
  2 = Major issues
  3 = Partially correct
  4 = Mostly correct, minor issues
  5 = Excellent, fully correct

Criteria:
${criteriaList}
${graderInstructions}
Respond with JSON only:
{
  "overall_score": <1-5 average>,
  "criteria_scores": {
    "<criterion text>": { "score": <1-5>, "reasoning": "<brief explanation>" }
  },
  "strengths": ["..."],
  "weaknesses": ["..."]
}`;
}

const GRADER_SYSTEM_PROMPT = `You are an expert evaluator assessing AI-generated responses for accuracy and quality. Provide objective, structured assessments. Always respond with valid JSON only.`;

async function gradeResponse(
  client: EvalClaudeClient,
  instructions: InstructionYAML,
  testCase: TestCase,
  response: any,
  grading: GradingConfig,
  graderModel: string
): Promise<{ result: GradingResult | undefined; inputTokens: number; outputTokens: number }> {
  const prompt = buildGradingPrompt(instructions, testCase, response, grading);
  const claudeResult = await client.call(prompt, {
    model: graderModel,
    maxTokens: 2048,
    temperature: 0.0,
    systemPrompt: GRADER_SYSTEM_PROMPT
  });

  if (!claudeResult.success || !claudeResult.parsedJson) {
    return { result: undefined, inputTokens: claudeResult.usage.inputTokens, outputTokens: claudeResult.usage.outputTokens };
  }

  const parsed = claudeResult.parsedJson;
  // Validate basic structure
  if (typeof parsed.overall_score !== 'number' || !parsed.criteria_scores) {
    return { result: undefined, inputTokens: claudeResult.usage.inputTokens, outputTokens: claudeResult.usage.outputTokens };
  }

  return {
    result: parsed as GradingResult,
    inputTokens: claudeResult.usage.inputTokens,
    outputTokens: claudeResult.usage.outputTokens
  };
}

// ── Runner ──

export async function runEvaluation(
  client: EvalClaudeClient,
  instructions: InstructionYAML,
  dataset: EvalDataset,
  config: EvalConfig,
  instructionName: string
): Promise<EvalReport> {
  const totalCalls = dataset.test_cases.length * config.runs;
  const systemPrompt = dataset.system_prompt_override || SYSTEM_PROMPT;
  const stepName = instructionName.replace(/\.instruction\.yaml$/, '');
  const doGrading = config.gradeEnabled && dataset.grading?.criteria?.length;
  const graderModel = config.graderModel || config.model;

  console.log(chalk.blue(`\nStarting evaluation: ${totalCalls} API calls (${dataset.test_cases.length} cases x ${config.runs} runs)`));
  if (doGrading) {
    console.log(chalk.blue(`Model-based grading enabled (grader: ${graderModel})`));
  }
  console.log(chalk.gray(`Model: ${config.model}  Temperature: ${config.temperature}  Max tokens: ${config.maxTokens}\n`));

  const testCaseResults: TestCaseResult[] = [];
  let callCount = 0;

  for (const testCase of dataset.test_cases) {
    console.log(chalk.cyan(`  Test case: ${testCase.name}`));
    const runs: RunResult[] = [];

    for (let r = 0; r < config.runs; r++) {
      callCount++;
      const progress = `[${callCount}/${totalCalls}]`;
      process.stdout.write(chalk.gray(`    ${progress} Run ${r + 1}/${config.runs}... `));

      const prompt = buildEvalPrompt(instructions, testCase, stepName);
      const result = await client.call(prompt, {
        model: config.model,
        maxTokens: config.maxTokens,
        temperature: config.temperature,
        systemPrompt
      });

      if (!result.success) {
        console.log(chalk.red(`FAIL (${result.error})`));
        runs.push({
          runIndex: r,
          claudeResult: result,
          schemaViolations: [{ path: '(api)', message: result.error || 'API call failed' }],
          assertionResults: []
        });
        continue;
      }

      // Validate schema
      const schemaViolations = result.parsedJson
        ? validateSchema(result.parsedJson, instructions.expected_output_schema)
        : [{ path: '(root)', message: 'Response was not valid JSON' }];

      // Check assertions
      const assertionResults = (testCase.expected && result.parsedJson)
        ? checkAssertions(result.parsedJson, testCase.expected)
        : [];

      const schemaOk = schemaViolations.length === 0;
      const assertionsOk = assertionResults.every(a => a.passed);
      const confidence = result.parsedJson?.confidence;

      // Model-based grading
      let gradingResult: GradingResult | undefined;
      if (doGrading && result.parsedJson) {
        process.stdout.write(chalk.gray('grading... '));
        const gradeOut = await gradeResponse(
          client, instructions, testCase, result.parsedJson,
          dataset.grading!, graderModel
        );
        gradingResult = gradeOut.result;
        // Add grading tokens to the run's usage
        result.usage.inputTokens += gradeOut.inputTokens;
        result.usage.outputTokens += gradeOut.outputTokens;
      }

      const status = schemaOk && assertionsOk
        ? chalk.green('PASS')
        : chalk.yellow('FAIL');
      const confStr = confidence !== undefined ? ` conf=${confidence.toFixed(2)}` : '';
      const gradeStr = gradingResult ? ` grade=${gradingResult.overall_score.toFixed(1)}` : '';
      console.log(`${status} ${chalk.gray(`${result.latencyMs}ms${confStr}${gradeStr}`)}`);

      if (config.verbose) {
        if (result.parsedJson) {
          console.log(chalk.gray(`      ${JSON.stringify(result.parsedJson, null, 2).split('\n').join('\n      ')}`));
        }
        if (schemaViolations.length > 0) {
          for (const v of schemaViolations) {
            console.log(chalk.yellow(`      Schema: ${v.path} — ${v.message}`));
          }
        }
        for (const a of assertionResults.filter(a => !a.passed)) {
          console.log(chalk.yellow(`      Assert: ${a.path} — ${a.message}`));
        }
        if (gradingResult) {
          console.log(chalk.gray(`      Grade: ${gradingResult.overall_score.toFixed(1)}/5.0`));
          for (const [criterion, { score, reasoning }] of Object.entries(gradingResult.criteria_scores)) {
            console.log(chalk.gray(`        ${criterion}: ${score}/5 — ${reasoning}`));
          }
        }
      }

      runs.push({ runIndex: r, claudeResult: result, schemaViolations, assertionResults, gradingResult });
    }

    testCaseResults.push({ testCase, runs });
  }

  return buildReport(testCaseResults, config, instructionName, dataset.grading);
}

// ── Report Builder ──

function buildReport(
  testCaseResults: TestCaseResult[],
  config: EvalConfig,
  instructionName: string,
  grading?: GradingConfig
): EvalReport {
  let totalSchemaPass = 0;
  let totalSchemaTotal = 0;
  let totalAssertionPass = 0;
  let totalAssertionTotal = 0;
  const allConfidences: number[] = [];
  const allGradeScores: number[] = [];
  let totalLatency = 0;
  let totalInputTokens = 0;
  let totalOutputTokens = 0;
  let totalCalls = 0;

  // Grading aggregation
  const criteriaScoreSums: Record<string, { sum: number; count: number }> = {};
  let gradingCalls = 0;
  let gradingInputTokens = 0;
  let gradingOutputTokens = 0;

  // Global consistency tracking across all runs
  const globalFieldValues: Record<string, any[]> = {};

  const reportCases = testCaseResults.map(({ testCase, runs }) => {
    let caseSchemaPass = 0;
    let caseAssertionPass = 0;
    let caseAssertionTotal = 0;
    const caseConfidences: number[] = [];
    const caseGradeScores: number[] = [];
    const caseFieldValues: Record<string, any[]> = {};

    const reportRuns = runs.map(run => {
      totalCalls++;
      const schemaPass = run.schemaViolations.length === 0;
      if (schemaPass) { caseSchemaPass++; totalSchemaPass++; }
      totalSchemaTotal++;

      const runAssertionPass = run.assertionResults.filter(a => a.passed).length;
      const runAssertionTotal = run.assertionResults.length;
      caseAssertionPass += runAssertionPass;
      caseAssertionTotal += runAssertionTotal;
      totalAssertionPass += runAssertionPass;
      totalAssertionTotal += runAssertionTotal;

      if (run.claudeResult.parsedJson?.confidence !== undefined) {
        const c = run.claudeResult.parsedJson.confidence;
        caseConfidences.push(c);
        allConfidences.push(c);
      }

      // Accumulate grading scores
      if (run.gradingResult) {
        caseGradeScores.push(run.gradingResult.overall_score);
        allGradeScores.push(run.gradingResult.overall_score);
        gradingCalls++;
        for (const [criterion, { score }] of Object.entries(run.gradingResult.criteria_scores)) {
          if (!criteriaScoreSums[criterion]) criteriaScoreSums[criterion] = { sum: 0, count: 0 };
          criteriaScoreSums[criterion].sum += score;
          criteriaScoreSums[criterion].count++;
        }
      }

      totalLatency += run.claudeResult.latencyMs;
      totalInputTokens += run.claudeResult.usage.inputTokens;
      totalOutputTokens += run.claudeResult.usage.outputTokens;

      // Track field values for consistency
      if (run.claudeResult.parsedJson && typeof run.claudeResult.parsedJson === 'object') {
        collectFieldValues(run.claudeResult.parsedJson, '', caseFieldValues);
        collectFieldValues(run.claudeResult.parsedJson, '', globalFieldValues);
      }

      return {
        runIndex: run.runIndex,
        success: run.claudeResult.success,
        parsedJson: run.claudeResult.parsedJson,
        schemaViolations: run.schemaViolations,
        assertionResults: run.assertionResults,
        gradingResult: run.gradingResult,
        latencyMs: run.claudeResult.latencyMs,
        inputTokens: run.claudeResult.usage.inputTokens,
        outputTokens: run.claudeResult.usage.outputTokens
      };
    });

    // Compute per-case consistency
    const consistency: Record<string, { agreed: number; total: number; values: any[] }> = {};
    for (const [field, values] of Object.entries(caseFieldValues)) {
      const modeCount = getModeCount(values);
      consistency[field] = { agreed: modeCount, total: values.length, values };
    }

    const avgConfidence = caseConfidences.length > 0
      ? caseConfidences.reduce((a, b) => a + b, 0) / caseConfidences.length
      : 0;

    const avgGrade = caseGradeScores.length > 0
      ? caseGradeScores.reduce((a, b) => a + b, 0) / caseGradeScores.length
      : undefined;

    return {
      name: testCase.name,
      schemaPass: caseSchemaPass,
      schemaTotal: runs.length,
      assertionPass: caseAssertionPass,
      assertionTotal: caseAssertionTotal,
      avgConfidence,
      avgGrade,
      consistency,
      runs: reportRuns
    };
  });

  // Global consistency
  const consistencySummary: Record<string, { agreed: number; total: number; rate: number }> = {};
  for (const [field, values] of Object.entries(globalFieldValues)) {
    const modeCount = getModeCount(values);
    consistencySummary[field] = {
      agreed: modeCount,
      total: values.length,
      rate: values.length > 0 ? modeCount / values.length : 0
    };
  }

  const avgConfidence = allConfidences.length > 0
    ? allConfidences.reduce((a, b) => a + b, 0) / allConfidences.length
    : 0;
  const confidenceStdDev = allConfidences.length > 1
    ? Math.sqrt(allConfidences.reduce((sum, c) => sum + Math.pow(c - avgConfidence, 2), 0) / allConfidences.length)
    : 0;

  // Grading summary
  let gradingSummary: EvalReport['gradingSummary'];
  if (allGradeScores.length > 0) {
    const criteriaAverages: Record<string, number> = {};
    for (const [criterion, { sum, count }] of Object.entries(criteriaScoreSums)) {
      criteriaAverages[criterion] = sum / count;
    }
    // Estimate grading cost separately (tokens are already included in totals)
    const graderModel = config.graderModel || config.model;
    gradingSummary = {
      avgScore: allGradeScores.reduce((a, b) => a + b, 0) / allGradeScores.length,
      criteriaAverages,
      gradingCalls,
      gradingTokens: { input: gradingInputTokens, output: gradingOutputTokens },
      gradingCost: EvalClaudeClient.estimateCost(graderModel, gradingInputTokens, gradingOutputTokens)
    };
  }

  return {
    timestamp: new Date().toISOString(),
    instruction: instructionName,
    model: config.model,
    temperature: config.temperature,
    runsPerCase: config.runs,
    totalCalls,
    summary: {
      schemaCompliance: {
        passed: totalSchemaPass,
        total: totalSchemaTotal,
        rate: totalSchemaTotal > 0 ? totalSchemaPass / totalSchemaTotal : 0
      },
      assertionPass: {
        passed: totalAssertionPass,
        total: totalAssertionTotal,
        rate: totalAssertionTotal > 0 ? totalAssertionPass / totalAssertionTotal : 0
      },
      avgConfidence,
      confidenceStdDev,
      avgLatencyMs: totalCalls > 0 ? totalLatency / totalCalls : 0,
      totalInputTokens,
      totalOutputTokens,
      estimatedCost: EvalClaudeClient.estimateCost(config.model, totalInputTokens, totalOutputTokens)
    },
    testCases: reportCases,
    consistencySummary,
    gradingSummary
  };
}

// ── Console Report ──

export function printReport(report: EvalReport): void {
  const hr = chalk.gray('─'.repeat(65));
  const pct = (n: number) => `${(n * 100).toFixed(1)}%`;
  const fmtTokens = (n: number) => n.toLocaleString();

  console.log('');
  console.log(hr);
  console.log(chalk.bold('  AIHF Prompt Evaluation Report'));
  console.log(chalk.gray(`  Model: ${report.model}  Temperature: ${report.temperature}`));
  console.log(chalk.gray(`  Instruction: ${report.instruction}`));
  console.log(chalk.gray(`  Test cases: ${report.testCases.length}  Runs per case: ${report.runsPerCase}  Total calls: ${report.totalCalls}`));
  console.log(hr);

  const s = report.summary;

  // Schema compliance
  const schemaColor = s.schemaCompliance.rate === 1 ? chalk.green : chalk.yellow;
  console.log(`  Schema Compliance:  ${schemaColor(`${s.schemaCompliance.passed}/${s.schemaCompliance.total} (${pct(s.schemaCompliance.rate)})`)}`);

  // Assertion pass
  if (s.assertionPass.total > 0) {
    const assertColor = s.assertionPass.rate >= 0.9 ? chalk.green : chalk.yellow;
    console.log(`  Assertion Pass:     ${assertColor(`${s.assertionPass.passed}/${s.assertionPass.total} (${pct(s.assertionPass.rate)})`)}`);
  }

  // Confidence
  if (s.avgConfidence > 0) {
    console.log(`  Avg Confidence:     ${s.avgConfidence.toFixed(2)} (\u03c3=${s.confidenceStdDev.toFixed(2)})`);
  }

  // Latency & tokens
  console.log(`  Avg Latency:        ${(s.avgLatencyMs / 1000).toFixed(1)}s`);
  console.log(`  Total Tokens:       ${fmtTokens(s.totalInputTokens)} in / ${fmtTokens(s.totalOutputTokens)} out`);
  console.log(`  Est. Cost:          $${s.estimatedCost.toFixed(2)}`);
  console.log('');

  // Model grading summary
  if (report.gradingSummary) {
    const gs = report.gradingSummary;
    const gradeColor = gs.avgScore >= 4.0 ? chalk.green : gs.avgScore >= 3.0 ? chalk.yellow : chalk.red;
    console.log(`  Model Grading:      ${gradeColor(`avg ${gs.avgScore.toFixed(1)}/5.0`)}`);
  }

  // Per test case table
  const hasGrading = !!report.gradingSummary;
  console.log(chalk.bold('  Per Test Case:'));
  const header = '  ' + padEnd('Test Case', 35) + padEnd('Schema', 10) + padEnd('Assert', 10) + padEnd('Conf', 8) + (hasGrading ? 'Grade' : '');
  console.log(chalk.gray(header));
  const headerLine = '  ' + '─'.repeat(35) + '─'.repeat(10) + '─'.repeat(10) + '─'.repeat(8) + (hasGrading ? '─'.repeat(6) : '');
  console.log(chalk.gray(headerLine));

  for (const tc of report.testCases) {
    const name = tc.name.length > 33 ? tc.name.substring(0, 30) + '...' : tc.name;
    const schema = `${tc.schemaPass}/${tc.schemaTotal}`;
    const assertion = tc.assertionTotal > 0 ? `${tc.assertionPass}/${tc.assertionTotal}` : '-';
    const conf = tc.avgConfidence > 0 ? tc.avgConfidence.toFixed(2) : '-';
    const grade = hasGrading && tc.avgGrade !== undefined ? tc.avgGrade.toFixed(1) : (hasGrading ? '-' : '');
    console.log(`  ${padEnd(name, 35)}${padEnd(schema, 10)}${padEnd(assertion, 10)}${padEnd(conf, 8)}${grade}`);
  }

  // Grading breakdown by criterion
  if (report.gradingSummary) {
    console.log('');
    console.log(chalk.bold('  Grading Breakdown:'));
    for (const [criterion, avg] of Object.entries(report.gradingSummary.criteriaAverages)) {
      const truncCriterion = criterion.length > 40 ? criterion.substring(0, 37) + '...' : criterion;
      const color = avg >= 4.0 ? chalk.green : avg >= 3.0 ? chalk.yellow : chalk.red;
      console.log(`  ${padEnd(truncCriterion, 42)} ${color(`avg ${avg.toFixed(1)}/5`)}`);
    }
  }

  // Consistency summary
  const consistencyEntries = Object.entries(report.consistencySummary)
    .filter(([, v]) => v.total > 1)
    .sort((a, b) => a[1].rate - b[1].rate);

  if (consistencyEntries.length > 0) {
    console.log('');
    console.log(chalk.bold('  Consistency (across all runs):'));
    for (const [field, { agreed, total, rate }] of consistencyEntries.slice(0, 10)) {
      const color = rate >= 0.9 ? chalk.green : rate >= 0.7 ? chalk.yellow : chalk.red;
      console.log(`  ${padEnd(field, 35)} ${color(`${agreed}/${total} (${pct(rate)})`)}`);
    }
    const lowConsistency = consistencyEntries.filter(([, v]) => v.rate < 0.9);
    if (lowConsistency.length > 0) {
      console.log(chalk.yellow('  Tip: Low consistency fields — consider lower temperature or more specific prompts'));
    }
  }

  // Schema violations summary
  const allViolations = report.testCases.flatMap(tc =>
    tc.runs.flatMap(r => r.schemaViolations)
  );
  if (allViolations.length > 0) {
    console.log('');
    console.log(chalk.bold('  Schema Violations:'));
    const uniqueViolations = [...new Set(allViolations.map(v => `${v.path}: ${v.message}`))];
    for (const v of uniqueViolations.slice(0, 10)) {
      console.log(chalk.yellow(`    ${v}`));
    }
  } else {
    console.log('');
    console.log(chalk.green('  Schema Violations: None'));
  }

  console.log(hr);
  console.log('');
}

// ── Helpers ──

function collectFieldValues(obj: any, prefix: string, map: Record<string, any[]>): void {
  if (typeof obj !== 'object' || obj === null || Array.isArray(obj)) return;
  for (const [key, value] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${key}` : key;
    // Only track leaf values (primitives and small arrays)
    if (value === null || typeof value !== 'object' || Array.isArray(value)) {
      const serialized = JSON.stringify(value);
      if (!map[path]) map[path] = [];
      map[path].push(serialized);
    } else {
      collectFieldValues(value, path, map);
    }
  }
}

function getModeCount(values: any[]): number {
  if (values.length === 0) return 0;
  const counts = new Map<any, number>();
  for (const v of values) {
    counts.set(v, (counts.get(v) || 0) + 1);
  }
  return Math.max(...counts.values());
}

function padEnd(str: string, len: number): string {
  return str.length >= len ? str : str + ' '.repeat(len - str.length);
}
