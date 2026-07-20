/**
 * Optional entry for a future ZIP Worker job loop.
 *
 * Current slice provides library APIs only:
 * - runPythonWorkerCli
 * - validateWorkerOutputDirectory / prepareWorkerOutputImport
 * - object key planners
 *
 * Wire a DoclingProcessingJob-style claim loop here when ZIP upload sessions exist.
 * Python Worker must never upload to Object Storage from this process.
 */
export {
  prepareWorkerOutputImport,
  runPythonWorkerCli,
  validateWorkerOutputDirectory,
} from "@/lib/python-worker";
