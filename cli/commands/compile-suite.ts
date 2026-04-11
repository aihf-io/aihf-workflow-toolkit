/**
 * Compile Suite Command - Compile all workflow bundles in a multi-part suite
 */

import { join, resolve } from 'path';
import { existsSync } from 'fs';
import chalk from 'chalk';
import { compileCommand } from './compile.js';

interface CompileSuiteOptions {
  output?: string;
  strict?: boolean;
}

export async function compileSuiteCommand(suitePath: string, options: CompileSuiteOptions) {
  try {
    const resolvedPath = resolve(process.cwd(), suitePath);

    // Read aihf-suite.yaml
    const suiteYamlPath = join(resolvedPath, 'aihf-suite.yaml');
    if (!existsSync(suiteYamlPath)) {
      throw new Error('aihf-suite.yaml not found - is this a multi-part suite root?');
    }

    const fs = await import('fs/promises');
    const yaml = await import('js-yaml');

    const suiteContent = await fs.readFile(suiteYamlPath, 'utf-8');
    const suiteConfig = yaml.load(suiteContent) as any;

    console.log(chalk.blue(`Compiling suite: ${suiteConfig.name || 'unknown'}`));

    const workflows: string[] = suiteConfig.workflows || [];

    if (workflows.length === 0) {
      console.log(chalk.yellow('No workflows found in suite. Add bundles with: aihf init <name> --suite .'));
      return;
    }

    console.log(chalk.gray(`Found ${workflows.length} workflow(s): ${workflows.join(', ')}`));
    console.log('');

    const results: { name: string; success: boolean; error?: string }[] = [];

    for (const workflow of workflows) {
      const workflowPath = join(resolvedPath, 'workflows', workflow);

      if (!existsSync(workflowPath)) {
        console.log(chalk.red(`Workflow '${workflow}' directory not found at: workflows/${workflow}/`));
        results.push({ name: workflow, success: false, error: 'directory not found' });
        continue;
      }

      if (!existsSync(join(workflowPath, 'bundle.yaml'))) {
        console.log(chalk.red(`Workflow '${workflow}' missing bundle.yaml`));
        results.push({ name: workflow, success: false, error: 'bundle.yaml missing' });
        continue;
      }

      console.log(chalk.cyan(`--- Compiling: ${workflow} ---`));

      try {
        // compileCommand may call process.exit(1) on failure.
        // Override process.exit temporarily to catch failures without killing the process.
        const originalExit = process.exit;
        let exitCalled = false;
        (process as any).exit = (code?: number) => {
          if (code && code !== 0) {
            exitCalled = true;
          }
        };

        await compileCommand(workflowPath, {
          output: options.output,
          strict: options.strict,
        });

        process.exit = originalExit;

        if (exitCalled) {
          results.push({ name: workflow, success: false, error: 'compilation failed' });
        } else {
          results.push({ name: workflow, success: true });
        }
      } catch (error: any) {
        results.push({ name: workflow, success: false, error: error.message });
      }

      console.log('');
    }

    // Summary
    console.log(chalk.bold('Suite compilation summary:'));
    const succeeded = results.filter(r => r.success);
    const failed = results.filter(r => !r.success);

    for (const r of results) {
      if (r.success) {
        console.log(chalk.green(`  ${r.name}: passed`));
      } else {
        console.log(chalk.red(`  ${r.name}: failed - ${r.error}`));
      }
    }

    console.log('');
    console.log(chalk.gray(`${succeeded.length}/${results.length} workflows compiled successfully`));

    if (failed.length > 0) {
      process.exit(1);
    }

  } catch (error: any) {
    console.error(chalk.red('Suite compilation failed:'), error.message);
    process.exit(1);
  }
}
