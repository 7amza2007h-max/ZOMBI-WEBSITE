# ZOMBI — إصلاح اكتشاف سيرفرات البوت

## الملفات المعدّلة
- `server.js` — تحسين اكتشاف السيرفرات، دمج قائمة Gateway heartbeat مع سجلات السيرفرات المحفوظة في Owner، الحفاظ على آخر قائمة سليمة، وعدم اعتبار غياب مصدر موثوق قائمة فارغة. تحسين التعامل مع 429 و5xx وTimeout وتفعيل stale cache للطلبات المؤقتة.
- `index.js` — إضافة heartbeat آمن من خدمة البوت إلى Dashboard، يرسل قائمة `client.guilds.cache` الفعلية بعد Ready، ويحدّثها كل 60 ثانية وعند دخول/خروج البوت من سيرفر.

## سبب المشكلة
Discord لا يتيح استخدام Bot Token مع `GET /users/@me/guilds`؛ هذا المسار خاص بتوكن مستخدم OAuth2. وفي النسخة المرفقة، Dashboard كانت تحاول الاعتماد على heartbeat إن وُجد، وإلا ترجع إلى `store.allGuildIds()`، وهي سجلات السيرفرات التي سبق حفظ إعداداتها فقط وليست قائمة جميع السيرفرات التي انضم إليها البوت. كما أن كود البوت المرفق لم يكن يرسل heartbeat إلى endpoint الموجود أصلًا في Dashboard. لذلك كانت القائمة ناقصة أو يتعذر التحقق منها.

## إعدادات Render

### خدمة البوت (Discord Bot)
أضف:
- `DASHBOARD_URL` = رابط خدمة Dashboard على Render، مثل `https://YOUR-DASHBOARD.onrender.com`، بدون مسار إضافي أو `/` في النهاية.

أبقِ `TOKEN` كما هو، ويجب أن يكون توكن البوت الفعلي نفسه المستخدم في خدمة Dashboard. لا تضع التوكن داخل الكود.

### خدمة Dashboard (Express)
تأكد من وجود:
- `BOT_TOKEN` = نفس Bot Token الموجود في `TOKEN` بخدمة البوت.
- `DATABASE_URL` = قاعدة البيانات المستخدمة حاليًا من Dashboard.
- `SESSION_SECRET` وبيانات Owner الحالية كما هي.

إذا كنت تستخدم Cloudflare/OAuth Proxy، اترك إعداداته الحالية كما هي؛ heartbeat يستخدم مفتاحًا مشتقًا من Bot Token ويتحقق منه endpoint الحالي، ولا يستخدم User OAuth Token.

## OAuth2 مقابل Bot Token
- `BOT_TOKEN` يُستخدم لطلبات Discord Bot REST ولتوقيع heartbeat.
- User OAuth Access Token لا يُستخدم لاكتشاف سيرفرات البوت.
- `DISCORD_CLIENT_ID` هو Application ID ويُستخدم في روابط/أوامر التطبيق، وليس بديلًا عن Bot Token.
- لا حاجة إلى إضافة صلاحيات OAuth2 جديدة أو تغيير نظام تسجيل دخول Owner.

## النشر
1. ارفع `server.js` المعدّل إلى خدمة Dashboard.
2. ارفع `index.js` المعدّل إلى خدمة البوت.
3. أضف `DASHBOARD_URL` إلى خدمة البوت.
4. أعد تشغيل الخدمتين.
5. بعد اتصال البوت بـ Discord، راقب سجل البوت بحثًا عن `Dashboard guild heartbeat: N guilds`.
6. افحص `/health` في Dashboard؛ يجب أن يظهر `botHeartbeat` مع عدد السيرفرات وعمر heartbeat.

## الاختبارات المنفذة
- `node --check server.js` — نجح.
- `node --check index.js` — نجح.

## الاختبارات غير المنفذة
لم أستطع من بيئة الفحص الاتصال بخدمات Render الفعلية أو Discord أو قاعدة PostgreSQL الإنتاجية؛ لذلك لم أزعم اختبار تسجيل دخول حقيقي أو التحقق من جميع السيرفرات الحية أو محاكاة Rate Limit على Discord. يلزم تنفيذ خطوات النشر والتحقق أعلاه في بيئتك.
