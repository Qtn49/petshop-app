'use client';

import { ExternalLink, Mail, MessageCircle, MessageSquare, Lightbulb } from 'lucide-react';

const communicationApps = [
  {
    id: 'outlook',
    name: 'Outlook',
    description: 'Check your email and calendar from Microsoft Outlook.',
    href: 'https://outlook.office.com',
    icon: Mail,
    iconBg: 'bg-sky-100',
    iconColor: 'text-sky-600',
  },
  {
    id: 'messages',
    name: 'Messages',
    description: 'Open iMessage / Messages.app on your Mac.',
    href: 'imessage://',
    icon: MessageCircle,
    iconBg: 'bg-green-100',
    iconColor: 'text-green-600',
  },
  {
    id: 'messenger',
    name: 'Messenger',
    description: 'Chat with contacts on Facebook Messenger.',
    href: 'https://messenger.com',
    icon: MessageSquare,
    iconBg: 'bg-blue-100',
    iconColor: 'text-blue-600',
  },
];

export default function CommunicationsPage() {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-slate-800">Communications</h1>
        <p className="text-slate-500 mt-1">Quick access to your messaging and email apps</p>
      </header>

      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 flex items-start gap-3">
        <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center flex-shrink-0">
          <Lightbulb className="w-5 h-5 text-amber-600" />
        </div>
        <div>
          <p className="font-medium text-amber-900">Tip: Use Texts.app to see all your messages in one place</p>
          <a
            href="https://texts.blog"
            target="_blank"
            rel="noopener noreferrer"
            className="text-amber-700 hover:text-amber-800 text-sm font-medium inline-flex items-center gap-1 mt-1"
          >
            texts.blog
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {communicationApps.map((app) => {
          const Icon = app.icon;
          return (
            <a
              key={app.id}
              href={app.href}
              target="_blank"
              rel="noopener noreferrer"
              className="bg-white rounded-xl border border-slate-200 p-6 flex flex-col gap-4 hover:border-primary-300 hover:shadow-md transition group"
            >
              <div
                className={`w-12 h-12 rounded-xl ${app.iconBg} flex items-center justify-center flex-shrink-0`}
              >
                <Icon className={`w-6 h-6 ${app.iconColor}`} />
              </div>
              <div>
                <h2 className="font-semibold text-slate-800 text-lg">{app.name}</h2>
                <p className="text-slate-500 text-sm mt-1">{app.description}</p>
              </div>
              <span className="inline-flex items-center gap-2 text-primary-600 font-medium text-sm group-hover:underline">
                Open {app.name}
                <ExternalLink className="w-4 h-4" />
              </span>
            </a>
          );
        })}
      </div>
    </div>
  );
}
