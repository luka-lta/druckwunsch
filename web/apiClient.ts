import type {
  CatalogEntryResponse,
  CreatePrintRequestRequest,
  FilamentRequest,
  FilamentResponse,
  LoginRequest,
  MeResponse,
  PreviewResponse,
  PrinterStatusResponse,
  PrintRequestResponse,
  PrintRequestStatus,
  StatisticsResponse,
  UpdatePrintRequestRequest,
} from '../shared/api';

export class ApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const response = await fetch(path, {
    method,
    headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
    credentials: 'same-origin',
  });

  if (response.status === 204) return undefined as T;
  const data: unknown = await response.json().catch(() => null);
  if (response.ok) return data as T;

  const message = (data as { error?: unknown } | null)?.error;
  throw new ApiError(response.status, typeof message === 'string' ? message : 'Unbekannter Fehler');
}

/** Lädt die angemeldete Person, oder null wenn niemand angemeldet ist */
export async function loadMe(): Promise<MeResponse | null> {
  try {
    return await request<MeResponse>('GET', '/api/me');
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) return null;
    throw error;
  }
}

export function login(input: LoginRequest): Promise<MeResponse> {
  return request('POST', '/api/login', input);
}

export function logout(): Promise<void> {
  return request('POST', '/api/logout');
}

export function loadPrintRequests(): Promise<PrintRequestResponse[]> {
  return request('GET', '/api/requests');
}

export function createPrintRequest(input: CreatePrintRequestRequest): Promise<PrintRequestResponse> {
  return request('POST', '/api/requests', input);
}

export function updatePrintRequestStatus(id: number, status: PrintRequestStatus): Promise<PrintRequestResponse> {
  return updatePrintRequest(id, { status });
}

export function updatePrintRequest(id: number, update: UpdatePrintRequestRequest): Promise<PrintRequestResponse> {
  return request('PATCH', `/api/requests/${id}`, update);
}

export function updatePrintRequestOrder(ids: number[]): Promise<void> {
  return request('PUT', '/api/requests/order', { ids });
}

export function submitSavedPrintRequest(id: number): Promise<PrintRequestResponse> {
  return request('POST', `/api/requests/${id}/submit`);
}

export function deletePrintRequest(id: number): Promise<void> {
  return request('DELETE', `/api/requests/${id}`);
}

export function loadPreview(url: string): Promise<PreviewResponse> {
  return request('GET', `/api/preview?url=${encodeURIComponent(url)}`);
}

export function loadPrinterStatus(): Promise<PrinterStatusResponse> {
  return request('GET', '/api/printer');
}

export function loadFilaments(): Promise<FilamentResponse[]> {
  return request('GET', '/api/filaments');
}

export function createFilament(input: FilamentRequest): Promise<FilamentResponse> {
  return request('POST', '/api/filaments', input);
}

export function updateFilament(id: number, input: FilamentRequest): Promise<FilamentResponse> {
  return request('PUT', `/api/filaments/${id}`, input);
}

export function deleteFilament(id: number): Promise<void> {
  return request('DELETE', `/api/filaments/${id}`);
}

export function loadStatistics(): Promise<StatisticsResponse> {
  return request('GET', '/api/statistics');
}

export function searchFilamentCatalog(query: string): Promise<CatalogEntryResponse[]> {
  return request('GET', `/api/filament-catalog?query=${encodeURIComponent(query)}`);
}

/** Lädt einen Katalogeintrag per Farbnummer, oder null wenn die Nummer unbekannt ist */
export async function loadCatalogEntry(code: string): Promise<CatalogEntryResponse | null> {
  try {
    return await request<CatalogEntryResponse>('GET', `/api/filament-catalog/${encodeURIComponent(code)}`);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return null;
    throw error;
  }
}
