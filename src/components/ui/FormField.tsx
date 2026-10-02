import type { InputHTMLAttributes } from 'react';

interface FormFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  hint?: string;
  labelClassName?: string;
  inputClassName?: string;
}

export function FormField({
  label,
  hint,
  id,
  className,
  labelClassName,
  inputClassName,
  ...props
}: FormFieldProps) {
  const mergedInputClass =
    inputClassName ||
    className ||
    'border border-slate-200 bg-white text-slate-950 placeholder:text-slate-400 focus:border-orange-400 focus:ring-4 focus:ring-orange-500/10 dark:border-slate-800 dark:bg-slate-900 dark:text-white dark:placeholder:text-slate-500';

  return (
    <label className="block text-left" htmlFor={id}>
      <span className={labelClassName || 'mb-2 block text-sm font-bold text-slate-700 dark:text-slate-300'}>
        {label}
      </span>
      <input
        id={id}
        className={`w-full rounded-xl px-4 py-3 text-sm outline-none transition ${mergedInputClass}`}
        {...props}
      />
      {hint && <span className="mt-1.5 block text-xs text-slate-400 dark:text-slate-500">{hint}</span>}
    </label>
  );
}