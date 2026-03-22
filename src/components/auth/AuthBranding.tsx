import { PawPrint } from 'lucide-react';

type Props = {
  subtitle: string;
  /** Shown under the wordmark (e.g. “Pet Shop Manager”). */
  title?: string;
};

/**
 * Same paw + “Pet Shop” row as the sidebar, plus optional app title line.
 */
export default function AuthBranding({ subtitle, title = 'Pet Shop Manager' }: Props) {
  return (
    <div className="text-center mb-8">
      <div className="flex items-center justify-center gap-2">
        <PawPrint className="h-8 w-8 text-amber-400 shrink-0" aria-hidden />
        <span className="font-bold text-2xl text-amber-400 tracking-tight">Pet Shop</span>
      </div>
      <h1 className="mt-2 text-lg font-semibold text-stone-800">{title}</h1>
      <p className="text-sm text-stone-500 mt-1">{subtitle}</p>
    </div>
  );
}
