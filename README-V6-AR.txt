ZOMBI WEBSITE V6
================

هذه النسخة تضيف:
- Dashboard مستقل لكل سيرفر يملكه/يديره المستخدم (Manage Server).
- Owner يستطيع فتح أي سيرفر مسجل من Owner Panel.
- Owner -> Free / Premium Features للتحكم بالميزات المتاحة لكل خطة.
- Owner -> Games للتحكم بألعاب السيرفرات العامة حسب الخطة.
- Owner -> Limits للتحكم بحدود Store / Self Roles / Ticket Types / Questions / Rounds / Time / Reward / Gang Members.
- تطبيق القيود داخل البوت نفسه وليس فقط إخفاء الخيارات في الموقع.
- إعدادات ألعاب لكل سيرفر: تشغيل/إيقاف، الجولات، وقت الجولة، جائزة الفائز.
- تعديل أسئلة Quiz / True-False / Word-Scramble / Speed / Daily.
- أنواع تذاكر متعددة مع Support Roles.
- Store وSelf Roles بحدود حسب الخطة.

الألعاب العامة المدعومة على السيرفرات الجديدة:
quiz, guess, rps, speed, scramble, truefalse, math, closest, word, wheel, daily

ملاحظة:
مافيا / روليت / الكراسي / من القاتل هي أنظمة Legacy خاصة بالسيرفر الأساسي الحالي، لذلك تبقى على السيرفر الأساسي. تظهر في Dashboard الأساسي ويمكن للـOwner تشغيلها/إيقافها، لكن لا يتم تسجيلها كسيرفرات عامة في V6.

الرفع على GitHub / Render:
1) استبدل ملفات Repo الموقع بملفات هذا المجلد.
2) لا ترفع ملف .env حقيقي إلى GitHub.
3) اترك Environment Variables الموجودة في Render كما هي، وتأكد من القيم المذكورة في .env.example.
4) Commit ثم انتظر Render حتى يصبح Live.
5) Cloudflare Worker V4 الحالي صالح لهذه النسخة ولا يحتاج تغيير إذا كان /health يظهر botConfigured=true.

بعد النشر:
- ادخل /owner
- اضبط Free / Premium ثم اضغط حفظ.
- افتح أي سيرفر من Dashboard واضبط أنظمته وألعابه وأسئلته.
