import type { Job } from "@/types/job";

const initial: Job[] = [
  {
    id: "mock-1",
    status: "ACTION_REQUIRED",
    progress: 0,
    message: "HWP/HWPX 파일은 PDF로 변환 후 업로드해 주세요.",
    originalFilename: "report.hwp",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "mock-2",
    status: "QUEUED",
    progress: 0,
    message: null,
    originalFilename: "doc.pdf",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "mock-3",
    status: "DONE",
    progress: 100,
    message: null,
    originalFilename: "notes.txt",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "mock-4",
    status: "FAILED",
    progress: 30,
    message: "텍스트 추출 중 오류가 발생했습니다.",
    originalFilename: "broken.pdf",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

let store: Job[] = [...initial];

export function getMockJobs(): Job[] {
  return [...store];
}

export function addMockJob(job: Job): void {
  store = [job, ...store];
}

export function updateMockJob(id: string, patch: Partial<Job>): void {
  store = store.map((j) => (j.id === id ? { ...j, ...patch } : j));
}

export function findMockJob(id: string): Job | undefined {
  return store.find((j) => j.id === id);
}
