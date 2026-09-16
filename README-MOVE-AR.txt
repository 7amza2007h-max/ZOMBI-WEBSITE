ZOMBI — MOVE COMMAND PATCH
==========================

تمت إضافة نظام سحب الأعضاء للفويس بأمر move مع تحكم كامل من Dashboard.

الاستخدام:
1) move @member
2) اعمل Reply على رسالة العضو واكتب move
3) يدعم أيضًا: سحب / اسحب

الشروط:
- منفذ الأمر لازم يكون داخل روم صوتي.
- العضو المطلوب لازم يكون داخل روم صوتي آخر.
- رتبة منفذ الأمر لازم تكون مختارة في Dashboard.
- Administrator لا يتجاوز قائمة الرتب المسموحة.
- مالك السيرفر يمكن السماح له دائمًا من خيار مستقل في Dashboard.
- يمكن تحديد رومات مسموح السحب منها وإليها. ترك القائمة فارغة = أي روم صوتي.
- ZOMBI BOT يحتاج View Channel + Connect + Move Members.

ملفات البوت — استبدل بنفس المسارات:
BOT/index.js
BOT/public/guildStore.js
BOT/public/moderationTools.js
BOT/public/publicSystem.js

ملفات الموقع / Dashboard — استبدل في جذر مشروع الموقع:
WEBSITE/server.js
WEBSITE/guildStore.js

بعد الرفع:
- أعد تشغيل البوت.
- أعد Deploy للموقع.
- افتح Dashboard > قسم الأعضاء/Moderation.
- فعّل أمر move واختر الرتب المسموحة.
- احفظ الإعدادات.

تم فحص Syntax للبوت والموقع ونجح npm run check في المشروعين.
