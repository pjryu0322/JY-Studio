export type PayloadStorageSaveInput = {
  packId: string;
  versionId: string;
  originalFileName: string;
  bytes: Uint8Array;
};

export type PayloadStorageSaveResult = {
  /** Relative storage key (never a user-supplied filename). */
  storagePath: string;
  fileSize: number;
  checksumSha256: string;
};

/**
 * Abstract immutable payload blob store.
 * Implementations must store original ZIP bytes without re-serialization.
 */
export interface PayloadStorage {
  save(input: PayloadStorageSaveInput): Promise<PayloadStorageSaveResult>;
  read(storagePath: string): Promise<Uint8Array>;
  delete(storagePath: string): Promise<void>;
}
