"use client"

import { useEffect, useState } from "react"
import { toast } from "sonner"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { Loader2 } from "lucide-react"
import { apiPatch, apiPost } from "@/lib/api-client"
import { METRICS } from "@/lib/monitoring/registry"
import type { AlertRule } from "./tabs/alerts-tab"

const CHANNELS = [
  { value: "dashboard", label: "داشبورد" },
  { value: "telegram", label: "تلگرام" },
  { value: "email", label: "ایمیل" },
]
const SEVERITIES = [
  { value: "INFO", label: "اطلاع" },
  { value: "WARNING", label: "هشدار" },
  { value: "CRITICAL", label: "بحرانی" },
]

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  rule: AlertRule | null
  onSaved: () => void
}

export function AlertRuleDialog({ open, onOpenChange, rule, onSaved }: Props) {
  const editing = Boolean(rule)
  const [name, setName] = useState("")
  const [metric, setMetric] = useState(METRICS[0]?.name ?? "")
  const [comparator, setComparator] = useState<"GT" | "LT">("GT")
  const [threshold, setThreshold] = useState("0")
  const [forSeconds, setForSeconds] = useState("0")
  const [severity, setSeverity] = useState("WARNING")
  const [channels, setChannels] = useState<string[]>(["dashboard"])
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    if (rule) {
      setName(rule.name)
      setMetric(rule.metric)
      setComparator(rule.comparator)
      setThreshold(String(rule.threshold))
      setForSeconds(String(rule.forSeconds))
      setSeverity(rule.severity)
      setChannels(rule.channels.length ? rule.channels : ["dashboard"])
    } else {
      setName("")
      setMetric(METRICS[0]?.name ?? "")
      setComparator("GT")
      setThreshold("0")
      setForSeconds("0")
      setSeverity("WARNING")
      setChannels(["dashboard"])
    }
  }, [open, rule])

  async function save() {
    if (!name.trim()) {
      toast.error("نام قانون لازم است")
      return
    }
    if (channels.length === 0) {
      toast.error("حداقل یک کانال اعلان انتخاب کنید")
      return
    }
    const payload = {
      name: name.trim(),
      metric,
      comparator,
      threshold: Number(threshold),
      forSeconds: Number(forSeconds),
      severity,
      channels,
    }
    if (!Number.isFinite(payload.threshold)) {
      toast.error("مقدار آستانه نامعتبر است")
      return
    }
    setSaving(true)
    try {
      if (editing && rule) {
        await apiPatch("/api/v1/admin/ops/alerts/rules", { id: rule.id, ...payload })
      } else {
        await apiPost("/api/v1/admin/ops/alerts/rules", payload)
      }
      toast.success(editing ? "قانون به‌روزرسانی شد" : "قانون ساخته شد")
      onSaved()
    } catch {
      toast.error("ذخیره قانون ناموفق بود")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editing ? "ویرایش قانون هشدار" : "قانون هشدار جدید"}</DialogTitle>
          <DialogDescription>
            وقتی متریک انتخاب‌شده از آستانه عبور کند، هشدار از طریق کانال‌های انتخابی ارسال می‌شود.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="rule-name">نام قانون</Label>
            <Input
              id="rule-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="مثلاً مصرف بالای CPU"
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label>متریک</Label>
            <Select value={metric} onValueChange={(v) => setMetric(v ?? metric)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {METRICS.map((m) => (
                    <SelectItem key={m.name} value={m.name}>
                      {m.label}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-2">
              <Label>شرط</Label>
              <Select value={comparator} onValueChange={(v) => setComparator((v as "GT" | "LT") ?? "GT")}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem value="GT">بیشتر از</SelectItem>
                    <SelectItem value="LT">کمتر از</SelectItem>
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="rule-threshold">آستانه</Label>
              <Input
                id="rule-threshold"
                type="number"
                dir="ltr"
                value={threshold}
                onChange={(e) => setThreshold(e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="rule-for">مدت پایداری (ثانیه)</Label>
              <Input
                id="rule-for"
                type="number"
                dir="ltr"
                value={forSeconds}
                onChange={(e) => setForSeconds(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label>شدت</Label>
              <Select value={severity} onValueChange={(v) => setSeverity(v ?? "WARNING")}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {SEVERITIES.map((s) => (
                      <SelectItem key={s.value} value={s.value}>
                        {s.label}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Label>کانال‌های اعلان</Label>
            <ToggleGroup
              value={channels}
              onValueChange={(v) => setChannels(v as string[])}
              variant="outline"
              className="w-full"
            >
              {CHANNELS.map((c) => (
                <ToggleGroupItem key={c.value} value={c.value} className="flex-1">
                  {c.label}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            انصراف
          </Button>
          <Button onClick={save} disabled={saving}>
            {saving ? <Loader2 data-icon="inline-start" className="animate-spin" /> : null}
            ذخیره
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
