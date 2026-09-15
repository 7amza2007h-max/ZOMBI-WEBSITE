# ZOMBI V9.16.2 — Role Permissions + Content Guard

## الجديد
- قسم عربي احترافي في Dashboard: **الرتب والصلاحيات**.
- قراءة الصلاحيات الحالية مباشرة من Discord.
- تعديل صلاحيات كل رتبة مع شرح عربي لكل صلاحية.
- صلاحيات منفصلة لكل شات/Category/Voice مع حالات: وراثة / سماح / منع.
- Presets: مخفي، قراءة فقط، كتابة، إدارة.
- زر **إدارة مقيدة آمنة** بدون Administrator الحقيقي حتى تعمل قيود القنوات.
- حماية ZOMBI للروابط والفيديو والصور والملفات، عامة أو حسب الرتبة + الشات.
- عند مخالفة الحماية: الرسالة تُحذف فورًا ثم يصل DM خاص للعضو فقط. لا توجد رسالة عامة.
- Administrator لا يتجاوز Content Guard الخاص بالبوت، لكنه يتجاوز Channel Overwrites الأصلية في Discord.

## ملفات Monkey Network
استبدل: `index.js`, `public/publicSystem.js`, `public/guildStore.js`, `package.json` وأضف `public/contentGuard.js`.

## ملفات Render / Website
استخدم مجلد الموقع الكامل المرفق؛ أهم الملفات المعدلة: `server.js`, `guildStore.js`, `dashboard.js`, `role-manager.js`, `site.css`.

## صلاحيات لازمة للبوت
Manage Roles + Manage Channels + Manage Messages، ويجب أن تكون رتبة ZOMBI BOT أعلى من الرتب التي تريد تعديلها.
