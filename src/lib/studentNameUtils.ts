/**
 * Utilities for validating and normalizing student names on accredited credentials.
 * Ensures student certificates are never permanently minted with placeholder names.
 */

const PLACEHOLDER_NAMES = new Set([
  'student',
  'verified graduate',
  'editor',
  'user',
  'anonymous',
  'graduate',
  'learner',
  'iunoware student',
  'unknown',
]);

/**
 * Checks if a given student name is missing, blank, or a generic system placeholder.
 */
export function isPlaceholderStudentName(name?: string | null): boolean {
  if (!name) return true;
  const trimmed = name.trim().toLowerCase();
  if (trimmed.length < 2) return true;
  return PLACEHOLDER_NAMES.has(trimmed);
}

/**
 * Validates a potential legal name.
 * Returns null if valid, or a human-friendly error string if invalid.
 */
export function validateLegalName(name: string): string | null {
  const trimmed = name.trim();
  if (!trimmed || trimmed.length < 2) {
    return 'Please enter your full legal name (minimum 2 characters).';
  }
  if (isPlaceholderStudentName(trimmed)) {
    return 'Please provide your official legal name rather than a placeholder.';
  }
  // Disallow purely numeric or punctuation strings
  if (!/[a-zA-Z\u00C0-\u024F\u1E00-\u1EFF]/.test(trimmed)) {
    return 'Legal name must contain alphabetic characters.';
  }
  return null;
}

