import { describe, it, expect } from 'vitest';
import {
  CreateOrderSchema as ClientCreateOrderSchema,
  VerifyPaymentSchema as ClientVerifyPaymentSchema,
  ChallengeSubmissionSchema,
  CreateChallengeSchema,
  EdgeCreateOrderSchema,
  EdgeVerifyPaymentSchema,
  RazorpayWebhookSchema,
  RazorpayEntitySchema,
  UnlockChallengesSchema,
  ReapExpiredReservationsSchema,
  DispatchWhatsAppQueueSchema,
} from '../../lib/schemas/runtimeContracts';

describe('Runtime Schema Contracts', () => {
  describe('CreateOrderSchema', () => {
    const validUuid = '123e4567-e89b-12d3-a456-426614174000';

    it('successfully parses valid cohort_id (snake_case)', () => {
      const result = EdgeCreateOrderSchema.safeParse({
        cohort_id: validUuid,
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.cohort_id).toBe(validUuid);
        expect(result.data.cohortId).toBe(validUuid);
        expect(result.data.currency).toBe('INR');
      }
    });

    it('successfully parses valid cohortId (camelCase)', () => {
      const result = EdgeCreateOrderSchema.safeParse({
        cohortId: validUuid,
        currency: 'USD',
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.cohortId).toBe(validUuid);
        expect(result.data.currency).toBe('USD');
      }
    });

    it('rejects malformed or invalid UUID with standardized field errors', () => {
      const result = EdgeCreateOrderSchema.safeParse({
        cohort_id: 'not-a-uuid',
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        const flattened = result.error.flatten();
        expect(flattened.fieldErrors.cohort_id).toBeDefined();
        expect(flattened.fieldErrors.cohort_id?.[0]).toMatch(/Invalid Cohort UUID/i);
      }
    });

    it('rejects missing cohort identifier', () => {
      const result = EdgeCreateOrderSchema.safeParse({});
      expect(result.success).toBe(false);
      if (!result.success) {
        const flattened = result.error.flatten();
        expect(flattened.fieldErrors.cohortId).toBeDefined();
      }
    });

    it('client contract supports test identifiers', () => {
      const result = ClientCreateOrderSchema.safeParse({ cohortId: 'cohort-abc-123' });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.cohortId).toBe('cohort-abc-123');
      }
    });
  });

  describe('VerifyPaymentSchema', () => {
    const validUuid = '123e4567-e89b-12d3-a456-426614174000';

    it('successfully parses valid verification payload', () => {
      const result = EdgeVerifyPaymentSchema.safeParse({
        orderId: 'order_12345',
        paymentId: 'pay_67890',
        signature: 'sig_abcdef',
        cohortId: validUuid,
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.orderId).toBe('order_12345');
        expect(result.data.paymentId).toBe('pay_67890');
        expect(result.data.signature).toBe('sig_abcdef');
        expect(result.data.cohortId).toBe(validUuid);
      }
    });

    it('successfully parses snake_case verification payload', () => {
      const result = EdgeVerifyPaymentSchema.safeParse({
        order_id: 'order_12345',
        payment_id: 'pay_67890',
        signature: 'sig_abcdef',
        cohort_id: validUuid,
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.orderId).toBe('order_12345');
        expect(result.data.paymentId).toBe('pay_67890');
        expect(result.data.cohortId).toBe(validUuid);
      }
    });

    it('rejects invalid cohort UUID in verification payload', () => {
      const result = EdgeVerifyPaymentSchema.safeParse({
        orderId: 'order_12345',
        paymentId: 'pay_67890',
        signature: 'sig_abcdef',
        cohortId: 'malformed-id',
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        const flattened = result.error.flatten();
        expect(flattened.fieldErrors.cohortId?.[0]).toMatch(/Invalid Cohort UUID/i);
      }
    });

    it('rejects missing parameters with specific field errors', () => {
      const result = EdgeVerifyPaymentSchema.safeParse({
        signature: 'sig_abcdef',
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        const flattened = result.error.flatten();
        expect(flattened.fieldErrors.orderId).toBeDefined();
        expect(flattened.fieldErrors.paymentId).toBeDefined();
        expect(flattened.fieldErrors.cohortId).toBeDefined();
      }
    });

    it('client contract accepts mock cohort prefixes in test environments', () => {
      const result = ClientVerifyPaymentSchema.safeParse({
        orderId: 'order_12345',
        paymentId: 'pay_67890',
        signature: 'sig_abcdef',
        cohortId: 'cohort-test-xyz',
      });
      expect(result.success).toBe(true);
    });
  });

  describe('RazorpayWebhookSchema', () => {
    it('successfully validates payment.captured webhook event', () => {
      const result = RazorpayWebhookSchema.safeParse({
        id: 'evt_12345',
        event: 'payment.captured',
        created_at: 1728000000,
        payload: {
          payment: {
            entity: {
              id: 'pay_12345',
              order_id: 'order_12345',
              amount: 499900,
              currency: 'INR',
              status: 'captured',
              captured: true,
            },
          },
        },
      });
      expect(result.success).toBe(true);
    });

    it('rejects webhook payload missing event type', () => {
      const result = RazorpayWebhookSchema.safeParse({
        created_at: 1728000000,
        payload: {},
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        const flattened = result.error.flatten();
        expect(flattened.fieldErrors.event).toBeDefined();
      }
    });

    it('validates RazorpayEntitySchema with optional fields and passes through extra keys', () => {
      const result = RazorpayEntitySchema.safeParse({
        id: 'pay_999',
        extra_gateway_field: 'extra_value',
      });
      expect(result.success).toBe(true);
    });
  });

  describe('UnlockChallengesSchema', () => {
    const validUuid = '123e4567-e89b-12d3-a456-426614174000';

    it('accepts valid cohort_id', () => {
      const result = UnlockChallengesSchema.safeParse({ cohort_id: validUuid });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.cohort_id).toBe(validUuid);
      }
    });

    it('accepts empty object (optional unlock parameter)', () => {
      const result = UnlockChallengesSchema.safeParse({});
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.cohort_id).toBeNull();
      }
    });

    it('rejects malformed UUID in cohort_id', () => {
      const result = UnlockChallengesSchema.safeParse({ cohort_id: 'bad-uuid' });
      expect(result.success).toBe(false);
      if (!result.success) {
        const flattened = result.error.flatten();
        expect(flattened.fieldErrors.cohort_id?.[0]).toMatch(/Invalid Cohort UUID/i);
      }
    });
  });

  describe('ReapExpiredReservationsSchema', () => {
    it('accepts empty or dryRun: true', () => {
      expect(ReapExpiredReservationsSchema.safeParse({}).success).toBe(true);
      expect(ReapExpiredReservationsSchema.safeParse({ dryRun: true }).success).toBe(true);
    });

    it('rejects non-boolean dryRun', () => {
      expect(ReapExpiredReservationsSchema.safeParse({ dryRun: 'not-bool' }).success).toBe(false);
    });
  });

  describe('DispatchWhatsAppQueueSchema', () => {
    it('accepts valid batch size between 1 and 100', () => {
      const result = DispatchWhatsAppQueueSchema.safeParse({ maxBatchSize: 50 });
      expect(result.success).toBe(true);
      if (result.success && result.data) {
        expect(result.data.maxBatchSize).toBe(50);
      }
    });

    it('rejects batch size exceeding 100', () => {
      const result = DispatchWhatsAppQueueSchema.safeParse({ maxBatchSize: 101 });
      expect(result.success).toBe(false);
    });

    it('rejects batch size less than 1', () => {
      const result = DispatchWhatsAppQueueSchema.safeParse({ maxBatchSize: 0 });
      expect(result.success).toBe(false);
    });
  });

  describe('ChallengeSubmissionSchema', () => {
    it('accepts valid deliverable submission', () => {
      const result = ChallengeSubmissionSchema.safeParse({
        challengeId: 'chal_123',
        userId: 'user_456',
        submissionUrl: 'https://github.com/student/video-cut',
        notes: 'Final render complete with color grade',
      });
      expect(result.success).toBe(true);
    });

    it('rejects invalid or non-URL submission link', () => {
      const result = ChallengeSubmissionSchema.safeParse({
        challengeId: 'chal_123',
        userId: 'user_456',
        submissionUrl: 'ftp://invalid-scheme.com',
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        const flattened = result.error.flatten();
        expect(flattened.fieldErrors.submissionUrl).toBeDefined();
      }
    });

    it('rejects submission missing challengeId or userId', () => {
      const result = ChallengeSubmissionSchema.safeParse({
        submissionUrl: 'https://github.com/student/video-cut',
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        const flattened = result.error.flatten();
        expect(flattened.fieldErrors.challengeId).toBeDefined();
        expect(flattened.fieldErrors.userId).toBeDefined();
      }
    });
  });

  describe('CreateChallengeSchema', () => {
    it('accepts valid challenge creation payload', () => {
      const result = CreateChallengeSchema.safeParse({
        cohortId: 'cohort_123',
        title: 'Cinematic Teaser Edit',
        type: 'PROJECT',
        week: 'Week 1',
        startDate: '2026-10-15',
        endDate: '2026-10-22',
        proReward: 150,
      });
      expect(result.success).toBe(true);
    });

    it('rejects negative reward or title under 3 characters', () => {
      const result = CreateChallengeSchema.safeParse({
        cohortId: 'cohort_123',
        title: 'AB',
        type: 'TASK',
        week: 'Week 1',
        startDate: '2026-10-15',
        endDate: '2026-10-22',
        proReward: -50,
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        const flattened = result.error.flatten();
        expect(flattened.fieldErrors.title).toBeDefined();
        expect(flattened.fieldErrors.proReward).toBeDefined();
      }
    });
  });
});
