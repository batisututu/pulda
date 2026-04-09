/**
 * Shared JSON extraction utility for AI gateway responses.
 * Extracts JSON from responses that may include markdown code fences.
 */

/**
 * Extracts a JSON string from a response that may include markdown code fences.
 * Handles both ```json ... ``` and ``` ... ``` blocks.
 */
export function extractJson(text: string): string {
  // Try to extract from ```json ... ``` or ``` ... ``` blocks
  const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) {
    return fenceMatch[1].trim();
  }
  // Otherwise assume the entire text is JSON
  return text.trim();
}
