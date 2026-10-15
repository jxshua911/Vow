import { useEffect, useRef } from 'react';

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
  const valueRef = useRef(value);
  const onChangeRef = useRef(onChange);
  const repeatRef = useRef<number | null>(null);
  valueRef.current = value;
  onChangeRef.current = onChange;

  const step = (unit: 'hour' | 'minute', amount: number) => {
    const { hour, minute } = parseTime(valueRef.current);
    const next = formatTime(
      unit === 'hour' ? wrap(hour + amount, 24) : hour,
      unit === 'minute' ? wrap(minute + amount, 60) : minute,
    );
    valueRef.current = next;
    onChangeRef.current(next);
  };

  const stopRepeating = () => {
    if (repeatRef.current !== null) {
      window.clearInterval(repeatRef.current);
      repeatRef.current = null;
    }
  };

  const startRepeating = (unit: 'hour' | 'minute', amount: number) => {
    stopRepeating();
    step(unit, amount);
    repeatRef.current = window.setInterval(() => step(unit, amount), 110);
  };

  useEffect(() => stopRepeating, []);

  const arrowClass = 'h-7 w-9 border border-vow-border text-vow-muted hover:text-vow-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-vow-ink select-none';
  const valueClass = 'w-9 text-center text-lg font-medium tabular-nums text-vow-ink';
  const holdProps = (unit: 'hour' | 'minute', amount: number) => ({
    onPointerDown: (event: React.PointerEvent<HTMLButtonElement>) => {
      event.preventDefault();
      startRepeating(unit, amount);
    },
    onPointerUp: stopRepeating,
    onPointerLeave: stopRepeating,
    onPointerCancel: stopRepeating,
    onContextMenu: (event: React.MouseEvent<HTMLButtonElement>) => event.preventDefault(),
    onKeyDown: (event: React.KeyboardEvent<HTMLButtonElement>) => {
      if (event.key === ' ' || event.key === 'Enter') step(unit, amount);
    },
  });

  const { hour, minute } = parseTime(value);

  return (
    <div className="inline-grid grid-cols-[2.25rem_auto_2.25rem] grid-rows-[1.75rem_2rem_1.75rem_auto] items-center gap-x-3 gap-y-1" aria-label={label}>
      <button type="button" {...holdProps('hour', 1)} className={arrowClass} aria-label="Increase hour">↑</button>
      <span aria-hidden="true" />
      <button type="button" {...holdProps('minute', 1)} className={arrowClass} aria-label="Increase minute">↑</button>
      <span className={valueClass} aria-label={`Hour ${hour}`}>{String(hour).padStart(2, '0')}</span>
      <span className="self-center text-center font-mono text-xl font-semibold leading-none text-vow-ink" aria-hidden="true">:</span>
      <span className={valueClass} aria-label={`Minute ${minute}`}>{String(minute).padStart(2, '0')}</span>
      <button type="button" {...holdProps('hour', -1)} className={arrowClass} aria-label="Decrease hour">↓</button>
      <span aria-hidden="true" />
      <button type="button" {...holdProps('minute', -1)} className={arrowClass} aria-label="Decrease minute">↓</button>
      <span className="text-[10px] uppercase tracking-wider text-vow-muted text-center">Hour</span>
      <span aria-hidden="true" />
      <span className="text-[10px] uppercase tracking-wider text-vow-muted text-center">Min</span>
    </div>
  );
}
