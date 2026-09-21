# Supabase Database Migration Versioning & Governance Policy

This directory represents the **single authoritative source of truth** for all database schema, policy, trigger, and function migrations for the CUT / CRAFT Video Editing Cohort Platform.

---

## 1. File Naming & Versioning Convention

All migration scripts follow the standard timestamped prefix format:
```
YYYYMMDDHHMMSS_<descriptive_snake_case_name>.sql
```

Example:
- `20260921000001_core_schema.sql`
- `20260921000002_rbac_and_cohort_scoping.sql`
- `20260921000003_storage_and_hardening.sql`
- `20260921000004_data_integrity_and_audit.sql`

Migrations are strictly sequential and executed in ascending alphabetical/timestamp order.

---

## 2. Standard Migration Execution Order

When bootstrapping a fresh environment or applying updates to staging/production, execute migrations in this exact order:

| Order | Migration File | Scope & Purpose |
|---|---|---|
| **1** | `20260921000001_core_schema.sql` | Baseline schema: `profiles`, `cohorts`, `modules`, `lessons`, `assignments`, `submissions`, `feedback`. |
| **2** | `20260921000002_rbac_and_cohort_scoping.sql` | RBAC roles, `mentor_cohorts` mapping, helper functions (`is_admin`, `is_mentor_for_cohort`). |
| **3** | `20260921000003_storage_and_hardening.sql` | Private Supabase storage buckets (`submissions`), signed URL policies, student submission lockdown. |
| **4** | `20260921000004_data_integrity_and_audit.sql` | Server-side mutation validation RPCs (`admin_update_user_role`, `enroll_student_in_cohort`, `admin_delete_cohort`, `publish_announcement`) and automatic audit triggers. |

---

## 3. Idempotency & Safety Guidelines

Every migration must adhere to the following safety rules:

1. **Idempotent DDL**:
   - Use `CREATE TABLE IF NOT EXISTS`.
   - Use `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`.
   - Use `CREATE OR REPLACE FUNCTION`.
   - Use `DROP POLICY IF EXISTS ... CREATE POLICY`.
   - Use `DROP TRIGGER IF EXISTS ... CREATE TRIGGER`.
2. **Backward Compatibility**:
   - Do not rename or drop live columns without a multi-phase migration (first deprecate in client code, then drop in a subsequent migration).
3. **Security Definer Functions**:
   - Always specify `SET search_path = public` on `SECURITY DEFINER` functions to prevent search path hijacking.
4. **Zero Ad-Hoc Scripts**:
   - Never run raw, untracked DDL commands in the Supabase production SQL editor without committing the corresponding versioned file in this directory.

