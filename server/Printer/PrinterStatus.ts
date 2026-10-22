import type { PrinterState } from '../../shared/api';
import { parseAmsTrays, type AmsTray } from './AmsTray';

// Bambu-Drucker senden nach einem "pushall" den vollständigen Zustand, danach oft nur geänderte Felder.
// Deshalb werden die Rohfelder über alle Nachrichten hinweg zusammengeführt.
export type RawPrintFields = Readonly<Record<string, unknown>>;

export interface PrinterStatus {
  readonly isConnected: boolean;
  readonly state: PrinterState;
  readonly progressPercent: number | null;
  readonly remainingMinutes: number | null;
  readonly jobName: string | null;
  readonly currentLayer: number | null;
  readonly totalLayers: number | null;
  readonly nozzleTemperature: number | null;
  readonly bedTemperature: number | null;
  readonly updatedAt: string | null;
  readonly amsTrays: readonly AmsTray[];
  /** Eindeutige Kennung des aktuellen bzw. letzten Druckauftrags */
  readonly jobKey: string | null;
}

const GCODE_STATES: Readonly<Record<string, PrinterState>> = {
  IDLE: 'idle',
  INIT: 'idle',
  OFFLINE: 'offline',
  PREPARE: 'preparing',
  SLICING: 'preparing',
  RUNNING: 'printing',
  PAUSE: 'paused',
  FINISH: 'finished',
  FAILED: 'failed',
};

/** Führt eine MQTT-Nachricht vom Topic device/<serial>/report in den bisherigen Stand ein */
export function mergeReport(previous: RawPrintFields, report: unknown): RawPrintFields {
  if (typeof report !== 'object' || report === null) return previous;
  const print = (report as Record<string, unknown>).print;
  if (typeof print !== 'object' || print === null) return previous;
  return { ...previous, ...(print as Record<string, unknown>) };
}

export function toPrinterStatus(raw: RawPrintFields, isConnected: boolean, updatedAt: Date | null): PrinterStatus {
  return {
    isConnected,
    state: isConnected ? parseState(raw.gcode_state) : 'offline',
    progressPercent: parsePercent(raw.mc_percent),
    remainingMinutes: parseNonNegativeInteger(raw.mc_remaining_time),
    jobName: parseJobName(raw),
    currentLayer: parseNonNegativeInteger(raw.layer_num),
    totalLayers: parseNonNegativeInteger(raw.total_layer_num),
    nozzleTemperature: parseTemperature(raw.nozzle_temper),
    bedTemperature: parseTemperature(raw.bed_temper),
    updatedAt: updatedAt?.toISOString() ?? null,
    amsTrays: parseAmsTrays(raw),
    jobKey: parseJobKey(raw),
  };
}

function parseState(value: unknown): PrinterState {
  if (typeof value !== 'string') return 'idle';
  return GCODE_STATES[value.toUpperCase()] ?? 'idle';
}

function parseNumber(value: unknown): number | null {
  const number = typeof value === 'string' ? Number(value) : value;
  if (typeof number !== 'number' || !Number.isFinite(number)) return null;
  return number;
}

function parsePercent(value: unknown): number | null {
  const number = parseNumber(value);
  if (number === null) return null;
  return Math.min(100, Math.max(0, Math.round(number)));
}

function parseNonNegativeInteger(value: unknown): number | null {
  const number = parseNumber(value);
  if (number === null || number < 0) return null;
  return Math.round(number);
}

function parseTemperature(value: unknown): number | null {
  const number = parseNumber(value);
  if (number === null) return null;
  return Math.round(number);
}

// Cloud-Drucke haben eine task_id, LAN-Drucke stattdessen oft nur lan_task_id; "0" bedeutet "keine"
function parseJobKey(raw: RawPrintFields): string | null {
  for (const field of [raw.task_id, raw.lan_task_id, raw.job_id, raw.subtask_id]) {
    const value = asIdText(field);
    if (value !== '' && value !== '0') return value;
  }
  const jobName = parseJobName(raw);
  const gcodeFile = typeof raw.gcode_file === 'string' ? raw.gcode_file : '';
  return jobName === null ? null : `${jobName}|${gcodeFile}`;
}

function asIdText(value: unknown): string {
  if (typeof value === 'number') return String(value);
  if (typeof value === 'string') return value.trim();
  return '';
}

// subtask_name ist der Name aus Bambu Studio; gcode_file ist oft nur ein interner Pfad wie /data/Metadata/plate_1.gcode
function parseJobName(raw: RawPrintFields): string | null {
  const subtaskName = typeof raw.subtask_name === 'string' ? raw.subtask_name.trim() : '';
  if (subtaskName !== '') return subtaskName;

  const gcodeFile = typeof raw.gcode_file === 'string' ? raw.gcode_file.trim() : '';
  if (gcodeFile === '') return null;
  const fileName = gcodeFile.split('/').pop() ?? '';
  return fileName.replace(/\.(gcode\.)?3mf$|\.gcode$/i, '') || null;
}
