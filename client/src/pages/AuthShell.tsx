import type { ReactNode } from 'react';
import { ShieldCheck } from 'lucide-react';

/** Centered card layout shared by the public sign-in pages. */
export function AuthShell({ subtitle, children, footer }: { subtitle: string; children: ReactNode; footer?: ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center text-center">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-700 text-white">
            <ShieldCheck className="h-6 w-6" />
          </div>
          <h1 className="mt-3 text-lg font-semibold text-slate-900">Insurance Ad Manager</h1>
          <p className="text-sm text-slate-500">{subtitle}</p>
        </div>
        <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">{children}</div>
        {footer && <div className="mt-4 text-center text-sm">{footer}</div>}
      </div>
    </div>
  );
}
