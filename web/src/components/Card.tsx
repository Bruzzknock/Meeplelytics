import { PropsWithChildren, ReactNode } from 'react';
import { clsx } from 'clsx';

interface CardProps extends PropsWithChildren {
  title?: string;
  subtitle?: string;
  icon?: ReactNode;
  className?: string;
}

export function Card({ title, subtitle, icon, className, children }: CardProps) {
  return (
    <div className={clsx('rounded-xl border border-slate-800 bg-slate-900/60 p-6 shadow-lg shadow-slate-900/20', className)}>
      {(title || subtitle || icon) && (
        <div className="mb-4 flex items-center justify-between gap-4">
          <div>
            {title && <h3 className="text-lg font-semibold text-white">{title}</h3>}
            {subtitle && <p className="text-sm text-slate-400">{subtitle}</p>}
          </div>
          {icon && <div className="text-slate-400">{icon}</div>}
        </div>
      )}
      {children}
    </div>
  );
}
