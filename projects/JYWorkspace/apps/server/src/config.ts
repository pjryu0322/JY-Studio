const readPort = (value: string | undefined, fallback: number) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

export interface ServerConfig {
  serverPort: number;
  databaseUrl: string;
  storageMode: string;
  storageBasePath: string;
  logDir: string;
  livekitUrl: string;
  livekitApiKey: string;
  livekitApiSecret: string;
  azureSpeechKey: string;
  azureSpeechRegion: string;
}

export const serverConfig: ServerConfig = {
  serverPort: readPort(process.env.SERVER_PORT, 4000),
  databaseUrl: process.env.DATABASE_URL ?? "postgres://localhost:5432/jyworkspace",
  storageMode: process.env.STORAGE_MODE ?? "local",
  storageBasePath: process.env.STORAGE_BASE_PATH ?? "./runtime/storage",
  logDir: process.env.LOG_DIR ?? "./runtime/logs",
  livekitUrl: process.env.LIVEKIT_URL ?? "",
  livekitApiKey: process.env.LIVEKIT_API_KEY ?? "",
  livekitApiSecret: process.env.LIVEKIT_API_SECRET ?? "",
  azureSpeechKey: process.env.AZURE_SPEECH_KEY ?? "",
  azureSpeechRegion: process.env.AZURE_SPEECH_REGION ?? ""
};

// TODO: Map local filesystem storage and logging to managed cloud services during cloud migration.