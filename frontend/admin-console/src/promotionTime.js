const MOSCOW_OFFSET_MINUTES = 180;

export function moscowLocalToIso(value) {
  if (!value) return null;
  const match = String(value).match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/);
  if (!match) throw new Error('Некорректная дата и время запуска.');
  const [, year, month, day, hour, minute, second = '00'] = match;
  const wallClockUtc = Date.UTC(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute), Number(second));
  return new Date(wallClockUtc - MOSCOW_OFFSET_MINUTES * 60_000).toISOString();
}
