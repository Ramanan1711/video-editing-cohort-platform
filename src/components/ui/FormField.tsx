import type { InputHTMLAttributes } from 'react';

interface FormFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  hint?: string;
}

export function FormField({ label, hint, id, ...props }: FormFieldProps) {
  return <label className="block text-left" htmlFor={id}><span className="mb-2 block text-sm font-bold text-slate-700 dark:text-slate-300">{label}</span><input id={id} className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-orange-400 focus:ring-4 focus:ring-orange-500/10 dark:border-slate-800 dark:bg-slate-900 dark:text-white dark:placeholder:text-slate-500" {...props} />{hint && <span className="mt-1.5 block text-xs text-slate-400 dark:text-slate-500">{hint}</span>}</label>;
}