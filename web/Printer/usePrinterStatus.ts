import { useEffect, useState } from 'react';
import type { PrinterStatusResponse } from '../../shared/api';
import { loadPrinterStatus } from '../apiClient';

/** Abstand zwischen Statusabfragen: 10 Sekunden */
const REFRESH_INTERVAL_MS = 10_000;

/** Fragt den Druckerstatus regelmäßig ab; null solange noch keine Antwort da ist */
export function usePrinterStatus(): PrinterStatusResponse | null {
  const [status, setStatus] = useState<PrinterStatusResponse | null>(null);

  useEffect(() => {
    let isActive = true;
    const refresh = () => {
      loadPrinterStatus()
        .then((result) => isActive && setStatus(result))
        .catch(() => undefined);
    };

    refresh();
    const interval = window.setInterval(refresh, REFRESH_INTERVAL_MS);
    return () => {
      isActive = false;
      window.clearInterval(interval);
    };
  }, []);

  return status;
}
