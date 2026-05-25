/**
 * User-facing labels for the service-planning workspace (SingleChat / Quick Design).
 * Internal keys remain `planning.*`, `service-planning`, timeline actions, etc.
 */

/** Lower slot area formerly shown as 「기획」 in slot grids (distinct from workflow step 「기획」). */
export const SERVICE_DEFINITION_AREA_LABEL = "서비스 정의" as const;

export const SERVICE_DEFINITION_PROGRESS_LABEL = "서비스 정의 진행도" as const;

export const SERVICE_DEFINITION_DETAIL_ARIA_LABEL = "서비스 정의 상세" as const;

/** Quick Design / AI team draft areas in user-facing order. */
export const SERVICE_PLANNING_TEAM_AREAS_PHRASE = "서비스 정의·분석·설계·디자인" as const;

export function serviceDefinitionSlotPathLabel(slotLabel: string): string {
  return `${SERVICE_DEFINITION_AREA_LABEL} > ${slotLabel}`;
}
