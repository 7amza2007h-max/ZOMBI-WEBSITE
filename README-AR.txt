تعديل Dashboard للألعاب - ZOMBI

الملفات المعدلة:
1) server.js
   - إضافة تحكم كامل بكل لعبة من صفحة الألعاب.
   - Enable / Disable لكل لعبة.
   - عدد الجولات.
   - مدة الجولة.
   - Cooldown.
   - Reward Min / Reward Max.
   - XP Reward.
   - اختيار الرومات المسموح بها لكل لعبة.
   - اختيار رتب البدء لكل لعبة.
   - دعم الألعاب التفاعلية العشر الجديدة.

2) guildStore.js
   - حفظ وقراءة إعدادات الألعاب الجديدة داخل إعدادات السيرفر بدون حذف البيانات القديمة.
   - إضافة الحقول: cooldownSeconds, rewardMin, rewardMax, xpReward, allowedChannelIds, startRoleIds.

3) planPolicy.js
   - تعريف الألعاب التفاعلية العشر الجديدة ضمن نظام Free / Premium / Premium+.

4) discordCommands.js
   - إضافة الألعاب الجديدة إلى خيارات /games.

طريقة التركيب على Render:
- استبدل الملفات الأربعة الموجودة في مشروع الداشبورد بهذه الملفات.
- ارفع التحديث إلى Render واعمل Deploy/Restart.
- لا تعدل DATABASE_URL أو متغيرات البيئة.
