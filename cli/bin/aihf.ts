#!/usr/bin/env node

/**
 * AIHF.io CLI - Workflow Development Tool
 *
 * Commands:
 * - init: Create new workflow bundles from templates
 * - compile: TypeScript → JavaScript compilation with Platform SDK validation
 * - compile-suite: Compile all bundles in a multi-part suite
 * - validate: Bundle structure and configuration validation
 * - bundle: Create deployment-ready ZIP files
 * - eval: Evaluate AI instruction prompts against test datasets
 */

import { Command } from 'commander';
import chalk from 'chalk';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

// CLI Commands
import { initCommand } from '../commands/init.js';
import { compileCommand } from '../commands/compile.js';
import { compileSuiteCommand } from '../commands/compile-suite.js';
import { validateCommand } from '../commands/validate.js';
import { bundleCommand } from '../commands/bundle.js';
import { evalCommand } from '../commands/eval.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Read version from package.json
const packagePath = join(__dirname, '../../package.json');
const packageJson = JSON.parse(readFileSync(packagePath, 'utf-8'));

const program = new Command();

program
  .name('aihf')
  .description('AIHF.io Platform CLI - Build and deploy AI-Human workflows')
  .version(packageJson.version)
  .addHelpText('before', chalk.blue.bold('AIHF.io Platform SDK'))
  .addHelpText('after', `
${chalk.gray('Examples:')}
  ${chalk.cyan('aihf init my-workflow')}                        Create isolated workflow
  ${chalk.cyan('aihf init my-product --type multi-part')}       Create multi-workflow suite
  ${chalk.cyan('aihf init signup --suite .')}                   Add bundle to suite
  ${chalk.cyan('aihf compile ./my-workflow')}                   Compile a bundle
  ${chalk.cyan('aihf compile-suite .')}                         Compile all suite bundles
  ${chalk.cyan('aihf validate ./my-workflow')}                  Validate a bundle
  ${chalk.cyan('aihf bundle ./my-workflow')}                    Create deployment ZIP
  ${chalk.cyan('aihf eval . --instructions src/instructions/my.instruction.yaml --dataset test-data/scenarios.json')}

${chalk.gray('Templates:')}
  ${chalk.cyan('basic-workflow')}     Simple single-step workflow
  ${chalk.cyan('full-stack')}         Complete workflow with auth and database

${chalk.gray('Workflow types:')}
  ${chalk.cyan('isolated')}           Single standalone workflow (default)
  ${chalk.cyan('multi-part')}         Suite with shared code across multiple workflows

${chalk.gray('Documentation:')} ${chalk.underline('https://docs.aihf.io')}
`);

// Init Command
program
  .command('init')
  .description('Create new workflow bundle or multi-part suite')
  .argument('<bundle-name>', 'Name of the workflow bundle or suite to create')
  .option('-t, --template <template>', 'Template to use', 'basic-workflow')
  .option('-T, --type <type>', 'Workflow type: isolated (default) or multi-part')
  .option('-S, --suite <path>', 'Add bundle to existing suite at path')
  .option('-d, --description <description>', 'Bundle description')
  .option('--skip-install', 'Skip npm install after creation')
  .option('--list-templates', 'List available templates')
  .action(initCommand);

// Compile Command
program
  .command('compile')
  .description('Compile TypeScript to JavaScript with Platform SDK validation')
  .argument('[bundle-path]', 'Path to workflow bundle', '.')
  .option('-o, --output <dir>', 'Output directory', 'dist')
  .option('--watch', 'Watch for changes and recompile')
  .option('--strict', 'Enable strict TypeScript compilation')
  .action(compileCommand);

// Compile Suite Command
program
  .command('compile-suite')
  .description('Compile all workflow bundles in a multi-part suite')
  .argument('[suite-path]', 'Path to suite root (containing aihf-suite.yaml)', '.')
  .option('-o, --output <dir>', 'Output directory for each bundle', 'dist')
  .option('--strict', 'Enable strict TypeScript compilation')
  .action(compileSuiteCommand);

// Validate Command
program
  .command('validate')
  .description('Validate bundle structure and configuration')
  .argument('[bundle-path]', 'Path to workflow bundle', '.')
  .option('--strict', 'Enable strict validation mode')
  .option('--fix', 'Attempt to fix common issues automatically')
  .option('-S, --suite', 'Validate all bundles in a suite')
  .action(validateCommand);

// Bundle Command
program
  .command('bundle')
  .description('Create deployment-ready ZIP bundle for admin.aihf.io upload')
  .argument('[bundle-path]', 'Path to workflow bundle', '.')
  .option('-o, --output <file>', 'Output ZIP file path')
  .option('--compress', 'Enable compression', true)
  .option('--include-source', 'Include TypeScript source files')
  .action(bundleCommand);

// Eval Command
program
  .command('eval')
  .description('Evaluate AI instruction prompts against test datasets')
  .argument('[bundle-path]', 'Path to workflow bundle', '.')
  .option('-i, --instructions <file>', 'Instruction YAML to evaluate (relative to bundle path)')
  .option('-d, --dataset <file>', 'Test dataset JSON file')
  .option('-m, --model <model>', 'Claude model to use', 'claude-sonnet-4-5-20250929')
  .option('-t, --temperature <n>', 'Temperature (0.0-1.0)', '0.1')
  .option('-r, --runs <n>', 'Iterations per test case', '3')
  .option('--max-tokens <n>', 'Max output tokens', '4096')
  .option('-o, --output <file>', 'Save report to JSON file')
  .option('--api-key <key>', 'Anthropic API key (or ANTHROPIC_API_KEY env var)')
  .option('--verbose', 'Show full Claude responses')
  .option('--grade', 'Enable model-based grading (LLM-as-judge)')
  .option('--grader-model <model>', 'Model for grading (defaults to --model)')
  .action(evalCommand);

// Global error handling
process.on('uncaughtException', (error) => {
  console.error(chalk.red('Unexpected error:'), error.message);
  if (process.env.DEBUG) {
    console.error(error.stack);
  }
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  console.error(chalk.red('Unhandled promise rejection:'), reason);
  process.exit(1);
});

// Parse CLI arguments
program.parse();
