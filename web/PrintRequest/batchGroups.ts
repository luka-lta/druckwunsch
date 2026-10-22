import type { PrintRequestResponse } from '../../shared/api';
import { toColorKey } from '../Filament/colorMatch';

/** Ab dieser Anzahl gleichfarbiger Wünsche wird ein Sammeldruck vorgeschlagen */
const MIN_BATCH_SIZE = 2;

export interface BatchGroup {
  readonly key: string;
  /** Farbe, wie sie im ersten Wunsch der Gruppe steht */
  readonly colorLabel: string;
  readonly requests: readonly PrintRequestResponse[];
}

/** Gruppiert angenommene Wünsche nach Farbe; "egal" bildet keine eigene Gruppe */
export function toBatchGroups(requests: readonly PrintRequestResponse[]): BatchGroup[] {
  const byColor = new Map<string, PrintRequestResponse[]>();
  for (const request of requests) {
    if (request.status !== 'accepted') continue;
    const key = toColorKey(request.color);
    if (key === '') continue;
    byColor.set(key, [...(byColor.get(key) ?? []), request]);
  }

  return [...byColor.entries()]
    .filter(([, group]) => group.length >= MIN_BATCH_SIZE)
    .map(([key, group]) => ({ key, colorLabel: group[0]?.color ?? key, requests: group }));
}
