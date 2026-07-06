import { CmsSingletonPage, buildSingletonMetadata } from "@/components/cms/singleton-page"

// The VPS service (ordering, provisioning, control panel) is planned for a
// later phase. This route already renders CMS-managed marketing/intro content
// so business logic can be added later without changing the URL or the page.
export const dynamic = "force-dynamic"
export const generateMetadata = () => buildSingletonMetadata("vps")

export default function VpsPage() {
  return <CmsSingletonPage type="vps" />
}
