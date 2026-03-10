const readPort = (value: string | undefined, fallback: number) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

export interface WorkerConfig {
  workerPort: number;
  serverBaseUrl: string;
  storageMode: string;
  storageBasePath: string;
  logDir: string;
  azureSpeechKey: string;
  azureSpeechRegion: string;
}

export const workerConfig: WorkerConfig = {
  workerPort: readPort(process.env.WORKER_PORT, 4100),
  serverBaseUrl: process.env.SERVER_BASE_URL ?? `http://localhost:${readPort(process.env.SERVER_PORT, 4000)}`,
  storageMode: process.env.STORAGE_MODE ?? "local",
  storageBasePath: process.env.STORAGE_BASE_PATH ?? "./runtime/storage",
  logDir: process.env.LOG_DIR ?? "./runtime/logs",
  azureSpeechKey: process.env.AZURE_SPEECH_KEY ?? "",
  azureSpeechRegion: process.env.AZURE_SPEECH_REGION ?? ""
};

// TODO: Replace local temp/audio handling with cloud queue and object storage adapters during cloud migration.