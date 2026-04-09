const SHAREABLE_TYPES = ['variant_set', 'error_note', 'mini_test_result', 'blueprint'] as const;

/**
 * Original exam papers are NEVER shareable (copyright protection).
 * Only AI-generated outputs can be shared.
 */
export function isShareable(itemType: string): boolean {
  return (SHAREABLE_TYPES as readonly string[]).includes(itemType);
}

export function isOriginalExam(itemType: string): boolean {
  return itemType === 'exam' || itemType === 'exam_image';
}
