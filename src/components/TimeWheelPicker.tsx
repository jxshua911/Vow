import { useMemo, useRef, type TouchEvent, type WheelEvent } from 'react';

type TimeWheelPickerProps = {
  value: string;
  onChange: (value: string) => void;
  label?: string;
};

function parseTime(value: string) {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value);
  const hour = match ? Math.min(23, Math.max(0, Number(match[1]))) : 9;
  const minute = match ? Math.min(59, Math.max(0, Number(match[2]))) : 0;
  return { hour, minute };
}

function formatTime(hour: number, minute: number) {
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

function wrap(value: number, max: number) {
  return (value + max) % max;
}

export function TimeWheelPicker({ value, onChange, label = 'Session time' }: TimeWheelPickerProps) {
  const { hour, minute } = parseTime(value);
  const touchStartY = useRef<number | null>(null);

  const hourValues = useMemo(() => [-2, -1, 0, 1, 2].map((offset) => wrap(hour + offset, 24)), [hour]);
  const minuteValues = useMemo(() => [-2, -1, 0, 1, 2].map((offset) => wrap(minute + offset, 60)), [minute]);

  function setTime(nextHour: number, nextMinute: number) {
    onChange(formatTime(wrap(nextHour, 24), wrap(nextMinute, 60)));
  }

  function adjust(part: 'hour' | 'minute', amount: number) {
    setTime(part === 'hour' ? hour + amount : hour, part === 'minute' ? minute + amount : minute);
  }

  function handleTouchStart(event: TouchEvent<HTMLDivElement>) {
    touchStartY.current = event.touches[0]?.clientY ?? null;
  }

  function handleTouchEnd(part: 'hour' | 'minute', event: TouchEvent<HTMLDivElement>) {
    const start = touchStartY.current;
    touchStartY.current = null;
    if (start === null) return;
    const end = event.changedTouches[0]?.clientY ?? start;
    const delta = start - end;
    if (Math.abs(delta) < 12) return;
    adjust(part, delta > 0 ? 1 : -1);
  }

  function handleWheel(part: 'hour' | 'minute', event: WheelEvent<HTMLDivElement>) {
    if (Math.abs(event.deltaY) < 2) return;
    adjust(part, event.deltaY > 0 ? 1 : -1);
  }

  const column = (part: 'hour' | 'minute', values: number[]) => {
    const current = part === 'hour' ? hour : minute;
    return (
      <div className="flex flex-col items-center">
        <button
          type="button"
          onClick={() => adjust(part, -1)}
          className="w-12 h-9 border border-vow-border text-vow-muted hover:text-vow-ink hover:border-vow-ink transition-colors"
          aria-label={`Earlier ${part}`}
        >
          ↑
        </button>
        <div
          className="relative my-1 w-20 h-36 overflow-hidden border-x border-vow-border select-none touch-none"
          onTouchStart={handleTouchStart}
          onTouchEnd={(event) => handleTouchEnd(part, event)}
          onWheel={(event) => handleWheel(part, event)}
          role="listbox"
          aria-label={part === 'hour' ? 'Hour' : 'Minute'}
          tabIndex={0}
        >
          <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-12 border-y border-vow-ink bg-vow-surface/50 pointer-events-none" />
          <div className="relative flex h-full flex-col items-center justify-center transition-transform duration-150 ease-out">
            {values.map((item, index) => (
              <div
                key={`${part}-${index}-${item}`}
                className={`h-9 leading-9 text-center text-sm tabular-nums transition-all duration-150 ${
                  index === 2
                    ? 'text-vow-ink font-medium scale-105'
                    : 'text-vow-muted/60 scale-90'
                }`}
                aria-selected={item === current && index === 2}
              >
                {String(item).padStart(2, '0')}
              </div>
            ))}
          </div>
        </div>
        <button
          type="button"
          onClick={() => adjust(part, 1)}
          className="w-12 h-9 border border-vow-border text-vow-muted hover:text-vow-ink hover:border-vow-ink transition-colors"
          aria-label={`Later ${part}`}
        >
          ↓
        </button>
      </div>
    );
  };

  return (
    <div className="border border-vow-border p-4 bg-vow-gray/10">
      <div className="flex items-center justify-between gap-3 mb-3">
        <div>
          <p className="vow-label">{label}</p>
          <p className="text-xs text-vow-muted mt-1">Swipe or use the arrows to adjust the time.</p>
        </div>
        <div className="text-lg font-medium tabular-nums text-vow-ink">{formatTime(hour, minute)}</div>
      </div>
      <div className="flex items-center justify-center gap-3" aria-label={`Set time to ${formatTime(hour, minute)}`}>
        {column('hour', hourValues)}
        <span className="text-lg font-medium text-vow-muted -mt-1">:</span>
        {column('minute', minuteValues)}
      </div>
      <p className="text-[10px] text-vow-muted text-center mt-3 uppercase tracking-wider">24-hour time</p>
    </div>
  );
}
