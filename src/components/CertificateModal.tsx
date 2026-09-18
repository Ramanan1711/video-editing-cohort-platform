import { Award, Printer, ShieldCheck, X } from 'lucide-react';
import { Button } from './ui/Button';

interface CertificateModalProps {
  isOpen: boolean;
  onClose: () => void;
  studentName: string;
  cohortName: string;
  cohortId: string;
  studentId: string;
  completedDate?: string;
}

export function CertificateModal({
  isOpen,
  onClose,
  studentName,
  cohortName,
  cohortId,
  studentId,
  completedDate,
}: CertificateModalProps) {
  if (!isOpen) return null;

  const dateStr = completedDate
    ? new Date(completedDate).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : new Date().toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });

  const credentialId = `CC-${cohortId.replace(/-/g, '').slice(0, 6).toUpperCase()}-${studentId
    .replace(/-/g, '')
    .slice(0, 6)
    .toUpperCase()}`;

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-950/80 p-4 backdrop-blur-md">
      <div className="relative w-full max-w-3xl animate-in fade-in zoom-in-95 duration-200">
        {/* Certificate Actions Bar */}
        <div className="mb-4 flex items-center justify-between print:hidden">
          <div className="flex items-center gap-2 text-white">
            <Award className="text-orange-400" size={24} />
            <span className="font-black text-sm uppercase tracking-wider">
              Official Credential
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={handlePrint}
              className="bg-white/10 text-white hover:bg-white/20 border-white/10"
            >
              <Printer size={15} />
              <span>Print / Save PDF</span>
            </Button>
            <button
              onClick={onClose}
              className="rounded-xl p-2 text-slate-400 transition hover:bg-white/10 hover:text-white"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* The Printable Certificate Box */}
        <div
          id="certificate-print-area"
          className="relative overflow-hidden rounded-3xl border-8 border-double border-amber-600/30 bg-[#fffdf9] p-8 sm:p-12 text-center shadow-2xl text-slate-900"
        >
          {/* Subtle Background Watermark */}
          <div className="pointer-events-none absolute -right-20 -top-20 size-96 rounded-full bg-orange-100/40 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-20 -left-20 size-96 rounded-full bg-amber-100/40 blur-3xl" />

          {/* Top Emblem */}
          <div className="mx-auto mb-4 flex size-16 items-center justify-center rounded-2xl bg-gradient-to-tr from-amber-600 to-orange-500 text-white shadow-lg shadow-orange-500/20">
            <Award size={32} />
          </div>

          <p className="text-xs font-black uppercase tracking-[0.25em] text-orange-600">
            CUT / CRAFT ACADEMY
          </p>
          <h2 className="mt-2 font-serif text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-950">
            Certificate of Completion
          </h2>

          <div className="mx-auto my-5 h-0.5 w-24 bg-gradient-to-r from-transparent via-amber-500 to-transparent" />

          <p className="text-xs uppercase tracking-widest text-slate-500">
            This certificate is proudly awarded to
          </p>

          <h3 className="mt-3 font-serif text-2xl sm:text-3xl font-black text-slate-950 tracking-normal text-amber-900">
            {studentName || 'Student'}
          </h3>

          <p className="mx-auto mt-4 max-w-lg text-xs leading-relaxed text-slate-600">
            for successfully completing all intensive curriculum modules, video editing challenges,
            technical timeline exercises, and mentor reviews in the accredited cohort:
          </p>

          <div className="mt-4 inline-block rounded-xl border border-amber-200 bg-amber-50/80 px-6 py-2">
            <span className="font-extrabold text-sm text-slate-950">{cohortName}</span>
          </div>

          {/* Signatures & Seal Section */}
          <div className="mt-10 grid grid-cols-3 items-end gap-4 border-t border-slate-200/80 pt-6">
            <div className="text-center">
              <div className="mx-auto h-8 w-24 border-b border-slate-400 font-serif italic text-slate-700 text-sm">
                Alex Vance
              </div>
              <p className="mt-1 text-[11px] font-bold text-slate-900">Lead Instructor</p>
              <p className="text-[10px] text-slate-400">CUT / CRAFT Faculty</p>
            </div>

            {/* Verified Seal */}
            <div className="flex flex-col items-center justify-center">
              <div className="flex size-14 items-center justify-center rounded-full border-2 border-dashed border-amber-600 bg-amber-50 text-amber-700 shadow-sm">
                <ShieldCheck size={26} />
              </div>
              <span className="mt-1 text-[9px] font-black uppercase tracking-wider text-amber-800">
                Verified Credential
              </span>
            </div>

            <div className="text-center">
              <div className="mx-auto h-8 w-24 border-b border-slate-400 font-serif italic text-slate-700 text-sm">
                Sarah Lin
              </div>
              <p className="mt-1 text-[11px] font-bold text-slate-900">Director of Education</p>
              <p className="text-[10px] text-slate-400">CUT / CRAFT Academy</p>
            </div>
          </div>

          {/* Footer Metadata */}
          <div className="mt-6 flex flex-col sm:flex-row items-center justify-between gap-2 border-t border-slate-100 pt-4 text-[10px] text-slate-400">
            <span>Issue Date: <strong className="text-slate-600">{dateStr}</strong></span>
            <span>
              Credential ID: <code className="font-mono font-bold text-slate-600">{credentialId}</code>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
