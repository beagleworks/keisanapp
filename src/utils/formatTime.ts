/** Format milliseconds as MM:SS.d (e.g., 01:23.4) */
export function formatStopwatch(ms: number): string {
  const safeMs = Math.max(0, Math.floor(ms));
  const totalTenths = Math.floor(safeMs / 100);
  const tenths = totalTenths % 10;
  const totalSeconds = Math.floor(totalTenths / 10);
  const seconds = totalSeconds % 60;
  const minutes = Math.floor(totalSeconds / 60);

  const mm = String(minutes).padStart(2, '0');
  const ss = String(seconds).padStart(2, '0');
  return `${mm}:${ss}.${tenths}`;
}

/** Format milliseconds into kid-friendly Japanese (e.g., 1ぷん 23.4びょう) */
export function formatJapaneseTime(ms: number): string {
  const safeMs = Math.max(0, Math.floor(ms));
  const totalTenths = Math.floor(safeMs / 100);
  const tenths = totalTenths % 10;
  const totalSeconds = Math.floor(totalTenths / 10);
  const seconds = totalSeconds % 60;
  const minutes = Math.floor(totalSeconds / 60);

  if (minutes === 0) {
    return `${seconds}.${tenths}びょう`;
  }
  return `${minutes}ぷん ${seconds}.${tenths}びょう`;
}
