import React from 'react';

export function ProfilePage({ onLegal }: { onLegal?: () => void }) {
  return (
    <div className="min-h-screen bg-vow-bg text-vow-text px-5 py-6">
      <div className="max-w-xl mx-auto space-y-6">
        <header>
          <h1 className="text-2xl font-semibold">Profile</h1>
          <p className="text-sm opacity-60 mt-1">Your VOW account and preferences</p>
        </header>

        <section className="rounded-2xl border border-current/10 p-5 space-y-4">
          <div>
            <h2 className="text-lg font-semibold">Customise</h2>
            <p className="text-sm opacity-60 mt-1">Personalise the VOW icon used throughout the app.</p>
          </div>

          <div className="space-y-3">
            <div className="text-sm font-medium">VOW Icon</div>
            <div className="grid grid-cols-4 gap-3">
              {[
                { name: 'White', value: '#FFFFFF' },
                { name: 'Black', value: '#000000' },
                { name: 'Gold', value: '#D4AF37' },
                { name: 'Blue', value: '#2563EB' },
              ].map((option) => (
                <button
                  key={option.name}
                  type="button"
                  aria-label={`Use ${option.name} VOW icon`}
                  onClick={() => {
                    localStorage.setItem('vow-icon-colour', option.name.toLowerCase());
                    window.dispatchEvent(new CustomEvent('vow-icon-colour-change', { detail: option.name.toLowerCase() }));
                  }}
                  className="rounded-2xl border border-current/10 p-3 flex flex-col items-center gap-2 hover:bg-current/5 transition-colors"
                >
                  <span className="w-14 h-14 rounded-xl bg-neutral-900/5 dark:bg-white/5 flex items-center justify-center overflow-hidden">
                    <span style={{ color: option.value, fontSize: '42px', lineHeight: 1, fontWeight: 700, transform: 'scaleX(1.08)' }}>&gt;</span>
                  </span>
                  <span className="text-xs">{option.name}</span>
                </button>
              ))}
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
