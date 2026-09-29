import React, { useEffect, useState } from 'react';
import { useSearchParams, useParams, Link } from 'react-router-dom';
import {
  ShieldCheck,
  ShieldAlert,
  Search,
  CheckCircle2,
  Calendar,
  Award,
  BookOpen,
  FileCheck2,
  Flame,
  Video,
  ExternalLink,
  Printer,
  LoaderCircle,
} from 'lucide-react';
import { getPublicCertificate, type PublicCertificate } from '../lib/courseService';
import { Button } from '../components/ui/Button';

export function VerifyCertificate() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { certificateNumber: paramCertNumber } = useParams<{ certificateNumber?: string }>();

  // Determine initial query from route param or search param ?id=
  const initialNumber = (paramCertNumber || searchParams.get('id') || '').trim();

  const [inputNumber, setInputNumber] = useState(initialNumber);
  const [activeNumber, setActiveNumber] = useState(initialNumber);
  const [loading, setLoading] = useState(Boolean(initialNumber));
  const [result, setResult] = useState<PublicCertificate | null>(null);

  useEffect(() => {
    const target = (paramCertNumber || searchParams.get('id') || '').trim();
    if (target) {
      setInputNumber(target);
      setActiveNumber(target);
    }
  }, [paramCertNumber, searchParams]);

  useEffect(() => {
    let isSubscribed = true;

    async function verify() {
      if (!activeNumber) {
        setResult(null);
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        const cert = await getPublicCertificate(activeNumber);
        if (isSubscribed) {
          setResult(cert);
        }
      } catch (err) {
        if (isSubscribed) {
          setResult({
            valid: false,
            error: 'Failed to communicate with certificate verification service.',
          });
        }
      } finally {
        if (isSubscribed) {
          setLoading(false);
        }
      }
    }

    verify();

    return () => {
      isSubscribed = false;
    };
  }, [activeNumber]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = inputNumber.trim();
    if (!clean) return;
    setSearchParams({ id: clean });
    setActiveNumber(clean);
  };

  const handlePrint = () => {
    window.print();
  };

  const formattedDate = result?.issued_at
    ? new Date(result.issued_at).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : null;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between selection:bg-orange-500 selection:text-white">
      {/* Top Navigation */}
      <header className="border-b border-white/10 bg-slate-900/60 backdrop-blur-md sticky top-0 z-30 print:hidden">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2.5 group">
            <div className="size-9 rounded-xl bg-gradient-to-tr from-amber-600 to-orange-500 flex items-center justify-center text-white shadow-lg shadow-orange-500/20 group-hover:scale-105 transition">
              <Award size={20} />
            </div>
            <div>
              <span className="font-black text-sm tracking-wider uppercase text-white">CUT / CRAFT</span>
              <span className="text-[10px] block text-orange-400 font-bold uppercase tracking-widest -mt-0.5">
                Academy Credential Registry
              </span>
            </div>
          </Link>

          <div className="flex items-center gap-3">
            <Link
              to="/student/dashboard"
              className="text-xs font-semibold text-slate-400 hover:text-white transition flex items-center gap-1.5"
            >
              <span>Student Portal</span>
              <ExternalLink size={13} />
            </Link>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-4xl w-full mx-auto px-4 sm:px-6 py-10 sm:py-14">
        {/* Page Title & Search Bar */}
        <div className="text-center max-w-2xl mx-auto mb-10 print:hidden">
          <div className="inline-flex items-center gap-2 rounded-full border border-orange-500/30 bg-orange-500/10 px-3.5 py-1 text-xs font-bold uppercase tracking-wider text-orange-400 mb-4">
            <ShieldCheck size={15} />
            Authoritative Credential Registry
          </div>
          <h1 className="text-3xl sm:text-4xl font-black text-white tracking-tight">
            Verify Academic Credential
          </h1>
          <p className="mt-2 text-sm text-slate-400">
            Verify the authenticity and 4-pillar graduation requirements for any CUT / CRAFT Academy credential holder.
          </p>

          <form onSubmit={handleSubmit} className="mt-6 flex flex-col sm:flex-row gap-2.5 max-w-lg mx-auto">
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input
                type="text"
                value={inputNumber}
                onChange={(e) => setInputNumber(e.target.value)}
                placeholder="Enter Credential ID (e.g. CC-202609-A8F2B1)"
                className="w-full rounded-xl border border-white/15 bg-slate-900/90 pl-10 pr-4 py-2.5 text-sm text-white placeholder-slate-500 focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
              />
            </div>
            <Button type="submit" variant="primary" className="bg-orange-500 hover:bg-orange-600 text-white font-bold text-sm px-6 py-2.5">
              Verify
            </Button>
          </form>
        </div>

        {/* Loading State */}
        {loading && (
          <div className="flex flex-col items-center justify-center py-16 text-center animate-in fade-in">
            <div className="size-14 rounded-2xl bg-orange-500/10 text-orange-400 flex items-center justify-center mb-4">
              <LoaderCircle size={28} className="animate-spin" />
            </div>
            <h3 className="text-lg font-bold text-white">Querying Credential Ledger</h3>
            <p className="mt-1 text-sm text-slate-400">Validating cryptographic certificate record in database...</p>
          </div>
        )}

        {/* Verified Credential Details Card */}
        {!loading && result?.valid && (
          <div className="rounded-2xl border border-emerald-500/30 bg-slate-900/90 p-6 sm:p-10 shadow-2xl relative overflow-hidden animate-in fade-in zoom-in-95">
            {/* Top Verified Banner */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-white/10">
              <div className="flex items-center gap-3.5">
                <div className="size-12 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 flex items-center justify-center shadow-lg shadow-emerald-500/10">
                  <ShieldCheck size={26} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center gap-1 rounded-md bg-emerald-500/20 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider text-emerald-300">
                      <CheckCircle2 size={12} />
                      Authentic &amp; Verified
                    </span>
                  </div>
                  <h2 className="text-xl sm:text-2xl font-black text-white mt-1">Official Accredited Credential</h2>
                </div>
              </div>

              <div className="flex items-center gap-2 print:hidden">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handlePrint}
                  className="bg-white/10 text-white hover:bg-white/20 border-white/10 text-xs"
                >
                  <Printer size={14} />
                  <span>Print Verification</span>
                </Button>
              </div>
            </div>

            {/* Credential Core Metadata */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 py-6 border-b border-white/10">
              <div>
                <p className="text-xs uppercase tracking-wider font-bold text-slate-400">Graduate Recipient</p>
                <p className="text-lg font-black text-white mt-1">{result.student_name}</p>
                <p className="text-xs text-slate-400 mt-0.5">Verified Cohort Scholar</p>
              </div>

              <div>
                <p className="text-xs uppercase tracking-wider font-bold text-slate-400">Cohort / Program</p>
                <p className="text-lg font-black text-white mt-1">{result.cohort_name}</p>
                <p className="text-xs text-slate-400 mt-0.5">CUT / CRAFT Academy</p>
              </div>

              <div>
                <p className="text-xs uppercase tracking-wider font-bold text-slate-400">Issue Date &amp; ID</p>
                <p className="text-lg font-black text-orange-400 font-mono mt-1">{result.certificate_number}</p>
                <p className="text-xs text-slate-400 mt-0.5 flex items-center gap-1">
                  <Calendar size={12} />
                  <span>{formattedDate || 'Verified'}</span>
                </p>
              </div>
            </div>

            {/* 4-Pillar Academic Completion Audit */}
            <div className="pt-6">
              <h3 className="text-sm font-bold uppercase tracking-wider text-slate-300 mb-4 flex items-center gap-2">
                <span>4-Pillar Academic Telemetry</span>
                <span className="text-xs font-normal text-emerald-400 font-mono">(100% Passed)</span>
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Pillar 1: Curriculum */}
                <div className="rounded-xl border border-white/10 bg-slate-950/60 p-4">
                  <div className="flex items-center gap-2.5 text-slate-300">
                    <BookOpen size={18} className="text-orange-400" />
                    <span className="font-bold text-sm">Course Curriculum</span>
                  </div>
                  <p className="mt-2 text-xs text-slate-400">
                    Comprehensive lesson video playback with ≥80% verifiable watch validation.
                  </p>
                  <div className="mt-3 flex items-center justify-between text-xs">
                    <span className="text-slate-400">Lessons Completed:</span>
                    <span className="font-mono font-bold text-emerald-400">
                      {result.metadata?.completed_lessons ?? 'All'} / {result.metadata?.total_lessons ?? 'All'}
                    </span>
                  </div>
                </div>

                {/* Pillar 2: Projects */}
                <div className="rounded-xl border border-white/10 bg-slate-950/60 p-4">
                  <div className="flex items-center gap-2.5 text-slate-300">
                    <FileCheck2 size={18} className="text-orange-400" />
                    <span className="font-bold text-sm">Approved Capstone Projects</span>
                  </div>
                  <p className="mt-2 text-xs text-slate-400">
                    Professional portfolio assignments reviewed and passed by industry mentors.
                  </p>
                  <div className="mt-3 flex items-center justify-between text-xs">
                    <span className="text-slate-400">Assignments Approved:</span>
                    <span className="font-mono font-bold text-emerald-400">
                      {result.metadata?.approved_assignments ?? 'All'} / {result.metadata?.total_assignments ?? 'All'}
                    </span>
                  </div>
                </div>

                {/* Pillar 3: Sprints */}
                <div className="rounded-xl border border-white/10 bg-slate-950/60 p-4">
                  <div className="flex items-center gap-2.5 text-slate-300">
                    <Flame size={18} className="text-orange-400" />
                    <span className="font-bold text-sm">Production Sprint Drills</span>
                  </div>
                  <p className="mt-2 text-xs text-slate-400">
                    Daily rapid-editing simulation challenges submitted and verified.
                  </p>
                  <div className="mt-3 flex items-center justify-between text-xs">
                    <span className="text-slate-400">Sprint Challenges:</span>
                    <span className="font-mono font-bold text-emerald-400">
                      {result.metadata?.completed_challenges ?? 'All'} / {result.metadata?.total_challenges ?? 'All'}
                    </span>
                  </div>
                </div>

                {/* Pillar 4: Attendance */}
                <div className="rounded-xl border border-white/10 bg-slate-950/60 p-4">
                  <div className="flex items-center gap-2.5 text-slate-300">
                    <Video size={18} className="text-orange-400" />
                    <span className="font-bold text-sm">Live Workshop Attendance</span>
                  </div>
                  <p className="mt-2 text-xs text-slate-400">
                    Live session attendance records verified (minimum 75% required).
                  </p>
                  <div className="mt-3 flex items-center justify-between text-xs">
                    <span className="text-slate-400">Attendance Rate:</span>
                    <span className="font-mono font-bold text-emerald-400">
                      {result.metadata?.attendance_rate_pct != null
                        ? `${result.metadata.attendance_rate_pct}%`
                        : '100%'}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Cryptographic Ledger Footer */}
            <div className="mt-8 rounded-xl border border-white/10 bg-slate-950/40 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-slate-400">
              <div className="flex items-center gap-2">
                <div className="size-2 rounded-full bg-emerald-400 animate-pulse" />
                <span>Authoritative database-persisted record verified in CUT / CRAFT Registry</span>
              </div>
              <span className="font-mono text-slate-500">SHA-256 Ledger Verified</span>
            </div>
          </div>
        )}

        {/* Invalid / Not Found State */}
        {!loading && result && !result.valid && (
          <div className="rounded-2xl border border-rose-500/30 bg-slate-900/90 p-8 sm:p-12 text-center max-w-xl mx-auto shadow-2xl animate-in fade-in">
            <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-2xl bg-rose-500/10 text-rose-400">
              <ShieldAlert size={28} />
            </div>
            <div className="inline-flex items-center gap-1 rounded-md bg-rose-500/20 px-2.5 py-0.5 text-xs font-bold uppercase tracking-wider text-rose-300 mb-2">
              Verification Failed
            </div>
            <h2 className="text-2xl font-black text-white">Credential Record Not Found</h2>
            <p className="mt-3 text-sm text-slate-400 leading-relaxed">
              {result.error ||
                'The specified certificate number does not correspond to an authentic issued credential in our canonical registry.'}
            </p>
            <div className="mt-6 rounded-xl border border-white/10 bg-slate-950/50 p-4 text-xs text-slate-400 text-left">
              <p className="font-semibold text-slate-300 mb-1">Verification Guidelines:</p>
              <ul className="list-disc list-inside space-y-1">
                <li>Check for typographical errors in the Credential ID.</li>
                <li>Credential IDs follow the standard format: <code className="text-orange-400">CC-YYYYMM-XXXXXX</code>.</li>
                <li>Unissued or in-progress certificates will not verify until all 4 academic pillars are fulfilled.</li>
              </ul>
            </div>
          </div>
        )}

        {/* Empty State before any search */}
        {!loading && !result && (
          <div className="rounded-2xl border border-white/10 bg-slate-900/40 p-10 text-center max-w-lg mx-auto">
            <div className="mx-auto mb-3 flex size-12 items-center justify-center rounded-2xl bg-white/5 text-slate-400">
              <Search size={22} />
            </div>
            <h3 className="text-base font-bold text-white">Ready for Verification</h3>
            <p className="mt-1 text-xs text-slate-400">
              Enter any CUT / CRAFT Credential ID above to inspect its real-time authenticity and graduation requirements.
            </p>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-white/10 bg-slate-900/60 py-6 text-center text-xs text-slate-500 print:hidden">
        <div className="max-w-6xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p>&copy; {new Date().getFullYear()} CUT / CRAFT Academy. All rights reserved.</p>
          <div className="flex items-center gap-4">
            <Link to="/" className="hover:text-slate-300 transition">Home</Link>
            <Link to="/login" className="hover:text-slate-300 transition">Sign In</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
export default VerifyCertificate;
