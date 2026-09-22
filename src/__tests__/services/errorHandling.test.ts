import { describe, it, expect } from 'vitest';
import { parseDatabaseError } from '../../lib/errorHandling';
import type { AppError } from '../../lib/errorHandling';

describe('Standardized Error Handling Suite (parseDatabaseError)', () => {
  it('handles null and undefined input gracefully with UNKNOWN_ERROR', () => {
    const errNull = parseDatabaseError(null);
    expect(errNull.code).toBe('UNKNOWN_ERROR');
    expect(errNull.canRetry).toBe(true);

    const errUndefined = parseDatabaseError(undefined);
    expect(errUndefined.code).toBe('UNKNOWN_ERROR');
  });

  it('passes through an already constructed AppError unchanged', () => {
    const existing: AppError = {
      code: 'NETWORK_ERROR',
      title: 'Custom Title',
      message: 'Custom Message',
      canRetry: true,
    };
    const result = parseDatabaseError(existing);
    expect(result).toBe(existing);
    expect(result.code).toBe('NETWORK_ERROR');
  });

  it('classifies network failures, fetch rejections, and offline states as NETWORK_ERROR', () => {
    const fetchErr = new Error('Failed to fetch');
    expect(parseDatabaseError(fetchErr).code).toBe('NETWORK_ERROR');
    expect(parseDatabaseError(fetchErr).canRetry).toBe(true);

    const netReqErr = { message: 'Network request failed' };
    expect(parseDatabaseError(netReqErr).code).toBe('NETWORK_ERROR');

    const connRefused = { message: 'Connection refused' };
    expect(parseDatabaseError(connRefused).code).toBe('NETWORK_ERROR');
  });

  it('classifies expired JWTs and 401 statuses as STALE_AUTH', () => {
    const jwtExpired = { message: 'JWT expired', status: 401 };
    const res1 = parseDatabaseError(jwtExpired);
    expect(res1.code).toBe('STALE_AUTH');
    expect(res1.canRetry).toBe(false);

    const refreshErr = new Error('Invalid Refresh Token: Refresh Token Not Found');
    expect(parseDatabaseError(refreshErr).code).toBe('STALE_AUTH');
  });

  it('classifies Postgres 42501 and RLS policy rejections as PERMISSION_DENIED', () => {
    const rlsErr = {
      code: '42501',
      message: 'new row violates row-level security policy for table "submissions"',
    };
    const res = parseDatabaseError(rlsErr);
    expect(res.code).toBe('PERMISSION_DENIED');
    expect(res.postgresCode).toBe('42501');
    expect(res.canRetry).toBe(false);

    const status403 = { status: 403, message: 'Forbidden' };
    expect(parseDatabaseError(status403).code).toBe('PERMISSION_DENIED');
  });

  it('classifies Postgres 42P01 and 42883 as MIGRATION_MISSING', () => {
    const missingTable = {
      code: '42P01',
      message: 'relation "mentor_cohort_assignments" does not exist',
    };
    const res = parseDatabaseError(missingTable);
    expect(res.code).toBe('MIGRATION_MISSING');
    expect(res.postgresCode).toBe('42P01');
    expect(res.canRetry).toBe(false);

    const missingFunc = {
      code: '42883',
      message: 'function submit_student_assignment(uuid, text) does not exist',
    };
    expect(parseDatabaseError(missingFunc).code).toBe('MIGRATION_MISSING');
  });

  it('classifies check constraints, capacity rejections, and custom exceptions as VALIDATION_ERROR', () => {
    const capacityErr = {
      code: 'P0001',
      message: 'Cohort has reached maximum enrollment capacity',
    };
    const res = parseDatabaseError(capacityErr);
    expect(res.code).toBe('VALIDATION_ERROR');
    expect(res.canRetry).toBe(true);

    const uniqueErr = {
      code: '23505',
      message: 'duplicate key value violates unique constraint "cohort_enrollments_pkey"',
    };
    expect(parseDatabaseError(uniqueErr).code).toBe('VALIDATION_ERROR');
  });

  it('classifies 404 and P0002 errors as NOT_FOUND', () => {
    const notFound = { status: 404, message: 'Lesson record not found' };
    const res = parseDatabaseError(notFound);
    expect(res.code).toBe('NOT_FOUND');
    expect(res.canRetry).toBe(false);
  });
});
