export type GithubRepositorySummary = {
  readonly fullName: string;
  readonly htmlUrl: string;
  readonly defaultBranch: string;
  readonly private: boolean;
  readonly fork: boolean;
  readonly archived: boolean;
  readonly pushedAt?: string | null;
  readonly updatedAt?: string | null;
  readonly size?: number | null;
};

export type GithubRepoLookupResult =
  | { readonly exists: true; readonly repo: GithubRepositorySummary }
  | { readonly exists: false; readonly reason: "not_found" }
  | {
      readonly exists: false;
      readonly reason: "unauthorized" | "forbidden" | "error";
      readonly message: string;
    };

export type GithubRepoAnalysisSummary = {
  readonly defaultBranch: string;
  readonly hasReadme: boolean;
  readonly hasPackageJson: boolean;
  readonly hasTsconfig: boolean;
  readonly hasNextConfig: boolean;
  readonly hasPrisma: boolean;
  readonly topLevelFiles: string[];
  readonly topLevelDirectories: string[];
  readonly detectedStack: string[];
  readonly riskLevel: "empty" | "low" | "medium" | "high";
  readonly recommendation: "create_new_name" | "connect_existing" | "analyze_only" | "manual_review";
  readonly notes: string[];
};

export type GitProvisioningNextAction =
  | "create_repo"
  | "connect_existing"
  | "choose_new_name"
  | "manual_review";
