import type { InputHTMLAttributes, ReactNode } from 'react';

interface FormFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  hint?: string;
  labelClassName?: string;
  inputClassName?: string;
  rightElement?: ReactNode;
}

export function FormField({
  label,
  hint,
  id,
  className,
  labelClassName,
  inputClassName,
  required,
  rightElement,
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
        {required && <span className="ml-1 text-red-500" aria-hidden="true">*</span>}
      </span>
      <div className="relative">
        <input
          id={id}
          aria-label={props['aria-label'] || label}
          required={required}
          className={`w-full rounded-xl px-4 py-3 text-sm outline-none transition ${rightElement ? 'pr-11' : ''} ${mergedInputClass}`}
          {...props}
        />
        {rightElement && (
          <div className="absolute inset-y-0 right-0 flex items-center pr-3.5">
            {rightElement}
          </div>
        )}
      </div>
      {hint && <span className="mt-1.5 block text-xs text-slate-400 dark:text-slate-500">{hint}</span>}
    </label>
  );
}