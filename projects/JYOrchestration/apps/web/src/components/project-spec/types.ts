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
  fileName: string;
  fileSize: number;
  fileType: string;
  status: string;
  createdAt: string;
};

export type UploadStatus = "idle" | "success" | "error";

export type UploadHistoryItem = {
  id: string;
  projectId: string;
  fileName: string;
  fileSize: number;
  fileType: string;
  status: string;
  createdAt: string;
};
