import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { ArrowUpRight, LoaderCircle } from 'lucide-react';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'dark';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  variant?: ButtonVariant;
  size?: ButtonSize;
  href?: string;
  loading?: boolean;
  withArrow?: boolean;
}

const variants: Record<ButtonVariant, string> = {
  primary: 'bg-orange-500 text-white shadow-lg shadow-orange-500/20 hover:bg-orange-600',
  secondary: 'border border-slate-200 bg-white text-slate-900 hover:border-orange-300 hover:text-orange-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100 dark:hover:border-orange-500/50 dark:hover:text-orange-400',
  ghost: 'text-slate-600 hover:bg-slate-100 hover:text-slate-950 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100',
  dark: 'bg-slate-950 text-white shadow-lg shadow-slate-950/15 hover:bg-slate-800 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700',
};

const sizes: Record<ButtonSize, string> = {
  sm: 'px-3 py-1.5 text-xs',
  md: 'px-5 py-3 text-sm',
  lg: 'px-6 py-3.5 text-base',
};

export function Button({ children, variant = 'primary', size = 'md', href, loading = false, withArrow = false, className = '', disabled, ...props }: ButtonProps) {
  const content = <>{loading ? <LoaderCircle className="animate-spin" size={size === 'sm' ? 14 : 17} /> : children}{withArrow && !loading && <ArrowUpRight size={size === 'sm' ? 14 : 17} />}</>;
  const classes = `inline-flex items-center justify-center gap-2 rounded-xl font-bold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-500 disabled:cursor-not-allowed disabled:opacity-50 ${variants[variant]} ${sizes[size]} ${className}`;

  if (href) return <a className={classes} href={href}>{content}</a>;
  return <button className={classes} disabled={disabled || loading} {...props}>{content}</button>;
}