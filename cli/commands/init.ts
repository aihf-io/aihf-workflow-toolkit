/**
 * Init Command - Create new workflow bundles from templates
 */

import { join, resolve } from 'path';
import { existsSync, mkdirSync, readdirSync } from 'fs';
import fsExtra from 'fs-extra';
import chalk from 'chalk';
const { copy, readJson, writeJson } = fsExtra;
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

interface InitOptions {
  template?: string;
  type?: string;
  suite?: string;
  description?: string;
  skipInstall?: boolean;
  listTemplates?: boolean;
}

// Get templates directory - relative to compiled CLI location
function getTemplatesDir(): string {
  // When compiled, __dirname is in dist/cli/commands
  // Templates are in templates/ at package root
  return join(__dirname, '../../templates');
}

// Get available templates
function getAvailableTemplates(): string[] {
  const templatesDir = getTemplatesDir();
  if (!existsSync(templatesDir)) {
    return [];
  }

  return readdirSync(templatesDir, { withFileTypes: true })
    .filter(dirent => dirent.isDirectory())
    .map(dirent => dirent.name);
}

export async function initCommand(bundleName: string, options: InitOptions) {
  try {
    // Handle --list-templates flag
    if (options.listTemplates) {
      const templates = getAvailableTemplates();
      console.log(chalk.blue('Available templates:'));
      console.log('');
      templates.forEach(t => {
        console.log(chalk.cyan(`  - ${t}`));
      });
      console.log('');
      console.log(chalk.gray('Use: aihf init <name> --template <template-name>'));
      console.log(chalk.gray('Use: aihf init <name> --type multi-part   (for multi-workflow suites)'));
      return;
    }

    // Validate bundle name
    if (!bundleName || bundleName.length === 0) {
      throw new Error('Bundle name is required');
    }

    if (!/^[a-z0-9-]+$/.test(bundleName)) {
      throw new Error('Bundle name must contain only lowercase letters, numbers, and hyphens');
    }

    const workflowType = options.type || 'isolated';
    if (!['isolated', 'multi-part'].includes(workflowType)) {
      throw new Error(`Invalid type '${workflowType}'. Must be 'isolated' or 'multi-part'.`);
    }

    // Handle --suite flag: create bundle inside an existing suite
    if (options.suite) {
      await initSuiteBundle(bundleName, options);
      return;
    }

    // Handle multi-part type: create suite root
    if (workflowType === 'multi-part') {
      await initMultiPartSuite(bundleName, options);
      return;
    }

    // Default: create isolated workflow bundle
    await initIsolatedBundle(bundleName, options);

  } catch (error: any) {
    console.error(chalk.red('Error creating workflow bundle:'), error.message);
    process.exit(1);
  }
}

/**
 * Create a standard isolated workflow bundle
 */
async function initIsolatedBundle(bundleName: string, options: InitOptions) {
  console.log(chalk.blue('Creating new AIHF.io workflow bundle...'));

  const targetPath = resolve(process.cwd(), bundleName);

  // Check if directory already exists
  if (existsSync(targetPath)) {
    throw new Error(`Directory '${bundleName}' already exists`);
  }

  // Resolve template path
  const templateName = options.template || 'basic-workflow';
  const templatesDir = getTemplatesDir();
  const templatePath = join(templatesDir, templateName);

  // Don't allow using multi-part template for isolated init
  if (templateName === 'multi-part') {
    throw new Error("Template 'multi-part' is for suites. Use --type multi-part instead.");
  }

  const availableTemplates = getAvailableTemplates().filter(t => t !== 'multi-part');

  if (!existsSync(templatePath)) {
    console.error(chalk.red(`Template '${templateName}' not found.`));
    console.log(chalk.yellow('Available templates:'));
    availableTemplates.forEach(t => console.log(chalk.cyan(`  - ${t}`)));
    throw new Error(`Template '${templateName}' not found`);
  }

  console.log(chalk.gray(`Using template: ${templateName}`));
  console.log(chalk.gray(`Target directory: ${targetPath}`));

  // Create target directory
  mkdirSync(targetPath, { recursive: true });

  // Copy template files
  console.log(chalk.yellow('Copying template files...'));
  await copy(templatePath, targetPath, {
    filter: (src) => {
      return !src.includes('node_modules') && !src.includes('/dist/');
    }
  });

  // Update package.json with new bundle name and description
  const packageJsonPath = join(targetPath, 'package.json');
  if (existsSync(packageJsonPath)) {
    console.log(chalk.yellow('Updating package.json...'));
    const packageJson = await readJson(packageJsonPath);
    packageJson.name = bundleName;
    if (options.description) {
      packageJson.description = options.description;
    }
    await writeJson(packageJsonPath, packageJson, { spaces: 2 });
  }

  const fs = await import('fs/promises');

  // Update bundle.yaml with new bundle name
  const bundleYamlPath = join(targetPath, 'bundle.yaml');
  if (existsSync(bundleYamlPath)) {
    console.log(chalk.yellow('Updating bundle.yaml...'));
    let bundleContent = await fs.readFile(bundleYamlPath, 'utf-8');
    bundleContent = bundleContent.replace(
      /^name:\s*.+$/m,
      `name: ${bundleName}`
    );
    await fs.writeFile(bundleYamlPath, bundleContent);
  }

  // Update config.json with new bundle name
  const configJsonPath = join(targetPath, 'config', 'config.json');
  if (existsSync(configJsonPath)) {
    console.log(chalk.yellow('Updating config.json...'));
    const config = await readJson(configJsonPath);
    const displayName = bundleName.split('-').map((w: string) =>
      w.charAt(0).toUpperCase() + w.slice(1)
    ).join(' ');
    config.name = `${displayName} Configuration`;
    await writeJson(configJsonPath, config, { spaces: 2 });
  }

  console.log(chalk.green('Workflow bundle created successfully!'));
  console.log('');
  console.log(chalk.bold('Next steps:'));
  console.log(chalk.gray(`  cd ${bundleName}`));

  if (!options.skipInstall) {
    console.log(chalk.gray('  npm install'));
  }

  console.log(chalk.gray('  aihf compile'));
  console.log(chalk.gray('  aihf validate'));
  console.log(chalk.gray('  aihf bundle'));
  console.log('');
  console.log(chalk.blue('Documentation: https://docs.aihf.io'));
  console.log(chalk.blue('Deploy via: https://admin.aihf.io'));
}

/**
 * Create a multi-part suite root
 */
async function initMultiPartSuite(suiteName: string, options: InitOptions) {
  console.log(chalk.blue('Creating new AIHF.io multi-workflow suite...'));

  const targetPath = resolve(process.cwd(), suiteName);

  if (existsSync(targetPath)) {
    throw new Error(`Directory '${suiteName}' already exists`);
  }

  const templatesDir = getTemplatesDir();
  const templatePath = join(templatesDir, 'multi-part');

  if (!existsSync(templatePath)) {
    throw new Error('Multi-part template not found. Ensure the AIHF CLI package is up to date.');
  }

  console.log(chalk.gray(`Target directory: ${targetPath}`));

  mkdirSync(targetPath, { recursive: true });

  // Copy multi-part template
  console.log(chalk.yellow('Copying suite template files...'));
  await copy(templatePath, targetPath, {
    filter: (src) => {
      return !src.includes('node_modules') && !src.includes('/dist/');
    }
  });

  const fs = await import('fs/promises');

  // Update aihf-suite.yaml with suite name
  const suiteYamlPath = join(targetPath, 'aihf-suite.yaml');
  if (existsSync(suiteYamlPath)) {
    console.log(chalk.yellow('Updating aihf-suite.yaml...'));
    let suiteContent = await fs.readFile(suiteYamlPath, 'utf-8');
    suiteContent = suiteContent.replace(
      /^name:\s*.+$/m,
      `name: ${suiteName}`
    );
    if (options.description) {
      suiteContent = suiteContent.replace(
        /^description:\s*.+$/m,
        `description: "${options.description}"`
      );
    }
    await fs.writeFile(suiteYamlPath, suiteContent);
  }

  console.log(chalk.green('Multi-workflow suite created successfully!'));
  console.log('');
  console.log(chalk.bold('Next steps:'));
  console.log(chalk.gray(`  cd ${suiteName}`));
  console.log(chalk.gray('  aihf init signup --suite .       # Add a workflow bundle'));
  console.log(chalk.gray('  aihf init dashboard --suite .    # Add another bundle'));
  console.log(chalk.gray('  aihf compile-suite .             # Compile all bundles'));
  console.log('');
  console.log(chalk.bold('Suite structure:'));
  console.log(chalk.gray('  shared/types/   - Shared TypeScript types across all bundles'));
  console.log(chalk.gray('  shared/utils/   - Shared utility functions'));
  console.log(chalk.gray('  workflows/      - Individual workflow bundles'));
  console.log('');
  console.log(chalk.blue('Documentation: https://docs.aihf.io'));
}

/**
 * Create a workflow bundle inside an existing suite
 */
async function initSuiteBundle(bundleName: string, options: InitOptions) {
  const fs = await import('fs/promises');
  const yaml = await import('js-yaml');

  const suitePath = resolve(process.cwd(), options.suite!);

  // Verify suite root exists
  const suiteYamlPath = join(suitePath, 'aihf-suite.yaml');
  if (!existsSync(suiteYamlPath)) {
    throw new Error(`No aihf-suite.yaml found at '${suitePath}'. Is this a multi-part suite root?`);
  }

  console.log(chalk.blue(`Adding workflow '${bundleName}' to suite...`));

  const workflowsDir = join(suitePath, 'workflows');
  if (!existsSync(workflowsDir)) {
    mkdirSync(workflowsDir, { recursive: true });
  }

  const targetPath = join(workflowsDir, bundleName);
  if (existsSync(targetPath)) {
    throw new Error(`Workflow '${bundleName}' already exists in this suite`);
  }

  // Use the specified template or default basic-workflow
  const templateName = options.template || 'basic-workflow';
  const templatesDir = getTemplatesDir();
  const templatePath = join(templatesDir, templateName);

  if (templateName === 'multi-part') {
    throw new Error("Cannot nest suites. Use a workflow template (e.g. basic-workflow, full-stack).");
  }

  if (!existsSync(templatePath)) {
    throw new Error(`Template '${templateName}' not found`);
  }

  console.log(chalk.gray(`Using template: ${templateName}`));
  console.log(chalk.gray(`Target: workflows/${bundleName}/`));

  mkdirSync(targetPath, { recursive: true });

  // Copy template files
  console.log(chalk.yellow('Copying template files...'));
  await copy(templatePath, targetPath, {
    filter: (src) => {
      return !src.includes('node_modules') && !src.includes('/dist/');
    }
  });

  // Update package.json
  const packageJsonPath = join(targetPath, 'package.json');
  if (existsSync(packageJsonPath)) {
    const packageJson = await readJson(packageJsonPath);
    packageJson.name = bundleName;
    if (options.description) {
      packageJson.description = options.description;
    }
    await writeJson(packageJsonPath, packageJson, { spaces: 2 });
  }

  // Update bundle.yaml
  const bundleYamlPath = join(targetPath, 'bundle.yaml');
  if (existsSync(bundleYamlPath)) {
    let bundleContent = await fs.readFile(bundleYamlPath, 'utf-8');
    bundleContent = bundleContent.replace(
      /^name:\s*.+$/m,
      `name: ${bundleName}`
    );
    await fs.writeFile(bundleYamlPath, bundleContent);
  }

  // Update config.json
  const configJsonPath = join(targetPath, 'config', 'config.json');
  if (existsSync(configJsonPath)) {
    const config = await readJson(configJsonPath);
    const displayName = bundleName.split('-').map((w: string) =>
      w.charAt(0).toUpperCase() + w.slice(1)
    ).join(' ');
    config.name = `${displayName} Configuration`;
    await writeJson(configJsonPath, config, { spaces: 2 });
  }

  // Add workflow to aihf-suite.yaml
  const suiteContent = await fs.readFile(suiteYamlPath, 'utf-8');
  const suiteConfig = yaml.load(suiteContent) as any;

  if (!suiteConfig.workflows) {
    suiteConfig.workflows = [];
  }

  if (!suiteConfig.workflows.includes(bundleName)) {
    suiteConfig.workflows.push(bundleName);
    await fs.writeFile(suiteYamlPath, yaml.dump(suiteConfig, { lineWidth: -1 }));
    console.log(chalk.green(`Added '${bundleName}' to aihf-suite.yaml`));
  }

  console.log(chalk.green(`Workflow '${bundleName}' added to suite!`));
  console.log('');
  console.log(chalk.bold('Next steps:'));
  console.log(chalk.gray(`  Edit workflows/${bundleName}/src/ to add your handlers`));
  console.log(chalk.gray(`  Import shared types: import { ... } from '@suite/shared/types';`));
  console.log(chalk.gray(`  Compile: aihf compile workflows/${bundleName}`));
  console.log(chalk.gray(`  Or compile all: aihf compile-suite .`));
}
