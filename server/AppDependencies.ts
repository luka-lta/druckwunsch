import type { LoginRateLimiter } from './Auth/LoginRateLimiter';
import type { SessionRepository } from './Auth/Repository/SessionRepository';
import type { UserRepository } from './Auth/Repository/UserRepository';
import type { Config } from './Config';
import type { FilamentCatalog } from './Filament/Catalog/BambuCatalog';
import type { FilamentRepository } from './Filament/Repository/FilamentRepository';
import type { PushTokenRepository } from './Notification/Repository/PushTokenRepository';
import type { PrinterStatusSource } from './Printer/BambuPrinterClient';
import type { PrintJobId, PrintJobRepository } from './Printer/PrintJob/PrintJobRepository';
import type { ModelPreviewLoader } from './PrintRequest/ModelPreview';
import type { PrintRequest, PrintRequestRepository } from './PrintRequest/Repository/PrintRequestRepository';

export interface AppDependencies {
  readonly config: Config;
  readonly users: UserRepository;
  readonly sessions: SessionRepository;
  readonly printRequests: PrintRequestRepository;
  readonly filaments: FilamentRepository;
  readonly catalog: FilamentCatalog;
  readonly loginRateLimiter: LoginRateLimiter;
  readonly loadPreview: ModelPreviewLoader;
  /** null, wenn kein Drucker konfiguriert ist */
  readonly printer: PrinterStatusSource | null;
  /** null ohne Drucker; liefert den laufenden Druckauftrag zum Verknüpfen */
  readonly printJobs: { getActiveJobId(): PrintJobId | null } | null;
  readonly printJobRepository: PrintJobRepository;
  readonly pushTokens: PushTokenRepository;
  /** Meldet einen neuen Wunsch per Push an die Admins; läuft im Hintergrund und darf nicht werfen */
  readonly notifyNewRequest: (request: PrintRequest) => void;
  readonly now: () => Date;
}
