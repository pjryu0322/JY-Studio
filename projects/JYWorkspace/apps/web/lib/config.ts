const readPort = (value: string | undefined, fallback: number) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

export interface WebConfig {
  webPort: number;
  serverUrl: string;
  livekitUrl: string;
  storageMode: string;
}

export const webConfig: WebConfig = {
  webPort: readPort(process.env.WEB_PORT, 3000),
  serverUrl: process.env.NEXT_PUBLIC_SERVER_URL ?? `http://localhost:${readPort(process.env.SERVER_PORT, 4000)}`,
  livekitUrl: process.env.LIVEKIT_URL ?? "",
  storageMode: process.env.STORAGE_MODE ?? "local"
};

// TODO: Replace direct environment reads with a centralized deployment config source during cloud migration.