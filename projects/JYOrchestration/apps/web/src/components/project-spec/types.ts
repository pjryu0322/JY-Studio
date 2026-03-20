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
  status: string;
  createdAt: string;
  contentStored: boolean;
};
