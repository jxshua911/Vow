import { useEffect, useMemo, useRef, useState } from 'react';
import { TimeWheelPicker } from './TimeWheelPicker';

export type VowSelectOption = { value: string; label: string };

type VowSelectProps = {
  value: string;
  options: VowSelectOption[];
  onChange: (value: string) => void;
  placeholder?: string;
  ariaLabel: string;
  className?: string;
  disabled?: boolean;
};

export function VowSelect({ value, options, onChange, placeholder = 'Choose an option', ariaLabel, className = '', disabled = false }: VowSelectProps) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const selected = options.find((option) => option.value === value);
  useEffect(() => {
    if (!open) return;
    const closeOutside = (event: PointerEvent) => {
      if (event.target instanceof Node && !root.current?.contains(event.target)) setOpen(false);
    };
    const closeEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') setOpen(false); };
    document.addEventListener('pointerdown', closeOutside);
    document.addEventListener('keydown', closeEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOutside);
      document.removeEventListener('keydown', closeEscape);
    };
  }, [open]);
  return (
    <div ref={root} className={`relative min-w-0 ${className}`}>
      <button type="button" disabled={disabled} aria-label={ariaLabel} aria-haspopup="listbox" aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
        className="vow-input flex min-h-11 w-full items-center justify-between gap-3 text-left disabled:opacity-50">
        <span className={selected ? 'truncate text-vow-ink' : 'truncate text-vow-muted'}>{selected?.label || placeholder}</span>
        <span aria-hidden="true" className={`shrink-0 text-vow-muted transition-transform ${open ? 'rotate-180' : ''}`}>⌄</span>
      </button>
      {open && <div role="listbox" aria-label={ariaLabel} className="absolute left-0 right-0 top-full z-[70] mt-1 max-h-64 overflow-y-auto border border-vow-border bg-vow-bg shadow-xl">
        {options.map((option) => (
          <button key={option.value} type="button" role="option" aria-selected={option.value === value}
            onClick={() => { onChange(option.value); setOpen(false); }}
            className={`block min-h-11 w-full px-3 py-3 text-left text-sm transition-colors ${option.value === value ? 'bg-vow-ink text-vow-bg' : 'text-vow-ink hover:bg-vow-surface'}`}>
            {option.label}
          </button>
        ))}
      </div>}
    </div>
  );
}

function parseDateOnly(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return date.getFullYear() === Number(match[1]) && date.getMonth() === Number(match[2]) - 1 && date.getDate() === Number(match[3]) ? date : null;
}

function formatDateOnly(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

type VowDatePickerProps = {
  value: string;
  onChange: (value: string) => void;
  label?: string;
  placeholder?: string;
  className?: string;
  min?: string;
  max?: string;
};

export function VowDatePicker({ value, onChange, label = 'Choose date', placeholder = 'Select a date', className = '', min, max }: VowDatePickerProps) {
  const selectedDate = parseDateOnly(value);
  const [open, setOpen] = useState(false);
  const [month, setMonth] = useState(() => {
    const initial = selectedDate || new Date();
    return new Date(initial.getFullYear(), initial.getMonth(), 1);
  });
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const currentValue = parseDateOnly(value);
    if (currentValue) setMonth(new Date(currentValue.getFullYear(), currentValue.getMonth(), 1));
  }, [value]);
  useEffect(() => {
    if (!open) return;
    const closeOutside = (event: PointerEvent) => {
      if (event.target instanceof Node && !root.current?.contains(event.target)) setOpen(false);
    };
    const closeEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') setOpen(false); };
    document.addEventListener('pointerdown', closeOutside);
    document.addEventListener('keydown', closeEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOutside);
      document.removeEventListener('keydown', closeEscape);
    };
  }, [open]);
  const days = useMemo(() => {
    const first = new Date(month.getFullYear(), month.getMonth(), 1);
    const mondayOffset = (first.getDay() + 6) % 7;
    const start = new Date(first.getFullYear(), first.getMonth(), 1 - mondayOffset);
    return Array.from({ length: 42 }, (_, index) => new Date(start.getFullYear(), start.getMonth(), start.getDate() + index));
  }, [month]);
  const minDate = min ? parseDateOnly(min) : null;
  const maxDate = max ? parseDateOnly(max) : null;
  const today = formatDateOnly(new Date());
  const moveMonth = (amount: number) => setMonth((current) => new Date(current.getFullYear(), current.getMonth() + amount, 1));
  const choose = (date: Date) => {
    const next = formatDateOnly(date);
    if (min && next < min || max && next > max) return;
    onChange(next);
    setOpen(false);
  };
  return (
    <div ref={root} className={`relative min-w-0 ${className}`}>
      <button type="button" aria-label={label} aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen((current) => !current)}
        className="vow-input flex min-h-11 w-full items-center justify-between gap-3 text-left">
        <span className={selectedDate ? 'truncate text-vow-ink' : 'truncate text-vow-muted'}>{selectedDate ? selectedDate.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : placeholder}</span>
        <span aria-hidden="true" className="shrink-0 text-vow-muted">▦</span>
      </button>
      {open && <div role="dialog" aria-label={label} className="absolute left-0 top-full z-[80] mt-1 w-[min(20rem,calc(100vw-2rem))] border border-vow-border bg-vow-bg p-3 shadow-2xl">
        <div className="mb-3 flex items-center justify-between gap-2">
          <button type="button" aria-label="Previous month" onClick={() => moveMonth(-1)} className="grid h-9 w-9 place-items-center border border-vow-border text-vow-ink hover:bg-vow-surface">‹</button>
          <p className="text-sm font-medium text-vow-ink">{MONTHS[month.getMonth()]} {month.getFullYear()}</p>
          <button type="button" aria-label="Next month" onClick={() => moveMonth(1)} className="grid h-9 w-9 place-items-center border border-vow-border text-vow-ink hover:bg-vow-surface">›</button>
        </div>
        <div className="grid grid-cols-7 gap-1">
          {WEEKDAYS.map((day) => <span key={day} className="py-1 text-center text-[10px] font-medium text-vow-muted">{day}</span>)}
          {days.map((date) => {
            const key = formatDateOnly(date);
            const inMonth = date.getMonth() === month.getMonth();
            const isSelected = key === value;
            const disabled = Boolean((minDate && date < minDate) || (maxDate && date > maxDate));
            return <button key={key} type="button" disabled={disabled} aria-pressed={isSelected} aria-label={date.toLocaleDateString()}
              onClick={() => choose(date)}
              className={`aspect-square min-w-0 text-xs transition-colors disabled:cursor-not-allowed disabled:opacity-20 ${isSelected ? 'bg-vow-ink font-semibold text-vow-bg' : key === today ? 'border border-vow-ink text-vow-ink' : inMonth ? 'text-vow-ink hover:bg-vow-surface' : 'text-vow-muted/50 hover:bg-vow-surface'}`}>
              {date.getDate()}
            </button>;
          })}
        </div>
        <div className="mt-3 flex items-center justify-between border-t border-vow-border pt-3">
          <button type="button" onClick={() => { onChange(''); setOpen(false); }} className="text-xs text-vow-muted underline underline-offset-4">Clear</button>
          <button type="button" onClick={() => choose(new Date())} className="text-xs text-vow-ink underline underline-offset-4">Today</button>
        </div>
      </div>}
    </div>
  );
}

type VowDateTimePickerProps = {
  value: string;
  onChange: (value: string) => void;
  label?: string;
  className?: string;
  minDate?: string;
};

export function VowDateTimePicker({ value, onChange, label = 'Date and time', className = '', minDate }: VowDateTimePickerProps) {
  const [datePart, timePart] = value ? value.split('T') : ['', ''];
  const dateValue = datePart || formatDateOnly(new Date());
  const timeValue = /^\d{2}:\d{2}$/.test(timePart || '') ? timePart : '09:00';
  const updateDate = (date: string) => onChange(date ? `${date}T${timeValue}` : '');
  const updateTime = (time: string) => onChange(`${dateValue}T${time}`);
  return (
    <div className={`grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end ${className}`}>
      <div className="min-w-0">
        <label className="mb-1 block text-xs text-vow-muted">{label} · date</label>
        <VowDatePicker value={datePart} onChange={updateDate} label={`${label} date`} min={minDate} />
      </div>
      <div className="min-w-0">
        <label className="mb-1 block text-xs text-vow-muted">{label} · time</label>
        <div className="flex min-h-11 items-center justify-center border border-vow-border px-3">
          <TimeWheelPicker value={timeValue} onChange={updateTime} label={`${label} time`} />
        </div>
      </div>
    </div>
  );
}
