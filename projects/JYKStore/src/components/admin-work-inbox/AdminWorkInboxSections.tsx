import type { AdminWorkInboxItemViewModel } from "@/lib/admin-work-inbox-view-model";
import { adminWorkInboxDetailHref } from "@/lib/admin-work-inbox/admin-work-inbox-navigation";
import {
  ADMIN_WORK_SECTION_ACCEPT_BODY,
  ADMIN_WORK_SECTION_ACCEPT_TITLE,
  ADMIN_WORK_SECTION_GENERATE_BODY,
  ADMIN_WORK_SECTION_GENERATE_TITLE,
  ADMIN_WORK_SECTION_PACK_REVIEW_BODY,
  ADMIN_WORK_SECTION_PACK_REVIEW_IN_PROGRESS_BODY,
  ADMIN_WORK_SECTION_PACK_REVIEW_IN_PROGRESS_TITLE,
  ADMIN_WORK_SECTION_PACK_REVIEW_TITLE,
  ADMIN_WORK_SECTION_PROVIDER_REVIEW_BODY,
  ADMIN_WORK_SECTION_PROVIDER_REVIEW_TITLE,
  ADMIN_WORK_SECTION_PUBLISHED_BODY,
  ADMIN_WORK_SECTION_PUBLISHED_TITLE,
  ADMIN_WORK_SECTION_RETURNED_BODY,
  ADMIN_WORK_SECTION_RETURNED_TITLE,
  ADMIN_WORK_SECTION_SERVICE_VALIDATION_BODY,
  ADMIN_WORK_SECTION_SERVICE_VALIDATION_TITLE,
} from "@/lib/role-based-ux-copy";
import type { AdminWorkQueueKey } from "@/lib/routes";
import { WorkInboxCard, WorkSection } from "@/components/admin-work-inbox/admin-work-inbox-shared";

export function AdminWorkInboxSections({
  acceptItems,
  generateItems,
  providerReviewInProgressItems,
  serviceValidationItems,
  packReviewRequiredItems,
  packReviewInProgressItems,
  returnedOrRejectedItems,
  legacyReturnedItems,
  publishedItems,
  activeQueue,
  returnedMetaByPack,
}: {
  readonly acceptItems: readonly AdminWorkInboxItemViewModel[];
  readonly generateItems: readonly AdminWorkInboxItemViewModel[];
  readonly providerReviewInProgressItems: readonly AdminWorkInboxItemViewModel[];
  readonly serviceValidationItems: readonly AdminWorkInboxItemViewModel[];
  readonly packReviewRequiredItems: readonly AdminWorkInboxItemViewModel[];
  readonly packReviewInProgressItems: readonly AdminWorkInboxItemViewModel[];
  readonly returnedOrRejectedItems: readonly AdminWorkInboxItemViewModel[];
  readonly legacyReturnedItems: readonly AdminWorkInboxItemViewModel[];
  readonly publishedItems: readonly AdminWorkInboxItemViewModel[];
  readonly activeQueue: AdminWorkQueueKey;
  readonly returnedMetaByPack: ReadonlyMap<string, string>;
}) {
  return (
    <>
      <WorkSection
        title={ADMIN_WORK_SECTION_ACCEPT_TITLE}
        body={ADMIN_WORK_SECTION_ACCEPT_BODY}
        count={acceptItems.length}
        accentClass="bg-indigo-100 text-indigo-900"
      >
        <ul className="space-y-1.5">
          {acceptItems.map((item) => (
            <WorkInboxCard key={item.packId} item={item} />
          ))}
        </ul>
      </WorkSection>

      <WorkSection
        title={ADMIN_WORK_SECTION_GENERATE_TITLE}
        body={ADMIN_WORK_SECTION_GENERATE_BODY}
        count={generateItems.length}
        accentClass="bg-sky-100 text-sky-900"
      >
        <ul className="space-y-1.5">
          {generateItems.map((item) => (
            <WorkInboxCard
              key={item.packId}
              item={item}
              href={adminWorkInboxDetailHref(item, activeQueue)}
              metaLine={returnedMetaByPack.get(item.packId)}
            />
          ))}
        </ul>
      </WorkSection>

      <WorkSection
        title={ADMIN_WORK_SECTION_PROVIDER_REVIEW_TITLE}
        body={ADMIN_WORK_SECTION_PROVIDER_REVIEW_BODY}
        count={providerReviewInProgressItems.length}
        accentClass="bg-violet-100 text-violet-900"
      >
        <ul className="space-y-1.5">
          {providerReviewInProgressItems.map((item) => (
            <WorkInboxCard key={item.packId} item={item} />
          ))}
        </ul>
      </WorkSection>

      <WorkSection
        title={ADMIN_WORK_SECTION_SERVICE_VALIDATION_TITLE}
        body={ADMIN_WORK_SECTION_SERVICE_VALIDATION_BODY}
        count={serviceValidationItems.length}
        accentClass="bg-teal-100 text-teal-900"
      >
        <ul className="space-y-1.5">
          {serviceValidationItems.map((item) => (
            <WorkInboxCard key={item.packId} item={item} />
          ))}
        </ul>
      </WorkSection>

      <WorkSection
        title={ADMIN_WORK_SECTION_PACK_REVIEW_TITLE}
        body={ADMIN_WORK_SECTION_PACK_REVIEW_BODY}
        count={packReviewRequiredItems.length}
        accentClass="bg-orange-100 text-orange-900"
      >
        <ul className="space-y-1.5">
          {packReviewRequiredItems.map((item) => (
            <WorkInboxCard key={item.packId} item={item} />
          ))}
        </ul>
      </WorkSection>

      <WorkSection
        title={ADMIN_WORK_SECTION_PACK_REVIEW_IN_PROGRESS_TITLE}
        body={ADMIN_WORK_SECTION_PACK_REVIEW_IN_PROGRESS_BODY}
        count={packReviewInProgressItems.length}
        accentClass="bg-orange-100 text-orange-900"
      >
        <ul className="space-y-1.5">
          {packReviewInProgressItems.map((item) => (
            <WorkInboxCard key={item.packId} item={item} />
          ))}
        </ul>
      </WorkSection>

      <WorkSection
        title={ADMIN_WORK_SECTION_RETURNED_TITLE}
        body={ADMIN_WORK_SECTION_RETURNED_BODY}
        count={returnedOrRejectedItems.length + legacyReturnedItems.length}
        accentClass="bg-rose-100 text-rose-900"
      >
        <ul className="space-y-1.5">
          {[...returnedOrRejectedItems, ...legacyReturnedItems].map((item) => (
            <WorkInboxCard
              key={item.packId}
              item={item}
              metaLine={returnedMetaByPack.get(item.packId)}
            />
          ))}
        </ul>
      </WorkSection>

      <WorkSection
        title={ADMIN_WORK_SECTION_PUBLISHED_TITLE}
        body={ADMIN_WORK_SECTION_PUBLISHED_BODY}
        count={publishedItems.length}
        accentClass="bg-emerald-100 text-emerald-900"
      >
        <ul className="space-y-1.5">
          {publishedItems.map((item) => (
            <WorkInboxCard key={item.packId} item={item} />
          ))}
        </ul>
      </WorkSection>
    </>
  );
}
