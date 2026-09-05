ZOMBI V6.2 — MULTI SERVER DASHBOARD + COMMAND SYNC
======================================================

هذا التحديث مخصص لإصلاح أوامر السيرفرات الجديدة وتوسيع تحكم Dashboard.

أهم ما تم إضافته:
- تسجيل أوامر Public لكل السيرفرات + Global fallback.
- /games يعمل في السيرفرات الجديدة بعد مزامنة الأوامر.
- زر داخل Dashboard: مزامنة أوامر هذا السيرفر الآن.
- أمر إدارة: /admin synccommands.
- Bootstrap بدون Slash إذا لم تظهر أي أوامر: اكتب !zombi-sync داخل السيرفر بحساب لديه Manage Server.
- Owner Panel: تحديد ميزات Free / Premium.
- Owner Panel: تحديد الأوامر المتاحة لكل خطة.
- Owner Panel: تحديد الألعاب المتاحة لكل خطة.
- Owner Panel: Limits للمتجر، Self Roles، أنواع التذاكر، الأسئلة، الجولات، الوقت، الجوائز، العصابات والمكافآت.
- كل سيرفر له إعدادات مستقلة في Neon.
- صاحب السيرفر/Manage Server يقدر يفتح Dashboard سيرفره فقط ويعدل المسموح له.
- تحكم Economy / Levels / Games / Questions / Tickets / Store / Self Roles / Gangs / Moderation / Member balances.
- تعديل المنتجات والـSelf Roles وأنواع التذاكر بعد إضافتها.
- إرسال/تحديث لوحات Tickets / Store / Self Roles من الموقع.
- القيود Free/Premium تطبق داخل البوت نفسه.

مهم — Lunafy:
استخدم ZIP الـ PATCH فقط. لا تحذف .env ولا ملفات البيانات القديمة.
استبدل:
  index.js
  public/publicSystem.js
  public/publicCommands.js
  public/planPolicy.js
  public/guildStore.js
  public/sharedStore.js
ثم Restart.

مهم — Website/Render:
ارفع محتويات ZOMBI-WEBSITE-V6.2.zip إلى GitHub repo الخاص بالموقع ثم Commit.
Render يعمل Deploy من GitHub.

مهم — Cloudflare:
استبدل كود Worker بملف cloudflare-worker.js الموجود في ZIP الموقع ثم Deploy.
افتح:
  https://zombi-oauth-proxy.amynnhmzt72.workers.dev/health
ويجب أن يكون:
  "botConfigured": true

إذا Slash Commands لا تظهر في سيرفر جديد:
1) من Dashboard افتح السيرفر.
2) اضغط "مزامنة أوامر هذا السيرفر الآن".
3) أو داخل Discord اكتب: !zombi-sync
4) بعدها اكتب /games.

ملاحظة:
الألعاب القديمة الخاصة بالسيرفر الأساسي (Mafia / Roulette / Chairs / Killer) ما زالت تستخدم أنظمتها Legacy في السيرفر الأساسي؛
the public multi-server game engine الحالي يدعم الألعاب السريعة الظاهرة في /games. لا يتم الادعاء أن هذه الأربع نُقلت بالكامل للسيرفرات العامة بعد.
