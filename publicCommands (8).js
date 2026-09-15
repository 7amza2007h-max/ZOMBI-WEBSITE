'use strict';
const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { GAME_DEFS } = require('./planPolicy');

const dashboard = new SlashCommandBuilder().setName('داشبورد').setDescription('فتح لوحة تحكم ZOMBI الخاصة بهذا السيرفر').setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild);
const setup = new SlashCommandBuilder().setName('setup').setDescription('إعداد ZOMBI لهذا السيرفر').setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild);
const balance = new SlashCommandBuilder().setName('balance').setDescription('عرض رصيدك أو رصيد عضو').addUserOption(o=>o.setName('user').setDescription('العضو').setRequired(false));
const daily = new SlashCommandBuilder().setName('daily').setDescription('استلام المكافأة اليومية');
const pay = new SlashCommandBuilder().setName('pay').setDescription('تحويل رصيد لعضو').addUserOption(o=>o.setName('user').setDescription('العضو').setRequired(true)).addIntegerOption(o=>o.setName('amount').setDescription('المبلغ').setMinValue(1).setRequired(true));
const leaderboard = new SlashCommandBuilder().setName('leaderboard').setDescription('عرض قائمة الأغنى');
const profile = new SlashCommandBuilder().setName('profile').setDescription('عرض ملفك الاقتصادي ومستواك').addUserOption(o=>o.setName('user').setDescription('العضو').setRequired(false));
const bank = new SlashCommandBuilder().setName('bank').setDescription('بنك السيرفر')
  .addSubcommand(s=>s.setName('balance').setDescription('عرض رصيد البنك'))
  .addSubcommand(s=>s.setName('deposit').setDescription('إيداع في البنك').addIntegerOption(o=>o.setName('amount').setDescription('المبلغ').setMinValue(1).setRequired(true)))
  .addSubcommand(s=>s.setName('withdraw').setDescription('سحب من البنك').addIntegerOption(o=>o.setName('amount').setDescription('المبلغ').setMinValue(1).setRequired(true)));

const games = new SlashCommandBuilder().setName('games').setDescription('فتح قائمة ألعاب ZOMBI أو تشغيل لعبة')
  .addStringOption(o=>{
    o.setName('game').setDescription('اختياري: شغّل لعبة مباشرة').setRequired(false);
    for(const g of GAME_DEFS.filter(x=>x.publicSupported)) o.addChoices({name:`${g.emoji} ${g.label}`,value:g.id});
    return o;
  });
const roulette = new SlashCommandBuilder().setName('roulette').setDescription('تشغيل لعبة الروليت');
const chairs = new SlashCommandBuilder().setName('chairs').setDescription('تشغيل لعبة الكراسي');
const mafia = new SlashCommandBuilder().setName('mafia').setDescription('تشغيل لعبة المافيا');
const killer = new SlashCommandBuilder().setName('killer').setDescription('تشغيل لعبة من القاتل');
const stopArabic = new SlashCommandBuilder().setName('ايقاف').setDescription('إيقاف لعبة ZOMBI في الروم إذا كنت المضيف أو من الرتب المسموحة');
const stopgame = new SlashCommandBuilder().setName('stopgame').setDescription('Stop the active ZOMBI game if you are host or allowed game staff');
const store = new SlashCommandBuilder().setName('store').setDescription('فتح متجر السيرفر');
const premium = new SlashCommandBuilder().setName('premium').setDescription('عرض حالة Premium أو تفعيل كود').addStringOption(o=>o.setName('code').setDescription('كود Premium').setRequired(false));
const gang = new SlashCommandBuilder().setName('gang').setDescription('نظام العصابات')
  .addSubcommand(s=>s.setName('create').setDescription('إنشاء عصابة').addStringOption(o=>o.setName('name').setDescription('اسم العصابة').setMaxLength(40).setRequired(true)))
  .addSubcommand(s=>s.setName('info').setDescription('معلومات عصابتك'))
  .addSubcommand(s=>s.setName('list').setDescription('عرض العصابات في السيرفر'))
  .addSubcommand(s=>s.setName('invite').setDescription('دعوة عضو').addUserOption(o=>o.setName('user').setDescription('العضو').setRequired(true)))
  .addSubcommand(s=>s.setName('kick').setDescription('طرد عضو').addUserOption(o=>o.setName('user').setDescription('العضو').setRequired(true)))
  .addSubcommand(s=>s.setName('deputy').setDescription('تعيين/إزالة نائب').addUserOption(o=>o.setName('user').setDescription('العضو').setRequired(true)))
  .addSubcommand(s=>s.setName('rename').setDescription('تغيير اسم العصابة').addStringOption(o=>o.setName('name').setDescription('الاسم الجديد').setMaxLength(40).setRequired(true)))
  .addSubcommand(s=>s.setName('transfer').setDescription('نقل ملكية العصابة').addUserOption(o=>o.setName('user').setDescription('المالك الجديد').setRequired(true)))
  .addSubcommand(s=>s.setName('leave').setDescription('مغادرة العصابة'))
  .addSubcommand(s=>s.setName('delete').setDescription('حذف العصابة نهائيًا'))
  .addSubcommand(s=>s.setName('deposit').setDescription('إيداع في خزنة العصابة').addIntegerOption(o=>o.setName('amount').setDescription('المبلغ').setMinValue(1).setRequired(true)))
  .addSubcommand(s=>s.setName('withdraw').setDescription('سحب من خزنة العصابة').addIntegerOption(o=>o.setName('amount').setDescription('المبلغ').setMinValue(1).setRequired(true)))
  .addSubcommand(s=>s.setName('mission').setDescription('فتح مهمة فعلية للعصابة'))
  .addSubcommand(s=>s.setName('equipment').setDescription('عرض معدات سرقة البنك ومخزونك'))
  .addSubcommand(s=>s.setName('buy-equipment').setDescription('شراء معدة لسرقة البنك').addStringOption(o=>o.setName('item').setDescription('المعدة').setRequired(true).addChoices(
    {name:'🎭 قناع افتراضي',value:'mask'},{name:'💻 جهاز اختراق',value:'hacking'},{name:'🛠️ مثقاب خزنة',value:'drill'},{name:'📻 جهاز اتصال',value:'radio'},{name:'🚗 سيارة هروب',value:'car'}
  )));
const help = new SlashCommandBuilder().setName('help').setDescription('عرض أوامر ZOMBI');
const admin = new SlashCommandBuilder().setName('admin').setDescription('أوامر إدارة ZOMBI').setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
  .addSubcommand(s=>s.setName('clear').setDescription('حذف رسائل').addIntegerOption(o=>o.setName('amount').setDescription('العدد').setMinValue(1).setMaxValue(100).setRequired(true)))
  .addSubcommand(s=>s.setName('kick').setDescription('طرد عضو').addUserOption(o=>o.setName('user').setDescription('العضو').setRequired(true)).addStringOption(o=>o.setName('reason').setDescription('السبب').setRequired(false)))
  .addSubcommand(s=>s.setName('ban').setDescription('حظر عضو').addUserOption(o=>o.setName('user').setDescription('العضو').setRequired(true)).addStringOption(o=>o.setName('reason').setDescription('السبب').setRequired(false)))
  .addSubcommand(s=>s.setName('lock').setDescription('قفل الروم الحالي'))
  .addSubcommand(s=>s.setName('unlock').setDescription('فتح الروم الحالي'))
  .addSubcommand(s=>s.setName('ticketpanel').setDescription('إرسال/تحديث لوحة التذاكر'))
  .addSubcommand(s=>s.setName('storepanel').setDescription('إرسال/تحديث لوحة المتجر'))
  .addSubcommand(s=>s.setName('rolepanel').setDescription('إرسال/تحديث لوحة الرتب'))
  .addSubcommand(s=>s.setName('gamepanel').setDescription('إرسال/تحديث لوحة الألعاب'))
  .addSubcommand(s=>s.setName('stopgames').setDescription('إيقاف كل ألعاب ZOMBI النشطة في السيرفر'))
  .addSubcommand(s=>s.setName('synccommands').setDescription('إعادة تسجيل أوامر ZOMBI في هذا السيرفر'));

const warn=new SlashCommandBuilder().setName('warn').setDescription('إعطاء تحذير').setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages).addUserOption(o=>o.setName('user').setDescription('العضو').setRequired(true)).addStringOption(o=>o.setName('reason').setDescription('السبب').setMaxLength(500).setRequired(true));
const warnings=new SlashCommandBuilder().setName('warnings').setDescription('عرض تحذيرات عضو').setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages).addUserOption(o=>o.setName('user').setDescription('العضو').setRequired(true));
const unwarn=new SlashCommandBuilder().setName('unwarn').setDescription('إزالة تحذير').setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages).addUserOption(o=>o.setName('user').setDescription('العضو').setRequired(true)).addStringOption(o=>o.setName('id').setDescription('رقم التحذير، أو اتركه لإزالة الأخير'));
const publicCommands=[warn,warnings,unwarn,dashboard,setup,balance,daily,pay,leaderboard,profile,bank,games,roulette,chairs,mafia,killer,stopArabic,stopgame,store,gang,premium,help,admin];
module.exports={dashboard,publicCommands};
