import Link from 'next/link';
import AuthBranding from '@/components/auth/AuthBranding';

const CONTACT_EMAIL = process.env.NEXT_PUBLIC_CONTACT_EMAIL ?? 'your-email@gmail.com';

export default function RegisterPage() {
  return (
    <div className="min-h-screen bg-auth-cream flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-amber-100 border border-amber-100/80 text-center">
        <AuthBranding
          title="Get your own Pet Shop Manager"
          subtitle="We'll help you get set up"
        />
        <p className="text-stone-600 leading-relaxed -mt-2 mb-6">
          Creating a new shop requires a subscription. Contact us and we&apos;ll get you set up within 24 hours.
        </p>
        <a
          href={`mailto:${CONTACT_EMAIL}`}
          className="inline-flex w-full justify-center items-center py-3.5 rounded-xl bg-primary-600 hover:bg-primary-700 text-white font-semibold shadow-md shadow-primary-600/20 transition-colors"
        >
          Contact us
        </a>
        <p className="mt-8 text-sm text-stone-500">
          <Link href="/login" className="text-primary-700 font-medium hover:text-primary-800 hover:underline">
            Already have a shop? Sign in →
          </Link>
        </p>
      </div>
    </div>
  );
}
