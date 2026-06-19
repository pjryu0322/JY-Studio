/**
 * @deprecated Import from `@/lib/planning/projectSchemaProvisionFailure` instead.
 */
export {
  buildProjectDataStoreStatusNotice,
  buildProjectDatabaseStatusNotice,
  buildSaveResultNotice,
  classifyProjectSchemaProvisionFailure as classifyProjectDatabaseCreationFailure,
  projectDataStoreActionGuide,
  projectDatabaseActionGuide,
  projectDatabaseFailureUserMessage,
  projectSchemaProvisionFailureUserMessage,
  readProjectSchemaProvisionFailureReason as readProjectDatabaseCreationFailureReason,
  shouldHideSaveMessageWhenStatusFailed,
  type ProjectDataStoreStatusNotice,
  type ProjectDatabaseStatusNotice,
  type ProjectSchemaProvisionFailureReason as ProjectDatabaseCreationFailureReason,
} from "@/lib/planning/projectSchemaProvisionFailure";
