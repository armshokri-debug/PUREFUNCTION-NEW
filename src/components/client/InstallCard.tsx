import React, { useEffect, useState } from 'react';
import { Download, Plus, Share, X } from 'lucide-react';
import { InstallPlatform, installPlatform, isStandalone } from '../../lib/install';

const KEY = 'pf.install.dismissed';

interface InstallEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

/**
 * Shown to clients on phones/tablets until they put the app on their home screen
 * (or close the card). iPhones need Safari's Share menu; Android gets a real Install button.
 */
export const InstallCard: React.FC = () => {
  const [platform] = useState<InstallPlatform>(() => installPlatform(navigator.userAgent, navigator.maxTouchPoints));
  const [hidden, setHidden] = useState(() => {
    try {
      return !!localStorage.getItem(KEY) || isStandalone();
    } catch {
      return isStandalone();
    }
  });
  const [prompt, setPrompt] = useState<InstallEvent | null>(null);

  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setPrompt(e as InstallEvent);
    };
    const onInstalled = () => setHidden(true);
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  if (hidden || platform === 'desktop') return null;

  const dismiss = () => {
    try {
      localStorage.setItem(KEY, String(Date.now()));
    } catch {
      /* ignore */
    }
    setHidden(true);
  };

  const install = async () => {
    if (!prompt) return;
    await prompt.prompt();
    const { outcome } = await prompt.userChoice;
    if (outcome === 'accepted') setHidden(true);
    setPrompt(null);
  };

  return (
    <section aria-label="Add to home screen" className="relative mb-4 rounded-2xl border border-[#FEF3C7] bg-[#FFFDF5] p-4 pr-10">
      <button onClick={dismiss} aria-label="Close" className="absolute right-2 top-2 p-2 text-gray-400 hover:text-[#111827] cursor-pointer">
        <X className="w-4 h-4" />
      </button>
      <div className="text-sm font-bold text-[#111827] mb-1">Put Pure Function on your home screen</div>
      <p className="text-xs text-gray-600 mb-3">Opens in one tap, full screen, like an app.</p>

      {platform === 'ios-safari' && (
        <ol className="space-y-2 text-sm text-[#111827]">
          <li className="flex items-center gap-2">
            <span className="w-5 h-5 rounded-full bg-[#111827] text-[#FFC809] text-[11px] font-bold flex items-center justify-center shrink-0">1</span>
            Tap <Share className="w-4 h-4 inline text-[#2563EB]" aria-label="Share" /> at the bottom of Safari
          </li>
          <li className="flex items-center gap-2">
            <span className="w-5 h-5 rounded-full bg-[#111827] text-[#FFC809] text-[11px] font-bold flex items-center justify-center shrink-0">2</span>
            Scroll and tap <b className="inline-flex items-center gap-1"><Plus className="w-3.5 h-3.5" />Add to Home Screen</b>
          </li>
        </ol>
      )}

      {platform === 'ios-other' && (
        <p className="text-sm text-[#111827]">
          To install, open this page in <b>Safari</b> (copy the link and paste it there), then tap Share → Add to Home Screen.
        </p>
      )}

      {platform === 'android' &&
        (prompt ? (
          <button onClick={() => void install()} className="inline-flex items-center gap-2 bg-[#111827] text-white text-sm font-semibold px-4 py-2.5 rounded-xl cursor-pointer">
            <Download className="w-4 h-4 text-[#FFC809]" /> Install app
          </button>
        ) : (
          <p className="text-sm text-[#111827]">
            Tap the <b>⋮</b> menu in Chrome, then <b>Add to Home screen</b> (or <b>Install app</b>).
          </p>
        ))}
    </section>
  );
};
