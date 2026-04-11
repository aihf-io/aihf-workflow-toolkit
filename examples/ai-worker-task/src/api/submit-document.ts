/**
 * API Handler: Submit Document
 * Receives document upload and stores for analysis
 */

import { AIHFPlatform } from '@aihf/platform-sdk';

export async function invokedByAIHF(
  sdk: AIHFPlatform,
  workflowName: string,
  workflowVersion: number,
  workflowStepId: string,
  taskId: string,
  sanitisedInput: string
): Promise<Response | null> {
  const input = JSON.parse(sanitisedInput);
  const entity = await sdk.entities.getCurrentEntity();

  if (!input.document || !input.filename) {
    return new Response(JSON.stringify({
      success: false,
      error: 'Document and filename are required'
    }), { status: 400, headers: { 'Content-Type': 'application/json' } });
  }

  // Determine document format from filename extension
  const extension = input.filename.split('.').pop()?.toLowerCase() || 'txt';
  const formatMap: Record<string, string> = {
    docx: 'docx', rtf: 'rtf', html: 'html', htm: 'html', txt: 'txt'
  };
  const format = formatMap[extension] || 'txt';

  // Parse document content using correct signature: parse(buffer, format)
  const parsed = await sdk.utilities.documents.parse(
    input.document,
    format as any
  );

  // Generate document ID
  const documentId = crypto.randomUUID();

  // Store document using correct FileManager signature: upload(filePath, content)
  await sdk.files.upload(
    `app/documents/${documentId}/${input.filename}`,
    input.document
  );

  // Create database record
  await sdk.database.insert(workflowName, 'documents', {
    id: documentId,
    entity_id: entity?.entity_id,
    filename: input.filename,
    text_content: parsed.text,
    word_count: parsed.text.split(/\s+/).length,
    status: 'pending_analysis',
    created_at: new Date().toISOString()
  });

  // Store document data for the next workflow step
  sdk.tasks.setStepData(JSON.stringify({
    documentId,
    textContent: parsed.text,
    filename: input.filename
  }));

  return new Response(JSON.stringify({
    success: true,
    taskId,
    documentId,
    message: 'Document submitted for analysis'
  }), {
    headers: { 'Content-Type': 'application/json' }
  });
}
