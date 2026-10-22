import type { AmsTrayResponse } from '../../shared/api';

/** "≈ 400 g · 40 %"; ohne Spulengewicht nur Prozent, ohne beides "?" */
export function formatRemaining(tray: Pick<AmsTrayResponse, 'remainPercent' | 'remainingGrams'>): string {
  if (tray.remainPercent === null) return '?';
  if (tray.remainingGrams === null) return `${tray.remainPercent} %`;
  return `≈ ${tray.remainingGrams} g · ${tray.remainPercent} %`;
}
