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
  fileName: string;
  fileSize: number;
  fileType: string;
};

export type UploadStatus = "idle" | "success" | "error";

export type UploadHistoryItem = {
  fileName: string;
  fileSize: number;
  fileType: string;
  testedAt: string;
};
