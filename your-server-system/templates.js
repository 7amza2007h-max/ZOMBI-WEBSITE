'use strict';
// Independent, data-driven templates for ZOMBI Your Server System.
// Permission bits are Discord API permission bitfield strings.
const P = {
  VIEW: '1024', SEND: '2048', HISTORY: '65536', CONNECT: '1048576', SPEAK: '2097152',
  MANAGE_CHANNELS: '16', MANAGE_ROLES: '268435456', MANAGE_GUILD: '32',
  KICK: '2', BAN: '4', MODERATE: '1099511627776', MENTION_EVERYONE: '131072',
  ADMIN: '8', EMBED: '16384', ATTACH: '32768', MOVE: '16777216'
};
const r=(name,color,permissions='0')=>({name,color,permissions});
const t=(id,name,category,plan,description,roles,categories)=>({id,name,category,plan,description,roles,categories});
const ch=(name,type='text',access='all')=>({name,type,access});
const staff=['Owner','Admin','Moderator'];
const baseRoles=[r('Owner',0xe74c3c,P.ADMIN),r('Admin',0xe67e22,P.MANAGE_CHANNELS),r('Moderator',0x3498db,'0'),r('Member',0x95a5a6,'0'),r('Bots',0x2ecc71,'0')];
const templates = [
t('friends','سيرفر أصدقاء','بسيط','free','سيرفر خفيف للأصدقاء مع شاتات وفويسات خاصة للإدارة.',[r('Owner',0xe74c3c,P.ADMIN),r('Admin',0xe67e22,P.MANAGE_CHANNELS),r('Friends',0x3498db,'0'),r('VIP',0xf1c40f,'0'),r('Bots',0x2ecc71,'0')],[
['📌・البداية',[ch('القوانين'),ch('الإعلانات','text','staff')]],['💬・المجتمع',[ch('العام'),ch('الصور-والمقاطع'),ch('الميمز'),ch('الاقتراحات')]],['🎮・الألعاب',[ch('الألعاب'),ch('البحث-عن-لاعبين')]],['🔊・الفويسات',[ch('فويس عام','voice'),ch('فويس ألعاب 1','voice'),ch('فويس ألعاب 2','voice'),ch('فويس خاص','voice','staff'),ch('AFK','voice')]],['🔒・الإدارة',[ch('شات الإدارة','text','staff')]]
]),
t('small-community','مجتمع صغير','بسيط','free','مجتمع صغير منظم بقنوات أساسية ومساحة للإدارة.',[r('Owner',0xe74c3c,P.ADMIN),r('Moderator',0x3498db,'0'),r('Member',0x95a5a6,'0'),r('Bots',0x2ecc71,'0')],[['📌・المعلومات',[ch('القوانين'),ch('الإعلانات','text','staff')]],['🌐・المجتمع',[ch('العام'),ch('التعارف'),ch('الصور'),ch('الاقتراحات')]],['🔊・الصوتيات',[ch('فويس عام','voice'),ch('فويس 2','voice')]],['🔒・الإدارة',[ch('شات الإدارة','text','staff'),ch('السجلات','text','staff')]]]),
t('fivem-general','FiveM عام','FiveM وRoleplay','premium','هيكل FiveM مع أقسام الشرطة والإسعاف والعصابات والدعم والإدارة.',[r('Owner',0xe74c3c,P.ADMIN),r('Co Owner',0xc0392b,P.MANAGE_GUILD),r('Management',0x8e44ad,P.MANAGE_CHANNELS),r('Admin',0xe67e22,P.MANAGE_CHANNELS),r('Moderator',0x3498db,'0'),r('Police',0x2980b9,'0'),r('EMS',0x27ae60,'0'),r('Gang',0x922b21,'0'),r('VIP',0xf1c40f,'0'),r('Member',0x95a5a6,'0'),r('Bots',0x2ecc71,'0')],[['📌・معلومات السيرفر',[ch('القوانين'),ch('الإعلانات','text','staff'),ch('الأخبار'),ch('التحديثات')]],['💬・المجتمع',[ch('العام'),ch('الشاتات'),ch('الصور-والمقاطع')]],['🎮・FiveM',[ch('معلومات-الدخول'),ch('مشاكل-اللعبة'),ch('تقديمات-الوظائف')]],['🚔・الشرطة',[ch('إعلانات-الشرطة','text','Police'),ch('نقاشات-الشرطة','text','Police'),ch('تقارير-الشرطة','text','Police')]],['🚑・الإسعاف',[ch('إعلانات-الإسعاف','text','EMS'),ch('تقارير-الإسعاف','text','EMS')]],['🔫・العصابات',[ch('إعلانات-العصابات','text','Gang'),ch('تنسيق-العصابات','text','Gang')]],['🎫・الدعم',[ch('فتح-تذكرة'),ch('الشكاوى'),ch('المساعدة')]],['🔊・الفويسات',[ch('انتظار','voice'),ch('فويس عام 1','voice'),ch('فويس عام 2','voice'),ch('فويس الشرطة','voice','Police'),ch('فويس الإسعاف','voice','EMS'),ch('فويس العصابات','voice','Gang'),ch('فويس الإدارة','voice','staff'),ch('اجتماعات خاصة','voice','staff')]],['🔒・الإدارة',[ch('شات الإدارة','text','staff'),ch('سجلات الإدارة','text','staff'),ch('اجتماعات الإدارة','voice','staff')]]]),
t('fivem-friends','FiveM للأصدقاء','FiveM وRoleplay','free','نسخة صغيرة للأصدقاء الذين يلعبون FiveM معًا.',[r('Owner',0xe74c3c,P.ADMIN),r('Friends',0x3498db,'0'),r('Driver',0xf39c12,'0'),r('Bots',0x2ecc71,'0')],[['📌・البداية',[ch('القوانين'),ch('معلومات-السيرفر')]],['🚘・FiveM',[ch('العام'),ch('اللقطات'),ch('اقتراحات')]],['🔊・الفويس',[ch('جلسة لعب','voice'),ch('جلسة ثانية','voice')]],['🔒・خاص',[ch('شات المالك','text','staff')]]]),
t('roleplay-full','رول بلاي متكامل','FiveM وRoleplay','premium_plus','قالب موسع للرول بلاي مع إدارة ووظائف وطلبات وتقارير.',[r('Owner',0xe74c3c,P.ADMIN),r('Director',0x8e44ad,P.MANAGE_GUILD),r('Management',0x9b59b6,P.MANAGE_CHANNELS),r('Admin',0xe67e22,P.MANAGE_CHANNELS),r('Moderator',0x3498db,'0'),r('Police',0x2980b9,'0'),r('EMS',0x27ae60,'0'),r('Mechanic',0xd35400,'0'),r('Gang',0x922b21,'0'),r('Citizen',0x95a5a6,'0'),r('VIP',0xf1c40f,'0'),r('Bots',0x2ecc71,'0')],[['📌・المعلومات',[ch('القوانين'),ch('الإعلانات','text','staff'),ch('التحديثات')]],['🌆・الحياة',[ch('العام'),ch('قصص-الشخصيات'),ch('الصور-والمقاطع')]],['📝・التقديمات',[ch('تقديم-شرطة'),ch('تقديم-إسعاف'),ch('تقديم-ميكانيكي')]],['🚔・الشرطة',[ch('إدارة-الشرطة','text','Police'),ch('التقارير','text','Police'),ch('فويس الشرطة','voice','Police')]],['🚑・الإسعاف',[ch('إدارة-الإسعاف','text','EMS'),ch('تقارير الإسعاف','text','EMS'),ch('فويس الإسعاف','voice','EMS')]],['🔧・الميكانيك',[ch('طلبات-الصيانة','text','Mechanic'),ch('فويس الميكانيك','voice','Mechanic')]],['🎫・الدعم',[ch('الدعم'),ch('الشكاوى')]],['🔊・الفويسات',[ch('انتظار','voice'),ch('عام 1','voice'),ch('عام 2','voice')]],['🔒・الإدارة',[ch('الإدارة','text','staff'),ch('سجلات','text','staff'),ch('اجتماع','voice','staff')]]]),
t('store','متجر إلكتروني','المتاجر والأعمال','premium','قنوات المنتجات والطلبات والدعم مع فصل قنوات الموظفين.',[r('Owner',0xe74c3c,P.ADMIN),r('Manager',0x8e44ad,P.MANAGE_CHANNELS),r('Admin',0xe67e22,P.MANAGE_CHANNELS),r('Support',0x3498db,'0'),r('Customer',0x95a5a6,'0'),r('VIP',0xf1c40f,'0'),r('Bots',0x2ecc71,'0')],[['📌・معلومات',[ch('القوانين'),ch('الإعلانات','text','staff')]],['🛍️・المتجر',[ch('المنتجات'),ch('الأسعار'),ch('الطلبات'),ch('التقييمات')]],['🎫・خدمة العملاء',[ch('الدعم-الفني'),ch('الشكاوى')]],['🔊・الدعم الصوتي',[ch('انتظار الدعم','voice'),ch('دعم فني','voice','Support')]],['🔒・الموظفون',[ch('شات الإدارة','text','staff'),ch('سجلات الطلبات','text','staff'),ch('اجتماعات الموظفين','voice','staff')]]]),
t('gaming-community','مجتمع ألعاب','الألعاب','premium','مجتمع ألعاب متعدد الأقسام للعثور على لاعبين ومشاركة المقاطع والفعاليات.',[r('Owner',0xe74c3c,P.ADMIN),r('Admin',0xe67e22,P.MANAGE_CHANNELS),r('Moderator',0x3498db,'0'),r('Event Manager',0x9b59b6,'0'),r('VIP',0xf1c40f,'0'),r('Gamer',0x2ecc71,'0'),r('Member',0x95a5a6,'0'),r('Bots',0x34495e,'0')],[['📌・البداية',[ch('القوانين'),ch('الإعلانات','text','staff')]],['🌐・المجتمع',[ch('العام'),ch('البحث-عن-لاعبين'),ch('المقاطع'),ch('الاقتراحات')]],['🎮・الألعاب',[ch('Minecraft'),ch('Roblox'),ch('Valorant'),ch('Fortnite')]],['🏆・الفعاليات',[ch('الفعاليات'),ch('التسجيل'),ch('النتائج')]],['🔊・الفويسات',[ch('انتظار','voice'),ch('ألعاب 1','voice'),ch('ألعاب 2','voice'),ch('ألعاب 3','voice'),ch('فويس فعاليات','voice','Event Manager')]],['🔒・الإدارة',[ch('شات الإدارة','text','staff')]]]),
t('community-arabic','مجتمع عربي عام','المجتمعات','free','مجتمع عربي بقنوات ترحيب ونقاشات واقتراحات.',[r('Owner',0xe74c3c,P.ADMIN),r('Admin',0xe67e22,P.MANAGE_CHANNELS),r('Moderator',0x3498db,'0'),r('Member',0x95a5a6,'0'),r('Bots',0x2ecc71,'0')],[['📌・ابدأ هنا',[ch('القوانين'),ch('الترحيب'),ch('الإعلانات','text','staff')]],['💬・المجتمع',[ch('العام'),ch('النقاشات'),ch('الصور'),ch('الاقتراحات')]],['🎉・الترفيه',[ch('الميمز'),ch('الفعاليات')]],['🔊・الفويس',[ch('جلسة عامة','voice'),ch('جلسة 2','voice')]],['🔒・الإدارة',[ch('شات الإدارة','text','staff'),ch('سجلات','text','staff')]]]),
t('support-team','سيرفر دعم فني','المتاجر والأعمال','premium','تنظيم الدعم والطلبات والتصعيد مع قنوات داخلية للفريق.',[r('Owner',0xe74c3c,P.ADMIN),r('Support Lead',0x8e44ad,P.MANAGE_CHANNELS),r('Support',0x3498db,'0'),r('Customer',0x95a5a6,'0'),r('Bots',0x2ecc71,'0')],[['📌・المعلومات',[ch('القوانين'),ch('الإعلانات','text','staff')]],['🎫・الدعم',[ch('فتح-طلب'),ch('الأسئلة-الشائعة'),ch('الشكاوى')]],['🧑‍💻・فريق الدعم',[ch('توزيع-الطلبات','text','staff'),ch('ملاحظات-الفريق','text','staff'),ch('فويس الدعم','voice','staff')]],['🔊・الصوت',[ch('انتظار','voice')]]]),
t('events','فعاليات وبطولات','الفعاليات','premium','قالب للبطولات والتسجيل والنتائج والحكام والمنظمين.',[r('Owner',0xe74c3c,P.ADMIN),r('Admin',0xe67e22,P.MANAGE_CHANNELS),r('Organizer',0x8e44ad,'0'),r('Judge',0x3498db,'0'),r('Participant',0x2ecc71,'0'),r('Member',0x95a5a6,'0'),r('Bots',0x34495e,'0')],[['📌・المعلومات',[ch('القوانين'),ch('الإعلانات','text','staff')]],['🏆・البطولة',[ch('التسجيل'),ch('جدول-المباريات'),ch('النتائج'),ch('الفائزون')]],['🧑‍⚖️・المنظمون',[ch('تنسيق-المنظمين','text','staff'),ch('تقارير-الحكام','text','Judge')]],['🔊・الفويسات',[ch('انتظار','voice'),ch('المتسابقون','voice'),ch('الحكام','voice','Judge'),ch('المنظمون','voice','Organizer')]],['🔒・الإدارة',[ch('شات الإدارة','text','staff')]]]),
t('education','تعليم ودورات','التعليم','premium','قنوات دروس ومصادر وأسئلة مع غرفة للمدرسين.',[r('Owner',0xe74c3c,P.ADMIN),r('Teacher',0x2980b9,'0'),r('Assistant',0x8e44ad,'0'),r('Student',0x2ecc71,'0'),r('Bots',0x34495e,'0')],[['📌・المعلومات',[ch('القوانين'),ch('الإعلانات','text','staff')]],['📚・التعلم',[ch('الدروس'),ch('المصادر'),ch('الأسئلة'),ch('الواجبات')]],['👩‍🏫・الطاقم',[ch('تنسيق-المدرسين','text','Teacher'),ch('خطة-الدروس','text','Teacher')]],['🔊・الفصول',[ch('دراسة جماعية','voice'),ch('شرح مباشر','voice'),ch('غرفة المدرسين','voice','Teacher')]]]),
t('team-management','فريق عمل وإدارة','الإدارة','premium_plus','قالب فريق عمل بمهام وتقارير واجتماعات وقنوات داخلية.',[r('Owner',0xe74c3c,P.ADMIN),r('Director',0x8e44ad,P.MANAGE_GUILD),r('Manager',0xe67e22,P.MANAGE_CHANNELS),r('Employee',0x3498db,'0'),r('HR',0x2ecc71,'0'),r('Bots',0x34495e,'0')],[['📌・المعلومات',[ch('الإعلانات','text','staff'),ch('دليل-الفريق','text','staff')]],['🗂️・العمل',[ch('المهام','text','staff'),ch('التقارير','text','staff'),ch('الاقتراحات','text','staff')]],['👥・الموارد البشرية',[ch('طلبات-الإجازة','text','HR'),ch('توظيف','text','HR')]],['🔊・الاجتماعات',[ch('اجتماع عام','voice','staff'),ch('اجتماع الإدارة','voice','Director')]]]),
t('private-server','سيرفر خاص بسيط','بسيط','free','سيرفر خاص minimal للأشخاص الموثوقين.',[r('Owner',0xe74c3c,P.ADMIN),r('Trusted',0x3498db,'0'),r('Bots',0x2ecc71,'0')],[['📌・الخاص',[ch('القوانين'),ch('العام'),ch('ملاحظات')]],['🔊・الصوت',[ch('فويس خاص','voice'),ch('AFK','voice')]],['🔒・المالك',[ch('ملاحظات المالك','text','staff')]]])
];
const normalizePlan = p => ({free:'free',premium:'premium',premium_plus:'premium_plus','premium+':'premium_plus'}[String(p||'free').toLowerCase()]||'free');
// Compatibility adapter: keep the old templates and their channels/roles,
// while exposing the schema expected by the current routes.js.
const permissionNames = [
  ['8','Administrator'],['16','ManageChannels'],['32','ManageGuild'],
  ['2','KickMembers'],['4','BanMembers'],['268435456','ManageRoles'],
  ['2048','SendMessages'],['1024','ViewChannel'],['65536','ReadMessageHistory'],
  ['16384','EmbedLinks'],['32768','AttachFiles'],['131072','MentionEveryone'],
  ['1048576','Connect'],['2097152','Speak'],['16777216','MoveMembers'],
  ['1099511627776','ModerateMembers']
];
const compatibleTemplates = templates.map((item, index) => ({
  id: item.id,
  name: item.name,
  category: item.category,
  plan: normalizePlan(item.plan),
  icon: ['🌐','👥','🎮','🚘','🌆','🛍️','🎮','🌍','🎫','🏆','📚','🧑‍💼','🔒'][index] || '🧩',
  description: item.description || '',
  features: ['قنوات كتابية وصوتية','رتب وصلاحيات','أقسام منظمة'],
  roles: (Array.isArray(item.roles) ? item.roles : []).map(role => {
    const bits = String(role.permissions ?? '0');
    return { name: role.name, color: '#' + (Number(role.color || 0) >>> 0).toString(16).padStart(6,'0').slice(-6), permissions: permissionNames.filter(([bit]) => (BigInt(bits || '0') & BigInt(bit)) !== 0n).map(([,name]) => name) };
  }),
  categories: (Array.isArray(item.categories) ? item.categories : []).map((entry, ci) => {
    const name = Array.isArray(entry) ? entry[0] : entry.name;
    const sourceChannels = Array.isArray(entry) ? entry[1] : entry.channels;
    const channels = (Array.isArray(sourceChannels) ? sourceChannels : []).map(channel => ({
      name: channel.name,
      type: channel.type === 'voice' || channel.type === 2 ? 2 : 0,
      access: channel.access || 'all'
    }));
    const roleAccess = {};
    for (const channel of (Array.isArray(sourceChannels) ? sourceChannels : [])) {
      if (channel.access && channel.access !== 'all' && channel.access !== 'staff') roleAccess[channel.access] = ['ViewChannel','SendMessages'];
    }
    return { name: String(name || `قسم ${ci+1}`), channels, roleAccess };
  })
}));
function cloneTemplate(id) {
  const item = compatibleTemplates.find(t => t.id === String(id));
  return item ? JSON.parse(JSON.stringify(item)) : null;
}
module.exports = { templates: compatibleTemplates, cloneTemplate, P, normalizePlan };
