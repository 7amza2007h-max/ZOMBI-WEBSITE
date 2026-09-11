ZOMBI V9.13.0 — PROFILE + XP PRO
================================

المميزات:
- #p : بروفايلك بصورة احترافية.
- #p @member : بروفايل عضو آخر.
- #top : ترتيب XP مع أزرار Daily / Weekly / Monthly / Season / All Time.
- داخل #top: Total XP / Chat XP / Voice XP.
- XP منفصل للشات والفويس.
- Chat Level + Voice Level + Total Level.
- Voice Time داخل البروفايل.
- Seasons بدون حذف All Time.
- رتب تلقائية عند مستويات تحددها من Dashboard.
- البيانات لا تحفظ صور الأعضاء؛ الصورة تتولد وقت الطلب فقط لتوفير المساحة.
- يعمل على كل السيرفرات التي يكون فيها نظام Levels مفعلاً.

أوامر إضافية:
- مستواي
- توب لفل
- #top day chat
- #top week voice
- #top month total
- #top season
- #season
- #season start اسم الموسم  (Manage Server / Owner فقط)

Dashboard > Members / Levels:
- Chat XP لكل رسالة
- Chat XP Cooldown
- Voice XP لكل دقيقة
- أقل عدد أعضاء حقيقيين في الفويس
- تجاهل Muted / Deafened
- Base XP / Growth
- اسم الموسم وبدء موسم جديد
- Level Roles بالشكل:
  5 | ROLE_ID
  10 | ROLE_ID
  20 | ROLE_ID

مهم:
- رتبة ZOMBI BOT يجب أن تكون أعلى من رتب Level Rewards.
- زر "بدء موسم جديد" يصفر Season XP فقط؛ All Time لا ينحذف.
- بيانات النظام تحفظ في levels-v3.json لكل سيرفر (أو PostgreSQL إذا DATABASE_URL مفعّل).
