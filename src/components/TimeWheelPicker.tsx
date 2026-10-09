type TimeWheelPickerProps = {
  value: string;
  onChange: (value: string) => void;
  label?: string;
};

function parseTime(value: string) {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value);
  return {
    hour: match ? Math.min(23, Math.max(0, Number(match[1]))) : 9,
    minute: match ? Math.min(59, Math.max(0, Number(match[2]))) : 0,
  };
}

function formatTime(hour: number, minute: number) {
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

function wrap(value: number, max: number) {
  return (value + max) % max;
}

export function TimeWheelPicker({ value, onChange, label = 'Session time' }: TimeWheelPickerProps) {
  const { hour, minute } = parseTime(value);
  const updateHour = (amount: number) => onChange(formatTime(wrap(hour + amount, 24), minute));
  const updateMinute = (amount: number) => onChange(formatTime(hour, wrap(minute + amount, 60)));

  const arrowClass = 'h-7 w-9 border border-vow-border text-vow-muted hover:text-vow-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-vow-ink';
  const valueClass = 'w-9 text-center text-lg font-medium tabular-nums text-vow-ink';

  return (
    <div className="inline-flex items-end gap-2" aria-label={label}>
      <div className="flex flex-col items-center gap-1">
        <button type="button" onClick={() => updateHour(1)} className={arrowClass} aria-label="Increase hour">↑</button>
        <span className={valueClass} aria-label={`Hour ${hour}`}>{String(hour).padStart(2, '0')}</span>
        <button type="button" onClick={() => updateHour(-1)} className={arrowClass} aria-label="Decrease hour">↓</button>
        <span className="text-[10px] uppercase tracking-wider text-vow-muted">Hour</span>
      </div>
      <span className="pb-8 text-lg text-vow-muted" aria-hidden="true">:</span>
      <div className="flex flex-col items-center gap-1">
        <button type="button" onClick={() => updateMinute(5)} className={arrowClass} aria-label="Increase minutes by five">↑</button>
        <span className={valueClass} aria-label={`Minute ${minute}`}>{String(minute).padStart(2, '0')}</span>
        <button type="button" onClick={() => updateMinute(-5)} className={arrowClass} aria-label="Decrease minutes by five">↓</button>
        <span className="text-[10px] uppercase tracking-wider text-vow-muted">Min</span>
      </div>
    </div>
  );
}
