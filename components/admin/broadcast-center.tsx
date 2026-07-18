"use client"

import { useMemo, useState } from "react"
import useSWR, { mutate } from "swr"
import { Bell, Bot, CalendarClock, CheckCircle2, ChevronLeft, CirclePause, ExternalLink, FileUp, Filter, Loader2, Megaphone, Package, Play, RefreshCw, Save, Send, Smartphone, Users, XCircle } from "lucide-react"
import { fetcher } from "@/lib/api-client"
import { cn } from "@/lib/utils"
import { TelegramMessageEditor } from "@/components/admin/telegram-message-editor"
import { BroadcastAudienceSelector } from "@/components/admin/broadcast-audience-selector"

type Campaign = { id: string; title: string; status: string; channels: string[]; totalRecipients: number; pendingCount: number; sentCount: number; failedCount: number; createdAt: string; scheduledAt?: string }
type AudienceResult = { count: number; sample: Array<{ id: string; displayName: string; telegramUsername?: string; telegramChatId?: string; vipManual: boolean }> }
type Product = { id: string; title: string; description?: string | null; coverImage?: string | null; fixedSale?: { status: string; price?: string | number } | null }
type AudienceUser = { id: string; displayName: string; alias?: string | null; username?: string | null; telegramUsername?: string | null; telegramId?: string | null; telegramChatId?: string | null; vipManual: boolean }
type AudienceMode = "ALL" | "FILTERED" | "SELECTED"
type ButtonStyle = "default" | "primary" | "success" | "danger"

const statusLabel: Record<string, string> = { DRAFT: "پیش‌نویس", SCHEDULED: "زمان‌بندی‌شده", QUEUED: "در صف", SENDING: "در حال ارسال", PAUSED: "متوقف", COMPLETED: "تکمیل", CANCELLED: "لغو" }

function escapeTelegramHtml(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
}

function emojiPreviewHtml(value: string) {
  return value.replace(/\[(\d{5,32})\]/g, '<span class="inline-flex rounded-md bg-primary/10 px-1.5 py-0.5 font-mono text-xs text-primary" title="emoji-id: $1">✨</span>')
}

export function BroadcastCenter() {
  const { data, isLoading } = useSWR<{ data: Campaign[] }>("/api/v1/admin/broadcasts", fetcher, { refreshInterval: 10000 })
  const campaigns = data?.data ?? []
  const { data: productData } = useSWR<{ data: Product[] }>("/api/v1/admin/products", fetcher)
  const products = useMemo(() => productData?.data?.filter((product) => product.fixedSale) ?? [], [productData])
  const [tab, setTab] = useState<"compose" | "history">("compose")
  const [title, setTitle] = useState("")
  const [channels, setChannels] = useState<string[]>(["TELEGRAM"])
  const [html, setHtml] = useState("")
  const [webTitle, setWebTitle] = useState("")
  const [webBody, setWebBody] = useState("")
  const [webHref, setWebHref] = useState("")
  const [media, setMedia] = useState<Array<{ type: string; url: string }>>([])
  const [buttonText, setButtonText] = useState("خرید و اطلاعات بیشتر")
  const [buttonUrl, setButtonUrl] = useState("")
  const [buttonType, setButtonType] = useState<"PRODUCT" | "LINK">("PRODUCT")
  const [buttonStyle, setButtonStyle] = useState<ButtonStyle>("default")
  const [productId, setProductId] = useState("")
  const [audienceMode, setAudienceMode] = useState<AudienceMode>("FILTERED")
  const [selectedUsers, setSelectedUsers] = useState<AudienceUser[]>([])
  const [vipOnly, setVipOnly] = useState(false)
  const [hasTelegram, setHasTelegram] = useState(false)
  const [scheduledAt, setScheduledAt] = useState("")
  const [audience, setAudience] = useState<AudienceResult | null>(null)
  const [busy, setBusy] = useState("")
  const [message, setMessage] = useState("")
  const selectedProduct = useMemo(() => products.find((product) => product.id === productId), [products, productId])

  function selectProduct(id: string) {
    setProductId(id)
    const product = products.find((item) => item.id === id)
    if (!product) return
    setButtonType("PRODUCT")
    setButtonText((current) => current || "خرید و اطلاعات بیشتر")
    setTitle((current) => current || `معرفی محصول: ${product.title}`)
    setHtml((current) => current || `<b>${escapeTelegramHtml(product.title)}</b>\n\n`)
    if (product.coverImage) setMedia((current) => current.length ? current : [{ type: "photo", url: product.coverImage! }])
  }

  const payload = useMemo(() => ({
    title: title || "پیام بدون عنوان",
    channels,
    audience: {
      mode: audienceMode,
      userIds: audienceMode === "SELECTED" ? selectedUsers.map((user) => user.id) : [],
      statuses: ["ACTIVE"],
      vipOnly: audienceMode === "FILTERED" ? vipOnly : false,
      languageCodes: [],
      hasTelegram: audienceMode === "FILTERED" ? hasTelegram || undefined : undefined,
    },
    telegramContent: channels.includes("TELEGRAM") ? {
      html,
      media,
      buttons: buttonText && (buttonType === "PRODUCT" ? productId : buttonUrl) ? [[{
        text: buttonText,
        url: buttonType === "PRODUCT" ? `${process.env.NEXT_PUBLIC_APP_URL || "https://acciran.com"}/flash/${productId}` : buttonUrl,
        openIn: buttonType === "PRODUCT" ? "MINI_APP" : "BROWSER",
        style: buttonStyle,
      }]] : [],
      disablePreview: true,
      silent: false,
      protectContent: false,
    } : undefined,
    webContent: channels.includes("WEB") ? { title: webTitle, body: webBody, href: webHref || undefined } : undefined,
    scheduledAt: scheduledAt ? new Date(scheduledAt).toISOString() : undefined,
  }), [title, channels, audienceMode, selectedUsers, vipOnly, hasTelegram, html, media, buttonText, buttonUrl, buttonType, buttonStyle, productId, webTitle, webBody, webHref, scheduledAt])

  async function request(url: string, body: unknown) {
    const response = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) })
    const result = await response.json()
    if (!response.ok || !result.ok) throw new Error(result.error?.message || "عملیات ناموفق بود")
    return result.data
  }

  async function previewAudience() {
    setBusy("audience"); setMessage("")
    try { setAudience(await request("/api/v1/admin/broadcasts/audience", payload.audience)) } catch (error) { setMessage((error as Error).message) } finally { setBusy("") }
  }

  async function submit(action: "DRAFT" | "SEND" | "SCHEDULE") {
    setBusy(action); setMessage("")
    try {
      await request("/api/v1/admin/broadcasts", { ...payload, action })
      setMessage(action === "DRAFT" ? "پیش‌نویس ذخیره شد." : action === "SCHEDULE" ? "کمپین زمان‌بندی شد." : "کمپین وارد صف ارسال شد.")
      await mutate("/api/v1/admin/broadcasts")
      setTab("history")
    } catch (error) { setMessage((error as Error).message) } finally { setBusy("") }
  }

  async function sendTest() {
    setBusy("test"); setMessage("")
    try { await request("/api/v1/admin/broadcasts/test", payload); setMessage("پیام آزمایشی برای حساب مدیر ارسال شد.") } catch (error) { setMessage((error as Error).message) } finally { setBusy("") }
  }

  async function upload(file?: File) {
    if (!file) return
    setBusy("upload")
    try {
      const form = new FormData(); form.append("file", file)
      const response = await fetch("/api/v1/admin/media", { method: "POST", body: form })
      const result = await response.json()
      if (!response.ok || !result.ok) throw new Error("آپلود ناموفق بود")
      const item = result.data
      setMedia((items) => [...items, { type: item.kind === "IMAGE" ? "photo" : item.kind === "VIDEO" ? "video" : item.kind === "AUDIO" ? "audio" : "document", url: item.url }].slice(0, 10))
    } catch (error) { setMessage((error as Error).message) } finally { setBusy("") }
  }

  async function campaignAction(id: string, action: string) {
    setBusy(id + action)
    try { await request(`/api/v1/admin/broadcasts/${id}/action`, { action }); await mutate("/api/v1/admin/broadcasts") } catch (error) { setMessage((error as Error).message) } finally { setBusy("") }
  }

  return (
    <section className="flex min-w-0 flex-col gap-5" dir="rtl">
      <header className="glass flex flex-col gap-4 rounded-2xl border border-border/60 p-5 shadow-lg sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3"><span className="flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary"><Megaphone className="size-5" /></span><div><h1 className="text-xl font-bold text-balance">مرکز پیام</h1><p className="text-sm text-muted-foreground">ارسال هدفمند به تلگرام و صندوق پیام وب‌اپ</p></div></div>
        <div className="flex rounded-xl bg-secondary p-1"><button onClick={() => setTab("compose")} className={cn("rounded-lg px-4 py-2 text-sm font-semibold", tab === "compose" && "bg-background text-primary shadow-sm")}>پیام جدید</button><button onClick={() => setTab("history")} className={cn("rounded-lg px-4 py-2 text-sm font-semibold", tab === "history" && "bg-background text-primary shadow-sm")}>کمپین‌ها</button></div>
      </header>

      {message && <div className="rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 text-sm text-foreground">{message}</div>}

      {tab === "compose" ? <div className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1fr)_300px]">
        <div className="flex min-w-0 flex-col gap-5">
          <Panel title="مقصد و عنوان" icon={Send}>
            <label className="flex flex-col gap-2 text-sm font-semibold">عنوان داخلی کمپین<input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="مثلاً اطلاع‌رسانی جشنواره تابستان" className="h-11 rounded-xl border border-border bg-background px-3 font-normal outline-none focus:border-primary" /></label>
            <div className="grid gap-3 sm:grid-cols-2">{[["TELEGRAM", Bot, "تلگرام", "پیام کامل، رسانه و دکمه"], ["WEB", Bell, "وب‌اپ", "پیام کوتاه در صندوق اعلان"]].map(([key, Icon, label, hint]) => <button key={key as string} type="button" onClick={() => setChannels((list) => list.includes(key as string) ? list.filter((x) => x !== key) : [...list, key as string])} className={cn("flex items-center gap-3 rounded-xl border p-4 text-right", channels.includes(key as string) ? "border-primary bg-primary/5" : "border-border bg-background")}><Icon className="size-5 text-primary" /><span><b className="block text-sm">{label as string}</b><small className="text-muted-foreground">{hint as string}</small></span></button>)}</div>
          </Panel>

          {channels.includes("TELEGRAM") && <Panel title="محتوای تلگرام" icon={Bot}>
            <div className="flex flex-col gap-3 rounded-xl border border-border bg-secondary/40 p-4">
              <div className="flex items-start gap-3">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"><Package className="size-5" /></span>
                <div><h3 className="text-sm font-bold">ارسال محصول جدید</h3><p className="text-xs leading-5 text-muted-foreground">محصول را انتخاب کنید تا تصویر، مقصد دکمه و قالب اولیه پیام آماده شود.</p></div>
              </div>
              <label className="flex flex-col gap-2 text-xs font-semibold text-muted-foreground">محصول مقصد
                <select value={productId} onChange={(event) => selectProduct(event.target.value)} className="h-11 rounded-xl border border-border bg-background px-3 text-sm text-foreground">
                  <option value="">انتخاب محصول…</option>
                  {products.map((product) => <option key={product.id} value={product.id}>{product.title}</option>)}
                </select>
              </label>
              {selectedProduct ? <div className="flex items-center gap-3 rounded-xl bg-background p-3">
                {selectedProduct.coverImage ? <img src={selectedProduct.coverImage} alt={`تصویر ${selectedProduct.title}`} className="size-14 shrink-0 rounded-lg object-cover" /> : <span className="flex size-14 shrink-0 items-center justify-center rounded-lg bg-secondary text-muted-foreground"><Package className="size-5" /></span>}
                <div className="min-w-0 flex-1"><b className="block truncate text-sm">{selectedProduct.title}</b><span className="text-xs text-muted-foreground">تصویر محصول و لینک Mini App آماده است</span></div>
                <CheckCircle2 className="size-5 shrink-0 text-primary" aria-label="آماده" />
              </div> : null}
            </div>
            <TelegramMessageEditor value={html} onChange={setHtml} />
            <div className="rounded-xl border border-primary/20 bg-primary/5 p-3 text-xs leading-6 text-muted-foreground"><p>برای ایموجی متحرک فقط شناسه آن را داخل کروشه بنویسید؛ نمونه:</p><code dir="ltr" className="mt-1 inline-block rounded bg-background px-2 py-1 font-mono text-foreground">[5900186420659622041] تست</code><p className="mt-1">هنگام ارسال، کد به ایموجی متحرک رسمی تلگرام تبدیل می‌شود.</p></div>
            <p className="text-xs leading-5 text-muted-foreground">متن را انتخاب کنید و از نوار بالا برای ضخیم، مورب، زیرخط، اسپویلر، نقل‌قول، لینک، کد و ایموجی استفاده کنید؛ نیازی به نوشتن HTML نیست.</p>
            <div className="flex flex-wrap gap-2"><label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-dashed border-primary/50 px-4 py-2 text-sm font-semibold text-primary"><FileUp className="size-4" />{busy === "upload" ? "در حال آپلود…" : "افزودن رسانه"}<input type="file" accept="image/*,video/*,audio/*,.pdf,.zip" className="sr-only" onChange={(e) => upload(e.target.files?.[0])} /></label>{media.map((item, index) => <button type="button" key={item.url} onClick={() => setMedia((items) => items.filter((_, i) => i !== index))} className="rounded-xl bg-secondary px-3 py-2 text-xs">{item.type} · حذف</button>)}</div>
            <div className="flex rounded-xl bg-secondary p-1"><button type="button" onClick={() => setButtonType("PRODUCT")} className={cn("flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold", buttonType === "PRODUCT" && "bg-background text-primary shadow-sm")}><Package className="size-4" />محصول در وب‌اپ</button><button type="button" onClick={() => setButtonType("LINK")} className={cn("flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold", buttonType === "LINK" && "bg-background text-primary shadow-sm")}><ExternalLink className="size-4" />لینک معمولی</button></div>
            <div className="grid gap-3 sm:grid-cols-2"><label className="flex flex-col gap-2 text-xs font-semibold text-muted-foreground">متن دکمه<input value={buttonText} onChange={(e) => setButtonText(e.target.value)} placeholder="مثلاً خرید" className="h-11 rounded-xl border border-border bg-background px-3 text-sm text-foreground" /></label>{buttonType === "PRODUCT" ? <label className="flex flex-col gap-2 text-xs font-semibold text-muted-foreground">محصول مقصد<select value={productId} onChange={(e) => selectProduct(e.target.value)} className="h-11 rounded-xl border border-border bg-background px-3 text-sm text-foreground"><option value="">انتخاب محصول…</option>{products.map((product) => <option key={product.id} value={product.id}>{product.title}</option>)}</select></label> : <label className="flex flex-col gap-2 text-xs font-semibold text-muted-foreground">آدرس لینک<input dir="ltr" value={buttonUrl} onChange={(e) => setButtonUrl(e.target.value)} placeholder="https://…" className="h-11 rounded-xl border border-border bg-background px-3 text-sm text-foreground" /></label>}</div>
            <fieldset className="flex flex-col gap-2"><legend className="mb-2 text-xs font-semibold text-muted-foreground">رنگ دکمه تلگرام</legend><div className="grid grid-cols-2 gap-2 sm:grid-cols-4">{([['default', 'شیشه‌ای', 'bg-secondary text-foreground'], ['primary', 'آبی', 'bg-blue-600 text-primary-foreground'], ['success', 'سبز', 'bg-green-600 text-primary-foreground'], ['danger', 'قرمز', 'bg-red-600 text-primary-foreground']] as const).map(([value, label, color]) => <button type="button" key={value} onClick={() => setButtonStyle(value)} className={cn("h-10 rounded-xl border text-xs font-bold", color, buttonStyle === value ? "border-primary ring-2 ring-primary/30" : "border-transparent")}>{label}</button>)}</div></fieldset>
            {buttonType === "PRODUCT" ? <div className="rounded-xl border border-primary/20 bg-primary/5 p-3 text-xs leading-5 text-muted-foreground">این دکمه با قابلیت رسمی Telegram Web App ارسال می‌شود؛ کاربر با لمس آن، صفحه همان محصول را داخل تلگرام می‌بیند و به مرورگر منتقل نمی‌شود.</div> : null}
          </Panel>}

          {channels.includes("WEB") && <Panel title="اعلان وب‌اپ" icon={Smartphone}>
            <input value={webTitle} maxLength={80} onChange={(e) => setWebTitle(e.target.value)} placeholder="عنوان کوتاه" className="h-11 rounded-xl border border-border bg-background px-3 text-sm" /><textarea value={webBody} maxLength={240} onChange={(e) => setWebBody(e.target.value)} rows={3} placeholder="متن اعلان…" className="rounded-xl border border-border bg-background p-3 text-sm" /><input dir="ltr" value={webHref} onChange={(e) => setWebHref(e.target.value)} placeholder="/products یا لینک مقصد" className="h-11 rounded-xl border border-border bg-background px-3 text-sm" />
          </Panel>}

          <Panel title="مخاطبان" icon={Filter}>
            <div className="grid gap-2 sm:grid-cols-3">{([['ALL', 'همه اعضا'], ['FILTERED', 'انتخاب گروهی'], ['SELECTED', 'انتخاب دستی']] as const).map(([mode, label]) => <button type="button" key={mode} onClick={() => { setAudienceMode(mode); setAudience(null) }} className={cn("h-11 rounded-xl border text-sm font-semibold", audienceMode === mode ? "border-primary bg-primary/10 text-primary" : "border-border bg-background")}>{label}</button>)}</div>
            {audienceMode === "FILTERED" ? <div className="grid gap-3 sm:grid-cols-2"><Toggle checked={vipOnly} onChange={setVipOnly} label="فقط اعضای VIP" /><Toggle checked={hasTelegram} onChange={setHasTelegram} label="فقط کاربران دارای تلگرام" /></div> : null}
            {audienceMode === "SELECTED" ? <BroadcastAudienceSelector selected={selectedUsers} onChange={(users) => { setSelectedUsers(users); setAudience(null) }} /> : null}
            <button onClick={previewAudience} disabled={busy === "audience" || (audienceMode === "SELECTED" && selectedUsers.length === 0)} className="flex h-11 items-center justify-center gap-2 rounded-xl border border-primary text-sm font-semibold text-primary disabled:opacity-50">{busy === "audience" ? <Loader2 className="size-4 animate-spin" /> : <Users className="size-4" />}محاسبه مخاطبان</button>
            {audience && <div className="rounded-xl bg-secondary p-4"><b className="text-2xl tabular-nums">{audience.count.toLocaleString("fa-IR")}</b><span className="mr-2 text-sm text-muted-foreground">کاربر واجد شرایط</span><div className="mt-3 flex flex-wrap gap-2">{audience.sample.slice(0, 6).map((user) => <span key={user.id} className="rounded-full bg-background px-3 py-1 text-xs">{user.displayName}</span>)}</div></div>}
          </Panel>

          <Panel title="ارسال یا زمان‌بندی" icon={CalendarClock}>
            <input type="datetime-local" value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} className="h-11 rounded-xl border border-border bg-background px-3 text-sm" />
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4"><ActionButton onClick={() => submit("SEND")} busy={busy === "SEND"} icon={Send} label="ارسال اکنون" primary /><ActionButton onClick={() => submit("SCHEDULE")} busy={busy === "SCHEDULE"} icon={CalendarClock} label="زمان‌بندی" /><ActionButton onClick={() => submit("DRAFT")} busy={busy === "DRAFT"} icon={Save} label="ذخیره پیش‌نویس" /><ActionButton onClick={sendTest} busy={busy === "test"} icon={Bot} label="ارسال آزمایشی" /></div>
          </Panel>
        </div>

        <aside className="xl:sticky xl:top-5 xl:h-fit"><div className="overflow-hidden rounded-3xl border-4 border-foreground/80 bg-background shadow-2xl"><div className="flex items-center justify-between bg-secondary px-4 py-3 text-xs"><span>پیش‌نمایش</span><Bot className="size-4 text-primary" /></div><div className="min-h-96 bg-secondary/50 p-4"><div className="mt-8 rounded-2xl rounded-tr-sm bg-background p-4 shadow-md"><div className="mb-2 text-xs font-bold text-primary">پیام ربات</div>{media[0] && (media[0].type === "photo" ? <img src={media[0].url} alt="پیش‌نمایش رسانه پیام" className="mb-3 aspect-video w-full rounded-xl object-cover" /> : <div className="mb-3 flex h-36 items-center justify-center rounded-xl bg-secondary text-xs text-muted-foreground">{media[0].type}</div>)}{html ? <div className="whitespace-pre-wrap text-sm leading-6 [&_a]:text-primary [&_blockquote]:border-r-2 [&_blockquote]:border-primary [&_blockquote]:pr-2 [&_code]:rounded [&_code]:bg-secondary [&_code]:px-1 [&_tg-spoiler]:rounded [&_tg-spoiler]:bg-foreground [&_tg-spoiler]:text-transparent" dangerouslySetInnerHTML={{ __html: emojiPreviewHtml(html) }} /> : <p className="whitespace-pre-wrap text-sm leading-6">{webBody || "پیش‌نمایش پیام شما اینجا نمایش داده می‌شود."}</p>}{buttonText && <div className={cn("mt-3 rounded-lg p-2 text-center text-xs font-semibold", buttonStyle === "primary" ? "bg-blue-600 text-primary-foreground" : buttonStyle === "success" ? "bg-green-600 text-primary-foreground" : buttonStyle === "danger" ? "bg-red-600 text-primary-foreground" : "bg-primary/10 text-primary")}>{buttonText}</div>}<div className="mt-2 text-left text-[10px] text-muted-foreground">اکنون</div></div></div></div></aside>
      </div> : <div className="flex flex-col gap-3">{isLoading ? <Loader2 className="mx-auto size-6 animate-spin text-primary" /> : campaigns.length === 0 ? <div className="glass rounded-2xl border border-border p-12 text-center text-sm text-muted-foreground">هنوز کمپینی ساخته نشده است.</div> : campaigns.map((campaign) => <CampaignRow key={campaign.id} campaign={campaign} busy={busy} action={campaignAction} />)}</div>}
    </section>
  )
}

function Panel({ title, icon: Icon, children }: { title: string; icon: typeof Send; children: React.ReactNode }) { return <section className="glass flex flex-col gap-4 rounded-2xl border border-border/60 p-5 shadow-md"><h2 className="flex items-center gap-2 text-sm font-bold"><Icon className="size-4 text-primary" />{title}</h2>{children}</section> }
function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) { return <button type="button" onClick={() => onChange(!checked)} className={cn("flex items-center justify-between rounded-xl border p-4 text-sm", checked ? "border-primary bg-primary/5" : "border-border bg-background")}><span>{label}</span><span className={cn("h-5 w-9 rounded-full p-0.5", checked ? "bg-primary" : "bg-muted")}><span className={cn("block size-4 rounded-full bg-background transition-transform", checked && "-translate-x-4")} /></span></button> }
function ActionButton({ onClick, busy, icon: Icon, label, primary }: { onClick: () => void; busy: boolean; icon: typeof Send; label: string; primary?: boolean }) { return <button type="button" onClick={onClick} disabled={busy} className={cn("flex h-11 items-center justify-center gap-2 rounded-xl border text-sm font-semibold disabled:opacity-50", primary ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background hover:border-primary")} >{busy ? <Loader2 className="size-4 animate-spin" /> : <Icon className="size-4" />}{label}</button> }
function CampaignRow({ campaign, busy, action }: { campaign: Campaign; busy: string; action: (id: string, action: string) => void }) { const progress = campaign.totalRecipients ? Math.round((campaign.sentCount / campaign.totalRecipients) * 100) : 0; return <article className="glass rounded-2xl border border-border/60 p-5"><div className="flex flex-col gap-4 sm:flex-row sm:items-center"><span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">{campaign.status === "COMPLETED" ? <CheckCircle2 className="size-5" /> : campaign.status === "CANCELLED" ? <XCircle className="size-5" /> : <Megaphone className="size-5" />}</span><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h3 className="truncate font-bold">{campaign.title}</h3><span className="rounded-full bg-secondary px-2 py-1 text-[11px]">{statusLabel[campaign.status] || campaign.status}</span></div><div className="mt-2 h-1.5 overflow-hidden rounded-full bg-secondary"><div className="h-full bg-primary" style={{ width: `${progress}%` }} /></div><div className="mt-2 flex gap-4 text-xs text-muted-foreground"><span>{campaign.sentCount.toLocaleString("fa-IR")} ارسال</span><span>{campaign.failedCount.toLocaleString("fa-IR")} خطا</span><span>{campaign.totalRecipients.toLocaleString("fa-IR")} مخاطب</span></div></div><div className="flex gap-2">{["QUEUED", "SENDING"].includes(campaign.status) && <button onClick={() => action(campaign.id, "PAUSE")} className="rounded-lg border border-border p-2" aria-label="توقف"><CirclePause className="size-4" /></button>}{campaign.status === "PAUSED" && <button onClick={() => action(campaign.id, "RESUME")} className="rounded-lg border border-border p-2" aria-label="ادامه"><Play className="size-4" /></button>}{campaign.failedCount > 0 && <button onClick={() => action(campaign.id, "RETRY")} className="rounded-lg border border-border p-2" aria-label="تلاش مجدد"><RefreshCw className={cn("size-4", busy === campaign.id + "RETRY" && "animate-spin")} /></button>}<a href={`/api/v1/admin/broadcasts/${campaign.id}`} className="rounded-lg border border-border p-2" aria-label="جزئیات"><ChevronLeft className="size-4" /></a></div></div></article> }
