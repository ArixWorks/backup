import { CmsSingletonPage, buildSingletonMetadata } from "@/components/cms/singleton-page"

// The Domain service (availability lookup, ordering, NS/DNS management) is
// planned for a later phase. This route already renders CMS-managed intro
// content so business logic can be added later without changing the URL.
export const dynamic = "force-dynamic"
export const generateMetadata = () => buildSingletonMetadata("domain")

export default function DomainsPage() {
  return <CmsSingletonPage type="domain" />
}
