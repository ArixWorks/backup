# راهنمای کامل نصب و راه‌اندازی روی VPS — از ۰ تا ۱۰۰

این سند نصب کامل **Bot Subio** (وب‌اپ + بات تلگرام + مینی‌اپ + پنل ادمین) را روی یک سرور مجازی لینوکسی (Ubuntu 22.04 / 24.04) پوشش می‌دهد.

معماری اجرا:

```
Internet ──▶ Nginx (443/TLS) ──┬──▶ Next.js app        (127.0.0.1:3000)
                               └──▶ Ops WebSocket       (127.0.0.1:4001)

                     PostgreSQL 16   Redis 7
                     (داده)          (قفل/صف/pub-sub)

                     systemd timer ──▶ POST /api/v1/cron/tick   (هر دقیقه)
                                   └─▶ POST /api/v1/cron/monitor (هر دقیقه)
```

دو مسیر نصب داریم:

- **مسیر A — Docker Compose** (ساده‌ترین، توصیه‌شده). Postgres + Redis + اپ در کانتینر.
- **مسیر B — نصب مستقیم (bare-metal)** با Node.js و PM2/systemd.

اگر تازه‌کارید، **مسیر A** را انتخاب کنید.

---

## پیش‌نیازها

- یک VPS با حداقل **۲ vCPU / ۴GB RAM** (پیشنهادی ۴GB به‌بالا؛ ساخت Next.js حافظه‌بر است).
- دامنه‌ای که رکورد `A` آن به IP سرور اشاره کند (مثل `example.com`).
- دسترسی SSH با کاربر `sudo`.
- سرویس‌های ابری (توکن‌ها را از قبل آماده کنید):
  - **توکن بات تلگرام** از [@BotFather](https://t.me/BotFather)
  - **Vercel Blob** توکن (ذخیره فایل) — از داشبورد Vercel > Storage > Blob
  - **Resend** API key (ایمیل) — از [resend.com](https://resend.com)
  - **AI Gateway** key (اختیاری، برای قابلیت‌های AI) — از داشبورد Vercel > AI Gateway

---

## گام ۰ — آماده‌سازی اولیه‌ی سرور

```bash
# ورود به سرور
ssh root@YOUR_SERVER_IP

# بروزرسانی
apt update && apt upgrade -y

# ساخت کاربر غیر-root (اختیاری ولی توصیه‌شده)
adduser deploy
usermod -aG sudo deploy
su - deploy

# ابزارهای پایه
sudo apt install -y git curl ufw

# فایروال: فقط SSH و وب
sudo ufw allow OpenSSH
sudo ufw allow 80
sudo ufw allow 443
sudo ufw enable
```

---

## گام ۱ — گرفتن کد

```bash
cd ~
git clone https://github.com/ArixWorks/backup.git botsubio
cd botsubio
```

> اگر ریپو خصوصی است، از SSH key یا Personal Access Token استفاده کنید.

---

## گام ۲ — ساخت فایل `.env`

```bash
cp .env.example .env
nano .env
```

حداقل مقادیر **الزامی** که باید پر شوند:

| متغیر | توضیح |
|---|---|
| `NEXT_PUBLIC_APP_URL` | آدرس عمومی سایت، مثل `https://example.com` |
| `AUTH_SECRET` | با `openssl rand -base64 32` بسازید |
| `POSTGRES_PRISMA_URL` | اتصال Postgres (pooled) |
| `POSTGRES_URL_NON_POOLING` | اتصال Postgres (مستقیم، برای migration) |
| `DATABASE_URL` | برابر `POSTGRES_URL_NON_POOLING` |
| `REDIS_URL` | مثل `redis://redis:6379` |
| `CRON_SECRET` | با `openssl rand -base64 32` بسازید |
| `TELEGRAM_BOT_TOKEN` | اگر بات/مینی‌اپ دارید |
| `BLOB_READ_WRITE_TOKEN` | اگر آپلود فایل دارید |
| `RESEND_API_KEY` + `RESEND_FROM` | اگر ایمیل دارید |
| `ADMIN_EMAIL` + `ADMIN_PASSWORD` | حساب ادمین اولیه |

برای ساخت سریع چند رمز:

```bash
echo "AUTH_SECRET=$(openssl rand -base64 32)"
echo "CRON_SECRET=$(openssl rand -base64 32)"
echo "REFERRAL_SIGNAL_SALT=$(openssl rand -base64 32)"
echo "DOMAIN_QUOTE_SECRET=$(openssl rand -base64 32)"
```

> **هشدار امنیتی:** رمزهای پیش‌فرض `docker-compose.yml` (مثل `botsubio`/`change-me-in-production`) را حتماً عوض کنید.

---

# مسیر A — نصب با Docker Compose (توصیه‌شده)

## A‑۱) نصب Docker

```bash
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker $USER
# از سشن خارج و دوباره وارد شوید تا گروه docker اعمال شود
exit
```

بررسی:

```bash
docker --version
docker compose version
```

## A‑۲) تنظیم `.env` برای compose

در حالت Docker، Postgres و Redis داخل خود compose بالا می‌آیند. در `.env` این مقادیر را با نام سرویس‌های داخلی بگذارید:

```env
POSTGRES_PRISMA_URL=postgresql://botsubio:STRONG_PASS@postgres:5432/botsubio?schema=public
POSTGRES_URL_NON_POOLING=postgresql://botsubio:STRONG_PASS@postgres:5432/botsubio?schema=public
DATABASE_URL=postgresql://botsubio:STRONG_PASS@postgres:5432/botsubio?schema=public
REDIS_URL=redis://redis:6379

POSTGRES_USER=botsubio
POSTGRES_PASSWORD=STRONG_PASS
POSTGRES_DB=botsubio
```

## A‑۳) بالا آوردن

```bash
docker compose up -d --build
```

این کار:
1. ایمیج اپ را می‌سازد (`Dockerfile`, خروجی standalone).
2. Postgres 16 و Redis 7 را با volume دائمی بالا می‌آورد.
3. هنگام اولین بوت، `prisma migrate deploy` (یا `db push`) را اجرا و سپس سرور را روی پورت ۳۰۰۰ استارت می‌کند.

بررسی وضعیت و لاگ:

```bash
docker compose ps
docker compose logs -f app
```

## A‑۴) ساخت ادمین و داده‌ی اولیه

```bash
# ساخت حساب ادمین از روی ADMIN_EMAIL/ADMIN_PASSWORD در .env
docker compose exec app pnpm exec tsx scripts/create-admin.ts

# (اختیاری) seed داده‌ی نمونه‌ی production
docker compose exec app pnpm run db:seed:prod
```

سپس مستقیم به **مسیر مشترک: Nginx + TLS** بروید.

---

# مسیر B — نصب مستقیم (bare-metal)

اگر Docker نمی‌خواهید.

## B‑۱) نصب Node.js 20 + pnpm

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
sudo corepack enable
corepack prepare pnpm@latest --activate
node -v && pnpm -v
```

## B‑۲) نصب PostgreSQL 16

```bash
sudo apt install -y postgresql postgresql-contrib
sudo -u postgres psql <<'SQL'
CREATE USER botsubio WITH PASSWORD 'STRONG_PASS';
CREATE DATABASE botsubio OWNER botsubio;
GRANT ALL PRIVILEGES ON DATABASE botsubio TO botsubio;
SQL
```

در `.env` (چون Postgres روی همان سرور است، host برابر `localhost`):

```env
POSTGRES_PRISMA_URL=postgresql://botsubio:STRONG_PASS@localhost:5432/botsubio?schema=public
POSTGRES_URL_NON_POOLING=postgresql://botsubio:STRONG_PASS@localhost:5432/botsubio?schema=public
DATABASE_URL=postgresql://botsubio:STRONG_PASS@localhost:5432/botsubio?schema=public
```

## B‑۳) نصب Redis

```bash
sudo apt install -y redis-server
sudo systemctl enable --now redis-server
```

```env
REDIS_URL=redis://localhost:6379
```

## B‑۴) نصب پکیج‌ها، migration و build

```bash
cd ~/botsubio
pnpm install --frozen-lockfile
pnpm exec prisma migrate deploy   # یا: pnpm exec prisma db push
pnpm exec tsx scripts/create-admin.ts
pnpm run build
```

## B‑۵) اجرای سرویس‌ها با systemd

سرویس اپ اصلی:

```bash
sudo nano /etc/systemd/system/botsubio.service
```

```ini
[Unit]
Description=Bot Subio Next.js app
After=network.target postgresql.service redis-server.service

[Service]
Type=simple
User=deploy
WorkingDirectory=/home/deploy/botsubio
EnvironmentFile=/home/deploy/botsubio/.env
Environment=NODE_ENV=production
Environment=PORT=3000
Environment=HOSTNAME=127.0.0.1
# خروجی standalone: سرور از .next/standalone/server.js اجرا می‌شود
ExecStart=/usr/bin/node .next/standalone/server.js
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

> نکته: در حالت standalone باید `public/` و `.next/static` کنار `server.js` باشند. اگر اپ را جای دیگری منتقل کردید، این دو را هم کپی کنید. در همان مسیر build معمولاً بدون تغییر کار می‌کند.

سرویس WebSocket مرکز عملیات:

```bash
sudo nano /etc/systemd/system/botsubio-ops-ws.service
```

```ini
[Unit]
Description=Bot Subio Ops WebSocket server
After=network.target redis-server.service

[Service]
Type=simple
User=deploy
WorkingDirectory=/home/deploy/botsubio
EnvironmentFile=/home/deploy/botsubio/.env
ExecStart=/usr/bin/node server/ops-ws-server.mjs
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

فعال‌سازی:

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now botsubio botsubio-ops-ws
sudo systemctl status botsubio
```

---

# مسیر مشترک — Nginx + TLS + Cron

این بخش برای هر دو مسیر A و B لازم است.

## گام ۳ — نصب Nginx و reverse proxy

```bash
sudo apt install -y nginx
sudo nano /etc/nginx/sites-available/botsubio
```

```nginx
server {
    listen 80;
    server_name example.com www.example.com;

    client_max_body_size 25m;   # آپلود مدیا

    # اپ Next.js
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # WebSocket مرکز عملیات (مسیر /ops-ws به پورت 4001، با upgrade)
    location /ops-ws {
        proxy_pass http://127.0.0.1:4001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header Cookie $http_cookie;
        proxy_read_timeout 3600s;
    }
}
```

> `NEXT_PUBLIC_OPS_WS_URL` را در `.env` برابر `wss://example.com/ops-ws` بگذارید.

فعال‌سازی و تست:

```bash
sudo ln -s /etc/nginx/sites-available/botsubio /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

## گام ۴ — گواهی SSL با Let's Encrypt

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d example.com -d www.example.com
```

Certbot خودش Nginx را برای HTTPS و ریدایرکت ۸۰→۴۴۳ تنظیم و تمدید خودکار را فعال می‌کند.

## گام ۵ — راه‌اندازی Cron (خیلی مهم)

روی Vercel، `vercel.json` این کار را می‌کرد؛ روی VPS باید خودتان هر دقیقه دو endpoint را صدا بزنید. با systemd timer:

```bash
sudo nano /etc/systemd/system/botsubio-cron.service
```

```ini
[Unit]
Description=Bot Subio cron tick + monitor

[Service]
Type=oneshot
# CRON_SECRET را از .env خودتان اینجا بگذارید یا از EnvironmentFile بخوانید
Environment=CRON_SECRET=YOUR_CRON_SECRET
Environment=BASE=https://example.com
ExecStart=/usr/bin/curl -fsS -X POST -H "Authorization: Bearer ${CRON_SECRET}" ${BASE}/api/v1/cron/tick
ExecStart=/usr/bin/curl -fsS -X POST -H "Authorization: Bearer ${CRON_SECRET}" ${BASE}/api/v1/cron/monitor
```

```bash
sudo nano /etc/systemd/system/botsubio-cron.timer
```

```ini
[Unit]
Description=Run Bot Subio cron every minute

[Timer]
OnCalendar=*:0/1
Persistent=true

[Install]
WantedBy=timers.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now botsubio-cron.timer
sudo systemctl list-timers | grep botsubio
```

> جایگزین ساده‌تر: خط زیر را با `crontab -e` اضافه کنید:
> ```
> * * * * * curl -fsS -X POST -H "Authorization: Bearer YOUR_CRON_SECRET" https://example.com/api/v1/cron/tick >/dev/null 2>&1
> * * * * * curl -fsS -X POST -H "Authorization: Bearer YOUR_CRON_SECRET" https://example.com/api/v1/cron/monitor >/dev/null 2>&1
> ```

## گام ۶ — اتصال بات و مینی‌اپ تلگرام

**روش توصیه‌شده (خودکار):** اپ یک روت ادمین دارد که وبهوک را همراه با
webhook secret، دستورات اسلش و دکمه‌ی منوی چت را یکجا ثبت می‌کند. کافی است
به‌عنوان ادمین وارد شوید و این را صدا بزنید (کوکی نشست ادمین لازم است):

```bash
# پس از لاگین ادمین (کوکی نشست را داشته باشید)
curl -X POST https://example.com/api/telegram/setup \
  -H 'content-type: application/json' \
  -b 'SESSION_COOKIE_HERE' \
  -d '{"action":"install"}'

# بررسی وضعیت فعلی وبهوک:
curl https://example.com/api/telegram/setup -b 'SESSION_COOKIE_HERE'
```

**روش دستی (جایگزین):** بدون webhook secret ثبت می‌کند، پس روش بالا بهتر است:

```bash
curl -X POST "https://api.telegram.org/bot<TELEGRAM_BOT_TOKEN>/setWebhook" \
  -d "url=https://example.com/api/telegram/webhook"
```

> در تنظیمات BotFather دامنه‌ی مینی‌اپ (`/setdomain`) را روی `https://example.com`
> بگذارید تا خطای «Bot domain invalid» رفع شود.

---

## گام ۷ — تأیید نصب (Smoke Test)

```bash
# سلامت پایه
curl -I https://example.com

# باید صفحه‌ی لاگین لود شود
curl -s https://example.com/login | head

# ورود ادمین (باید 200 و کوکی نشست بدهد)
curl -i -X POST https://example.com/api/v1/auth/login \
  -H 'content-type: application/json' \
  -d '{"email":"admin@example.com","password":"YOUR_ADMIN_PASSWORD"}'
```

سپس در مرورگر:
1. به `https://example.com/login` بروید و با حساب ادمین وارد شوید.
2. پنل `/admin` و مرکز عملیات `/admin/ops` را باز کنید (استریم realtime باید وصل شود = تست WebSocket).

---

## به‌روزرسانی نسخه‌ی جدید (Deploy تغییرات)

**مسیر A (Docker):**

```bash
cd ~/botsubio
git pull
docker compose up -d --build
# migrationها هنگام بوت اجرا می‌شوند
```

**مسیر B (bare-metal):**

```bash
cd ~/botsubio
git pull
pnpm install --frozen-lockfile
pnpm exec prisma migrate deploy
pnpm run build
sudo systemctl restart botsubio botsubio-ops-ws
```

---

## پشتیبان‌گیری و بازیابی

اسکریپت‌های آماده (به `DATABASE_URL` نیاز دارند):

```bash
# پشتیبان (خروجی gzip در ./backups)
pnpm run db:backup
# یا در Docker:
docker compose exec app pnpm run db:backup

# بازیابی
CONFIRM_RESTORE=RESTORE pnpm run db:restore
```

بکاپ مستقیم Postgres (توصیه‌شده به‌صورت روزانه در crontab):

```bash
pg_dump "$DATABASE_URL" | gzip > backup-$(date +%F).sql.gz
```

پشتیبان‌گیری از volumeهای Docker:

```bash
docker run --rm -v botsubio_postgres_data:/data -v $PWD:/backup alpine \
  tar czf /backup/pgdata-$(date +%F).tar.gz -C /data .
```

---

## عیب‌یابی

| نشانه | علت محتمل | راه‌حل |
|---|---|---|
| اپ در production کرش با پیام `AUTH_SECRET must be set` | `AUTH_SECRET` خالی است | مقدار بسازید و در `.env` بگذارید، سرویس را ری‌استارت کنید |
| endpointهای `/api/v1/cron/*` خطای 403 | `CRON_SECRET` ست نشده یا هدر اشتباه | مقدار را ست و هدر `Authorization: Bearer <CRON_SECRET>` بفرستید |
| مزایده‌ها نهایی نمی‌شوند / رزروها آزاد نمی‌شوند | cron اجرا نمی‌شود | timer/crontab را بررسی کنید (`systemctl list-timers`) |
| آپلود فایل کار نمی‌کند | `BLOB_READ_WRITE_TOKEN` خالی | توکن Blob را ست کنید |
| ایمیل ارسال نمی‌شود | `RESEND_API_KEY`/`RESEND_FROM` | کلید و دامنه‌ی تأییدشده در Resend را بررسی کنید |
| مرکز عملیات realtime وصل نمی‌شود | سرویس WS یا پروکسی nginx | `botsubio-ops-ws` را بررسی و بلوک `/ops-ws` را در nginx مطمئن شوید |
| قفل‌ها/همزمانی مزایده خراب | `REDIS_URL` ست نیست | Redis واقعی را وصل کنید (نه fallback درون‌حافظه) |
| خطای «Bot domain invalid» در مینی‌اپ | دامنه در BotFather تنظیم نشده | `/setdomain` را روی دامنه‌ی سایت بگذارید |
| ساخت build با کمبود حافظه می‌میرد | RAM کم | swap اضافه کنید یا روی ماشین قوی‌تر build و سپس منتقل کنید |

لاگ‌ها:

```bash
# Docker
docker compose logs -f app

# bare-metal
sudo journalctl -u botsubio -f
sudo journalctl -u botsubio-ops-ws -f
```

---

## چک‌لیست امنیتی نهایی

- [ ] همه‌ی رمزهای پیش‌فرض (`botsubio`, `change-me-in-production`) عوض شده‌اند.
- [ ] `AUTH_SECRET` و `CRON_SECRET` مقدار تصادفی قوی دارند.
- [ ] فایروال فقط ۲۲/۸۰/۴۴۳ را باز گذاشته؛ پورت‌های ۵۴۳۲/۶۳۷۹/۳۰۰۰/۴۰۰۱ از بیرون بسته‌اند.
- [ ] TLS فعال و ریدایرکت ۸۰→۴۴۳ برقرار است.
- [ ] `.env` در گیت commit نشده (در `.gitignore` و `.dockerignore` هست).
- [ ] بکاپ خودکار روزانه‌ی دیتابیس تنظیم شده.
- [ ] `NODE_ENV=production` ست است.
