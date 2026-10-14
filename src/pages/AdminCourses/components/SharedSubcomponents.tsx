import type { ReactNode } from 'react';
import {
  Eye,
  FileArchive,
  FileText,
  Image as ImageIcon,
  Lock,
  Paperclip,
  Video,
} from 'lucide-react';
import { Card } from '../../../components/ui/Card';
import type { ResourceType, VisibilityRule } from '../../../lib/courseService';

export function StatCard({ label, value, icon }: { label: string; value: number; icon: ReactNode }) {
  return (
    <Card className="flex items-center justify-between p-5 shadow-sm">
      <div>
        <p className="text-xs font-bold uppercase tracking-wider text-slate-400">{label}</p>
        <p className="mt-1 text-2xl font-black text-slate-950">{value}</p>
      </div>
      <div className="flex size-10 items-center justify-center rounded-xl bg-slate-100/70">{icon}</div>
    </Card>
  );
}

export function VisibilityBadge({ rule }: { rule: VisibilityRule }) {
  if (rule === 'after_completion') {
    return (
      <span className="inline-flex items-center gap-1 rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-bold text-amber-700">
        <Lock size={10} /> Locked until complete
      </span>
    );
  }
  if (rule === 'public') {
    return (
      <span className="inline-flex items-center gap-1 rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] font-bold text-emerald-700">
        <Eye size={10} /> Public Preview
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded bg-blue-50 px-1.5 py-0.5 text-[10px] font-bold text-blue-700">
      Enrolled only
    </span>
  );
}

export function ResourceIcon({ type }: { type?: ResourceType }) {
  switch (type) {
    case 'video':
      return <Video size={16} className="text-emerald-500" />;
    case 'pdf':
      return <FileText size={16} className="text-red-500" />;
    case 'document':
      return <FileText size={16} className="text-blue-500" />;
    case 'image':
      return <ImageIcon size={16} className="text-purple-500" />;
    case 'project_file':
      return <FileArchive size={16} className="text-orange-500" />;
    default:
      return <Paperclip size={16} className="text-slate-400" />;
  }
}

export function FormField({
  label,
  value,
  onChange,
  type = 'text',
  placeholder,
  required,
  min,
}: {
  label: string;
  value: string;
  onChange: (val: string) => void;
  type?: string;
  placeholder?: string;
  required?: boolean;
  min?: string;
}) {
  return (
    <label className="block text-left">
      <span className="mb-1.5 block text-sm font-bold text-slate-700">
        {label} {required && <span className="text-red-500">*</span>}
      </span>
      <input
        type={type}
        min={min}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        required={required}
        className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-950 outline-none transition focus:border-orange-400 focus:ring-4 focus:ring-orange-500/10"
      />
    </label>
  );
}

export function TextareaField({
  label,
  value,
  onChange,
  placeholder,
  rows = 3,
  required,
}: {
  label: string;
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
  rows?: number;
  required?: boolean;
}) {
  return (
    <label className="block text-left">
      <span className="mb-1.5 block text-sm font-bold text-slate-700">
        {label} {required && <span className="text-red-500">*</span>}
      </span>
      <textarea
        rows={rows}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        required={required}
        className="w-full resize-none rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-950 outline-none transition focus:border-orange-400 focus:ring-4 focus:ring-orange-500/10"
      />
    </label>
  );
}
