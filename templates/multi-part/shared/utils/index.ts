/**
 * Shared utility functions for this suite.
 *
 * Export helpers here so all workflow bundles can import them:
 *   import { formatDate } from '@suite/shared/utils';
 */

export function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}
