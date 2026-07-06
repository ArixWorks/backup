import type { Metadata } from "next"
import { Playground } from "./playground"

export const metadata: Metadata = {
  title: "آزمایشگاه ویرایشگر محتوا | مدیریت",
}

export default function RichContentLabPage() {
  return <Playground />
}
