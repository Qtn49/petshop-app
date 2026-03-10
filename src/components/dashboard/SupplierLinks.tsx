'use client';

import { ExternalLink } from 'lucide-react';

type Link = {
  id: string;
  name: string;
  url: string;
};

export default function SupplierLinks({
  links,
  userId,
}: {
  links: Link[];
  userId?: string;
}) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      <div className="p-4 border-b border-slate-100 flex items-center justify-between">
        <h2 className="font-semibold text-slate-800">Saved Links</h2>
        <a
          href="/suppliers"
          className="text-sm text-primary-600 hover:text-primary-700 font-medium"
        >
          Manage
        </a>
      </div>
      <div className="p-4">
        <ul className="space-y-2">
          {links.map((link) => (
            <li key={link.id}>
              <a
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 p-3 rounded-lg border border-slate-100 hover:border-primary-200 hover:bg-primary-50 transition"
              >
                <span className="flex-1 font-medium text-slate-800 truncate">
                  {link.name}
                </span>
                <ExternalLink className="w-4 h-4 text-slate-400 flex-shrink-0" />
              </a>
            </li>
          ))}
          {links.length === 0 && (
            <p className="text-slate-500 text-sm py-4 text-center">
              No saved links yet. <a href="/suppliers" className="text-primary-600">Add some</a>
            </p>
          )}
        </ul>
      </div>
    </div>
  );
}
