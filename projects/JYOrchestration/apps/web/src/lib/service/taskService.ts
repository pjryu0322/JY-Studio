/**
 * Task / TaskRun 조회·집계 (projectId 스코프).
 * 실행 로직 변경 없이 데이터 접근만 담당.
 */
import { prisma } from "@/lib/prisma";

export async function countTasksByProjectId(projectId: string): Promise<number> {
  return prisma.task.count({ where: { projectId } });
}

export async function countTaskRunsByProjectId(projectId: string): Promise<number> {
  return prisma.taskRun.count({
    where: { task: { projectId } },
  });
}
