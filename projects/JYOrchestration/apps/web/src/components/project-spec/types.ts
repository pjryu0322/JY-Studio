export type Project = {
  id: string;
  name: string;
  description: string | null;
  projectType: string;
  status: string;
};

export type ApiResponse<T> = {
  success: boolean;
  message?: string;
  data?: T;
};

export type UploadResult = {
  id: string;
  projectId: string;
  originalFileName: string;
  fileSize: number;
  fileType: string;
  sourceType: string;
  parseStatus: string;
  parsedAt: string | null;
  hasParsedJson: boolean;
  status: string;
  createdAt: string;
  contentStored: boolean;
};

export type UploadStatus = "idle" | "success" | "error";

export type UploadHistoryItem = {
  id: string;
  projectId: string;
  originalFileName: string;
  fileSize: number;
  fileType: string;
  sourceType: string;
  parseStatus: string;
  parsedAt: string | null;
  hasParsedJson: boolean;
  status: string;
  createdAt: string;
  contentStored: boolean;
};

export type ParseResult = {
  id: string;
  parseStatus: string | null;
  parsedAt: string | null;
  hasParsedJson: boolean;
};

export type TaskItem = {
  id: string;
  projectId: string;
  projectSpecUploadId: string;
  name: string;
  description: string;
  status: string;
  order: number;
  createdAt: string;
  updatedAt: string;
};
