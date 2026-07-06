import { CmsSingletonPage, buildSingletonMetadata } from "@/components/cms/singleton-page"

export const dynamic = "force-dynamic"
export const generateMetadata = () => buildSingletonMetadata("rules")

export default function RulesPage() {
  return <CmsSingletonPage type="rules" />
}
