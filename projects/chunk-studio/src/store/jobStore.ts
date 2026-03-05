"use client";

import { create } from "zustand";
import type { Job } from "@/types/job";

interface JobState {
  jobs: Job[];
  selectedJobId: string | null;
  setSelectedJobId: (id: string | null) => void;
  refresh: () => Promise<void>;
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
              : jobs[0]?.id ?? null,
        }));
      }
    } catch {
      set({ jobs: get().jobs });
    }
  },
}));
