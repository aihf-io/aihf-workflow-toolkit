/**
 * Lightweight Claude API Client for Eval
 *
 * No retry logic — fail fast for eval runs.
 */

export interface EvalClaudeOptions {
  model: string;
  maxTokens: number;
  temperature: number;
  systemPrompt: string;
}

export interface EvalClaudeResult {
  success: boolean;
  content: string;
  parsedJson?: any;
  usage: {
    inputTokens: number;
    outputTokens: number;
  };
  latencyMs: number;
  error?: string;
}

export class EvalClaudeClient {
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async call(prompt: string, options: EvalClaudeOptions): Promise<EvalClaudeResult> {
    const startTime = Date.now();

    const requestBody: any = {
      model: options.model,
      max_tokens: options.maxTokens,
      temperature: options.temperature,
      system: options.systemPrompt,
      messages: [
        { role: 'user', content: prompt }
      ]
    };

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'x-api-key': this.apiKey,
      'anthropic-version': '2023-06-01'
    };

    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers,
        body: JSON.stringify(requestBody)
      });

      const latencyMs = Date.now() - startTime;

      if (!response.ok) {
        const errorText = await response.text();
        return {
          success: false,
          content: '',
          usage: { inputTokens: 0, outputTokens: 0 },
          latencyMs,
          error: `API error ${response.status}: ${errorText}`
        };
      }

      const data = await response.json() as any;
      const content = data.content?.[0]?.text || '';
      const usage = {
        inputTokens: data.usage?.input_tokens || 0,
        outputTokens: data.usage?.output_tokens || 0
      };

      // Parse JSON from response — extract from markdown code blocks if needed
      let parsedJson: any = undefined;
      try {
        let jsonContent = content;
        const jsonMatch = content.match(/```(?:json)?\s*\n([\s\S]*?)\n```/);
        if (jsonMatch) {
          jsonContent = jsonMatch[1];
        }
        parsedJson = JSON.parse(jsonContent.trim());
      } catch {
        // Not valid JSON — leave parsedJson undefined
      }

      return { success: true, content, parsedJson, usage, latencyMs };

    } catch (error: any) {
      return {
        success: false,
        content: '',
        usage: { inputTokens: 0, outputTokens: 0 },
        latencyMs: Date.now() - startTime,
        error: error.message || 'Network error'
      };
    }
  }

  /**
   * Estimate cost based on model pricing (per million tokens).
   * Pricing as of 2025 for common Claude models.
   */
  static estimateCost(
    model: string,
    inputTokens: number,
    outputTokens: number
  ): number {
    // Per-million-token pricing
    const pricing: Record<string, { input: number; output: number }> = {
      'claude-sonnet-4-5-20250929': { input: 3.00, output: 15.00 },
      'claude-haiku-4-5-20251001': { input: 0.80, output: 4.00 },
      'claude-opus-4-6': { input: 15.00, output: 75.00 },
      // Legacy model IDs
      'claude-3-5-sonnet-20241022': { input: 3.00, output: 15.00 },
      'claude-3-5-haiku-20241022': { input: 0.80, output: 4.00 },
    };

    const prices = pricing[model] || { input: 3.00, output: 15.00 };
    return (inputTokens * prices.input + outputTokens * prices.output) / 1_000_000;
  }
}
