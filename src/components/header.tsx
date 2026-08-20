import { useEffect, useState } from 'react';
import { getCredits } from '#/lib/credits';
import { getErrorMessage } from '#/lib/utils';
import { CreditsBadge } from './credits-badge';

type CreditsState =
  | { status: 'loading' }
  | { status: 'error'; error: string }
  | { status: 'success'; credits: string };

export function Header() {
  const [credits, setCredits] = useState<CreditsState>({ status: 'loading' });

  useEffect(() => {
    let cancelled = false;
    getCredits()
      .then((balance) => {
        if (!cancelled) setCredits({ status: 'success', credits: balance });
      })
      .catch((error: unknown) => {
        if (!cancelled) setCredits({ status: 'error', error: getErrorMessage(error) });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <header className="fixed z-10 top-0 left-0 bg-gray-100 border-b border-gray-300 py-4 w-full">
      <nav aria-label="main navigation" className="mx-auto px-6 max-w-5xl flex items-baseline">
        <div className="flex items-baseline gap-6">
          <a href="/" className="text-2xl font-normal leading-none">
            {' '}
            Translator
          </a>
        </div>

        <div className="ml-auto max-w-70 flex gap-4 justify-between items-center">
          <CreditsBadge {...credits} />
        </div>
      </nav>
    </header>
  );
}