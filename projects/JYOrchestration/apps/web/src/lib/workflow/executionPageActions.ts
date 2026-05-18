/**
 * Stable import path for execution page actions.
 * Implementation lives in executionProcessActions.ts.
 */

export {
  createExecutionProcessActions as createExecutionPageActions,
  type ExecutionProcessActionContext as ExecutionPageActionContext,
} from "@/lib/workflow/executionProcessActions";
