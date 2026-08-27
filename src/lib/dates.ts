export function startOfWeek(date: Date = new Date()): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day;
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function endOfWeek(date: Date = new Date()): Date {
  const d = startOfWeek(date);
  d.setDate(d.getDate() + 6);
  d.setHours(23, 59, 59, 999);
  return d;
}

export function weekRange(date: Date = new Date()): { start: Date; end: Date } {
  return { start: startOfWeek(date), end: endOfWeek(date) };
}

/** Return a calendar date in the user's local timezone. Never use UTC conversion here. */
export function toDateString(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function formatTime(dt: string): string {
  return new Date(dt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

export function formatDate(dt: string): string {
  return new Date(dt).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
}

export function formatDateLong(dt: string): string {
  return new Date(dt).toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
}

export function formatRelative(dt: string): string {
  const now = new Date();
  const target = new Date(dt);
  const diffMs = target.getTime() - now.getTime();
  const diffHrs = diffMs / (1000 * 60 * 60);
  const diffDays = Math.round(diffHrs / 24);

  if (Math.abs(diffDays) === 0) return 'Today';
  if (diffDays === 1) return 'Tomorrow';
  if (diffDays === -1) return 'Yesterday';
  if (diffDays > 0 && diffDays < 7) return `In ${diffDays} days`;
  if (diffDays < 0 && diffDays > -7) return `${Math.abs(diffDays)} days ago`;
  return formatDate(dt);
}

export function isThisWeek(dt: string): boolean {
  const { start, end } = weekRange();
  const target = new Date(dt);
  return target >= start && target <= end;
}

export function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

export function dayName(dt: string): string {
  return new Date(dt).toLocaleDateString([], { weekday: 'long' });
}

export function timeOfDay(dt: string): 'morning' | 'afternoon' | 'evening' {
  const h = new Date(dt).getHours();
  if (h < 12) return 'morning';
  if (h < 17) return 'afternoon';
  return 'evening';
}

export function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

export function nextSessionSlot(preferredTimes: string | null, baseDate: Date): Date {
  if (!preferredTimes) {
    const d = new Date(baseDate);
    d.setHours(9, 0, 0, 0);
    return d;
  }
  const match = preferredTimes.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)/i);
  if (match) {
    let h = parseInt(match[1], 10);
    const m = match[2] ? parseInt(match[2], 10) : 0;
    const period = match[3].toLowerCase();
    if (period === 'pm' && h !== 12) h += 12;
    if (period === 'am' && h === 12) h = 0;
    const d = new Date(baseDate);
    d.setHours(h, m, 0, 0);
    return d;
  }
  const d = new Date(baseDate);
  d.setHours(9, 0, 0, 0);
  return d;
}
