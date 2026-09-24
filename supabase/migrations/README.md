# Supabase Database Migration Versioning & Governance Policy

This directory represents the **single authoritative source of truth** for all database schema, policy, trigger, and function migrations for the CUT / CRAFT Video Editing Cohort Platform.

---

## 1. Canonical Sequential Migration Order

When bootstrapping a fresh environment or applying updates to staging/production, execute migrations in this exact numerical order. **Do not run legacy ad-hoc scripts in `supabase/` directly**, as they are now consolidated into these 4 canonical files:

| Order | Migration File | Scope & Production Security Enforcements |
|---|---|---|
| **1** | [`20260921000001_core_schema.sql`](file:///Users/ramananm/Documents/Iunoware/Project/video-editing-cohort-platform/supabase/migrations/20260921000001_core_schema.sql) | Baseline schema: `profiles`, `cohorts`, `enrollments`, `modules`, `lessons`, `lesson_progress`, `lesson_resources`, `assignments`, `submissions`, `feedback`, `announcements`, `live_sessions`, `notifications`. Enables RLS on all tables. |
| **2** | [`20260921000002_rbac_and_cohort_scoping.sql`](file:///Users/ramananm/Documents/Iunoware/Project/video-editing-cohort-platform/supabase/migrations/20260921000002_rbac_and_cohort_scoping.sql) | RBAC roles, `mentor_cohorts` mapping table, Security Definer helper functions (`is_admin`, `is_mentor_or_admin`, `is_active_user`, `is_mentor_for_cohort`, `is_mentor_for_student`). |
| **3** | [`20260921000003_storage_and_hardening.sql`](file:///Users/ramananm/Documents/Iunoware/Project/video-editing-cohort-platform/supabase/migrations/20260921000003_storage_and_hardening.sql) | **Storage Privacy & Submissions Lockdown**: <br>• Private `submissions` bucket (`public = false`)<br>• Signed URL access policy on `storage.objects` (owner, assigned mentor, admin)<br>• Submission integrity trigger (`trg_enforce_submission_integrity`) preventing student status escalation, ownership tampering, or assignment tampering<br>• Lesson resource visibility enforcement (`public`, `enrolled`, `after_completion`)<br>• Airtight RLS across 7 core entities: `profiles`, `enrollments`, `submissions`, `feedback`, `notifications`, `lesson_resources`, `storage.objects`<br>• Server-side submission RPC (`submit_student_assignment`) and revisions archive (`submission_versions`). |
| **4** | [`20260921000004_data_integrity_and_audit.sql`](file:///Users/ramananm/Documents/Iunoware/Project/video-editing-cohort-platform/supabase/migrations/20260921000004_data_integrity_and_audit.sql) | Database-level audit logging (`audit_logs`, `log_audit_event`), critical mutation validation RPCs (`admin_update_user_role`, `admin_update_user_status`, `enroll_student_in_cohort`, `admin_delete_cohort`, `publish_announcement`), and automatic audit triggers. |

---

## 2. Legacy Script Consolidation Map

The ad-hoc scripts in `supabase/*.sql` have been audited and merged into the canonical migrations above:

| Legacy Ad-Hoc Script | Canonical Target File | Notes |
|---|---|---|
| `mentor_access_and_rbac.sql` | `20260921000002_rbac_and_cohort_scoping.sql` & `20260921000003_storage_and_hardening.sql` | RBAC functions, profiles RLS, review RPC |
| `course_authoring_phase2.sql` | `20260921000003_storage_and_hardening.sql` | Storage bucket config, visibility columns |
| `course_resources.sql` | `20260921000001_core_schema.sql` & `20260921000003_storage_and_hardening.sql` | Table creation & visibility RLS rules |
| `security_and_storage_hardening.sql` | `20260921000003_storage_and_hardening.sql` | Storage bucket lockdown & signed URL policies |
| `production_security_hardening.sql` | `20260921000003_storage_and_hardening.sql` | Comprehensive 7-table RLS and submission triggers |
| `admin_operations.sql`, `phase4_mentor_admin_operations.sql` | `20260921000004_data_integrity_and_audit.sql` | Admin mutation validation and audit logs |
| `student_flow_enhancements.sql`, `student_flow_validation.sql` | `20260921000003_storage_and_hardening.sql` | Submission versions and student RPCs |

---

## 3. Production Security Checklist Verification

| Item | Status | Verification Mechanism |
|---|---|---|
| **Make student submission storage private** | ✅ Enforced | `storage.buckets.public = false` for `submissions` in `20260921000003` |
| **Replace public submission URLs with signed expiring URLs** | ✅ Enforced | `uploadSubmissionFile` & `getSecureSubmissionUrl` in `courseService.ts` generate expiring signed URLs via `supabase.storage.createSignedUrl` |
| **Restrict submission access to owner, assigned mentor, admin** | ✅ Enforced | Enforced in PostgreSQL on both `storage.objects` and `public.submissions` |
| **Remove authorization fallback based on user_metadata.role** | ✅ Enforced | `AuthContext.tsx` defaults to `'student'`, never escalates from metadata; `Login.tsx` purged |
| **Block suspended users in ProtectedRoute.tsx** | ✅ Enforced | `ProtectedRoute.tsx` checks `profile?.status === 'suspended'` and blocks access with sign-out screen |
| **Prevent students from changing submission status, owner, or assignment ID** | ✅ Enforced | `trg_enforce_submission_integrity` trigger raises 42501 on any attempted modification |
| **Enforce mentor cohort access in database policies** | ✅ Enforced | `mentor_cohorts` table + `is_mentor_for_cohort` / `is_mentor_for_student` helpers in RLS |
| **Enforce lesson resource visibility in PostgreSQL (including after_completion)** | ✅ Enforced | RLS on `lesson_resources` checks `visibility in ('public', 'enrolled', 'after_completion')` with `lesson_progress.completed` |
| **Verify RLS policies for profiles, enrollments, submissions, feedback, notifications, resources, storage** | ✅ Enforced | All 7 tables covered by explicit SELECT, INSERT, UPDATE, DELETE policies in `20260921000003` |
| **Review overlapping Supabase scripts and establish single migration order** | ✅ Enforced | Consolidated into 4 sequential numbered migrations (001 to 004) |

---

## 4. Idempotency & Safety Guidelines

1. **Idempotent DDL**:
   - Use `CREATE TABLE IF NOT EXISTS`.
   - Use `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`.
   - Use `CREATE OR REPLACE FUNCTION`.
   - Use `DROP POLICY IF EXISTS ... CREATE POLICY`.
   - Use `DROP TRIGGER IF EXISTS ... CREATE TRIGGER`.
2. **Backward Compatibility**:
   - Column dual-compatibility (`version` and `version_number`, `name` and `title`, `url` and `file_url`) ensures client code never breaks regardless of legacy column naming.
3. **Security Definer Functions**:
   - Always specify `SET search_path = public` on `SECURITY DEFINER` functions to prevent search path hijacking.
