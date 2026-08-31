import React, { useEffect, useState } from 'react';
import { registerPlugin } from '@capacitor/core';

interface VowIconPlugin {
  setColour(options: { colour: 'white' | 'black' | 'gold' | 'blue' }): Promise<{ colour: string }>;
}

const VowIcon = registerPlugin<VowIconPlugin>('VowIcon');
const ICON_COLOURS = [
  { name: 'White', value: 'white' as const, colour: '#FFFFFF' },
  { name: 'Black', value: 'black' as const, colour: '#000000' },
  { name: 'Gold', value: 'gold' as const, colour: '#D4AF37' },
  { name: 'Blue', value: 'blue' as const, colour: '#2563EB' },
];

export function ProfilePage({ onLegal }: { onLegal?: () => void }) {
  const [iconColour, setIconColour] = useState<'white' | 'black' | 'gold' | 'blue'>('white');
  const [iconChanging, setIconChanging] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem('vow-icon-colour') as typeof iconColour | null;
    if (saved && ICON_COLOURS.some((option) => option.value === saved)) setIconColour(saved);
  }, []);

  async function selectIcon(colour: typeof iconColour) {
    if (iconChanging || colour === iconColour) return;
    setIconChanging(true);
    try {
      await VowIcon.setColour({ colour });
      localStorage.setItem('vow-icon-colour', colour);
      setIconColour(colour);
      window.dispatchEvent(new CustomEvent('vow-icon-colour-change', { detail: colour }));
    } catch (error) {
      console.error('[VOW] Failed to change launcher icon:', error);
    } finally {
      setIconChanging(false);
    }
  }

  return (
    <div className="min-h-screen bg-vow-bg text-vow-text px-5 py-6">
      <div className="max-w-xl mx-auto space-y-6">
        <header>
          <h1 className="text-2xl font-semibold">Profile</h1>
          <p className="text-sm opacity-60 mt-1">Your VOW account and preferences</p>
        </header>

        <section className="rounded-2xl border border-current/10 p-5 space-y-5">
          <div>
            <h2 className="text-lg font-semibold">Customise</h2>
            <p className="text-sm opacity-60 mt-1">Personalise how VOW appears on your device.</p>
          </div>

          <div className="space-y-3">
            <div>
              <div className="text-sm font-medium">VOW Icon</div>
              <p className="text-xs opacity-50 mt-1">Choose the colour of the VOW launcher icon.</p>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {ICON_COLOURS.map((option) => {
                const selected = iconColour === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    aria-label={`Use ${option.name} VOW icon`}
                    aria-pressed={selected}
                    disabled={iconChanging}
                    onClick={() => selectIcon(option.value)}
                    className={`rounded-2xl border p-3 flex flex-col items-center gap-2 transition-all ${selected ? 'border-current ring-2 ring-current/20' : 'border-current/10 hover:bg-current/5'}`}
                  >
                    <span className="w-14 h-14 rounded-xl bg-neutral-900 dark:bg-white flex items-center justify-center overflow-hidden">
                      <span style={{ color: option.colour, fontSize: '46px', lineHeight: 1, fontWeight: 700, transform: 'translateY(-1px) scaleX(1.08)' }}>&gt;</span>
                    </span>
                    <span className="text-xs font-medium">{option.name}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </section>

        {onLegal && (
          <button type="button" onClick={onLegal} className="text-sm opacity-60 hover:opacity-100">
            Legal
          </button>
        )}
      </div>
    </div>
  );
}
