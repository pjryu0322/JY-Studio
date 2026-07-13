export class DoclingImportError extends Error {
  constructor(
    public code: string,
    message: string,
    public httpStatus = 400,
  ) {
    super(message);
    this.name = "DoclingImportError";
  }
}

export function isDoclingImportError(e: unknown): e is DoclingImportError {
  return e instanceof DoclingImportError;
}
