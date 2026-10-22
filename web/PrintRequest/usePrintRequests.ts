import { useCallback, useEffect, useState } from 'react';
import type { PrintRequestResponse } from '../../shared/api';
import { loadPrintRequests } from '../apiClient';

/** Abstand zwischen automatischen Aktualisierungen: 30 Sekunden */
const REFRESH_INTERVAL_MS = 30_000;

export interface PrintRequestsState {
  requests: PrintRequestResponse[] | null;
  error: string | null;
  reload: () => Promise<void>;
  upsert: (request: PrintRequestResponse) => void;
  remove: (id: number) => void;
}

/** Lädt die sichtbaren Druckwünsche und hält sie regelmäßig aktuell */
export function usePrintRequests(): PrintRequestsState {
  const [requests, setRequests] = useState<PrintRequestResponse[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try {
      setRequests(await loadPrintRequests());
      setError(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Laden fehlgeschlagen');
    }
  }, []);

  useEffect(() => {
    void reload();
    const interval = window.setInterval(() => void reload(), REFRESH_INTERVAL_MS);
    return () => window.clearInterval(interval);
  }, [reload]);

  const upsert = useCallback((request: PrintRequestResponse) => {
    setRequests((current) => {
      const list = current ?? [];
      const isKnown = list.some((existing) => existing.id === request.id);
      if (!isKnown) return [request, ...list];
      return list.map((existing) => (existing.id === request.id ? request : existing));
    });
  }, []);

  const remove = useCallback((id: number) => {
    setRequests((current) => (current ?? []).filter((existing) => existing.id !== id));
  }, []);

  return { requests, error, reload, upsert, remove };
}
