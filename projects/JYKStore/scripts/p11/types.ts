import type { S3Client } from "@aws-sdk/client-s3";

export type TableCount = {
  model: string;
  table: string;
  count: number;
  packRelated: boolean;
  action: "keep" | "delete" | "unknown";
};

export type ObjectEntry = {
  key: string;
  size: number;
  lastModified: string | null;
  prefixClass: string;
  packId: string | null;
  dbReferenced: boolean;
  classification:
    | "ACTIVE_REFERENCED"
    | "LEGACY_REFERENCED"
    | "ORPHAN_OBJECT"
    | "MISSING_OBJECT"
    | "UNKNOWN";
};

export type S3Config = {
  client: S3Client;
  bucket: string;
  prefix: string;
  endpoint?: string;
  region: string;
};

export type DbUserRow = {
  id: string;
  email: string | null;
  accountRole: string;
  providerProfileCount: number;
  packCount: number;
  apiKeyCount: number;
  keep: boolean;
};

export type DbPackRow = {
  packId: string;
  status: string;
  providerProfileId: string | null;
  versionCount: number;
};

export type DbInventoryResult = {
  tables: TableCount[];
  users: DbUserRow[];
  packs: DbPackRow[];
  categories: number;
  structureTemplates: number;
};

export type ObjectInventoryResult = {
  objects: ObjectEntry[];
  dbKeys: string[];
  missingObjects: string[];
  totals: {
    count: number;
    bytes: number;
    orphanCount: number;
    unknownCount: number;
  };
};

export type ParsedArgs = {
  command: string;
  execute: boolean;
  confirm: string;
};
