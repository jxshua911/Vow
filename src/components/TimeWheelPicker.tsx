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
  function adjust(amount: number) {
    const total = wrap(hour * 60 + minute + amount, 24 * 60);
    onChange(formatTime(Math.floor(total / 60), total % 60));
  }
  return (
    <div className="flex items-center justify-between gap-3 border border-vow-border px-3 py-2 bg-vow-gray/10">
      <span className="vow-label">{label}</span>
      <div className="flex items-center gap-2">
        <button type="button" onClick={() => adjust(-5)} className="h-8 w-8 border border-vow-border text-vow-muted hover:text-vow-ink" aria-label="Earlier by five minutes">↑</button>
        <input
          type="time"
          value={formatTime(hour, minute)}
          onChange={(event) => {
            const next = parseTime(event.target.value);
            if (event.target.value) onChange(formatTime(next.hour, next.minute));
          }}
          className="h-9 w-[7.5rem] border border-vow-border bg-vow-bg px-2 text-sm tabular-nums text-vow-ink"
          aria-label={label}
        />
        <button type="button" onClick={() => adjust(5)} className="h-8 w-8 border border-vow-border text-vow-muted hover:text-vow-ink" aria-label="Later by five minutes">↓</button>
      </div>
    </div>
  );
}
