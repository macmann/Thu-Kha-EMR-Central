const TIME_ZONE = 'Asia/Yangon';

const dateFormatter = new Intl.DateTimeFormat('en-GB', {
  timeZone: TIME_ZONE,
  weekday: 'short',
  month: 'short',
  day: 'numeric',
});

const longDateFormatter = new Intl.DateTimeFormat('en-GB', {
  timeZone: TIME_ZONE,
  weekday: 'long',
  month: 'long',
  day: 'numeric',
  year: 'numeric',
});

const timeFormatter = new Intl.DateTimeFormat('en-GB', {
  timeZone: TIME_ZONE,
  hour: 'numeric',
  minute: '2-digit',
  hour12: true,
});

const dateKeyFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: TIME_ZONE,
});

export function formatYangonDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return dateFormatter.format(date);
}

export function formatYangonLongDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return longDateFormatter.format(date);
}

export function formatYangonTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return timeFormatter.format(date);
}

export function formatYangonTimeRange(startIso: string, endIso: string): string {
  const start = formatYangonTime(startIso);
  const end = formatYangonTime(endIso);
  return `${start} – ${end}`;
}

export function getYangonDateKey(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return dateKeyFormatter.format(date);
}

export function getTodayYangonDateKey(): string {
  return dateKeyFormatter.format(new Date());
}

export function shiftDateKey(dateKey: string, deltaDays: number): string {
  const baseline = new Date(`${dateKey}T00:00:00+06:30`);
  if (Number.isNaN(baseline.getTime())) return dateKey;
  baseline.setUTCDate(baseline.getUTCDate() + deltaDays);
  return dateKeyFormatter.format(baseline);
}

export function describeYangonDate(dateKey: string): string {
  const today = getTodayYangonDateKey();
  if (dateKey === today) return 'Today';
  if (dateKey === shiftDateKey(today, 1)) return 'Tomorrow';
  return dateFormatter.format(new Date(`${dateKey}T00:00:00+06:30`));
}

export function isYangonDateBefore(dateKey: string, comparisonKey: string): boolean {
  return dateKey < comparisonKey;
}
