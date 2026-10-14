import { BulkImportSprintModal as BaseBulkImportSprintModal } from '../../../components/admin/BulkImportSprintModal';
import { useAdminCourses } from '../context/useAdminCourses';
import { useToast } from '../../../context/useToast';
import { logAuditEvent } from '../../../lib/adminService';

export function BulkSprintImportModal() {
  const toast = useToast();
  const {
    bulkImportTargetCohort,
    setBulkImportTargetCohort,
    loadChallengesForCohort,
    user,
  } = useAdminCourses();

  if (!bulkImportTargetCohort) return null;

  return (
    <BaseBulkImportSprintModal
      isOpen={Boolean(bulkImportTargetCohort)}
      cohortId={bulkImportTargetCohort.id}
      cohortTitle={bulkImportTargetCohort.title}
      onClose={() => setBulkImportTargetCohort(null)}
      onSuccess={async (importedCount) => {
        const targetId = bulkImportTargetCohort.id;
        setBulkImportTargetCohort(null);
        await loadChallengesForCohort(targetId);
        void logAuditEvent({
          actor_id: user?.id,
          action: 'challenge.bulk_imported',
          entity_type: 'cohort',
          entity_id: targetId,
          metadata: { count: importedCount },
        });
        toast.success(`Successfully imported ${importedCount} sprint challenges.`);
      }}
    />
  );
}
