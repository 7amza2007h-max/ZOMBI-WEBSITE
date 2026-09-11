ZOMBI V9.15 — Separate Logs Per System

هذا التحديث يضيف من Dashboard اختيار شات لوق منفصل لكل نظام.

أمثلة:
- البنك -> روم لوق البنك
- Economy / ZOM -> روم لوق الاقتصاد
- العصابات -> روم لوق العصابات
- سرقة البنك / النهب -> روم لوق السرقة
- التذاكر -> روم لوق التذاكر
- المتجر -> روم لوق المتجر
- التحذيرات -> روم لوق التحذيرات
- الألعاب -> روم لوق الألعاب
- Levels / XP -> روم لوق المستويات
- Voice -> روم لوق الفويس
- Music -> روم لوق الموسيقى
- Moderation / Audit -> روم لوق الإدارة
- الرسائل -> روم لوق حذف/تعديل الرسائل
- الأعضاء -> روم لوق الدخول/الخروج والتغييرات
- Commands -> روم لوق الأوامر
- Panels -> روم لوق إرسال/تحديث اللوحات
- Self Roles -> روم لوق الرتب الذاتية
- Name Change -> روم لوق تغيير الاسم
- Premium -> روم لوق الاشتراكات
- System -> روم لوق النظام

مهم:
إذا تركت روم نظام معين فارغًا، سيستخدم Logs العام كاحتياط.
إذا كان Logs العام فارغًا لكن اخترت رومًا مخصصًا لنظام، يظل ذلك النظام يسجل عادي.

ملفات Render / Website:
- server.js
- site.css

ملفات Monkey / Bot:
- public/serverLogs.js
- public/publicSystem.js
- public/storeSystem.js
- public/warningSystem.js
- public/citySystems.js
- music/musicSystem.js
- levels/levels.js
- nameChangeSystem.js

بعد الاستبدال:
1) Deploy للموقع على Render.
2) Stop ثم Start للبوت على Monkey Network.
3) Dashboard > Logs، اختر الرومات واحفظ.

صلاحيات البوت داخل رومات اللوق:
View Channel + Send Messages + Embed Links
ولوق الإدارة يفضل أيضًا View Audit Log.
