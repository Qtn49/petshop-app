'use client';

import Link from 'next/link';
import { Building2, Link2 } from 'lucide-react';

export default function InitialScreen() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 p-4">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-slate-800">Pet Shop Manager</h1>
          <p className="text-slate-500 mt-1">Get started by creating or connecting to an organization</p>
        </div>

        <div className="grid gap-4">
          <Link
            href="/onboarding"
            className="flex items-center gap-4 p-6 rounded-xl border-2 border-slate-200 bg-white hover:border-primary-500 hover:bg-primary-50/50 transition text-left"
          >
            <div className="w-12 h-12 rounded-full bg-primary-100 flex items-center justify-center flex-shrink-0">
              <Building2 className="w-6 h-6 text-primary-600" />
            </div>
            <div>
              <h2 className="font-semibold text-slate-800">Create a new organization</h2>
              <p className="text-sm text-slate-600 mt-0.5">Set up your company and admin account from scratch</p>
            </div>
          </Link>

          <Link
            href="/connect"
            className="flex items-center gap-4 p-6 rounded-xl border-2 border-slate-200 bg-white hover:border-primary-500 hover:bg-primary-50/50 transition text-left"
          >
            <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center flex-shrink-0">
              <Link2 className="w-6 h-6 text-slate-600" />
            </div>
            <div>
              <h2 className="font-semibold text-slate-800">Connect to an existing organization</h2>
              <p className="text-sm text-slate-600 mt-0.5">Sign in with your organization and user account</p>
            </div>
          </Link>
        </div>
      </div>
    </div>
  );
}
