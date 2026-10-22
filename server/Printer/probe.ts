// Prüft die Verbindung zum Drucker und gibt den empfangenen Status aus.
// Usage: npm run printer:probe
import { BambuPrinterClient } from './BambuPrinterClient';
import { parsePrinterConfig } from './PrinterConfig';

/** Wartezeit auf eine Statusmeldung, bevor aufgegeben wird: 20 Sekunden */
const PROBE_TIMEOUT_MS = 20_000;

/** Abstand zwischen den Prüfungen, ob schon Daten da sind: 0,5 Sekunden */
const POLL_INTERVAL_MS = 500;

const config = parsePrinterConfig(process.env);
if (config === null) {
  console.error('PRINTER_HOST, PRINTER_SERIAL und PRINTER_ACCESS_CODE fehlen in der .env');
  process.exit(1);
}

console.log(`Verbinde mit ${config.host}:8883 …`);
const client = new BambuPrinterClient(config, (previous, current) => console.log(`Status: ${previous} → ${current}`));
client.start();

const startedAt = Date.now();
const interval = setInterval(() => {
  const status = client.getStatus();
  if (status.updatedAt !== null) {
    console.log('\nVerbindung klappt. Empfangener Status:');
    console.log(status);
    finish(0);
    return;
  }
  if (Date.now() - startedAt < PROBE_TIMEOUT_MS) return;

  console.error(status.isConnected
    ? '\nVerbunden, aber keine Statusmeldung erhalten. Stimmt die Seriennummer?'
    : '\nKeine Verbindung. IP, Access-Code und LAN-/Developer-Modus prüfen.');
  finish(1);
}, POLL_INTERVAL_MS);

function finish(exitCode: number): void {
  clearInterval(interval);
  client.stop();
  process.exit(exitCode);
}
