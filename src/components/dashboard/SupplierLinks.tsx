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
    <div className="overflow-hidden h-full flex flex-col">
      <div className="p-4 border-b border-amber-50/90 flex items-center justify-between">
        <h2 className="font-semibold text-stone-800">Saved Links</h2>
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
                className="flex items-center gap-3 p-3 rounded-xl border border-amber-100/80 hover:border-amber-200 hover:bg-amber-50/50 transition hover:scale-[1.01]"
              >
                <span className="flex-1 font-medium text-stone-800 truncate">
                  {link.name}
                </span>
                <ExternalLink className="w-4 h-4 text-stone-400 flex-shrink-0" />
              </a>
            </li>
          ))}
          {links.length === 0 && (
            <p className="text-stone-500 text-sm py-4 text-center">
              No saved links yet. <a href="/suppliers" className="text-primary-600">Add some</a>
            </p>
          )}
        </ul>
      </div>
    </div>
  );
}
