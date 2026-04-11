/**
 * API Handler: Parse Document
 * Parses document files into HTML and text
 */

import { AIHFPlatform, DocumentFormat } from '@aihf/platform-sdk';

export async function invokedByAIHF(
  sdk: AIHFPlatform,
  workflowName: string,
  workflowVersion: number,
  workflowStepId: string,
  taskId: string,
  sanitisedInput: string
): Promise<Response | null> {
  const input = JSON.parse(sanitisedInput);

  if (!input.document || !input.filename) {
    return new Response(JSON.stringify({
      success: false,
      error: 'Document and filename are required'
    }), { status: 400, headers: { 'Content-Type': 'application/json' } });
  }

  try {
    // Determine format from filename extension
    const extension = input.filename.split('.').pop()?.toLowerCase() || 'txt';
    const formatMap: Record<string, DocumentFormat> = {
      docx: 'docx', rtf: 'rtf', html: 'html', htm: 'html', txt: 'txt'
    };
    const format: DocumentFormat = formatMap[extension] || 'txt';

    // Parse the document using correct signature: parse(buffer, format)
    const parsed = await sdk.utilities.documents.parse(
      input.document,
      format
    );

    // Generate document ID for storage
    const documentId = crypto.randomUUID();

    // Store parsed document
    await sdk.database.insert(workflowName, 'documents', {
      id: documentId,
      filename: input.filename,
      html_content: parsed.html,
      text_content: parsed.text,
      metadata: JSON.stringify(parsed.metadata),
      word_count: parsed.text.split(/\s+/).length,
      created_at: new Date().toISOString()
    });

    return new Response(JSON.stringify({
      success: true,
      documentId,
      html: parsed.html,
      text: parsed.text,
      metadata: parsed.metadata,
      messages: parsed.messages,
      wordCount: parsed.text.split(/\s+/).length
    }), {
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Document parsing failed:', error);
    return new Response(JSON.stringify({
      success: false,
      error: 'Failed to parse document'
    }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}
