export interface PrinterConfig {
  readonly host: string;
  readonly serial: string;
  readonly accessCode: string;
}

const PRINTER_KEYS = ['PRINTER_HOST', 'PRINTER_SERIAL', 'PRINTER_ACCESS_CODE'] as const;

/**
 * Liest die Drucker-Zugangsdaten. Fehlen alle drei Werte, ist die Drucker-Anbindung aus (null).
 * Sind nur einige gesetzt, ist das ein Konfigurationsfehler.
 */
export function parsePrinterConfig(env: NodeJS.ProcessEnv): PrinterConfig | null {
  const values = PRINTER_KEYS.map((key) => env[key]?.trim() ?? '');
  const setCount = values.filter((value) => value !== '').length;
  if (setCount === 0) return null;
  if (setCount < PRINTER_KEYS.length) {
    throw new Error(`Incomplete printer configuration: Set all of ${PRINTER_KEYS.join(', ')} or none`);
  }

  const [host = '', serial = '', accessCode = ''] = values;
  return { host, serial, accessCode };
}
