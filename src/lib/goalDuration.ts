export type DurationUnit = 'days' | 'weeks' | 'months' | 'years';

export function durationToken(value: string, unit: DurationUnit): string | null {
  const amount = Number(value);
  if (!Number.isSafeInteger(amount) || amount <= 0) return null;
  return `${amount}${unit === 'weeks' ? 'w' : unit === 'months' ? 'm' : unit === 'years' ? 'y' : 'd'}`;
}

export function parseDurationToken(value: unknown): { amount: number; unit: 'weeks' | 'months' | 'years' } | null {
  const match = /^(\d+)(w|m|y)$/i.exec(String(value ?? '').trim());
  if (!match) return null;
  const amount = Number(match[1]);
  if (!Number.isSafeInteger(amount) || amount <= 0) return null;
  return {
    amount,
    unit: match[2].toLowerCase() === 'w' ? 'weeks' : match[2].toLowerCase() === 'y' ? 'years' : 'months',
  };
}
