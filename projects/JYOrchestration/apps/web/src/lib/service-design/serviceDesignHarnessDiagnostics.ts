export type ServiceDesignHarnessApplicationStatus = {
  stage: "ideation" | "service-flow" | "feature-planning";
  /** The caller received a `ServiceDesignHarnessPayload` (or equivalent). */
  payloadReceived: boolean;
  /** `runHarness()` is executed in the execution path (confirmed by source). */
  runHarnessExecuted: boolean;
  /** The backend API contract applies harness outputs (not just metadata pass-through). */
  backendContractApplied: boolean;
  /** Human-readable caveats / confirmations (source-level notes). */
  notes: string[];
};

