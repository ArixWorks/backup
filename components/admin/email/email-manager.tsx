"use client"

import { Mail } from "lucide-react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { EmailAnalytics } from "./email-analytics"
import { EmailLogs } from "./email-logs"
import { EmailSettings } from "./email-settings"

export function EmailManager() {
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 p-4 md:p-6">
      <header className="flex items-center gap-3">
        <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Mail className="size-5" />
        </div>
        <div>
          <h1 className="text-xl font-bold">مدیریت ایمیل</h1>
          <p className="text-sm text-muted-foreground">تحلیل ارسال، گزارش‌ها و پیکربندی سرویس ایمیل</p>
        </div>
      </header>

      <Tabs defaultValue="analytics" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="analytics">تحلیل</TabsTrigger>
          <TabsTrigger value="logs">گزارش‌ها</TabsTrigger>
          <TabsTrigger value="settings">تنظیمات</TabsTrigger>
        </TabsList>
        <TabsContent value="analytics" className="mt-5">
          <EmailAnalytics />
        </TabsContent>
        <TabsContent value="logs" className="mt-5">
          <EmailLogs />
        </TabsContent>
        <TabsContent value="settings" className="mt-5">
          <EmailSettings />
        </TabsContent>
      </Tabs>
    </div>
  )
}
