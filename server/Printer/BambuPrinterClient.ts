import { connect, type MqttClient } from 'mqtt';
import type { PrinterState } from '../../shared/api';
import type { PrinterConfig } from './PrinterConfig';
import { mergeReport, toPrinterStatus, type PrinterStatus, type RawPrintFields } from './PrinterStatus';

/** MQTT-Port der Bambu-Drucker im LAN-Modus (TLS) */
const MQTT_PORT = 8883;

/** Benutzername ist bei allen Bambu-Druckern fest vorgegeben */
const MQTT_USERNAME = 'bblp';

/** Wartezeit zwischen Verbindungsversuchen: 10 Sekunden */
const RECONNECT_PERIOD_MS = 10_000;

/** Maximale Wartezeit auf den Verbindungsaufbau: 10 Sekunden */
const CONNECT_TIMEOUT_MS = 10_000;

/** Abstand für vollständige Status-Abfragen, damit kein Feld veraltet: 5 Minuten */
const PUSHALL_INTERVAL_MS = 5 * 60 * 1000;

const PUSHALL_REQUEST = JSON.stringify({ pushing: { sequence_id: '0', command: 'pushall' } });

export type PrinterStateChangeListener = (previous: PrinterState, current: PrinterState) => void;

export interface PrinterStatusSource {
  getStatus(): PrinterStatus;
}

/** Liest den Status eines Bambu-Druckers per MQTT im lokalen Netz */
export class BambuPrinterClient implements PrinterStatusSource {
  private readonly config: PrinterConfig;
  private readonly onStateChange: PrinterStateChangeListener;
  private client: MqttClient | null = null;
  private pushallInterval: NodeJS.Timeout | null = null;
  private raw: RawPrintFields = {};
  private isConnected = false;
  private updatedAt: Date | null = null;
  private lastState: PrinterState = 'offline';

  constructor(config: PrinterConfig, onStateChange: PrinterStateChangeListener) {
    this.config = config;
    this.onStateChange = onStateChange;
  }

  start(): void {
    const reportTopic = `device/${this.config.serial}/report`;
    const requestTopic = `device/${this.config.serial}/request`;

    // Der Drucker nutzt ein Zertifikat der Bambu-eigenen CA, das Node nicht kennt. Die Verbindung
    // bleibt verschlüsselt, das Zertifikat wird aber nicht geprüft. Für das Heimnetz vertretbar.
    const client = connect(`mqtts://${this.config.host}:${MQTT_PORT}`, {
      username: MQTT_USERNAME,
      password: this.config.accessCode,
      rejectUnauthorized: false,
      reconnectPeriod: RECONNECT_PERIOD_MS,
      connectTimeout: CONNECT_TIMEOUT_MS,
    });
    this.client = client;

    client.on('connect', () => {
      this.isConnected = true;
      client.subscribe(reportTopic, (error) => {
        if (error) {
          console.error('Failed to subscribe to printer report', { reason: error.message });
          return;
        }
        client.publish(requestTopic, PUSHALL_REQUEST);
      });
    });

    client.on('message', (_topic, payload) => this.handleMessage(payload));
    client.on('close', () => this.markDisconnected());
    client.on('error', (error) => console.error('Printer connection error', { reason: error.message }));

    this.pushallInterval = setInterval(() => {
      if (this.isConnected) client.publish(requestTopic, PUSHALL_REQUEST);
    }, PUSHALL_INTERVAL_MS);
  }

  stop(): void {
    if (this.pushallInterval !== null) clearInterval(this.pushallInterval);
    this.client?.end(true);
  }

  getStatus(): PrinterStatus {
    return toPrinterStatus(this.raw, this.isConnected, this.updatedAt);
  }

  private handleMessage(payload: Buffer): void {
    let report: unknown;
    try {
      report = JSON.parse(payload.toString('utf8'));
    } catch {
      return;
    }

    this.raw = mergeReport(this.raw, report);
    this.updatedAt = new Date();
    this.emitStateChange();
  }

  private markDisconnected(): void {
    if (!this.isConnected) return;
    this.isConnected = false;
    this.emitStateChange();
  }

  private emitStateChange(): void {
    const current = this.getStatus().state;
    const previous = this.lastState;
    if (current === previous) return;
    this.lastState = current;
    this.onStateChange(previous, current);
  }
}
