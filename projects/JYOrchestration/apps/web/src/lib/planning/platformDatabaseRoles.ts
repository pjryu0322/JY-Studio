/** Platform management DB (Prisma / orchestration metadata). Admin pre-creates this database. */
export const JYORCHESTRATION_PLATFORM_MANAGEMENT_DATABASE_NAME = "jyorchestration";

/** Generated project service data (schemas/tables/seed per project). Admin pre-creates this database. */
export const JYPROJECTS_GENERATED_PROJECT_DATA_DATABASE_NAME = "jyprojects";

/** @deprecated Use JYPROJECTS_GENERATED_PROJECT_DATA_DATABASE_NAME */
export const JYPROJECTS_RUNTIME_DATABASE_NAME = JYPROJECTS_GENERATED_PROJECT_DATA_DATABASE_NAME;
