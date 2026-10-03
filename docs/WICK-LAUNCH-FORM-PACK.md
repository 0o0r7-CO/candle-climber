# $WICK LAUNCH FORM PACK — vibe/vibe wizard (/create) — copy-paste ready

> ساخته‌شده در 2026-10-03 از روی اسناد پروژه:
> `docs/TOKEN-LAUNCHPAD-RESEARCH.md` (§3 ساختار ویزارد، §9 چک‌لیست W6) ·
> `docs/VIBE-LAUNCHPAD-INTEL.md` (trace زنده‌ی /create) ·
> `docs/GROWTH-AND-HOOKS-STRATEGY.md` (اقتصاد توکن) · README.
> هر عدد و هر ادعا در این بسته از اسناد اثبات‌محورِ خود پروژه می‌آید — هیچ‌چیز حدسی نیست.
> **زبان فرم انگلیسی است → بلوک‌های «کپی» انگلیسی‌اند؛ توضیح هر فیلد فارسی است.**

---

## ⚠️ قدم صفر — قبل از باز کردن فرم (مهم‌ترین نکته‌ی کل بسته)

در تحقیق زنده‌ی خود ویزارد این جمله ثبت شده: **"All of it is fixed once it is live."**
یعنی هرچه در این فرم وارد کنی — لوگو، اسم، توضیح، لینک‌ها — **بعد از امضا برای همیشه قفل می‌شود و هیچ‌وقت قابل ویرایش نیست.**

پس قبل از امضا این تصمیم‌ها را نهایی کن:

| تصمیم | وضعیت فعلی | توصیه |
|---|---|---|
| اکانت X (توییتر) | ❌ ساخته نشده (آیتم W7) | **قبل از امضا بساز.** حلقه‌ی اشتراک Death Card به X گره خورده؛ اگر خالی بگذاری، بعداً نمی‌توانی اضافه کنی. فقط هندل بساز و یک پین‌توییت (لینک بازی) کافی است |
| Telegram / Discord | ❌ نداریم | خالی بگذار — خالی بودنِ صادقانه بهتر از لینک مرده است |
| لوگو | ✅ موجود است | `icon-512.png` (مربع ۵۱۲) — لینک مستقیم: https://candle-climber.vercel.app/icon-512.png |

سه نکته‌ی فنی که نباید غافلگیرت کند (از trace زنده‌ی `/create`):
1. اول از همه مودال **User Agreement** می‌آید (نسخه `2026-08-29-v2-v3`) — قبولش کن، طبیعی است، باگ نیست.
2. پیش‌نویس فرم خودکار در `localStorage` (کلید `v6-create-draft-app-1`) ذخیره می‌شود — اگر وسط کار مرورگر را بستی، فرم از همان‌جا برمی‌گردد.
3. فیلد کارمزدِ ساخت ممکن است **0.0004 ETH** نشان دهد؛ مقدار واقعی روی‌چنجری (config + محاسبه‌ی آنچین، هر دو تأیید شده) **0.0005 ETH** است. تعجب نکن، جایی که در review screen می‌بینی ملاک است.

---

## 1️⃣ STEP 1 — TOKEN

| فیلد فرم | مقدار (کپی کن) | توضیح |
|---|---|---|
| **Logo** ⭐ الزامی | فایل `icon-512.png` از بالا | مربع، 512×512، همان آیکون PWA بازی — هویت یکسان با محصول |
| **Name** (≤64) | `Candle Climber` | ۱۴ کاراکتر؛ همان نام برند در همه‌جای پروژه |
| **Ticker** (≤16) | `$WICK` | نماد ثابت پروژه از روز اول (README / CC-PLAN)؛ فیت معنایی با مکانیک اصلی بازی (wick = فتیله‌ی کندل) |
| **Pair tab** | `Classic` (native ETH) | «مسیر مستقیم». ۱۲۰۰ از ۱۲۰۰ لانچ اخیر پلتفرم با ETH بودند؛ تنها روتِ battle-tested. تبریک — پیش‌فرض درفت هم همین است |
| **Project type** | `Product & Utility` | دقیقاً همان چیزی که هستیم: بازیِ زنده و قابل‌بازی (کف لانچ پلتفرم: «MVP, demo, prototype, or usable flow» — ما از آن بالاتریم) |
| **Description** | بلوک‌های §7 پایین | نسخه‌ی STANDARD توصیه‌ی اصلی است؛ اگر فیلد کوتاه بود از SHORT |
| **Website** | `https://candle-climber.vercel.app` | بازی زنده و در دسترس — قوی‌ترین برگِ برنده‌ی این فرم |
| **X (Twitter)** | آدرس اکانت X خودت (اگر ساختی) | طبق قدم صفر |
| **Telegram / Discord** | خالی | طبق قدم صفر |

---

## 2️⃣ STEP 2 — TAX

**مجموع مالیات: `2%`** (پلتفرم خودکار ۲۰٪ آن را برمی‌دارد → ۸۰٪ به تو می‌رسد که آزادانه تقسیم می‌کنی)

تقسیم پیشنهادی سهم ۸۰٪ سازنده — الگوی DRGN (لانچ مرجعِ بازی‌محور پلتفرم) با تمرکز روی هولدرها:

| اسلایدر ویزارد | مقدار | چرا |
|---|---|---|
| **Token reflections** (به هولدرهای $WICK) | **75%** | قلب روایت: نگه‌داشتن توکن = سود خودکار. فروش = ضرر خودکار. دقیقاً همان حلقه‌ای که استراتژی رشد می‌خواهد |
| **Treasury** | **20%** | صندوق جوایز تورنمنت‌ها و جایزه‌ی لیدربورد (بعد از graduation که ترنسفرها باز شوند) |
| **Burn** | **5%** | لایه‌ی دیفلیشن اختیاری |
| **ETH reflections** | **0%** | تمرکز روی خود $WICK، نه پراکندگی |

> چرا ۲٪ و نه ۱٪ یا ۳٪؟ DRGN (بازی مرجع) با ۲٪ لانچ شد؛ FORGE (ابزار 3D) با ۱٪. برای ما که «هولدر = بازیکن روزانه» است، بازتاب ۷۵٪ سهم هولدرها منطقی‌ترین ابزار شکل‌دهی رفتار است و ۲٪ رقم متعارف اکوسیستم است.
> یادآوری: ۲۰ ثانیه‌ی anti-snipe در آغاز ترید خودکار فعال می‌شود — کاری لازم نداری.

---

## 3️⃣ STEP 3 — BUY

| فیلد | مقدار | چرا |
|---|---|---|
| **Creator opening buy** | **None** (توصیه‌ی اصلی) | روایت تمیز «هیچ‌کس — حتی سازنده — قبل از بقیه نخریده»؛ با cap ۳٪ خرید اولیه‌ی سازنده هم‌خوان است. جایگزین: 1% اگر سیگنال تعهد می‌خواهی |
| **Creation fee** | 0.0005 ETH خودکار کم می‌شود | اگر UI نوشت 0.0004، ملاک همان 0.0005 آنچین است |
| سقف | تو + ایردراپ‌ها ≤ 50% عرضه | با صفرِ بالا مشکلی نیست |

---

## 4️⃣ STEP 4 — AIRDROPS (گفت لیست هدیه‌ی Merkle)

**توصیه: این مرحله را خالی بگذار (skip).**

چرا — سه دلیل اثباتی:
1. لیست هدیه به **آدرس کیف پول** نیاز دارد؛ در بازی هنوز برداشتِ کیف‌پول نداریم (Balance Gate = P4.2، بعد از لانچ.ship می‌شود). snapshot جعلی نمی‌سازیم.
2. هدیه‌ها تا graduation **قفل** می‌مانند و اگر هرگز graduate نشویم **برای همیشه قفل** می‌مانند — ریسک بی‌دلیل برای دارایی‌ای که گیرنده ندارد.
3. سهم ~۱۰٪ جامعه از روتِ دیگر محقق می‌شود: حساب‌وزنِ ایردراپ (streak / prediction / archive marathon — P4.4) + خزانه‌ی ۲۰٪ برای تورنمنت‌ها. قول ما به جامعه همان می‌ماند، فقط مسیر اجرا درست است.

> DRGN همین ۱۰٪ را برای ۳,۸۷۹ کیف‌پولِ از قبل جمع‌شده رزرو کرد — ما هنوز چنین snapshot ای نداریم.

---

## 5️⃣ چک‌لیست پیش از امضا (O2/O3)

1. ☐ **P4.0** — faucet کنِ testnet ETH روی Robinhood Chain (هزینه‌ی واقعی صفر).
2. ☐ مودال User Agreement را قبول کن (انتظارش را داشتی).
3. ☐ (اختیاری، حرفه‌ای) همان لحظه‌ی لانچ، config زنده را re-verify کن — سیاست ممکن است از 2026-09-30 عوض شده باشد:
   ```bash
   curl -s https://testnet.vibevibe.fun/api/v1/chains/46630/config | jq '.data.protocol | {policyVersion, netGraduationTargetWei, creationFeeWei, curveWalletCapBps, transfersLockedUntilGraduation}'
   ```
   (re-verified 2026-10-03: policy v3 unchanged؛ فیلدها الان زیر `.data.protocol` تو در تو شده‌اند — مسیر قدیمی null برمی‌گرداند)
4. ☐ **Sweep فیلدهای جدید ویزارد (آپدیت Sep 29 «big merge»)** — بعد از ما فرم عوض شده؛ این‌ها را حین پر کردن چک کن و اگر بود، همان پیش‌فرض پک را نگه دار:
   - تب‌های pair: اگر علاوه بر Classic، **Stock pairs / Anything pairs** دیدی → همان Classic (native ETH) را انتخاب کن.
   - اگر تیک/فیلد **holder reflections** در STEP 2/TAX دیدی → همان تفکیک 75/20/5/0 پک را وارد کن (اعداد دست نزن).
   - گزینه‌های **fully customizable token** → هیچ‌کدام را اضافه نکن (نام/تیکر/لوگو/توضیح کافی است).
   - اگر بخش **graduation airdrop registration** دیدی → خالی بگذار؛ ثبتش بعد از graduation است (بعداً ثبت می‌شویم).
5. ☐ در **review screen** چک کن: pair = Classic ETH · creation fee · آدرس factory با config زنده بخواند.
6. ☐ امضا — کل لانچ **یک تراکنش** است (توکن + منحنی در همان tx دیپلوی می‌شوند).
7. ☐ بلافاصله بعد از لانچ: پست **#project-showcase** (قالب §6) + آدرس توکن را برای من بفرست تا Balance Gate (P4.2) و حساب‌وزن‌ها (P4.4) را ببندم.

---

## 6️⃣ قالب پست #project-showcase (بعد از لانچ — کپی کن، جای <token URL> را پر کن)

> **پست X در روز لانچ — دیالکت بنیان‌گذار (اندازه‌گیری‌شده از تایم‌لاینش، 2026-10-03):**
> هیچ هشتگی استفاده نکن. فقط `$WICK` + منشن `@vibevibefun` + یک هوک محصول‌محور (سبک "chef
> v/v just cooked…" / "one verb for today: cook") + ادعاهای قابل‌اثبات (QA، anti-cheat،
> server-verified). جمله‌ی سلب مسئولیت همان الگوی بازی ترفیع‌شده: "Community project built on
> @vibevibefun testnet. Not affiliated with the vibe/vibe team. $WICK is a testnet token with no
> monetary value." یک پست قوی، نه ریپلای پراکنده. (معیار انتقادش به بازی ترفیع‌شده:
> **پیدا کردن بازی در صفحه سخت بود** → لندینگ ما باید بازی را همان اول صفحه نشان بدهد.)

```
🧱 CANDLE CLIMBER — the chart is the level

A vertical skill platformer built from real candlestick data.
Live on Robinhood Chain testnet via the vibe builders program.

🎮 Play (free, no wallet needed): https://candle-climber.vercel.app
🪙 $WICK: <token URL>

How to play: one real symbol's chart per day — identical for every
climber worldwide. Green candles hold. Red candles crumble. Fall off
the bottom and you're liquidated. Download your Death Card, come back
tomorrow for new terrain.

$WICK utility: hold to unlock summit-tier runs (Balance Gate) ·
airdrop weights from daily streaks & route predictions · every trade
auto buyback-burns supply. After graduation: in-game burn, treasury
tournaments — and MIRROR mode, where $WICK's own chart becomes a
playable level.
```

---

## 7️⃣ بلوک‌های Description (انگلیسی — سه نسخه)

### 🔹 SHORT (~۳۰۰ کاراکتر — اگر فیلد محدود بود / بایو X)

```
The chart is the level. A live skill platformer built from real
candlestick data — green candles hold, red candles crumble, fall and
you're liquidated. One real market chart becomes the same mountain
for every climber worldwide, every day. $WICK: summit tiers, airdrop
weights, auto buyback-burn — and one day, its own chart as a level.
```

### 🔹 STANDARD — توصیه‌ی اصلی برای فیلد Description فرم

```
Candle Climber is a live, playable skill platformer whose levels are
built from real market candles — not hand-designed terrain. Every day
one real symbol's chart, drawn from a deterministic daily seed
(identical for every player worldwide), becomes a mountain: green
candles are solid jump pads, red candles crumble under your feet, and
falling off the bottom means liquidation. Every run ends in a
downloadable Death Card built for sharing.

Score is pure skill. Runs are verified server-side with HMAC
run-tokens and a dedicated anti-cheat suite — no reward loops tied to
self-play, anti-sybil by design.

$WICK is the game's utility token. Holding it gates summit-tier runs
and cosmetics through server-side on-chain balance reads (Balance
Gate — base gameplay stays free), and earns airdrop weights from
daily streaks, route predictions and archive marathons. After
graduation it unlocks in-game spend/burn, treasury-funded tournaments
and MIRROR mode — $WICK's own chart becomes a playable level. Every
trade already buyback-burns $WICK automatically via the platform's
fee rails.

Live and playable now: https://candle-climber.vercel.app
Built for the vibe builders program on Robinhood Chain testnet.
```

### 🔹 EXTENDED (برای پست معرفی/هرجای دیگر که جا دارید)

```
CANDLE CLIMBER — the chart is the level.

A vertical skill platformer where the terrain IS the market. Each
day, one real symbol's candlestick chart — pulled live, deterministic
for everyone on Earth — is transposed into a mountain of platforms:
green candles hold your weight, red candles crumble, wicks are the
risky shortcuts. Fall off the bottom and you are, obviously,
liquidated. Your run ends in an auto-generated Death Card: score,
symbol, cause of liquidation, rank — one click to share.

What's shipped (live now):
· Canvas 2D engine — fixed-timestep physics, coyote time, jump
  buffering, crumble timers
· Real market data (Binance klines, server-proxied with geo-fallback
  and honest synthetic fallback)
· Deterministic daily levels + 5-pool daily mutations
· Global leaderboards, ghost replays, async duels
· Death Cards (1080×1350 PNG / WebShare), PWA install, mobile touch
· 450+ headless QA rounds; real-device QA on Android

Why $WICK exists:
Pre-graduation, holding $WICK gates summit-tier runs and cosmetics
(server-side on-chain balance reads — base game stays free) and
accumulates airdrop weights from streaks, route predictions and
archive marathons. Every trade buyback-burns supply automatically.
After graduation, transfers unlock and the economy opens: in-game
burn, treasury-funded tournaments — and MIRROR mode, where $WICK's
own price chart becomes a playable level. Pump = smooth ramp. Dump =
nightmare.

No reward promises, no gambling texture — skill, honesty, and a
mountain made of the market. Play: https://candle-climber.vercel.app
```

---

## 8️⃣ خط قرمزهای نگارشی (حین نوشتن هر متن اضافه‌ای رعایت کن)

1. **هرگز قول جایزه/سود نده** — «airdrop weights» و «weights» بگو، نه «earn» / «guaranteed». خود پلتفرم هم چیزی را تضمین نمی‌کند.
2. **testnet بودن را شفاف بگو** (در بلوک‌ها هست) — بوی واقعی‌بودن می‌دهد، نه ضعف.
3. از لحن قمار پرهیز کن — قبل از TGE همه‌ی «stakes» فقط امتیاز/وزن‌اند.
4. عدد جعل نکن — «450+ QA rounds»، «1200/1200 launches ETH» این‌ها اثبات‌شده‌اند؛ همین‌ها را بگو.
