/**
 * Eval Command — Evaluate AI instruction prompts against test datasets
 *
 * Loads an instruction YAML + sample test data, assembles prompts exactly as
 * the platform does in production, calls Claude API, validates outputs against
 * the instruction's expected_output_schema, and reports metrics.
 */

import { join, resolve, basename } from 'path';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import chalk from 'chalk';
import yaml from 'js-yaml';

import { EvalClaudeClient } from '../lib/eval-claude-client.js';
import {
  runEvaluation,
  printReport,
  InstructionYAML,
  EvalDataset,
  EvalConfig
} from '../lib/eval-runner.js';

interface EvalOptions {
  instructions?: string;
  dataset?: string;
  model?: string;
  temperature?: string;
  runs?: string;
  maxTokens?: string;
  output?: string;
  apiKey?: string;
  verbose?: boolean;
  grade?: boolean;
  graderModel?: string;
}

export async function evalCommand(bundlePath: string, options: EvalOptions) {
  try {
    console.log(chalk.blue.bold('\nAIHF Prompt Evaluation'));

    const resolvedBundle = resolve(process.cwd(), bundlePath);

    // ── Resolve API key ──
    const apiKey = options.apiKey || process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      console.error(chalk.red('Error: Anthropic API key required.'));
      console.error(chalk.gray('Set ANTHROPIC_API_KEY env var or use --api-key <key>'));
      process.exit(1);
    }

    // ── Resolve instruction file ──
    if (!options.instructions) {
      console.error(chalk.red('Error: --instructions <file> is required'));
      console.error(chalk.gray('Specify the instruction YAML relative to the bundle path'));
      process.exit(1);
    }

    const instructionPath = resolve(resolvedBundle, options.instructions);
    if (!existsSync(instructionPath)) {
      console.error(chalk.red(`Error: Instruction file not found: ${instructionPath}`));
      process.exit(1);
    }

    // ── Resolve dataset file ──
    if (!options.dataset) {
      console.error(chalk.red('Error: --dataset <file> is required'));
      console.error(chalk.gray('Specify a JSON file with test cases'));
      process.exit(1);
    }

    const datasetPath = resolve(resolvedBundle, options.dataset);
    if (!existsSync(datasetPath)) {
      // Also try relative to cwd
      const cwdDatasetPath = resolve(process.cwd(), options.dataset);
      if (!existsSync(cwdDatasetPath)) {
        console.error(chalk.red(`Error: Dataset file not found: ${datasetPath}`));
        process.exit(1);
      }
    }
    const finalDatasetPath = existsSync(resolve(resolvedBundle, options.dataset))
      ? resolve(resolvedBundle, options.dataset)
      : resolve(process.cwd(), options.dataset);

    // ── Load instruction YAML ──
    console.log(chalk.gray(`Instruction: ${instructionPath}`));
    const instructionContent = readFileSync(instructionPath, 'utf-8');
    const instructions = yaml.load(instructionContent) as InstructionYAML;

    if (!instructions.task_instructions || !instructions.business_rules) {
      console.error(chalk.red('Error: Instruction YAML must have task_instructions and business_rules'));
      process.exit(1);
    }
    if (!instructions.expected_output_schema) {
      console.warn(chalk.yellow('Warning: No expected_output_schema — schema validation will be skipped'));
    }

    // ── Load dataset ──
    console.log(chalk.gray(`Dataset: ${finalDatasetPath}`));
    const datasetContent = readFileSync(finalDatasetPath, 'utf-8');
    let dataset: EvalDataset;
    try {
      dataset = JSON.parse(datasetContent);
    } catch {
      console.error(chalk.red('Error: Dataset file is not valid JSON'));
      process.exit(1);
    }

    if (!dataset.test_cases || !Array.isArray(dataset.test_cases) || dataset.test_cases.length === 0) {
      console.error(chalk.red('Error: Dataset must have a non-empty "test_cases" array'));
      process.exit(1);
    }

    console.log(chalk.gray(`Test cases: ${dataset.test_cases.length}`));
    if (dataset.description) {
      console.log(chalk.gray(`Description: ${dataset.description}`));
    }

    // ── Build config ──
    const config: EvalConfig = {
      model: options.model || 'claude-sonnet-4-5-20250929',
      temperature: parseFloat(options.temperature || '0.1'),
      runs: parseInt(options.runs || '3', 10),
      maxTokens: parseInt(options.maxTokens || '4096', 10),
      verbose: options.verbose || false,
      gradeEnabled: options.grade || false,
      graderModel: options.graderModel
    };

    // Warn if --grade used but dataset has no grading criteria
    if (config.gradeEnabled && (!dataset.grading?.criteria || dataset.grading.criteria.length === 0)) {
      console.warn(chalk.yellow('Warning: --grade enabled but dataset has no "grading.criteria" — grading will be skipped'));
    }

    // Validate config
    if (isNaN(config.temperature) || config.temperature < 0 || config.temperature > 1) {
      console.error(chalk.red('Error: Temperature must be between 0 and 1'));
      process.exit(1);
    }
    if (isNaN(config.runs) || config.runs < 1) {
      console.error(chalk.red('Error: Runs must be at least 1'));
      process.exit(1);
    }

    // ── Run evaluation ──
    const client = new EvalClaudeClient(apiKey);
    const instructionName = basename(instructionPath);

    const report = await runEvaluation(client, instructions, dataset, config, instructionName);

    // ── Print report ──
    printReport(report);

    // ── Save JSON report ──
    if (options.output) {
      const outputPath = resolve(process.cwd(), options.output);
      writeFileSync(outputPath, JSON.stringify(report, null, 2));
      console.log(chalk.green(`Report saved to: ${outputPath}`));
    }

  } catch (error: any) {
    console.error(chalk.red('Evaluation failed:'), error.message);
    if (process.env.DEBUG) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}
