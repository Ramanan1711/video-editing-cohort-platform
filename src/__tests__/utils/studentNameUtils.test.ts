import { describe, it, expect } from 'vitest';
import { isPlaceholderStudentName, validateLegalName } from '../../lib/studentNameUtils';

describe('studentNameUtils', () => {
  describe('isPlaceholderStudentName', () => {
    it('identifies null, undefined, empty, or whitespace strings as placeholder', () => {
      expect(isPlaceholderStudentName(null)).toBe(true);
      expect(isPlaceholderStudentName(undefined)).toBe(true);
      expect(isPlaceholderStudentName('')).toBe(true);
      expect(isPlaceholderStudentName('   ')).toBe(true);
      expect(isPlaceholderStudentName('a')).toBe(true);
    });

    it('identifies generic system placeholders (case-insensitive)', () => {
      expect(isPlaceholderStudentName('Student')).toBe(true);
      expect(isPlaceholderStudentName('student')).toBe(true);
      expect(isPlaceholderStudentName('STUDENT')).toBe(true);
      expect(isPlaceholderStudentName('Verified Graduate')).toBe(true);
      expect(isPlaceholderStudentName('Editor')).toBe(true);
      expect(isPlaceholderStudentName('User')).toBe(true);
      expect(isPlaceholderStudentName('Anonymous')).toBe(true);
      expect(isPlaceholderStudentName('Learner')).toBe(true);
      expect(isPlaceholderStudentName('Unknown')).toBe(true);
    });

    it('recognizes legitimate student legal names', () => {
      expect(isPlaceholderStudentName('Maya Lin')).toBe(false);
      expect(isPlaceholderStudentName('Alex Vance')).toBe(false);
      expect(isPlaceholderStudentName('Ramanan M.')).toBe(false);
      expect(isPlaceholderStudentName('Jean-Luc Picard')).toBe(false);
      expect(isPlaceholderStudentName('Li Wei')).toBe(false);
    });
  });

  describe('validateLegalName', () => {
    it('returns an error for empty or too short names', () => {
      expect(validateLegalName('')).toBe('Please enter your full legal name (minimum 2 characters).');
      expect(validateLegalName('A')).toBe('Please enter your full legal name (minimum 2 characters).');
      expect(validateLegalName('   ')).toBe('Please enter your full legal name (minimum 2 characters).');
    });

    it('returns an error for placeholder names', () => {
      expect(validateLegalName('Student')).toBe('Please provide your official legal name rather than a placeholder.');
      expect(validateLegalName('verified graduate')).toBe('Please provide your official legal name rather than a placeholder.');
    });

    it('returns an error for non-alphabetic strings', () => {
      expect(validateLegalName('123456')).toBe('Legal name must contain alphabetic characters.');
      expect(validateLegalName('---')).toBe('Legal name must contain alphabetic characters.');
    });

    it('returns null (valid) for genuine legal names', () => {
      expect(validateLegalName('Maya Lin')).toBeNull();
      expect(validateLegalName('Jordan K. Smith')).toBeNull();
      expect(validateLegalName('Søren Kierkegaard')).toBeNull();
    });
  });
});

