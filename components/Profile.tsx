import React, { useEffect, useState } from 'react';
import { registerPlugin } from '@capacitor/core';

const VowIcon = registerPlugin<{ setColour(options: { colour: string }): Promise<{ colour: string }> }>('VowIcon');

const ICON_COLOURS = [
  { name: 'White', value: 'white', fg: '#000000', bg: '#FFFFFF' },
  { name: 'Black', value: 'black', fg: '#FFFFFF', bg: '#000000' },
  { name: 'Gold', value: 'gold', fg: '#D4AF37', bg: '#000000' },
  { name: 'Blue', value: 'blue', fg: '#2563EB', bg: '#000000' },
] as const;

type IconColour = typeof ICON_COLOURS[number]['value'];

export function ProfilePage({ onLegal }: { onLegal?: () => void }) {
  const [customiseOpen, setCustomiseOpen] = useState(false);
  const [selected, setSelected] = useState<IconColour>(() => (localStorage.getItem('vow-icon-colour') as IconColour) || 'white');

  useEffect(() => {
    if (!customiseOpen) return;
    void VowIcon.setColour({ colour: selected }).catch(() => undefined);
  }, [customiseOpen, selected]);

  async function chooseIcon(colour: IconColour) {
    setSelected(colour);
    localStorage.setItem('vow-icon-colour', colour);
    try { await VowIcon.setColour({ colour }); } catch { /* Web preview has no native icon plugin. */ }
  }

  if (customiseOpen) {
    return (
      <div className="min-h-screen bg-vow-bg text-vow-text px-5 py-6">
        <div className="max-w-xl mx-auto space-y-6">
          <button type="button" onClick={() => setCustomiseOpen(false)} className="text-sm opacity-60 hover:opacity-100">← Profile</button>
          <header>
            <h1 className="text-2xl font-semibold">Customise</h1>
            <p className="text-sm opacity-60 mt-1">Personalise your VOW icon.</p>
          </header>
          <section className="rounded-2xl border border-current/10 p-5 space-y-5">
            <div><h2 className="text-lg font-semibold">VOW Icon</h2><p className="text-sm opacity-60 mt-1">Choose your VOW icon.</p></div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {ICON_COLOURS.map((option) => (
                <button key={option.value} type="button" onClick={() => void chooseIcon(option.value)} aria-pressed={selected === option.value} className={`rounded-2xl border p-3 flex flex-col items-center gap-2 ${selected === option.value ? 'border-current ring-2 ring-current/20' : 'border-current/10'}`}>
                  <span className="w-16 h-16 rounded-2xl flex items-center justify-center" style={{ background: option.bg }}>
                    <span style={{ color: option.fg, fontSize: 56, lineHeight: 0.8, fontWeight: 800, fontFamily: 'Arial, sans-serif' }}>&gt;</span>
                  </span>
                  <span className="text-xs font-medium">{option.name}</span>
                </button>
              ))}
            </div>
          </section>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-vow-bg text-vow-text px-5 py-6">
      <div className="max-w-xl mx-auto space-y-6">
        <header><h1 className="text-2xl font-semibold">Profile</h1><p className="text-sm opacity-60 mt-1">Your VOW account and preferences</p></header>
        <section className="rounded-2xl border border-current/10 overflow-hidden">
          <button type="button" onClick={() => setCustomiseOpen(true)} className="w-full px-5 py-4 flex items-center justify-between text-left hover:bg-current/5 transition-colors">
            <div><div className="text-base font-medium">Customise</div><div className="text-sm opacity-60 mt-1">Personalise your VOW experience</div></div>
            <span className="text-xl opacity-50">›</span>
          </button>
        </section>
        {onLegal && <button type="button" onClick={onLegal} className="text-sm opacity-60 hover:opacity-100">Legal</button>}
      </div>
    </div>
  );
}
