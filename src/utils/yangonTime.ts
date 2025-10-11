import { BadRequestError } from './httpErrors.js';

export const ASIA_YANGON_OFFSET_MINUTES = 6 * 60 + 30;

function pad(value: number): string {
  return value.toString().padStart(2, '0');
}

function normalizeDateKey(dateKey: string): string {
  const trimmed = dateKey.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    throw new BadRequestError('Date must be formatted as YYYY-MM-DD');
  }
  return trimmed;
}

export function buildYangonDate(dateKey: string): Date {
  const normalized = normalizeDateKey(dateKey);
  const date = new Date(`${normalized}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) {
    throw new BadRequestError('Invalid calendar date');
  }
  return date;
}

export function yangonDateTimeToInstant(dateKey: string, minutes: number): Date {
  const date = buildYangonDate(dateKey);
  const result = new Date(date);
  const adjustedMinutes = minutes - ASIA_YANGON_OFFSET_MINUTES;
  result.setUTCMinutes(result.getUTCMinutes() + adjustedMinutes);
  return result;
}

export function formatYangonIso(dateKey: string, minutes: number): string {
  const normalized = normalizeDateKey(dateKey);
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${normalized}T${pad(hours)}:${pad(mins)}:00+06:30`;
}

export function parseYangonSlotStart(value: string): {
  dateKey: string;
  minutes: number;
  instant: Date;
} {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new BadRequestError('slotStart is required');
  }

  const trimmed = value.trim();
  const hasTime = trimmed.includes('T');
  const withTime = hasTime ? trimmed : `${trimmed}T00:00`;
  const hasZone = /(?:Z|[+-]\d{2}:?\d{2})$/.test(withTime);
  const normalized = hasZone ? withTime : `${withTime}+06:30`;

  const instant = new Date(normalized);
  if (Number.isNaN(instant.getTime())) {
    throw new BadRequestError('Invalid slotStart value');
  }

  const local = new Date(instant.getTime() + ASIA_YANGON_OFFSET_MINUTES * 60 * 1000);
  const year = local.getUTCFullYear();
  const month = pad(local.getUTCMonth() + 1);
  const day = pad(local.getUTCDate());
  const hours = local.getUTCHours();
  const minutes = local.getUTCMinutes();

  const dateKey = `${year}-${month}-${day}`;

  return {
    dateKey,
    minutes: hours * 60 + minutes,
    instant,
  };
}

export function getCurrentYangonDateTime(): {
  dateKey: string;
  minutes: number;
  instant: Date;
} {
  const now = new Date();
  const local = new Date(now.getTime() + ASIA_YANGON_OFFSET_MINUTES * 60 * 1000);
  const year = local.getUTCFullYear();
  const month = pad(local.getUTCMonth() + 1);
  const day = pad(local.getUTCDate());
  const hours = local.getUTCHours();
  const minutes = local.getUTCMinutes();
  return {
    dateKey: `${year}-${month}-${day}`,
    minutes: hours * 60 + minutes,
    instant: now,
  };
}

export function compareDateKeys(a: string, b: string): number {
  return a.localeCompare(b);
}
