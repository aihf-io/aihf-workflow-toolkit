/**
 * API Handler: Process Image
 * Extracts metadata and stores images.
 *
 * Note: The SDK provides image metadata extraction and format detection
 * (sdk.utilities.images.getMetadata, detectFormat, toDataUrl),
 * not image resizing/conversion. This handler demonstrates
 * extracting image metadata, detecting format, and storing files.
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

  if (!input.image) {
    return new Response(JSON.stringify({
      success: false,
      error: 'Image is required'
    }), { status: 400, headers: { 'Content-Type': 'application/json' } });
  }

  try {
    // Get image metadata using correct SDK API
    const metadata = await sdk.utilities.images.getMetadata(input.image);

    // Detect image format from buffer
    const detectedFormat = sdk.utilities.images.detectFormat(input.image);

    // Store image file using correct FileManager signature: upload(filePath, content)
    const imageId = crypto.randomUUID();
    const extension = detectedFormat || 'png';
    const filename = `uploaded-${imageId}.${extension}`;

    await sdk.files.upload(
      `app/images/${filename}`,
      input.image
    );

    // Convert to data URL for preview
    const dataUrl = sdk.utilities.images.toDataUrl(input.image, detectedFormat);

    // Store metadata in database
    await sdk.database.insert(workflowName, 'images', {
      id: imageId,
      filename,
      format: metadata.format,
      width: metadata.width,
      height: metadata.height,
      size: metadata.size,
      has_alpha: metadata.hasAlpha ? 'true' : 'false',
      created_at: new Date().toISOString()
    });

    return new Response(JSON.stringify({
      success: true,
      imageId,
      filename,
      metadata: {
        format: metadata.format,
        width: metadata.width,
        height: metadata.height,
        size: metadata.size,
        hasAlpha: metadata.hasAlpha
      },
      dataUrl
    }), {
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Image processing failed:', error);
    return new Response(JSON.stringify({
      success: false,
      error: 'Failed to process image'
    }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}
