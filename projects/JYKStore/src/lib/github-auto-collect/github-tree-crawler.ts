import type { GitHubTreeFileItem } from "./github-auto-collect-types";

export function splitTreeItems(items: GitHubTreeFileItem[]): {
  files: GitHubTreeFileItem[];
  directories: GitHubTreeFileItem[];
} {
  const files: GitHubTreeFileItem[] = [];
  const directories: GitHubTreeFileItem[] = [];
  for (const item of items) {
    if (item.type === "blob") files.push(item);
    else directories.push(item);
  }
  return { files, directories };
}

export function limitFilesForAnalysis(
  files: GitHubTreeFileItem[],
  maxFilesToAnalyze: number,
): { files: GitHubTreeFileItem[]; truncatedByLimit: boolean } {
  if (files.length <= maxFilesToAnalyze) {
    return { files, truncatedByLimit: false };
  }
  const sorted = [...files].sort((a, b) => a.path.localeCompare(b.path));
  return {
    files: sorted.slice(0, maxFilesToAnalyze),
    truncatedByLimit: true,
  };
}
