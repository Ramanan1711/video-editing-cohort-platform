import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Award,
  Download,
  LoaderCircle,
  Printer,
  ShieldCheck,
  ShieldAlert,
  CheckCircle2,
  XCircle,
  BookOpen,
  FileCheck2,
  X,
} from 'lucide-react';
import { Button } from './ui/Button';
import { verifyCertificateEligibility, type CertificateEligibilityResult } from '../lib/courseService';

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
  const [eligibility, setEligibility] = useState<CertificateEligibilityResult | null>(null);
  const [verifying, setVerifying] = useState(true);

  useEffect(() => {
    if (!isOpen) return;
    let active = true;
    verifyCertificateEligibility(studentId, cohortId)
      .then((res) => {
        if (active) {
          setEligibility(res);
          setVerifying(false);
        }
      })
      .catch((err: unknown) => {
        if (active) {
          setEligibility({
            eligible: false,
            reason: err instanceof Error ? err.message : 'Verification failed.',
          });
          setVerifying(false);
        }
      });
    return () => {
      active = false;
    };
  }, [isOpen, studentId, cohortId]);

  const dateStr = eligibility?.issued_at
    ? new Date(eligibility.issued_at).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : completedDate
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

  const credentialId =
    eligibility?.certificate_number ||
    `CC-${cohortId.replace(/-/g, '').slice(0, 6).toUpperCase()}-${studentId
      .replace(/-/g, '')
      .slice(0, 6)
      .toUpperCase()}`;

  // Add certificate print class to body when modal is open and eligible
  useEffect(() => {
    if (isOpen && eligibility?.eligible && !verifying) {
      document.body.classList.add('certificate-modal-open');
      return () => {
        document.body.classList.remove('certificate-modal-open');
      };
    }
  }, [isOpen, eligibility?.eligible, verifying]);

  if (!isOpen) return null;

  if (verifying) {
    return createPortal(
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm">
        <div className="w-full max-w-md rounded-2xl border border-white/10 bg-slate-900 p-6 text-center text-white shadow-2xl">
          <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-2xl bg-orange-500/10 text-orange-400">
            <LoaderCircle size={28} className="animate-spin" />
          </div>
          <h3 className="text-lg font-bold">Verifying Academic Eligibility</h3>
          <p className="mt-2 text-sm text-slate-400">
            Checking curriculum lesson completion and mentor-approved submissions for this cohort...
          </p>
        </div>
      </div>,
      document.body
    );
  }

  if (eligibility && !eligibility.eligible) {
    return createPortal(
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm animate-in fade-in">
        <div className="relative w-full max-w-lg rounded-2xl border border-white/10 bg-slate-900 p-6 text-white shadow-2xl">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 rounded-xl p-2 text-slate-400 transition hover:bg-white/10 hover:text-white"
            aria-label="Close"
          >
            <X size={20} />
          </button>

          <div className="flex items-center gap-3">
            <div className="flex size-12 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-400">
              <ShieldAlert size={24} />
            </div>
            <div>
              <h3 className="text-lg font-bold">Certificate Requirements Incomplete</h3>
              <p className="text-xs text-slate-400">CUT / CRAFT Academy Credential Verification</p>
            </div>
          </div>

          <p className="mt-4 text-sm text-slate-300">
            {eligibility.reason ||
              'To receive your official accredited certificate, you must complete all lessons and have every assignment approved by a mentor.'}
          </p>

          <div className="mt-5 space-y-3 rounded-xl border border-white/10 bg-slate-950/50 p-4">
            <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Requirements Checklist
            </div>

            {/* Enrollment Requirement */}
            <div className="flex items-center justify-between gap-3 text-sm">
              <div className="flex items-center gap-2.5">
                <ShieldCheck size={16} className="text-slate-400" />
                <span>Active Cohort Enrollment</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono font-medium text-emerald-400">Verified</span>
                <CheckCircle2 size={16} className="text-emerald-400" />
              </div>
            </div>

            {/* Lessons Requirement */}
            <div className="flex items-center justify-between gap-3 text-sm">
              <div className="flex items-center gap-2.5">
                <BookOpen size={16} className="text-slate-400" />
                <div>
                  <span>Course Lessons</span>
                  <p className="text-[10px] text-slate-400">≥80% watch verification required</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono font-medium text-slate-300">
                  {eligibility.completed_lessons ?? 0} / {eligibility.total_lessons ?? 0}
                </span>
                {(eligibility.completed_lessons ?? 0) >= (eligibility.total_lessons ?? 1) &&
                (eligibility.total_lessons ?? 0) > 0 ? (
                  <CheckCircle2 size={16} className="text-emerald-400" />
                ) : (
                  <XCircle size={16} className="text-rose-400" />
                )}
              </div>
            </div>

            {/* Assignments Requirement */}
            <div className="flex items-center justify-between gap-3 text-sm">
              <div className="flex items-center gap-2.5">
                <FileCheck2 size={16} className="text-slate-400" />
                <div>
                  <span>Approved Assignments</span>
                  <p className="text-[10px] text-slate-400">Reviewed &amp; passed by mentor</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono font-medium text-slate-300">
                  {eligibility.approved_assignments ?? 0} / {eligibility.total_assignments ?? 0}
                </span>
                {(eligibility.approved_assignments ?? 0) >= (eligibility.total_assignments ?? 1) &&
                (eligibility.total_assignments ?? 0) > 0 ? (
                  <CheckCircle2 size={16} className="text-emerald-400" />
                ) : (
                  <XCircle size={16} className="text-rose-400" />
                )}
              </div>
            </div>
          </div>

          <div className="mt-6 flex justify-end gap-3">
            <Button variant="primary" onClick={onClose} className="w-full sm:w-auto">
              Return to Curriculum
            </Button>
          </div>
        </div>
      </div>,
      document.body
    );
  }

  const handlePrint = () => {
    window.print();
  };

  // High-Resolution 2400x1700 PNG Image Generator
  const handleDownloadImage = () => {
    const canvas = document.createElement('canvas');
    canvas.width = 2400;
    canvas.height = 1700;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // 1. Parchment Base
    ctx.fillStyle = '#fffdfa';
    ctx.fillRect(0, 0, 2400, 1700);

    const radialGrad = ctx.createRadialGradient(1200, 850, 150, 1200, 850, 1300);
    radialGrad.addColorStop(0, '#ffffff');
    radialGrad.addColorStop(1, '#fbf4e6');
    ctx.fillStyle = radialGrad;
    ctx.fillRect(0, 0, 2400, 1700);

    // 2. Ornate Multi-layer Border
    // Outer fine gold
    ctx.strokeStyle = '#d97706';
    ctx.lineWidth = 4;
    ctx.strokeRect(60, 60, 2280, 1580);

    // Main thick charcoal border
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 14;
    ctx.strokeRect(80, 80, 2240, 1540);

    // Inner fine gold
    ctx.strokeStyle = '#b45309';
    ctx.lineWidth = 3;
    ctx.strokeRect(104, 104, 2192, 1492);

    // Corner rosettes
    const drawCorner = (x: number, y: number) => {
      ctx.save();
      ctx.translate(x, y);
      ctx.fillStyle = '#d97706';
      ctx.beginPath();
      ctx.arc(0, 0, 14, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = 3;
      ctx.stroke();

      ctx.strokeStyle = '#d97706';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-25, 0);
      ctx.lineTo(25, 0);
      ctx.moveTo(0, -25);
      ctx.lineTo(0, 25);
      ctx.stroke();
      ctx.restore();
    };

    drawCorner(104, 104);
    drawCorner(2296, 104);
    drawCorner(2296, 1596);
    drawCorner(104, 1596);

    // 3. Top Header Emblem & Text
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ea580c';
    ctx.font = 'bold 24px sans-serif';
    ctx.fillText('CUT / CRAFT ACADEMY OF POST-PRODUCTION', 1200, 220);

    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 78px serif';
    ctx.fillText('Certificate of Completion', 1200, 330);

    // Diamond divider
    ctx.strokeStyle = '#d97706';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(850, 380);
    ctx.lineTo(1150, 380);
    ctx.moveTo(1250, 380);
    ctx.lineTo(1550, 380);
    ctx.stroke();

    ctx.fillStyle = '#d97706';
    ctx.beginPath();
    ctx.moveTo(1200, 368);
    ctx.lineTo(1212, 380);
    ctx.lineTo(1200, 392);
    ctx.lineTo(1188, 380);
    ctx.closePath();
    ctx.fill();

    // Citation Header
    ctx.fillStyle = '#64748b';
    ctx.font = 'bold 22px sans-serif';
    ctx.fillText('THIS CERTIFICATE IS PROUDLY CONFERRED UPON', 1200, 480);

    // Student Name
    ctx.fillStyle = '#7c2d12';
    ctx.font = 'bold 84px serif';
    ctx.fillText(studentName || 'Student', 1200, 600);

    // Gold underline
    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(700, 640);
    ctx.lineTo(1700, 640);
    ctx.stroke();

    // Body Text
    ctx.fillStyle = '#475569';
    ctx.font = '28px serif';
    ctx.fillText(
      'for successfully mastering advanced timeline architecture, narrative pacing, color science, and sound design,',
      1200,
      730
    );
    ctx.fillText(
      'and completing all intensive video editing challenges, technical timelines, and mentor reviews in the accredited cohort:',
      1200,
      780
    );

    // Cohort Badge
    ctx.fillStyle = '#fef3c7';
    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = 2;
    const pW = 760;
    const pH = 76;
    const pX = 1200 - pW / 2;
    const pY = 840;
    ctx.beginPath();
    ctx.roundRect(pX, pY, pW, pH, 16);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 36px sans-serif';
    ctx.fillText(cohortName, 1200, 892);

    // Signatures & Seal Area (Y: 1140 to 1380)
    // Left: Alex Vance
    ctx.fillStyle = '#1e293b';
    ctx.font = 'italic 52px serif';
    ctx.fillText('Alex Vance', 480, 1160);

    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(300, 1190);
    ctx.lineTo(660, 1190);
    ctx.stroke();

    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 24px sans-serif';
    ctx.fillText('Alex Vance', 480, 1230);
    ctx.fillStyle = '#64748b';
    ctx.font = '20px sans-serif';
    ctx.fillText('Lead Instructor, CUT / CRAFT Faculty', 480, 1265);

    // Center Gold Seal
    const sealX = 1200;
    const sealY = 1180;
    const sR = 86;

    ctx.save();
    ctx.translate(sealX, sealY);
    ctx.fillStyle = '#d97706';
    ctx.beginPath();
    for (let i = 0; i < 36; i++) {
      const angle = (i * Math.PI) / 18;
      const r = i % 2 === 0 ? sR + 8 : sR - 4;
      ctx.lineTo(Math.cos(angle) * r, Math.sin(angle) * r);
    }
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#b45309';
    ctx.beginPath();
    ctx.arc(0, 0, sR - 8, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = '#fef3c7';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, 0, sR - 16, 0, Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 16px sans-serif';
    ctx.fillText('★ CUT / CRAFT ★', 0, -26);
    ctx.font = 'bold 22px sans-serif';
    ctx.fillText('VERIFIED', 0, 6);
    ctx.font = 'bold 14px sans-serif';
    ctx.fillText('CREDENTIAL', 0, 32);
    ctx.restore();

    // Right: Sarah Lin
    ctx.fillStyle = '#1e293b';
    ctx.font = 'italic 52px serif';
    ctx.fillText('Sarah Lin', 1920, 1160);

    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(1740, 1190);
    ctx.lineTo(2100, 1190);
    ctx.stroke();

    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 24px sans-serif';
    ctx.fillText('Sarah Lin', 1920, 1230);
    ctx.fillStyle = '#64748b';
    ctx.font = '20px sans-serif';
    ctx.fillText('Director of Education, CUT / CRAFT Academy', 1920, 1265);

    // Footer Metadata
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(160, 1420);
    ctx.lineTo(2240, 1420);
    ctx.stroke();

    ctx.textAlign = 'left';
    ctx.fillStyle = '#64748b';
    ctx.font = '22px sans-serif';
    ctx.fillText(`Issue Date: ${dateStr}`, 180, 1475);

    ctx.textAlign = 'center';
    ctx.fillText('Verify authentic credential at cutcraft.studio/credentials', 1200, 1475);

    ctx.textAlign = 'right';
    ctx.font = 'bold 22px monospace';
    ctx.fillText(`Credential ID: ${credentialId}`, 2220, 1475);

    // Trigger instant download
    const link = document.createElement('a');
    link.download = `CUT_CRAFT_Certificate_${(studentName || 'Student').replace(/\s+/g, '_')}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  };

  const portalContent = (
    <div className="certificate-portal-root fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-950/85 p-4 sm:p-6 backdrop-blur-md">
      {/* Scoped print styling ensuring single landscape page */}
      <style>{`
        @media print {
          @page {
            size: landscape;
            margin: 0 !important;
          }
          html, body {
            margin: 0 !important;
            padding: 0 !important;
            width: 100vw !important;
            height: 100vh !important;
            overflow: hidden !important;
            background: #ffffff !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          body.certificate-modal-open #root {
            display: none !important;
          }
          .certificate-portal-root {
            position: fixed !important;
            inset: 0 !important;
            width: 100vw !important;
            height: 100vh !important;
            padding: 0 !important;
            margin: 0 !important;
            background: #ffffff !important;
            display: flex !important;
            align-items: center !important;
            justify-content: center !important;
            z-index: 999999 !important;
          }
          .certificate-print-wrapper {
            width: 100vw !important;
            height: 100vh !important;
            max-width: none !important;
            margin: 0 !important;
            padding: 0 !important;
          }
          #certificate-print-area {
            width: 100vw !important;
            height: 100vh !important;
            max-width: none !important;
            margin: 0 !important;
            box-shadow: none !important;
            border-radius: 0 !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
            page-break-after: avoid !important;
            break-after: avoid !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .print-hidden,
          .print\\:hidden {
            display: none !important;
          }
        }
      `}</style>

      <div className="certificate-print-wrapper relative w-full max-w-4xl animate-in fade-in zoom-in-95 duration-200">
        {/* Certificate Actions Bar */}
        <div className="mb-3 flex items-center justify-between print:hidden">
          <div className="flex items-center gap-2 text-white">
            <Award className="text-orange-400" size={22} />
            <span className="font-black text-xs uppercase tracking-wider">
              Official Academy Credential
            </span>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={handleDownloadImage}
              className="bg-white/10 text-white hover:bg-white/20 border-white/10 text-xs"
            >
              <Download size={14} />
              <span>Download Image (PNG)</span>
            </Button>

            <Button
              variant="primary"
              size="sm"
              onClick={handlePrint}
              className="bg-orange-500 text-white hover:bg-orange-600 text-xs"
            >
              <Printer size={14} />
              <span>Print / Save PDF</span>
            </Button>

            <button
              onClick={onClose}
              className="rounded-xl p-2 text-slate-400 transition hover:bg-white/10 hover:text-white"
              aria-label="Close certificate modal"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* The Printable Certificate Box in Widescreen Landscape */}
        <div
          id="certificate-print-area"
          style={{
            WebkitPrintColorAdjust: 'exact',
            printColorAdjust: 'exact',
          }}
          className="relative aspect-[1.414/1] w-full overflow-hidden rounded-2xl border-4 border-amber-600/40 bg-[#fffdfa] p-3 sm:p-5 shadow-2xl text-slate-900"
        >
          {/* Inner Double Charcoal & Gold Frame */}
          <div className="relative flex size-full flex-col justify-between rounded-xl border-4 sm:border-8 border-slate-950 p-5 sm:p-8 bg-[#fffdfa]">
            {/* Fine Inner Accent Border */}
            <div className="pointer-events-none absolute inset-2 rounded-lg border border-amber-600/60" />

            {/* 4 Corner Filigree Ornaments */}
            <CornerOrnament className="top-3 left-3" />
            <CornerOrnament className="top-3 right-3 rotate-90" />
            <CornerOrnament className="bottom-3 right-3 rotate-180" />
            <CornerOrnament className="bottom-3 left-3 -rotate-90" />

            {/* Subtle Center Watermark */}
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center opacity-[0.03]">
              <Award size={360} />
            </div>

            {/* Header Section */}
            <div className="relative z-10 text-center">
              <div className="mx-auto mb-1 flex size-10 items-center justify-center rounded-xl bg-gradient-to-tr from-amber-600 to-orange-500 text-white shadow-md shadow-orange-500/20">
                <Award size={20} />
              </div>

              <p className="text-[10px] sm:text-xs font-black uppercase tracking-[0.25em] text-orange-600">
                CUT / CRAFT ACADEMY OF POST-PRODUCTION
              </p>

              <h2 className="mt-1 font-serif text-2xl sm:text-4xl font-extrabold tracking-tight text-slate-950">
                Certificate of Completion
              </h2>

              {/* Diamond Divider */}
              <div className="mx-auto my-2.5 flex items-center justify-center gap-3">
                <div className="h-0.5 w-16 sm:w-28 bg-gradient-to-r from-transparent to-amber-500" />
                <div className="size-2 rotate-45 bg-amber-600" />
                <div className="h-0.5 w-16 sm:w-28 bg-gradient-to-l from-transparent to-amber-500" />
              </div>

              <p className="text-[10px] sm:text-xs uppercase tracking-widest font-bold text-slate-500">
                This certificate is proudly conferred upon
              </p>

              {/* Student Name */}
              <h3 className="mt-2 font-serif text-2xl sm:text-4xl font-bold tracking-normal text-amber-950">
                {studentName || 'Student'}
              </h3>

              <div className="mx-auto mt-1 h-0.5 w-48 sm:w-72 bg-gradient-to-r from-transparent via-amber-400 to-transparent" />

              {/* Citation Body */}
              <p className="mx-auto mt-2 max-w-xl text-[10px] sm:text-xs leading-relaxed text-slate-600">
                for demonstrating technical post-production discipline, mastering timeline pace, narrative cutting,
                and successfully completing all video challenges and mentor reviews in the cohort:
              </p>

              {/* Cohort Plaque */}
              <div className="mt-2.5 inline-block rounded-xl border border-amber-300 bg-amber-50 px-5 py-1.5 shadow-2xs">
                <span className="font-extrabold text-xs sm:text-sm text-slate-950">{cohortName}</span>
              </div>
            </div>

            {/* Bottom Row: Signatures & Gold Seal */}
            <div className="relative z-10 grid grid-cols-3 items-end gap-2 border-t border-slate-200/80 pt-3 sm:pt-4">
              {/* Left: Lead Instructor */}
              <div className="text-center">
                <svg
                  className="mx-auto h-7 sm:h-8 w-28 sm:w-36"
                  viewBox="0 0 160 40"
                  fill="none"
                  stroke="#1e293b"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M10 28 C 15 10, 22 8, 26 32 C 28 36, 32 20, 42 22 C 48 24, 52 14, 58 26 C 64 30, 72 20, 80 22 M 20 22 L 35 22 M 95 12 C 90 28, 100 34, 110 24 C 118 16, 126 30, 134 22 C 140 18, 148 24, 155 18" />
                </svg>
                <div className="mx-auto h-px w-24 sm:w-36 bg-slate-300" />
                <p className="mt-1 text-[11px] font-bold text-slate-900">Alex Vance</p>
                <p className="text-[9px] sm:text-[10px] text-slate-400">Lead Instructor, CUT / CRAFT</p>
              </div>

              {/* Center: Official Embossed Seal */}
              <div className="flex flex-col items-center justify-center">
                <div className="relative flex size-14 sm:size-16 items-center justify-center rounded-full bg-gradient-to-br from-amber-400 via-amber-500 to-amber-700 p-0.5 shadow-md shadow-amber-600/20 ring-2 sm:ring-4 ring-amber-300/40">
                  <div className="flex size-full flex-col items-center justify-center rounded-full border border-dashed border-amber-100 bg-amber-600 text-white">
                    <ShieldCheck size={18} className="text-yellow-200" />
                    <span className="text-[6px] font-black uppercase tracking-wider text-amber-100">
                      OFFICIAL SEAL
                    </span>
                  </div>
                </div>
                <span className="mt-1 text-[8px] sm:text-[9px] font-black uppercase tracking-widest text-amber-800">
                  VERIFIED CREDENTIAL
                </span>
              </div>

              {/* Right: Director of Education */}
              <div className="text-center">
                <svg
                  className="mx-auto h-7 sm:h-8 w-28 sm:w-36"
                  viewBox="0 0 160 40"
                  fill="none"
                  stroke="#1e293b"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M15 15 C 8 22, 14 32, 28 30 C 38 28, 45 16, 52 24 C 58 30, 68 22, 75 26 M 90 8 C 92 24, 94 34, 96 32 C 102 24, 115 16, 124 28 C 132 22, 142 26, 152 20" />
                </svg>
                <div className="mx-auto h-px w-24 sm:w-36 bg-slate-300" />
                <p className="mt-1 text-[11px] font-bold text-slate-900">Sarah Lin</p>
                <p className="text-[9px] sm:text-[10px] text-slate-400">Director of Education</p>
              </div>
            </div>

            {/* Footer Metadata */}
            <div className="relative z-10 mt-2 flex items-center justify-between border-t border-slate-100 pt-2 text-[9px] sm:text-[10px] text-slate-400">
              <span>
                Issue Date: <strong className="text-slate-600">{dateStr}</strong>
              </span>
              <span className="hidden sm:inline text-slate-400">
                Verify authentic credential at cutcraft.studio/credentials
              </span>
              <span>
                Credential ID: <code className="font-mono font-bold text-slate-700">{credentialId}</code>
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(portalContent, document.body);
}

// Ornate Corner Filigree Ornament Component
function CornerOrnament({ className }: { className: string }) {
  return (
    <svg
      className={`pointer-events-none absolute size-8 text-amber-600/75 ${className}`}
      viewBox="0 0 40 40"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
    >
      <path d="M 4 36 L 4 4 L 36 4" />
      <path d="M 7 32 L 7 7 L 32 7" />
      <circle cx="14" cy="14" r="2.5" fill="currentColor" />
      <path d="M 4 4 L 18 18" />
    </svg>
  );
}
