import { useCallback, useEffect, useState } from 'react';
import type { FilamentResponse } from '../../shared/api';
import { loadFilaments } from '../apiClient';

export interface FilamentsState {
  filaments: FilamentResponse[] | null;
  reload: () => Promise<void>;
}

/** Lädt die Filament-Bibliothek (für die Familie nur verfügbare Spulen) */
export function useFilaments(): FilamentsState {
  const [filaments, setFilaments] = useState<FilamentResponse[] | null>(null);

  const reload = useCallback(async () => {
    try {
      setFilaments(await loadFilaments());
    } catch {
      setFilaments((current) => current ?? []);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { filaments, reload };
}
