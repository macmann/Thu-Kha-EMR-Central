import { BadRequestError } from './httpErrors.js';

const DATE_ONLY_REGEX = /^(\d{4})-(\d{2})-(\d{2})$/;

export function toDateOnly(dateStr: string): Date {
  if (typeof dateStr !== 'string') {
    throw new BadRequestError('Date must be a string in format YYYY-MM-DD');
  }

  const normalized = dateStr.trim();
  const match = DATE_ONLY_REGEX.exec(normalized);

  if (!match) {
    throw new BadRequestError('Date must be in format YYYY-MM-DD');
  }

  const [, yearStr, monthStr, dayStr] = match;
  const date = new Date(`${normalized}T00:00:00Z`);

  if (Number.isNaN(date.getTime())) {
    throw new BadRequestError('Invalid calendar date');
  }

  const year = Number(yearStr);
  const month = Number(monthStr);
  const day = Number(dayStr);

  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() + 1 !== month ||
    date.getUTCDate() !== day
  ) {
    throw new BadRequestError('Invalid calendar date');
  }

  return date;
}

export function toMinutes(hhmm: string): number {
  const [hours, minutes] = hhmm.split(":").map(Number);
  return hours * 60 + minutes;
}

export function minutesToHHMM(totalMinutes: number): string {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  const paddedHours = String(hours).padStart(2, "0");
  const paddedMinutes = String(minutes).padStart(2, "0");

  return `${paddedHours}:${paddedMinutes}`;
}

export function dayOfWeekUTC(date: Date): number {
  return date.getUTCDay();
}

export function composeDateTime(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60 * 1000);
}
