/**
 * API Handler: Parse Spreadsheet
 * Parses XLSX and CSV files into structured data
 */

import { AIHFPlatform, SpreadsheetFormat } from '@aihf/platform-sdk';

export async function invokedByAIHF(
  sdk: AIHFPlatform,
  workflowName: string,
  workflowVersion: number,
  workflowStepId: string,
  taskId: string,
  sanitisedInput: string
): Promise<Response | null> {
  const input = JSON.parse(sanitisedInput);

  if (!input.file || !input.filename) {
    return new Response(JSON.stringify({
      success: false,
      error: 'File and filename are required'
    }), { status: 400, headers: { 'Content-Type': 'application/json' } });
  }

  try {
    // Determine format from filename extension
    const extension = input.filename.split('.').pop()?.toLowerCase() || 'xlsx';
    const formatMap: Record<string, SpreadsheetFormat> = {
      xlsx: 'xlsx', xls: 'xls', csv: 'csv', ods: 'ods'
    };
    const format: SpreadsheetFormat = formatMap[extension] || 'xlsx';

    // Parse the spreadsheet using correct signature: parse(buffer, format)
    const parsed = await sdk.utilities.spreadsheets.parse(
      input.file,
      format
    );

    // Process sheets for response (limit preview data)
    const sheets = parsed.sheets.map(sheet => ({
      name: sheet.name,
      headers: sheet.headers || (sheet.data[0] || []),
      rowCount: sheet.rowCount,
      columnCount: sheet.columnCount,
      preview: sheet.data.slice(0, 100) // First 100 rows
    }));

    return new Response(JSON.stringify({
      success: true,
      sheets,
      metadata: {
        filename: input.filename,
        sheetCount: parsed.metadata.sheetCount,
        totalRows: parsed.sheets.reduce((sum, s) => sum + s.rowCount, 0)
      }
    }), {
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Spreadsheet parsing failed:', error);
    return new Response(JSON.stringify({
      success: false,
      error: 'Failed to parse spreadsheet'
    }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}
