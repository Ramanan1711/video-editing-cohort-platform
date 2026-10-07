import type { HTMLAttributes, ReactNode } from 'react';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  className?: string;
}

export function Card({ children, className = '', ...props }: CardProps) {
  return <div className={`rounded-2xl border border-slate-200 bg-white dark:border-surface-subtle dark:bg-surface-card dark:text-slate-100 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.08)] ${className}`} {...props}>{children}</div>;
}