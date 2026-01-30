/**
 * Token estimation utilities using tiktoken
 */

import { encoding_for_model, TiktokenModel } from 'tiktoken';

let encoder: ReturnType<typeof encoding_for_model> | null = null;

/**
 * Get or create the tiktoken encoder
 * Uses cl100k_base which is compatible with GPT-4 and Claude
 */
function getEncoder() {
  if (!encoder) {
    // cl100k_base is used by GPT-4 and is close enough for Claude estimates
    encoder = encoding_for_model('gpt-4' as TiktokenModel);
  }
  return encoder;
}

/**
 * Count tokens in a string
 */
export function countTokens(text: string): number {
  const enc = getEncoder();
  return enc.encode(text).length;
}

/**
 * Count tokens in multiple strings
 */
export function countTokensMultiple(texts: string[]): number {
  return texts.reduce((sum, text) => sum + countTokens(text), 0);
}

/**
 * Truncate text to fit within a token limit
 * Returns the truncated text and actual token count
 */
export function truncateToTokens(
  text: string,
  maxTokens: number
): { text: string; tokens: number } {
  const enc = getEncoder();
  const tokens = enc.encode(text);

  if (tokens.length <= maxTokens) {
    return { text, tokens: tokens.length };
  }

  const truncatedTokens = tokens.slice(0, maxTokens);
  const truncatedText = new TextDecoder().decode(enc.decode(truncatedTokens));

  return { text: truncatedText, tokens: maxTokens };
}

/**
 * Estimate tokens without actually encoding (faster but less accurate)
 * Uses the approximation of ~4 characters per token
 */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/**
 * Free the encoder resources
 */
export function freeEncoder(): void {
  if (encoder) {
    encoder.free();
    encoder = null;
  }
}
