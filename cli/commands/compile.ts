/**
 * Compile Command - TypeScript → JavaScript compilation with Platform SDK validation
 */

import { join, resolve, dirname, relative } from 'path';
import { existsSync, mkdirSync } from 'fs';
import { fileURLToPath } from 'url';
import chalk from 'chalk';
import { exec } from 'child_process';
import { promisify } from 'util';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const execAsync = promisify(exec);

interface CompileOptions {
  output?: string;
  watch?: boolean;
  strict?: boolean;
}

interface SuiteContext {
  suitePath: string;
  suiteConfig: any;
  relativeToSuite: string; // e.g. "workflows/signup"
}

// Get the Platform SDK types file path
function getPlatformSDKTypesPath(): string {
  // When compiled, __dirname is in dist/cli/commands
  // Types are in types/ at package root
  return resolve(join(__dirname, '../../types/index.d.ts'));
}

/**
 * Walk up from bundlePath looking for aihf-suite.yaml.
 * Returns the suite context if found, null otherwise.
 */
function detectSuiteContext(bundlePath: string): SuiteContext | null {
  let current = resolve(bundlePath);
  const root = resolve('/');

  // Walk up at most 3 levels (bundle → workflows → suite-root)
  for (let i = 0; i < 3; i++) {
    const parent = dirname(current);
    if (parent === current || parent === root) break;
    current = parent;

    const suiteYamlPath = join(current, 'aihf-suite.yaml');
    if (existsSync(suiteYamlPath)) {
      return {
        suitePath: current,
        suiteConfig: null, // Loaded lazily when needed
        relativeToSuite: relative(current, bundlePath),
      };
    }
  }

  return null;
}

export async function compileCommand(bundlePath: string, options: CompileOptions) {
  try {
    console.log(chalk.blue('Compiling workflow bundle...'));

    const resolvedPath = resolve(process.cwd(), bundlePath);
    const outputDir = options.output || 'dist';
    const outputPath = join(resolvedPath, outputDir);

    // Validate bundle path
    if (!existsSync(resolvedPath)) {
      throw new Error(`Bundle path '${bundlePath}' does not exist`);
    }

    // Check for bundle.yaml (required)
    const bundleYamlPath = join(resolvedPath, 'bundle.yaml');
    if (!existsSync(bundleYamlPath)) {
      throw new Error('bundle.yaml not found - is this an AIHF workflow bundle?');
    }

    // Check for src directory
    const srcPath = join(resolvedPath, 'src');
    if (!existsSync(srcPath)) {
      throw new Error('Source directory \'src\' not found in bundle');
    }

    console.log(chalk.gray(`Bundle path: ${resolvedPath}`));
    console.log(chalk.gray(`Output directory: ${outputPath}`));

    // Create output directory
    if (!existsSync(outputPath)) {
      mkdirSync(outputPath, { recursive: true });
    }

    // Detect suite context
    const suiteCtx = detectSuiteContext(resolvedPath);
    const platformSDKTypesPath = getPlatformSDKTypesPath();
    const tsconfigPath = join(resolvedPath, 'tsconfig.json');

    const fs = await import('fs/promises');

    if (suiteCtx) {
      // Suite-aware compilation
      // Copy shared/ into src/_shared/ so rootDir can stay at ./src
      // and the output goes to dist/src/ (same as isolated bundles).
      console.log(chalk.cyan(`Suite detected at: ${suiteCtx.suitePath}`));

      const sharedSrcPath = join(suiteCtx.suitePath, 'shared');
      const sharedDestPath = join(resolvedPath, 'src', '_shared');

      if (existsSync(sharedSrcPath)) {
        // Remove stale _shared if present from a previous run
        if (existsSync(sharedDestPath)) {
          const { rm } = await import('fs/promises');
          await rm(sharedDestPath, { recursive: true, force: true });
        }
        const { copy } = await import('fs-extra');
        await copy(sharedSrcPath, sharedDestPath);
        console.log(chalk.green('Shared code copied to src/_shared/'));
      }

      // Generate isolated-style tsconfig so output goes to dist/src/
      const tsconfigContent = {
        compilerOptions: {
          target: 'ES2022',
          module: 'ESNext',
          lib: ['ES2022', 'WebWorker'],
          moduleResolution: 'node',
          strict: options.strict || true,
          esModuleInterop: true,
          skipLibCheck: true,
          forceConsistentCasingInFileNames: true,
          resolveJsonModule: true,
          allowSyntheticDefaultImports: true,
          declaration: false,
          sourceMap: false,
          outDir: `./${outputDir}/src`,
          rootDir: './src',
          paths: {
            '@aihf/platform-sdk': [platformSDKTypesPath]
          }
        },
        include: ['src/**/*'],
        exclude: ['node_modules', outputDir]
      };

      await fs.writeFile(tsconfigPath, JSON.stringify(tsconfigContent, null, 2));

      console.log(chalk.green('Shared code will be compiled from: src/_shared/'));
    } else {
      // Isolated bundle compilation (unchanged behavior)
      const tsconfigContent = {
        compilerOptions: {
          target: 'ES2022',
          module: 'ESNext',
          lib: ['ES2022', 'WebWorker'],
          moduleResolution: 'node',
          strict: options.strict || true,
          esModuleInterop: true,
          skipLibCheck: true,
          forceConsistentCasingInFileNames: true,
          resolveJsonModule: true,
          allowSyntheticDefaultImports: true,
          declaration: false,
          sourceMap: false,
          outDir: `./${outputDir}/src`,
          rootDir: './src',
          paths: {
            '@aihf/platform-sdk': [platformSDKTypesPath]
          }
        },
        include: ['src/**/*'],
        exclude: ['node_modules', outputDir]
      };

      await fs.writeFile(tsconfigPath, JSON.stringify(tsconfigContent, null, 2));
    }

    // Copy config directory to output
    const configPath = join(resolvedPath, 'config');
    if (existsSync(configPath)) {
      console.log(chalk.yellow('Copying configuration files...'));
      const { copy } = await import('fs-extra');
      await copy(configPath, join(outputPath, 'config'));
    }

    // Copy static files to output (CSS, JS, images, etc.)
    const staticPath = join(resolvedPath, 'src', 'static');
    if (existsSync(staticPath)) {
      console.log(chalk.yellow('Copying static files...'));
      const { copy } = await import('fs-extra');
      const staticOutputPath = join(outputPath, 'src', 'static');
      await copy(staticPath, staticOutputPath);
      console.log(chalk.green('Static files copied to dist/src/static'));
    }

    // Compile TypeScript
    console.log(chalk.yellow('Compiling TypeScript files...'));

    const tscCommand = options.watch
      ? 'npx tsc --watch --preserveWatchOutput'
      : 'npx tsc';

    try {
      const { stdout, stderr } = await execAsync(tscCommand, {
        cwd: resolvedPath,
        env: { ...process.env, NODE_ENV: 'production' }
      });

      if (stderr && !stderr.includes('Starting compilation in watch mode')) {
        console.warn(chalk.yellow('TypeScript warnings:'));
        console.warn(stderr);
      }

      if (stdout) {
        console.log(chalk.gray(stdout));
      }

    } catch (error: any) {
      // TypeScript compilation errors
      console.error(chalk.red('TypeScript compilation failed:'));
      console.error(error.stdout || error.message);
      process.exit(1);
    }

    if (options.watch) {
      console.log(chalk.green('Watching for file changes...'));
      console.log(chalk.gray('Press Ctrl+C to stop watching'));
      return;
    }

    // Clean up _shared copy for suite bundles (after tsc, before validation)
    if (suiteCtx) {
      const sharedDestPath = join(resolvedPath, 'src', '_shared');
      if (existsSync(sharedDestPath)) {
        const { rm } = await import('fs/promises');
        await rm(sharedDestPath, { recursive: true, force: true });
        console.log(chalk.green('Cleaned up temporary src/_shared/'));
      }
    }

    // Validate compiled output
    console.log(chalk.yellow('Validating compiled output...'));

    const compiledSrcPath = join(outputPath, 'src'); // Always dist/src/ now

    if (!existsSync(compiledSrcPath)) {
      throw new Error('Compilation failed - no output generated in dist/src/');
    }

    // Check that Platform SDK imports are valid
    const glob = await import('glob');
    const jsFiles = glob.globSync('**/*.js', { cwd: outputPath });

    let platformSDKUsageFound = false;
    for (const file of jsFiles) {
      const filePath = join(outputPath, file);
      const content = await fs.readFile(filePath, 'utf-8');

      if (content.includes('@aihf/platform-sdk') || content.includes('AIHFPlatform')) {
        platformSDKUsageFound = true;
        break;
      }
    }

    if (platformSDKUsageFound) {
      console.log(chalk.green('Platform SDK usage detected and validated'));
    }

    if (suiteCtx) {
      // Check if shared code was compiled into dist/src/_shared/
      const sharedOutputPath = join(outputPath, 'src', '_shared');
      if (existsSync(sharedOutputPath)) {
        console.log(chalk.green('Shared code compiled into dist/src/_shared/'));
      }
    }

    console.log(chalk.green('Compilation completed successfully!'));
    console.log(chalk.gray(`Compiled files available in: ${outputPath}`));

  } catch (error: any) {
    console.error(chalk.red('Compilation failed:'), error.message);
    process.exit(1);
  }
}
