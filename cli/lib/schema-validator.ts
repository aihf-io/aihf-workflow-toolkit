/**
 * Lightweight JSON Schema Validator
 *
 * Handles the simple JSON Schema subset used in AIHF instruction YAMLs:
 * type, required, properties, enum, minimum, maximum, items, maxItems, minItems
 *
 * No external dependency — avoids adding ajv to the CLI package.
 */

export interface SchemaViolation {
  path: string;
  message: string;
}

export function validateSchema(data: any, schema: any, path: string = ''): SchemaViolation[] {
  const violations: SchemaViolation[] = [];

  if (!schema || typeof schema !== 'object') {
    return violations;
  }

  // Type check
  if (schema.type) {
    const actualType = getJsonType(data);
    if (actualType !== schema.type) {
      violations.push({
        path: path || '(root)',
        message: `Expected type "${schema.type}", got "${actualType}"`
      });
      return violations; // No point checking further if type is wrong
    }
  }

  // Enum check
  if (schema.enum && Array.isArray(schema.enum)) {
    if (!schema.enum.includes(data)) {
      violations.push({
        path: path || '(root)',
        message: `Value "${data}" not in enum [${schema.enum.join(', ')}]`
      });
    }
  }

  // Number constraints
  if (typeof data === 'number') {
    if (schema.minimum !== undefined && data < schema.minimum) {
      violations.push({
        path: path || '(root)',
        message: `Value ${data} is below minimum ${schema.minimum}`
      });
    }
    if (schema.maximum !== undefined && data > schema.maximum) {
      violations.push({
        path: path || '(root)',
        message: `Value ${data} is above maximum ${schema.maximum}`
      });
    }
  }

  // Object checks
  if (schema.type === 'object' && typeof data === 'object' && data !== null && !Array.isArray(data)) {
    // Required fields
    if (schema.required && Array.isArray(schema.required)) {
      for (const field of schema.required) {
        if (!(field in data)) {
          violations.push({
            path: path ? `${path}.${field}` : field,
            message: `Required field "${field}" is missing`
          });
        }
      }
    }

    // Property validation
    if (schema.properties && typeof schema.properties === 'object') {
      for (const [key, propSchema] of Object.entries(schema.properties)) {
        if (key in data) {
          violations.push(...validateSchema(data[key], propSchema, path ? `${path}.${key}` : key));
        }
      }
    }
  }

  // Array checks
  if (schema.type === 'array' && Array.isArray(data)) {
    if (schema.minItems !== undefined && data.length < schema.minItems) {
      violations.push({
        path: path || '(root)',
        message: `Array has ${data.length} items, minimum is ${schema.minItems}`
      });
    }
    if (schema.maxItems !== undefined && data.length > schema.maxItems) {
      violations.push({
        path: path || '(root)',
        message: `Array has ${data.length} items, maximum is ${schema.maxItems}`
      });
    }

    // Validate items schema
    if (schema.items && data.length > 0) {
      for (let i = 0; i < data.length; i++) {
        violations.push(...validateSchema(data[i], schema.items, `${path || '(root)'}[${i}]`));
      }
    }
  }

  return violations;
}

function getJsonType(value: any): string {
  if (value === null || value === undefined) return 'null';
  if (Array.isArray(value)) return 'array';
  return typeof value; // 'string', 'number', 'boolean', 'object'
}

/**
 * Check expected assertions from test case against actual output.
 * Supports:
 *   - dot-notation paths: "recommended_schedule.type" → traverses object
 *   - exact match: "WEEK_ON_WEEK_OFF" — value equality
 *   - { min: N } — number >= N
 *   - { max: N } — number <= N
 *   - { contains: "string" } — string/array contains
 */
export interface AssertionResult {
  path: string;
  passed: boolean;
  expected: any;
  actual: any;
  message: string;
}

export function checkAssertions(data: any, expected: Record<string, any>): AssertionResult[] {
  const results: AssertionResult[] = [];

  for (const [dotPath, assertion] of Object.entries(expected)) {
    const actual = getByDotPath(data, dotPath);

    if (typeof assertion === 'object' && assertion !== null && !Array.isArray(assertion)) {
      // Constraint object
      if ('min' in assertion) {
        const passed = typeof actual === 'number' && actual >= assertion.min;
        results.push({
          path: dotPath,
          passed,
          expected: `>= ${assertion.min}`,
          actual,
          message: passed ? 'OK' : `Expected >= ${assertion.min}, got ${actual}`
        });
      }
      if ('max' in assertion) {
        const passed = typeof actual === 'number' && actual <= assertion.max;
        results.push({
          path: dotPath,
          passed,
          expected: `<= ${assertion.max}`,
          actual,
          message: passed ? 'OK' : `Expected <= ${assertion.max}, got ${actual}`
        });
      }
      if ('contains' in assertion) {
        let passed = false;
        if (typeof actual === 'string') {
          passed = actual.toLowerCase().includes(String(assertion.contains).toLowerCase());
        } else if (Array.isArray(actual)) {
          passed = actual.some(item =>
            typeof item === 'string'
              ? item.toLowerCase().includes(String(assertion.contains).toLowerCase())
              : item === assertion.contains
          );
        }
        results.push({
          path: dotPath,
          passed,
          expected: `contains "${assertion.contains}"`,
          actual: typeof actual === 'string' ? actual.substring(0, 80) : actual,
          message: passed ? 'OK' : `Expected to contain "${assertion.contains}"`
        });
      }
    } else {
      // Exact match
      const passed = actual === assertion;
      results.push({
        path: dotPath,
        passed,
        expected: assertion,
        actual,
        message: passed ? 'OK' : `Expected "${assertion}", got "${actual}"`
      });
    }
  }

  return results;
}

function getByDotPath(obj: any, path: string): any {
  const parts = path.split('.');
  let current = obj;
  for (const part of parts) {
    if (current === null || current === undefined) return undefined;
    current = current[part];
  }
  return current;
}
