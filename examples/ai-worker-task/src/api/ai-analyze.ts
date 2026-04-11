/**
 * API Handler: Document Analysis
 * Work domain step - worker processes this for document analysis
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
  const { documentId } = input;

  if (!documentId) {
    return new Response(JSON.stringify({
      hasWork: false,
      error: 'Document ID is required'
    }), { status: 400, headers: { 'Content-Type': 'application/json' } });
  }

  try {
    // Get document text from the database (stored during upload step)
    const doc = await sdk.database.queryOne<{ text_content: string; filename: string }>(
      workflowName,
      'SELECT text_content, filename FROM documents WHERE id = ?',
      [documentId]
    );

    if (!doc || !doc.text_content) {
      return new Response(JSON.stringify({
        hasWork: false,
        error: 'Document not found'
      }), { status: 404, headers: { 'Content-Type': 'application/json' } });
    }

    // Analyze the document content using local business logic
    const analysis = analyzeContent(doc.text_content);

    // Store analysis results using correct database.update() signature:
    // update(workflowId, table, data, where, whereParams)
    await sdk.database.update(
      workflowName,
      'documents',
      {
        status: 'analyzed',
        analysis: JSON.stringify(analysis),
        analyzed_at: new Date().toISOString()
      },
      'id = ?',
      [documentId]
    );

    // Route based on confidence threshold
    const configHelper = await sdk.workflows.getWorkflowConfigHelper(workflowName, workflowVersion);
    const confidenceThreshold = configHelper.getNumber('confidence_threshold', 0.85);

    if (analysis.confidence >= confidenceThreshold) {
      // High confidence - auto-approve and go to results
      await sdk.database.update(
        workflowName,
        'documents',
        { status: 'approved', auto_approved: 'true' },
        'id = ?',
        [documentId]
      );

      sdk.tasks.setStepData(JSON.stringify({
        documentId,
        analysis,
        autoApproved: true
      }));
    } else {
      // Lower confidence - store data for human review step
      sdk.tasks.setStepData(JSON.stringify({
        documentId,
        analysis,
        needsReview: true
      }));
    }

    return new Response(JSON.stringify({
      hasWork: true,
      analysis,
      confidence: analysis.confidence,
      needsReview: analysis.confidence < confidenceThreshold
    }), {
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Document analysis failed:', error);

    // Update status to failed
    await sdk.database.update(
      workflowName,
      'documents',
      { status: 'analysis_failed', error: String(error) },
      'id = ?',
      [documentId]
    );

    // Return hasWork: false to defer and retry later
    return new Response(JSON.stringify({
      hasWork: false,
      error: 'Analysis failed, will retry'
    }), { headers: { 'Content-Type': 'application/json' } });
  }
}

/**
 * Analyze document content
 * This is where your business logic goes - text analysis, pattern extraction, etc.
 */
function analyzeContent(text: string): {
  topics: string[];
  summary: string;
  sentiment: 'positive' | 'negative' | 'neutral';
  wordCount: number;
  confidence: number;
} {
  const words = text.split(/\s+/).filter(w => w.length > 0);
  const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);

  // Extract key topics (simple keyword extraction)
  const topicWords = words
    .filter(w => w.length > 6)
    .reduce((acc, word) => {
      const lower = word.toLowerCase();
      acc[lower] = (acc[lower] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

  const topics = Object.entries(topicWords)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([word]) => word);

  // Simple sentiment analysis
  const positiveWords = ['good', 'great', 'excellent', 'positive', 'success', 'happy', 'improve'];
  const negativeWords = ['bad', 'poor', 'fail', 'negative', 'problem', 'issue', 'error'];

  const lowerText = text.toLowerCase();
  const positiveCount = positiveWords.filter(w => lowerText.includes(w)).length;
  const negativeCount = negativeWords.filter(w => lowerText.includes(w)).length;

  let sentiment: 'positive' | 'negative' | 'neutral' = 'neutral';
  if (positiveCount > negativeCount + 1) sentiment = 'positive';
  if (negativeCount > positiveCount + 1) sentiment = 'negative';

  // Generate summary (first 2-3 sentences)
  const summary = sentences.slice(0, 3).join('. ').trim() + '.';

  // Calculate confidence based on content quality
  const confidence = Math.min(0.99, Math.max(0.5,
    0.7 +
    (words.length > 100 ? 0.1 : 0) +
    (topics.length >= 3 ? 0.1 : 0) +
    (sentences.length > 5 ? 0.1 : 0)
  ));

  return {
    topics,
    summary,
    sentiment,
    wordCount: words.length,
    confidence
  };
}
