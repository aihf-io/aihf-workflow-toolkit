/**
 * API Handler: Extract PDF
 * Extracts text and metadata from uploaded PDF files.
 *
 * Note: The SDK provides pdf extraction (sdk.utilities.pdfs.extractPages),
 * not pdf generation. This handler demonstrates parsing and extracting
 * content from existing PDF files.
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

  if (!input.pdfData) {
    return new Response(JSON.stringify({
      success: false,
      error: 'PDF data is required'
    }), { status: 400, headers: { 'Content-Type': 'application/json' } });
  }

  try {
    // Validate that the buffer is a valid PDF
    if (!sdk.utilities.pdfs.isValidPdf(input.pdfData)) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Invalid PDF file'
      }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    // Extract pages and metadata from the PDF
    const extracted = await sdk.utilities.pdfs.extractPages(input.pdfData);

    // Store the PDF file
    const pdfId = crypto.randomUUID();
    const filename = input.filename || `uploaded-${pdfId}.pdf`;

    await sdk.files.upload(
      `app/pdfs/${filename}`,
      input.pdfData
    );

    // Store extraction results in the database
    await sdk.database.insert(workflowName, 'pdf_extractions', {
      id: pdfId,
      filename,
      page_count: extracted.metadata.pageCount,
      title: extracted.metadata.title || null,
      author: extracted.metadata.author || null,
      full_text: extracted.pages.map(p => p.text).join('\n\n'),
      created_at: new Date().toISOString()
    });

    // Convert to base64 for optional client-side rendering
    const base64Data = sdk.utilities.pdfs.toBase64(input.pdfData);

    return new Response(JSON.stringify({
      success: true,
      pdfId,
      filename,
      pages: extracted.pages.map(p => ({
        pageNumber: p.pageNumber,
        text: p.text,
        width: p.width,
        height: p.height
      })),
      metadata: extracted.metadata,
      base64: base64Data
    }), {
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('PDF extraction failed:', error);
    return new Response(JSON.stringify({
      success: false,
      error: 'Failed to extract PDF content'
    }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}
