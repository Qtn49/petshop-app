import { HTMLAttributes } from 'react';

type CardProps = HTMLAttributes<HTMLDivElement> & {
  title?: string;
};

export default function Card({ title, children, className = '', ...props }: CardProps) {
  return (
    <div
      className={`bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden ${className}`}
      {...props}
    >
      {title && (
        <div className="px-4 py-3 border-b border-slate-100">
          <h3 className="font-semibold text-slate-800">{title}</h3>
        </div>
      )}
      <div className="p-4">{children}</div>
    </div>
  );
}
