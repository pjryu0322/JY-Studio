"use client";

import { create } from "zustand";
import type { Job } from "@/types/job";

interface JobState {
  jobs: Job[];
  selectedJobId: string | null;
  setSelectedJobId: (id: string | null) => void;
  refresh: () => Promise<void>;
}

function pickDefaultJobId(jobs: Job[]): string | null {
  return jobs.find((job) => job.status === "DONE")?.id ?? jobs[0]?.id ?? null;
}

export const useJobStore = create<JobState>((set, get) => ({
  jobs: [],
  selectedJobId: null,

  setSelectedJobId: (id) => set({ selectedJobId: id }),

  refresh: async () => {
    try {
      const res = await fetch("/api/jobs");
      if (res.ok) {
        const data = await res.json();
        const jobs: Job[] = data.jobs ?? [];
        set((state) => ({
          jobs,
          selectedJobId:
            state.selectedJobId && jobs.some((j) => j.id === state.selectedJobId)
              ? state.selectedJobId
              : pickDefaultJobId(jobs),
        }));
      }
    } catch {
      set({ jobs: get().jobs });
    }
  },
}));
