/**
 * LaTeX validation and sanitization utility.
 * Uses KaTeX to parse LaTeX segments and attempt common fixes.
 */

import katex from 'katex';

interface ValidationResult {
  isValid: boolean;
  sanitized: string;
}

/**
 * Validate a string containing LaTeX segments ($...$ and $$...$$).
 * Attempts to fix common issues. Returns the sanitized content and validity flag.
 */
export function validateLatex(content: string): ValidationResult {
  const latexPattern = /\$\$([\s\S]*?)\$\$|\$([\s\S]*?)\$/g;
  let match: RegExpExecArray | null;
  let result = content;
  let allValid = true;

  while ((match = latexPattern.exec(content)) !== null) {
    const latex = match[1] ?? match[2];
    if (!latex) continue;

    try {
      katex.renderToString(latex, { throwOnError: true });
    } catch {
      // Attempt common fixes
      const fixed = attemptFix(latex);
      try {
        katex.renderToString(fixed, { throwOnError: true });
        result = result.split(latex).join(fixed);
      } catch {
        // 수정 불가능한 LaTeX — 원본 유지하고 유효성 플래그만 false로 설정
        allValid = false;
      }
    }
  }

  return { isValid: allValid, sanitized: result };
}

/**
 * Attempt to fix common LaTeX issues:
 * - Unbalanced braces
 * - Missing braces after \frac and \sqrt
 */
function attemptFix(latex: string): string {
  let fixed = latex;

  // Fix unbalanced braces
  const openBraces = (fixed.match(/{/g) || []).length;
  const closeBraces = (fixed.match(/}/g) || []).length;
  if (openBraces > closeBraces) {
    fixed += '}'.repeat(openBraces - closeBraces);
  }

  // Fix \frac without braces: \frac 1 2 → \frac{1}{2}
  fixed = fixed.replace(
    /\\frac\s+([^\s{}\\])[\s]*([^\s{}\\])/g,
    '\\frac{$1}{$2}'
  );
  // Fix \frac with one brace group but missing second: \frac{a} b → \frac{a}{b}
  fixed = fixed.replace(
    /\\frac(\{[^}]*\})\s*([^\s{}\\])/g,
    '\\frac$1{$2}'
  );

  // Fix \sqrt without braces or bracket: \sqrt 3 → \sqrt{3}
  fixed = fixed.replace(/\\sqrt(?![\[{])\s*([^\s{}\\])/g, '\\sqrt{$1}');

  return fixed;
}

/**
 * Decode Unicode escape sequences left over from double-escaped GPT responses.
 * OpenAI Structured Outputs sometimes returns \\uXXXX (double-escaped),
 * which JSON.parse decodes to literal \uXXXX strings instead of Unicode chars.
 */
function decodeUnicodeEscapes(text: string): string {
  return text.replace(/\\u([0-9a-fA-F]{4})/g, (_, hex) =>
    String.fromCharCode(parseInt(hex, 16))
  );
}

/**
 * Normalize LaTeX delimiters from \( \) / \[ \] to $ / $$.
 * GPT models often output \(...\) and \[...\] which KaTeX does not render.
 */
function normalizeDelimiters(text: string): string {
  // \[ ... \] → $$ ... $$  (use function replacement to avoid $$ special pattern)
  let result = text.replace(/\\\[/g, () => '$$').replace(/\\\]/g, () => '$$');
  // \( ... \) → $ ... $
  result = result.replace(/\\\(/g, '$').replace(/\\\)/g, '$');
  return result;
}

/**
 * Object-style validator for use in AI gateway adapters.
 * Compatible with the adapter-patterns reference.
 */
export const latexValidator = {
  validateAndFix(text: string): string {
    const decoded = decodeUnicodeEscapes(text);
    const normalized = normalizeDelimiters(decoded);
    const { sanitized } = validateLatex(normalized);
    return sanitized;
  },

  attemptFix,
};
