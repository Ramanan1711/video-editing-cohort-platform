import { z } from 'zod';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Validates cohort identifier (UUID format in production, or non-empty identifier in test/dev mocks).
 */
export const CohortIdSchema = z.string().refine(
  (val) => val.length > 0 && (UUID_REGEX.test(val) || val.startsWith('cohort-') || val.startsWith('mock_')),
  { message: 'Invalid Cohort UUID' }
);

/**
 * Runtime schema for initializing cohort payment orders.
 */
export const CreateOrderSchema = z
  .object({
    cohort_id: CohortIdSchema.optional(),
    cohortId: CohortIdSchema.optional(),
    currency: z.enum(['INR', 'USD']).default('INR'),
  })
  .refine((data) => Boolean(data.cohort_id || data.cohortId), {
    message: 'cohort_id is required',
    path: ['cohort_id'],
  })
  .transform((data) => ({
    cohort_id: (data.cohort_id || data.cohortId) as string,
    cohortId: (data.cohortId || data.cohort_id) as string,
    currency: data.currency,
  }));

export type CreateOrderInput = z.input<typeof CreateOrderSchema>;
export type CreateOrderOutput = z.output<typeof CreateOrderSchema>;

/**
 * Runtime schema for verifying server-side payment signatures and enrolling students.
 */
export const VerifyPaymentSchema = z
  .object({
    order_id: z.string().min(1, { message: 'order_id is required' }).optional(),
    orderId: z.string().min(1, { message: 'orderId is required' }).optional(),
    payment_id: z.string().min(1, { message: 'payment_id is required' }).optional(),
    paymentId: z.string().min(1, { message: 'paymentId is required' }).optional(),
    signature: z.string().min(1, { message: 'signature is required' }),
    cohort_id: CohortIdSchema.optional(),
    cohortId: CohortIdSchema.optional(),
  })
  .refine((data) => Boolean(data.orderId || data.order_id), {
    message: 'orderId is required',
    path: ['orderId'],
  })
  .refine((data) => Boolean(data.paymentId || data.payment_id), {
    message: 'paymentId is required',
    path: ['paymentId'],
  })
  .refine((data) => Boolean(data.cohortId || data.cohort_id), {
    message: 'cohortId is required',
    path: ['cohortId'],
  })
  .transform((data) => ({
    orderId: (data.orderId || data.order_id) as string,
    order_id: (data.order_id || data.orderId) as string,
    paymentId: (data.paymentId || data.payment_id) as string,
    payment_id: (data.payment_id || data.paymentId) as string,
    signature: data.signature,
    cohortId: (data.cohortId || data.cohort_id) as string,
    cohort_id: (data.cohort_id || data.cohortId) as string,
  }));

export type VerifyPaymentInput = z.input<typeof VerifyPaymentSchema>;
export type VerifyPaymentOutput = z.output<typeof VerifyPaymentSchema>;

/**
 * Runtime schema for student challenge deliverable submission.
 */
export const ChallengeSubmissionSchema = z.object({
  challengeId: z.string().min(1, { message: 'challengeId is required' }),
  userId: z.string().min(1, { message: 'userId is required' }),
  submissionUrl: z
    .string()
    .min(1, { message: 'submissionUrl is required' })
    .refine(
      (val) => {
        try {
          const parsed = new URL(val);
          return ['http:', 'https:'].includes(parsed.protocol);
        } catch {
          return val.startsWith('https://') || val.startsWith('http://');
        }
      },
      { message: 'submissionUrl must be a valid HTTP/HTTPS URL' }
    ),
  notes: z.string().max(2000, { message: 'notes cannot exceed 2000 characters' }).optional(),
});

export type ChallengeSubmissionInput = z.input<typeof ChallengeSubmissionSchema>;

/**
 * Runtime schema for admin creating a course challenge.
 */
export const CreateChallengeSchema = z.object({
  cohortId: z.string().min(1, { message: 'cohortId is required' }),
  cohortTitle: z.string().optional(),
  title: z.string().min(3, { message: 'Title must be at least 3 characters' }),
  type: z.enum(['PROJECT', 'TASK']),
  week: z.string().min(1, { message: 'Week label is required' }),
  startDate: z.string().min(1, { message: 'Start date is required' }),
  endDate: z.string().min(1, { message: 'End date is required' }),
  durationLabel: z.string().optional(),
  status: z.enum(['active', 'upcoming', 'completed']).default('active'),
  proReward: z.number().int().nonnegative().default(100),
  description: z.string().optional(),
  assetUrl: z.string().url().optional().or(z.literal('')),
  assetName: z.string().optional(),
  assetSize: z.string().optional(),
});

export type CreateChallengeInputSchema = z.input<typeof CreateChallengeSchema>;

/**
 * Strict Edge Function schema for create-razorpay-order
 */
export const EdgeCreateOrderSchema = z
  .object({
    cohort_id: z.string().uuid({ message: 'Invalid Cohort UUID' }).optional(),
    cohortId: z.string().uuid({ message: 'Invalid Cohort UUID' }).optional(),
    currency: z.enum(['INR', 'USD']).default('INR'),
  })
  .refine((data) => Boolean(data.cohort_id || data.cohortId), {
    message: 'Missing cohortId parameter',
    path: ['cohortId'],
  })
  .transform((data) => ({
    cohort_id: (data.cohort_id || data.cohortId) as string,
    cohortId: (data.cohortId || data.cohort_id) as string,
    currency: data.currency,
  }));

/**
 * Strict Edge Function schema for verify-razorpay-payment
 */
export const EdgeVerifyPaymentSchema = z
  .object({
    order_id: z.string().min(1, { message: 'order_id is required' }).optional(),
    orderId: z.string().min(1, { message: 'orderId is required' }).optional(),
    payment_id: z.string().min(1, { message: 'payment_id is required' }).optional(),
    paymentId: z.string().min(1, { message: 'paymentId is required' }).optional(),
    signature: z.string().min(1, { message: 'signature is required' }),
    cohort_id: z.string().uuid({ message: 'Invalid Cohort UUID' }).optional(),
    cohortId: z.string().uuid({ message: 'Invalid Cohort UUID' }).optional(),
  })
  .refine((data) => Boolean(data.orderId || data.order_id), {
    message: 'Missing orderId parameter',
    path: ['orderId'],
  })
  .refine((data) => Boolean(data.paymentId || data.payment_id), {
    message: 'Missing paymentId parameter',
    path: ['paymentId'],
  })
  .refine((data) => Boolean(data.cohortId || data.cohort_id), {
    message: 'Missing cohortId parameter',
    path: ['cohortId'],
  })
  .transform((data) => ({
    orderId: (data.orderId || data.order_id) as string,
    order_id: (data.order_id || data.orderId) as string,
    paymentId: (data.paymentId || data.payment_id) as string,
    payment_id: (data.payment_id || data.paymentId) as string,
    signature: data.signature,
    cohortId: (data.cohortId || data.cohort_id) as string,
    cohort_id: (data.cohort_id || data.cohortId) as string,
  }));

/**
 * Edge Function schema for razorpay-webhook
 */
export const RazorpayEntitySchema = z
  .object({
    id: z.string().optional(),
    order_id: z.string().optional(),
    amount: z.number().optional(),
    currency: z.string().optional(),
    status: z.string().optional(),
    captured: z.boolean().optional(),
    notes: z.record(z.string(), z.unknown()).optional(),
    method: z.string().optional(),
    error_code: z.string().optional(),
    error_description: z.string().optional(),
    created_at: z.number().optional(),
  })
  .passthrough();

export const RazorpayWebhookSchema = z
  .object({
    id: z.string().optional(),
    event: z.string().min(1, { message: 'Missing webhook event type' }),
    created_at: z.number().optional(),
    payload: z
      .object({
        payment: z.object({ entity: RazorpayEntitySchema.optional() }).passthrough().optional(),
        order: z.object({ entity: RazorpayEntitySchema.optional() }).passthrough().optional(),
      })
      .passthrough()
      .optional(),
  })
  .passthrough();

/**
 * Edge Function schema for unlock-challenges
 */
export const UnlockChallengesSchema = z
  .object({
    cohort_id: z.string().uuid({ message: 'Invalid Cohort UUID' }).optional(),
    cohortId: z.string().uuid({ message: 'Invalid Cohort UUID' }).optional(),
  })
  .transform((data) => ({
    cohort_id: (data.cohort_id || data.cohortId) ?? null,
  }));

/**
 * Edge Function schema for reap-expired-reservations
 */
export const ReapExpiredReservationsSchema = z
  .object({
    dryRun: z.boolean().optional(),
  })
  .optional();

/**
 * Edge Function schema for dispatch-whatsapp-queue
 */
export const DispatchWhatsAppQueueSchema = z
  .object({
    maxBatchSize: z.number().int().min(1).max(100).default(25),
  })
  .optional();
