/**
 * Token estimation utilities
 *
 * Provides rough token counting for measuring context efficiency.
 * Uses a simple heuristic: 1 token ≈ 4 characters for English text.
 */

/**
 * Estimate token count from text
 *
 * @param text - Text to estimate tokens for
 * @returns Estimated token count
 */
export function estimateTokens(text: string): number {
  // Simple heuristic: ~4 characters per token
  // This is a rough approximation based on GPT tokenization
  return Math.ceil(text.length / 4);
}

/**
 * Estimate tokens for JSON data
 *
 * @param data - Data to estimate tokens for
 * @returns Estimated token count
 */
export function estimateTokensFromJSON(data: unknown): number {
  const json = JSON.stringify(data);
  return estimateTokens(json);
}

/**
 * Format token count for display
 *
 * @param tokens - Token count
 * @returns Formatted string (e.g., "1.5K", "250")
 */
export function formatTokenCount(tokens: number): string {
  if (tokens >= 1000) {
    return `${(tokens / 1000).toFixed(1)}K`;
  }
  return tokens.toString();
}
