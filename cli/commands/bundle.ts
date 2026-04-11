/**
 * Bundle Command - Create deployment-ready ZIP bundles
 */

import { join, resolve, basename } from 'path';
import { existsSync } from 'fs';
import chalk from 'chalk';
import archiver from 'archiver';
import { createWriteStream } from 'fs';

interface BundleOptions {
  output?: string;
  compress?: boolean;
  includeSource?: boolean;
}

export async function bundleCommand(bundlePath: string, options: BundleOptions) {
  try {
    console.log(chalk.blue('📦 Creating deployment bundle...'));

    const resolvedPath = resolve(process.cwd(), bundlePath);
    const bundleName = basename(resolvedPath);

    // Validate bundle path
    if (!existsSync(resolvedPath)) {
      throw new Error(`Bundle path '${bundlePath}' does not exist`);
    }

    // Check for compiled output
    const distPath = join(resolvedPath, 'dist');
    if (!existsSync(distPath)) {
      throw new Error('Compiled output not found. Run \'aihf compile\' first.');
    }

    // Determine output file path
    const outputFile = options.output || `${bundleName}.zip`;
    const outputPath = resolve(process.cwd(), outputFile);

    console.log(chalk.gray(`📁 Bundle path: ${resolvedPath}`));
    console.log(chalk.gray(`📦 Output file: ${outputPath}`));

    // Validate required files before bundling
    await validateBundleForDeployment(resolvedPath);

    // Create ZIP archive
    const output = createWriteStream(outputPath);
    const archive = archiver('zip', {
      zlib: { level: options.compress !== false ? 9 : 1 }
    });

    // Handle archive events
    output.on('close', () => {
      const sizeKB = Math.round(archive.pointer() / 1024);
      console.log(chalk.green('✅ Bundle created successfully!'));
      console.log(chalk.gray(`📊 Bundle size: ${sizeKB} KB`));
      console.log(chalk.gray(`📁 File: ${outputPath}`));
      console.log('');
      console.log(chalk.blue('🚀 Ready for deployment!'));
      console.log(chalk.gray('   Upload this bundle at: https://admin.aihf.io'));
    });

    archive.on('error', (err) => {
      throw err;
    });

    archive.pipe(output);

    console.log(chalk.yellow('📋 Adding configuration files...'));

    // Add configuration files
    const configFiles = ['workflow.yaml', 'bundle.yaml', 'package.json'];
    for (const file of configFiles) {
      const filePath = join(resolvedPath, file);
      if (existsSync(filePath)) {
        archive.file(filePath, { name: file });
      }
    }

    // Add compiled JavaScript output
    console.log(chalk.yellow('📦 Adding compiled output...'));
    archive.directory(distPath, 'dist');

    // Add source files if requested
    if (options.includeSource) {
      console.log(chalk.yellow('📄 Adding source files...'));
      const srcPath = join(resolvedPath, 'src');
      if (existsSync(srcPath)) {
        archive.directory(srcPath, 'src');
      }
    }

    // Add README if present
    const readmePath = join(resolvedPath, 'README.md');
    if (existsSync(readmePath)) {
      archive.file(readmePath, { name: 'README.md' });
    }

    // Finalize the archive
    await archive.finalize();

  } catch (error: any) {
    console.error(chalk.red('✗ Bundle creation failed:'), error.message);
    process.exit(1);
  }
}

async function validateBundleForDeployment(bundlePath: string) {
  console.log(chalk.yellow('🔍 Validating bundle for deployment...'));

  const fs = await import('fs/promises');

  // Required files for deployment
  const requiredFiles = [
    'workflow.yaml',
    'bundle.yaml',
    'dist/config/config.json'
  ];

  const errors: string[] = [];

  for (const file of requiredFiles) {
    const filePath = join(bundlePath, file);
    if (!existsSync(filePath)) {
      errors.push(`Required file missing: ${file}`);
    }
  }

  // Check for compiled JavaScript files
  const distSrcPath = join(bundlePath, 'dist/src');
  if (!existsSync(distSrcPath)) {
    errors.push('Compiled source files missing in dist/src/');
  } else {
    // Check for at least one component
    const glob = await import('glob');
    const jsFiles = glob.globSync('**/*.js', { cwd: distSrcPath });

    if (jsFiles.length === 0) {
      errors.push('No compiled JavaScript files found in dist/src/');
    }
  }

  // Validate bundle.yaml references
  try {
    const bundleYamlPath = join(bundlePath, 'bundle.yaml');
    const yaml = await import('js-yaml');
    const bundleContent = await fs.readFile(bundleYamlPath, 'utf-8');
    const bundle = yaml.load(bundleContent) as any;

    if (bundle.steps) {
      for (const step of bundle.steps) {
        // Check UI files exist in compiled output
        if (step.ui?.dynamic) {
          const compiledFile = step.ui.dynamic.replace(/\.ts$/, '.js');
          const compiledPath = join(bundlePath, 'dist/src', compiledFile);

          if (!existsSync(compiledPath)) {
            errors.push(`Compiled UI file missing: dist/src/${compiledFile}`);
          }
        }

        // Check API files exist in compiled output
        if (step.api && Array.isArray(step.api)) {
          for (const apiHandler of step.api) {
            if (apiHandler.file) {
              const compiledFile = apiHandler.file.replace(/\.ts$/, '.js');
              const compiledPath = join(bundlePath, 'dist/src', compiledFile);

              if (!existsSync(compiledPath)) {
                errors.push(`Compiled API file missing: dist/src/${compiledFile}`);
              }
            }
          }
        }
      }
    }

  } catch (error: any) {
    errors.push(`Failed to validate bundle components: ${error.message}`);
  }

  if (errors.length > 0) {
    console.error(chalk.red('❌ Bundle validation failed:'));
    errors.forEach(error => {
      console.error(chalk.red(`  ✗ ${error}`));
    });
    throw new Error('Bundle validation failed. Please fix the errors above.');
  }

  console.log(chalk.green('✅ Bundle validation passed'));
}
