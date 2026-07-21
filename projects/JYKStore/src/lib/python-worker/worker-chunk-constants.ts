/**
 * Shared constant for the ZIP Worker retrieval chunk type.
 *
 * Kept in a dependency-free module so both the Worker DB import service and the
 * search-generation count assertion can import it without creating a cycle.
 */
export const WORKER_RETRIEVAL_CHUNK_TYPE = "WORKER_RETRIEVAL_CHUNK";
