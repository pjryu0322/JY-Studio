export type PlatformSectionId = "meeting" | "chat" | "documents" | "translation";

export interface PlatformSection {
  id: PlatformSectionId;
  label: string;
  description: string;
}

export interface HealthResponse {
  ok: true;
}

export interface RuntimeEnv {
  webPort: number;
  serverPort: number;
  translationWorkerPort: number;
  serverBaseUrl: string;
  translationServiceUrl: string;
  livekitUrl: string;
}