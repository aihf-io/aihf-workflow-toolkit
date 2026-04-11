/**
 * Validate Command - Bundle structure and configuration validation
 *
 * Validates workflow bundles against the AIHF Platform SDK type definitions
 * (see packages/aihf-platform/types/index.d.ts for the canonical reference).
 */

import { join, resolve, dirname } from 'path';
import { existsSync, statSync } from 'fs';
import chalk from 'chalk';
import yaml from 'js-yaml';

interface ValidateOptions {
  strict?: boolean;
  fix?: boolean;
  suite?: boolean;
}

interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

// ---------------------------------------------------------------------------
// Canonical manager names on AIHFPlatform (types/index.d.ts)
// ---------------------------------------------------------------------------
const VALID_MANAGER_NAMES = [
  'entities',
  'tasks',
  'workflows',
  'database',
  'emails',
  'credentials',
  'utilities',
  'auth',
  'files',
  'preferences',
  'billing',
] as const;

// ---------------------------------------------------------------------------
// Valid methods for each manager, derived from the type definitions
// ---------------------------------------------------------------------------
const VALID_MANAGER_METHODS: Record<string, string[]> = {
  entities: [
    'getCurrentEntity',
    'getEntity',
    'updateEntity',
    'findByUsername',
    'createEntity',
    'selfRegisterEntity',
  ],
  tasks: [
    'setStepData',
    'getStepData',
    'getTask',
  ],
  workflows: [
    'listWorkflows',
    'getWorkflow',
    'getWorkflowConfig',
    'getWorkflowConfigHelper',
  ],
  database: [
    'query',
    'queryOne',
    'execute',
    'batch',
    'dump',
    'insert',
    'update',
    'delete',
    'upsert',
  ],
  emails: [
    'send',
    'sendPasswordReset',
    'sendEmailVerification',
    'sendWelcomeEmail',
    'sendTaskAssignedEmail',
    'sendWorkflowCompleteEmail',
  ],
  credentials: [
    'changeSelfPassword',
    'initiateOAuth',
    'completeOAuth',
    'linkOAuthCredential',
    'createIdentityWithOAuth',
    'getLinkedOAuthProviders',
    'unlinkOAuthProvider',
  ],
  utilities: [
    'documents',
    'spreadsheets',
    'pdfs',
    'images',
    'tensors',
    'diagrams',
    'calendar',
    'waves',
    'ui',
  ],
  auth: [
    'createMagicLink',
  ],
  files: [
    'list',
    'getMetadata',
    'download',
    'upload',
    'delete',
    'createFolder',
    'deleteFolder',
    'search',
    'getRootFolders',
  ],
  preferences: [
    'getNotificationPreferences',
    'updateNotificationPreferences',
    'getWorkflowPreferences',
    'updateWorkflowPreferences',
  ],
  billing: [
    'createCheckoutSession',
    'getSubscription',
    'createPortalSession',
    'listPlans',
  ],
};

// ---------------------------------------------------------------------------
// Utilities sub-managers and their methods
// ---------------------------------------------------------------------------
const VALID_UTILITY_SUB_MANAGERS: Record<string, string[]> = {
  documents: ['parse'],
  spreadsheets: ['parse', 'toCSV'],
  pdfs: ['extractPages', 'isValidPdf', 'toBase64'],
  images: ['getMetadata', 'detectFormat', 'toDataUrl', 'serializeAnnotations', 'deserializeAnnotations'],
  tensors: ['analyze', 'reshape', 'to2DArray', 'from2DArray'],
  diagrams: ['create', 'validateMermaidSyntax', 'generateFlowchart', 'generateSequenceDiagram'],
  calendar: [
    'buildMonthGrid', 'getWeekdayNames', 'getMonthName', 'toISODate',
    'isDateInRange', 'daysBetween', 'addDays', 'formatDate',
  ],
  waves: [
    'normalize', 'scale', 'offset', 'add', 'subtract', 'multiply', 'invert',
    'clip', 'downsample', 'upsample', 'resample', 'movingAverage', 'ema',
    'gaussianSmooth', 'convolve', 'removeDC', 'derivative', 'integral',
    'fft', 'ifft', 'compare', 'pearsonCorrelation', 'rmse', 'findPeaks',
    'findValleys', 'align', 'crossCorrelation', 'stats', 'sine', 'square',
    'sawtooth', 'noise',
  ],
  ui: [
    'documentEditor', 'spreadsheetViewer', 'pdfViewer', 'imageAnnotator',
    'tensorExplorer', 'diagramBuilder', 'calendar', 'dateRangePicker',
    'bottomTabs', 'slideover', 'toastContainer', 'toast', 'checkoutButton',
    'subscriptionPortalButton', 'subscriptionStatus', 'waveViewer',
    'getStylesheet', 'getInlineStyles',
  ],
};

// ---------------------------------------------------------------------------
// Deprecated / incorrect patterns that should be flagged
// ---------------------------------------------------------------------------
const DEPRECATED_PATTERNS: Array<{ pattern: RegExp; message: string }> = [
  // Wrong manager name
  { pattern: /\.ai\b/, message: "Manager 'ai' does not exist on AIHFPlatform. Use the correct manager name (e.g. entities, tasks, workflows, database, etc.)." },

  // Entity methods
  { pattern: /\.entities\.getInitiator\b/, message: "entities.getInitiator() does not exist. Use entities.getCurrentEntity() instead." },
  { pattern: /\.entities\.searchEntities\b/, message: "entities.searchEntities() does not exist. Use entities.findByUsername() for lookup by username." },

  // Task methods
  { pattern: /\.tasks\.getCurrentTask\b/, message: "tasks.getCurrentTask() does not exist. Use tasks.getTask(taskId) instead." },
  { pattern: /\.tasks\.updateTaskData\b/, message: "tasks.updateTaskData() does not exist. Use tasks.setStepData(data) to set step data." },
  { pattern: /\.tasks\.completeTask\b/, message: "tasks.completeTask() does not exist. Task completion is managed by the platform." },
  { pattern: /\.tasks\.createTask\b/, message: "tasks.createTask() does not exist. Tasks are created by the platform when workflows are initiated." },

  // Database ORM-style methods
  { pattern: /\.database\.select\b/, message: "database.select() does not exist. Use database.query(workflowId, sql, params) for raw SQL queries." },
  { pattern: /\.database\.find\b/, message: "database.find() does not exist. Use database.query() or database.queryOne() for raw SQL queries." },
  { pattern: /\.database\.create\b/, message: "database.create() does not exist. Use database.insert(workflowId, table, data) or database.execute(workflowId, sql, params)." },
  { pattern: /\.database\.save\b/, message: "database.save() does not exist. Use database.insert() or database.upsert() instead." },

  // Workflow methods
  { pattern: /\.workflows\.createWorkflow\b/, message: "workflows.createWorkflow() does not exist. Workflows are defined in workflow.yaml and deployed via bundles." },
  { pattern: /\.workflows\.deleteWorkflow\b/, message: "workflows.deleteWorkflow() does not exist. Workflows are managed through the platform admin." },
];

// ---------------------------------------------------------------------------
// Valid config field types (config.json)
// ---------------------------------------------------------------------------
const VALID_CONFIG_FIELD_TYPES = ['boolean', 'number', 'string', 'textarea', 'select', 'multiselect'] as const;

// ===========================================================================
// Main command
// ===========================================================================

/**
 * Detect if a bundle is inside a suite by walking up looking for aihf-suite.yaml
 */
function detectSuiteRoot(bundlePath: string): string | null {
  let current = resolve(bundlePath);
  const root = resolve('/');

  for (let i = 0; i < 3; i++) {
    const parent = dirname(current);
    if (parent === current || parent === root) break;
    current = parent;

    if (existsSync(join(current, 'aihf-suite.yaml'))) {
      return current;
    }
  }

  return null;
}

export async function validateCommand(bundlePath: string, options: ValidateOptions) {
  try {
    const resolvedPath = resolve(process.cwd(), bundlePath);

    // Suite-level validation: validate all bundles in the suite
    if (options.suite) {
      await validateSuite(resolvedPath);
      return;
    }

    console.log(chalk.blue('Validating workflow bundle...'));
    console.log(chalk.gray(`Bundle path: ${resolvedPath}`));

    // Detect if this bundle is inside a suite
    const suiteRoot = detectSuiteRoot(resolvedPath);
    if (suiteRoot) {
      console.log(chalk.cyan(`Suite context detected at: ${suiteRoot}`));
    }

    const result: ValidationResult = {
      valid: true,
      errors: [],
      warnings: []
    };

    // Validate bundle structure
    await validateBundleStructure(resolvedPath, result);

    // Validate configuration files
    await validateConfigurationFiles(resolvedPath, result);

    // Validate file consistency
    await validateFileConsistency(resolvedPath, result);

    // Validate Platform SDK usage (suite-aware)
    await validatePlatformSDKUsage(resolvedPath, result, suiteRoot);

    // Display results
    displayValidationResults(result);

    if (!result.valid) {
      process.exit(1);
    }

  } catch (error: any) {
    console.error(chalk.red('Validation failed:'), error.message);
    process.exit(1);
  }
}

/**
 * Validate all bundles in a suite
 */
async function validateSuite(suitePath: string) {
  const fs = await import('fs/promises');

  const suiteYamlPath = join(suitePath, 'aihf-suite.yaml');
  if (!existsSync(suiteYamlPath)) {
    console.error(chalk.red('aihf-suite.yaml not found - is this a multi-part suite root?'));
    process.exit(1);
  }

  const suiteContent = await fs.readFile(suiteYamlPath, 'utf-8');
  const suiteConfig = yaml.load(suiteContent) as any;

  console.log(chalk.blue(`Validating suite: ${suiteConfig.name || 'unknown'}`));

  const workflows: string[] = suiteConfig.workflows || [];
  if (workflows.length === 0) {
    console.log(chalk.yellow('No workflows found in suite.'));
    return;
  }

  // Validate shared code compiles
  const sharedPath = join(suitePath, 'shared');
  if (existsSync(sharedPath)) {
    console.log(chalk.green('Shared directory found'));
  } else {
    console.log(chalk.yellow('No shared/ directory found'));
  }

  const results: { name: string; valid: boolean; errors: number; warnings: number }[] = [];

  for (const workflow of workflows) {
    const workflowPath = join(suitePath, 'workflows', workflow);

    if (!existsSync(workflowPath)) {
      console.log(chalk.red(`Workflow '${workflow}' directory not found`));
      results.push({ name: workflow, valid: false, errors: 1, warnings: 0 });
      continue;
    }

    console.log(chalk.cyan(`\n--- Validating: ${workflow} ---`));

    const result: ValidationResult = {
      valid: true,
      errors: [],
      warnings: []
    };

    await validateBundleStructure(workflowPath, result);
    await validateConfigurationFiles(workflowPath, result);
    await validateFileConsistency(workflowPath, result);
    await validatePlatformSDKUsage(workflowPath, result, suitePath);

    displayValidationResults(result);
    results.push({ name: workflow, valid: result.valid, errors: result.errors.length, warnings: result.warnings.length });
  }

  // Summary
  console.log(chalk.bold('\nSuite validation summary:'));
  const allValid = results.every(r => r.valid);

  for (const r of results) {
    if (r.valid) {
      console.log(chalk.green(`  ${r.name}: passed (${r.warnings} warnings)`));
    } else {
      console.log(chalk.red(`  ${r.name}: failed (${r.errors} errors, ${r.warnings} warnings)`));
    }
  }

  if (!allValid) {
    process.exit(1);
  }
}

// ===========================================================================
// Bundle structure validation
// ===========================================================================

async function validateBundleStructure(bundlePath: string, result: ValidationResult) {
  console.log(chalk.yellow('Validating bundle structure...'));

  // Required files
  const requiredFiles = [
    'bundle.yaml',
    'config/config.json'
  ];

  for (const file of requiredFiles) {
    const filePath = join(bundlePath, file);
    if (!existsSync(filePath)) {
      result.errors.push(`Required file missing: ${file}`);
      result.valid = false;
    }
  }

  // Required directories
  const requiredDirs = [
    'src',
    'config'
  ];

  for (const dir of requiredDirs) {
    const dirPath = join(bundlePath, dir);
    if (!existsSync(dirPath)) {
      result.errors.push(`Required directory missing: ${dir}`);
      result.valid = false;
    } else if (!statSync(dirPath).isDirectory()) {
      result.errors.push(`Expected directory but found file: ${dir}`);
      result.valid = false;
    }
  }

  // Optional but recommended directories
  const recommendedDirs = ['src/ui', 'src/api'];
  for (const dir of recommendedDirs) {
    const dirPath = join(bundlePath, dir);
    if (!existsSync(dirPath)) {
      result.warnings.push(`Recommended directory missing: ${dir}`);
    }
  }

  // Check for README
  const readmePath = join(bundlePath, 'README.md');
  if (!existsSync(readmePath)) {
    result.warnings.push('README.md not found - consider adding documentation');
  }
}

// ===========================================================================
// Configuration file validation
// ===========================================================================

async function validateConfigurationFiles(bundlePath: string, result: ValidationResult) {
  console.log(chalk.yellow('Validating configuration files...'));

  const fs = await import('fs/promises');

  // ---- bundle.yaml --------------------------------------------------------
  try {
    const bundleYamlPath = join(bundlePath, 'bundle.yaml');
    if (existsSync(bundleYamlPath)) {
      const bundleContent = await fs.readFile(bundleYamlPath, 'utf-8');
      const bundle = yaml.load(bundleContent) as any;

      if (!bundle.name) {
        result.errors.push('bundle.yaml: missing required field "name"');
        result.valid = false;
      }

      if (!bundle.version) {
        result.errors.push('bundle.yaml: missing required field "version"');
        result.valid = false;
      }

      if (!bundle.steps || !Array.isArray(bundle.steps)) {
        result.errors.push('bundle.yaml: missing or invalid "steps" array');
        result.valid = false;
      } else {
        validateBundleSteps(bundle.steps, result);
      }
    }
  } catch (error: any) {
    result.errors.push(`bundle.yaml: invalid YAML format - ${error.message}`);
    result.valid = false;
  }

  // ---- config/config.json -------------------------------------------------
  try {
    const configPath = join(bundlePath, 'config/config.json');
    if (existsSync(configPath)) {
      const configContent = await fs.readFile(configPath, 'utf-8');
      const config = JSON.parse(configContent);
      validateConfigJson(config, result);
    }
  } catch (error: any) {
    result.errors.push(`config/config.json: invalid JSON format - ${error.message}`);
    result.valid = false;
  }

  // ---- package.json (optional) --------------------------------------------
  try {
    const packagePath = join(bundlePath, 'package.json');
    if (existsSync(packagePath)) {
      const packageContent = await fs.readFile(packagePath, 'utf-8');
      const packageJson = JSON.parse(packageContent);

      if (!packageJson.name) {
        result.warnings.push('package.json: missing name');
      }
    }
  } catch (error: any) {
    result.errors.push(`package.json: invalid JSON format - ${error.message}`);
    result.valid = false;
  }
}

// ---------------------------------------------------------------------------
// bundle.yaml step validation
//
// Each step must match WorkflowManifestStepHandler:
//   { id, route, domain?, ui: { css, script, dynamic }, api: [{ route_match, file, input, output }] }
// ---------------------------------------------------------------------------
function validateBundleSteps(steps: any[], result: ValidationResult) {
  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    const label = step.id ? `step "${step.id}"` : `step[${i}]`;

    // Required: id
    if (!step.id) {
      result.errors.push(`bundle.yaml: ${label} missing required field "id"`);
      result.valid = false;
    }

    // Required: route
    if (!step.route) {
      result.errors.push(`bundle.yaml: ${label} missing required field "route"`);
      result.valid = false;
    }

    // Optional: domain (must be 'app' or 'work' when present)
    if (step.domain !== undefined && !['app', 'work'].includes(step.domain)) {
      result.errors.push(`bundle.yaml: ${label} has invalid domain "${step.domain}" (must be "app" or "work")`);
      result.valid = false;
    }
    if (step.domain === undefined) {
      result.warnings.push(`bundle.yaml: ${label} has no "domain" set - consider specifying "app" or "work"`);
    }

    // Required: ui object { css, script, dynamic }
    if (!step.ui) {
      result.errors.push(`bundle.yaml: ${label} missing required "ui" object`);
      result.valid = false;
    } else if (typeof step.ui !== 'object' || Array.isArray(step.ui)) {
      result.errors.push(`bundle.yaml: ${label} "ui" must be an object with { css, script, dynamic }`);
      result.valid = false;
    } else {
      const uiFields = ['css', 'script', 'dynamic'];
      for (const field of uiFields) {
        if (!step.ui[field] && step.ui[field] !== '') {
          result.warnings.push(`bundle.yaml: ${label} ui missing field "${field}"`);
        }
      }
    }

    // Required: api must be an array (gateway rejects steps without it)
    if (!step.api) {
      result.errors.push(`bundle.yaml: ${label} "api" is required (use "api: []" for steps with no handlers)`);
      result.valid = false;
    } else if (!Array.isArray(step.api)) {
      result.errors.push(`bundle.yaml: ${label} "api" must be an array of handler objects`);
      result.valid = false;
    } else {
      for (let j = 0; j < step.api.length; j++) {
        const handler = step.api[j];
        const handlerLabel = `${label} api[${j}]`;

        if (!handler.route_match) {
          result.errors.push(`bundle.yaml: ${handlerLabel} missing required field "route_match"`);
          result.valid = false;
        }

        if (!handler.file) {
          result.errors.push(`bundle.yaml: ${handlerLabel} missing required field "file"`);
          result.valid = false;
        }

        if (handler.input !== undefined && !Array.isArray(handler.input)) {
          result.errors.push(`bundle.yaml: ${handlerLabel} "input" must be an array of parameter objects`);
          result.valid = false;
        }

        if (handler.output !== undefined && !Array.isArray(handler.output)) {
          result.errors.push(`bundle.yaml: ${handlerLabel} "output" must be an array of parameter objects`);
          result.valid = false;
        }

        // Validate individual parameter definitions
        for (const paramListKey of ['input', 'output'] as const) {
          if (Array.isArray(handler[paramListKey])) {
            for (const param of handler[paramListKey]) {
              if (!param.name) {
                result.errors.push(`bundle.yaml: ${handlerLabel} ${paramListKey} parameter missing "name"`);
                result.valid = false;
              }
              if (param.type && !['string', 'number', 'boolean', 'Response'].includes(param.type)) {
                result.errors.push(`bundle.yaml: ${handlerLabel} ${paramListKey} parameter "${param.name || '?'}" has invalid type "${param.type}" (must be "string", "number", "boolean", or "Response")`);
                result.valid = false;
              }
            }
          }
        }

        // SSE opt-in marker constraints. The 'Response' parameter type is
        // exclusively the SSE opt-in marker and must appear only as the
        // sole output[0] with name 'SSE'. Any other use is invalid.
        const hasResponseInInput =
          Array.isArray(handler.input) &&
          handler.input.some((p: any) => p?.type === 'Response');
        if (hasResponseInInput) {
          result.errors.push(
            `bundle.yaml: ${handlerLabel} input parameters may not use type "Response" ` +
            `— this type is exclusively the SSE output marker`
          );
          result.valid = false;
        }

        if (Array.isArray(handler.output)) {
          const responseOutputs = handler.output.filter((p: any) => p?.type === 'Response');
          if (responseOutputs.length > 0) {
            const onlyOutput = handler.output.length === 1 ? handler.output[0] : null;
            const isValidSSEShape =
              onlyOutput &&
              onlyOutput.type === 'Response' &&
              onlyOutput.name === 'SSE';
            if (!isValidSSEShape) {
              result.errors.push(
                `bundle.yaml: ${handlerLabel} SSE handlers must declare output exactly as ` +
                `[{ name: "SSE", type: "Response" }] — no other output parameters allowed`
              );
              result.valid = false;
            }
          }
        }
      }
    }
  }
}

// ---------------------------------------------------------------------------
// config.json validation
//
// Must match WorkflowConfig: { name, description, version, fields: WorkflowConfigField[] }
// Field types: 'boolean' | 'number' | 'string' | 'select' | 'multiselect'
// ---------------------------------------------------------------------------
function validateConfigJson(config: any, result: ValidationResult) {
  // Detect old freeform config format (no fields array, arbitrary top-level keys)
  const knownTopLevelKeys = ['name', 'description', 'version', 'fields'];
  const configKeys = Object.keys(config);
  const unknownKeys = configKeys.filter(k => !knownTopLevelKeys.includes(k));
  if (!config.fields && unknownKeys.length > 0) {
    result.errors.push(
      `config/config.json: appears to use old freeform format (found keys: ${unknownKeys.join(', ')}). ` +
      `Migrate to the fields-based format: { name, description, version, fields: [...] }. ` +
      `See docs/CONFIG_JSON.md for the required schema.`
    );
    result.valid = false;
    return;
  }

  if (!config.name) {
    result.warnings.push('config/config.json: missing "name"');
  }

  if (!config.description) {
    result.warnings.push('config/config.json: missing "description"');
  }

  if (config.version === undefined) {
    result.warnings.push('config/config.json: missing "version" (should be a number, e.g. 1)');
  } else if (typeof config.version !== 'number') {
    result.errors.push(`config/config.json: "version" must be a number, got ${typeof config.version}`);
    result.valid = false;
  }

  if (!config.fields) {
    result.warnings.push('config/config.json: missing "fields" array');
    return;
  }

  if (!Array.isArray(config.fields)) {
    result.errors.push('config/config.json: "fields" must be an array');
    result.valid = false;
    return;
  }

  for (let i = 0; i < config.fields.length; i++) {
    const field = config.fields[i];
    const label = field.id ? `field "${field.id}"` : `fields[${i}]`;

    if (!field.id) {
      result.errors.push(`config/config.json: ${label} missing required "id"`);
      result.valid = false;
    }

    if (!field.label) {
      result.warnings.push(`config/config.json: ${label} missing "label"`);
    }

    if (!field.type) {
      result.errors.push(`config/config.json: ${label} missing required "type"`);
      result.valid = false;
    } else if (!(VALID_CONFIG_FIELD_TYPES as readonly string[]).includes(field.type)) {
      result.errors.push(
        `config/config.json: ${label} has invalid type "${field.type}" ` +
        `(must be one of: ${VALID_CONFIG_FIELD_TYPES.join(', ')})`
      );
      result.valid = false;
    }

    if (field.default === undefined) {
      result.warnings.push(`config/config.json: ${label} missing "default" value`);
    }

    if (!field.description) {
      result.warnings.push(`config/config.json: ${label} missing "description"`);
    }

    // Select / multiselect must have options
    if ((field.type === 'select' || field.type === 'multiselect') && !Array.isArray(field.options)) {
      result.errors.push(`config/config.json: ${label} of type "${field.type}" must have an "options" array`);
      result.valid = false;
    }

    // Validate options shape
    if (Array.isArray(field.options)) {
      for (let j = 0; j < field.options.length; j++) {
        const opt = field.options[j];
        if (opt.value === undefined) {
          result.errors.push(`config/config.json: ${label} options[${j}] missing "value"`);
          result.valid = false;
        }
        if (!opt.label) {
          result.warnings.push(`config/config.json: ${label} options[${j}] missing "label"`);
        }
      }
    }

    // dependsOn validation
    if (field.dependsOn) {
      if (!field.dependsOn.field) {
        result.errors.push(`config/config.json: ${label} dependsOn missing "field"`);
        result.valid = false;
      }
      if (field.dependsOn.value === undefined) {
        result.errors.push(`config/config.json: ${label} dependsOn missing "value"`);
        result.valid = false;
      }
    }
  }
}

// ===========================================================================
// File consistency validation
// ===========================================================================

async function validateFileConsistency(bundlePath: string, result: ValidationResult) {
  console.log(chalk.yellow('Validating file consistency...'));

  const fs = await import('fs/promises');

  try {
    const bundleYamlPath = join(bundlePath, 'bundle.yaml');
    if (!existsSync(bundleYamlPath)) {
      return;
    }

    const bundleContent = await fs.readFile(bundleYamlPath, 'utf-8');
    const bundle = yaml.load(bundleContent) as any;

    // Validate step handler file existence
    if (bundle.steps) {
      for (const step of bundle.steps) {
        // Check UI dynamic file
        if (step.ui?.dynamic) {
          const uiPath = join(bundlePath, 'src', step.ui.dynamic);
          if (!existsSync(uiPath)) {
            result.errors.push(`UI file not found: src/${step.ui.dynamic} (referenced by step "${step.id || '?'}")`);
            result.valid = false;
          } else {
            // Verify the file exports the required UI function
            const uiContent = await fs.readFile(uiPath, 'utf-8');
            if (!uiContent.includes('renderAIHFWorkflowStepUI')) {
              result.errors.push(
                `src/${step.ui.dynamic}: must export "renderAIHFWorkflowStepUI" ` +
                `(step "${step.id || '?'}" references this as a UI handler)`
              );
              result.valid = false;
            }
          }
        }

        // Check UI CSS file
        if (step.ui?.css) {
          const cssPath = join(bundlePath, 'src', step.ui.css);
          if (!existsSync(cssPath)) {
            result.warnings.push(`CSS file not found: src/${step.ui.css} (referenced by step "${step.id || '?'}")`);
          }
        }

        // Check UI script file
        if (step.ui?.script) {
          const scriptPath = join(bundlePath, 'src', step.ui.script);
          if (!existsSync(scriptPath)) {
            result.warnings.push(`Script file not found: src/${step.ui.script} (referenced by step "${step.id || '?'}")`);
          }
        }

        // Check API handler files
        if (step.api && Array.isArray(step.api)) {
          for (const apiHandler of step.api) {
            if (apiHandler.file) {
              const apiPath = join(bundlePath, 'src', apiHandler.file);
              if (!existsSync(apiPath)) {
                result.errors.push(`API file not found: src/${apiHandler.file} (referenced by step "${step.id || '?'}")`);
                result.valid = false;
              } else {
                // Verify the file exports the required function
                const apiContent = await fs.readFile(apiPath, 'utf-8');

                // Detect SSE handlers via the declarative opt-in marker:
                // output must be exactly [{ name: 'SSE', type: 'Response' }]
                const isSSEHandler =
                  Array.isArray(apiHandler.output) &&
                  apiHandler.output.length === 1 &&
                  apiHandler.output[0]?.type === 'Response' &&
                  apiHandler.output[0]?.name === 'SSE';

                if (apiHandler.route_match === '/aihfDomainTransition') {
                  // Domain transition handlers export renderAIHFWorkflowStepUITransition
                  if (!apiContent.includes('renderAIHFWorkflowStepUITransition')) {
                    result.errors.push(
                      `src/${apiHandler.file}: must export "renderAIHFWorkflowStepUITransition" ` +
                      `(step "${step.id || '?'}" references this as a domain transition handler)`
                    );
                    result.valid = false;
                  }
                } else if (isSSEHandler) {
                  // SSE handlers export invokedByAIHFSSE instead of invokedByAIHF.
                  // Reject if the file only exports invokedByAIHF with no SSE export.
                  if (!apiContent.includes('invokedByAIHFSSE')) {
                    result.errors.push(
                      `src/${apiHandler.file}: must export "invokedByAIHFSSE" ` +
                      `(step "${step.id || '?'}" declares this route as SSE via ` +
                      `output: [{ name: "SSE", type: "Response" }])`
                    );
                    result.valid = false;
                  }
                } else {
                  if (!apiContent.includes('invokedByAIHF')) {
                    result.errors.push(
                      `src/${apiHandler.file}: must export "invokedByAIHF" ` +
                      `(step "${step.id || '?'}" references this as an API handler)`
                    );
                    result.valid = false;
                  }
                }
              }
            }
          }
        }
      }
    }

  } catch (error: any) {
    result.warnings.push(`File consistency check failed: ${error.message}`);
  }
}

// ===========================================================================
// Platform SDK usage validation
// ===========================================================================

// Known valid import path prefixes (non-relative, non-node_modules)
const VALID_IMPORT_PREFIXES = ['@aihf/platform-sdk'];

async function validatePlatformSDKUsage(bundlePath: string, result: ValidationResult, suiteRoot: string | null = null) {
  console.log(chalk.yellow('Validating Platform SDK usage...'));

  const fs = await import('fs/promises');
  const glob = await import('glob');

  // If in a suite, @suite/shared/* imports are valid
  const validImportPrefixes = [...VALID_IMPORT_PREFIXES];
  if (suiteRoot) {
    validImportPrefixes.push('@suite/shared/');
  }

  try {
    const srcPath = join(bundlePath, 'src');
    if (!existsSync(srcPath)) {
      return;
    }

    const tsFiles = glob.globSync('**/*.{ts,tsx}', { cwd: srcPath });
    let hasInvokedByAIHF = false;
    let hasRenderUI = false;

    for (const file of tsFiles) {
      const filePath = join(srcPath, file);
      const content = await fs.readFile(filePath, 'utf-8');

      // Check for required function exports
      if (content.includes('export async function invokedByAIHF') ||
          content.includes('export function invokedByAIHF')) {
        hasInvokedByAIHF = true;
      }

      if (content.includes('export async function renderAIHFWorkflowStepUI') ||
          content.includes('export function renderAIHFWorkflowStepUI')) {
        hasRenderUI = true;
      }

      // Check for @suite/shared imports when NOT in a suite context
      if (!suiteRoot && content.includes('@suite/shared/')) {
        result.errors.push(
          `${file}: uses @suite/shared/ imports but this bundle is not inside a suite. ` +
          `Create a suite with 'aihf init <name> --type multi-part' first.`
        );
        result.valid = false;
      }

      // If in a suite, validate that shared imports reference existing files
      if (suiteRoot && content.includes('@suite/shared/')) {
        const importPattern = /from\s+['"]@suite\/shared\/([^'"]+)['"]/g;
        let importMatch: RegExpExecArray | null;
        while ((importMatch = importPattern.exec(content)) !== null) {
          const importPath = importMatch[1];
          // Check if the shared file exists (with .ts extension)
          const sharedFilePath = join(suiteRoot, 'shared', importPath);
          const candidates = [
            sharedFilePath + '.ts',
            join(sharedFilePath, 'index.ts'),
            sharedFilePath,
          ];
          const fileExists = candidates.some(c => existsSync(c));
          if (!fileExists) {
            result.warnings.push(
              `${file}: imports '@suite/shared/${importPath}' but shared file not found`
            );
          }
        }
      }

      // --- Validate manager names ---
      validateManagerNames(content, file, result);

      // --- Validate deprecated / incorrect method patterns ---
      validateDeprecatedPatterns(content, file, result);

      // --- Validate method names on known managers ---
      validateManagerMethods(content, file, result);

      // --- Validate utilities sub-manager usage ---
      validateUtilitiesMethods(content, file, result);
    }

    if (hasInvokedByAIHF) {
      console.log(chalk.green('  Found invokedByAIHF function for API handling'));
    }

    if (hasRenderUI) {
      console.log(chalk.green('  Found renderAIHFWorkflowStepUI function for UI rendering'));
    }

    if (!hasInvokedByAIHF && !hasRenderUI) {
      result.warnings.push('No Platform SDK handler functions found - ensure your handlers export invokedByAIHF or renderAIHFWorkflowStepUI');
    }

  } catch (error: any) {
    result.warnings.push(`Platform SDK validation failed: ${error.message}`);
  }
}

// ---------------------------------------------------------------------------
// Check for usage of invalid manager names (e.g. sdk.ai, sdk.foo)
// ---------------------------------------------------------------------------
function validateManagerNames(content: string, file: string, result: ValidationResult) {
  // Strip single-line comments to avoid false positives (e.g. "// sdk.workflow.getVariable()")
  const strippedContent = content.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

  // Match patterns like sdk.something or platform.something where a property is
  // accessed that looks like a manager call.  We look for typical SDK variable
  // names (sdk, platform, aihf) followed by a dot and an identifier.
  const sdkAccessPattern = /\b(?:sdk|platform|aihf)\s*\.\s*([a-zA-Z_]\w*)\b/g;
  let match: RegExpExecArray | null;

  while ((match = sdkAccessPattern.exec(strippedContent)) !== null) {
    const managerName = match[1];
    // Skip if it is a known top-level method on AIHFPlatform
    const topLevelMethods = ['getSelfEntity', 'getRemoteKVSyncPayload', 'acknowledgeRemoteCommands'];
    if (topLevelMethods.includes(managerName)) continue;
    // Skip common non-manager accesses
    if (['constructor', 'prototype', 'then', 'catch', 'finally'].includes(managerName)) continue;

    if (!(VALID_MANAGER_NAMES as readonly string[]).includes(managerName)) {
      result.errors.push(
        `${file}: invalid manager name "sdk.${managerName}" - ` +
        `valid managers are: ${VALID_MANAGER_NAMES.join(', ')}`
      );
      result.valid = false;
    }
  }
}

// ---------------------------------------------------------------------------
// Check for known deprecated / incorrect method patterns
// ---------------------------------------------------------------------------
function validateDeprecatedPatterns(content: string, file: string, result: ValidationResult) {
  for (const { pattern, message } of DEPRECATED_PATTERNS) {
    if (pattern.test(content)) {
      result.errors.push(`${file}: ${message}`);
      result.valid = false;
    }
  }
}

// ---------------------------------------------------------------------------
// Validate that method calls on known managers actually exist
// ---------------------------------------------------------------------------
function validateManagerMethods(content: string, file: string, result: ValidationResult) {
  // Matches sdk.manager.method( or platform.manager.method(
  const methodCallPattern = /\b(?:sdk|platform|aihf)\s*\.\s*([a-zA-Z_]\w*)\s*\.\s*([a-zA-Z_]\w*)\s*\(/g;
  let match: RegExpExecArray | null;

  while ((match = methodCallPattern.exec(content)) !== null) {
    const managerName = match[1];
    const methodName = match[2];

    // Skip utilities sub-manager access (handled separately)
    if (managerName === 'utilities') continue;

    const validMethods = VALID_MANAGER_METHODS[managerName];
    if (validMethods && !validMethods.includes(methodName)) {
      result.errors.push(
        `${file}: unknown method "${managerName}.${methodName}()" - ` +
        `valid methods on ${managerName} are: ${validMethods.join(', ')}`
      );
      result.valid = false;
    }
  }
}

// ---------------------------------------------------------------------------
// Validate utilities sub-manager method calls
// e.g. sdk.utilities.documents.parse(), sdk.utilities.ui.calendar()
// ---------------------------------------------------------------------------
function validateUtilitiesMethods(content: string, file: string, result: ValidationResult) {
  // Match sdk.utilities.subManager.method(
  const utilMethodPattern = /\b(?:sdk|platform|aihf)\s*\.\s*utilities\s*\.\s*([a-zA-Z_]\w*)\s*\.\s*([a-zA-Z_]\w*)\s*\(/g;
  let match: RegExpExecArray | null;

  while ((match = utilMethodPattern.exec(content)) !== null) {
    const subManagerName = match[1];
    const methodName = match[2];

    const validSubMethods = VALID_UTILITY_SUB_MANAGERS[subManagerName];
    if (!validSubMethods) {
      result.errors.push(
        `${file}: unknown utilities sub-manager "utilities.${subManagerName}" - ` +
        `valid sub-managers are: ${Object.keys(VALID_UTILITY_SUB_MANAGERS).join(', ')}`
      );
      result.valid = false;
    } else if (!validSubMethods.includes(methodName)) {
      result.errors.push(
        `${file}: unknown method "utilities.${subManagerName}.${methodName}()" - ` +
        `valid methods are: ${validSubMethods.join(', ')}`
      );
      result.valid = false;
    }
  }

  // Also check for direct sub-manager access without method call (just property)
  // to validate the sub-manager name at least.
  const utilAccessPattern = /\b(?:sdk|platform|aihf)\s*\.\s*utilities\s*\.\s*([a-zA-Z_]\w*)\b/g;
  while ((match = utilAccessPattern.exec(content)) !== null) {
    const subManagerName = match[1];
    if (!VALID_UTILITY_SUB_MANAGERS[subManagerName]) {
      // Only warn if not already caught above (avoid duplicates via a simple check)
      const errorMsg = `unknown utilities sub-manager "utilities.${subManagerName}"`;
      if (!result.errors.some(e => e.includes(errorMsg))) {
        result.errors.push(
          `${file}: ${errorMsg} - ` +
          `valid sub-managers are: ${Object.keys(VALID_UTILITY_SUB_MANAGERS).join(', ')}`
        );
        result.valid = false;
      }
    }
  }
}

// ===========================================================================
// Display results
// ===========================================================================

function displayValidationResults(result: ValidationResult) {
  console.log('');

  if (result.errors.length > 0) {
    console.log(chalk.red.bold('Validation Errors:'));
    result.errors.forEach(error => {
      console.log(chalk.red(`  [error] ${error}`));
    });
    console.log('');
  }

  if (result.warnings.length > 0) {
    console.log(chalk.yellow.bold('Validation Warnings:'));
    result.warnings.forEach(warning => {
      console.log(chalk.yellow(`  [warn] ${warning}`));
    });
    console.log('');
  }

  if (result.valid) {
    console.log(chalk.green.bold('Bundle validation passed!'));
    if (result.warnings.length > 0) {
      console.log(chalk.gray('   Note: Warnings do not prevent deployment'));
    }
  } else {
    console.log(chalk.red.bold('Bundle validation failed!'));
    console.log(chalk.gray('   Please fix the errors above before deploying'));
  }
}
