import { ProviderCenterPageClient } from "@/components/ProviderCenterPageClient";

/** Provider-mode rail entry: review-target inbox only. */
export default function ProviderReviewsPage() {
  return (
    <ProviderCenterPageClient
      variant="reviewInbox"
      initialFilter="providerReviewRequested"
    />
  );
}
