'use strict';
// Raw Discord application-command payloads for dashboard-side per-guild command sync.
// Option type: 1=subcommand, 3=string, 4=integer, 6=user.
const MANAGE_GUILD='32';
const gamesChoices=[
  ['🧠 أسئلة','quiz'],['🔢 تخمين','guess'],['✂️ حجر ورق مقص','rps'],['⚡ سرعة','speed'],
  ['🔤 ترتيب','scramble'],['✅ صح / خطأ','truefalse'],['➗ حساب','math'],['🎯 الأقرب','closest'],
  ['🔎 الكلمة','word'],['🎡 عجلة الحظ','wheel'],['🏆 اليومي','daily']
].map(([name,value])=>({name,value}));
const commands=[
  {name:'داشبورد',description:'فتح لوحة تحكم ZOMBI الخاصة بهذا السيرفر',default_member_permissions:MANAGE_GUILD},
  {name:'setup',description:'إعداد ZOMBI لهذا السيرفر',default_member_permissions:MANAGE_GUILD},
  {name:'balance',description:'عرض رصيدك أو رصيد عضو',options:[{type:6,name:'user',description:'العضو',required:false}]},
  {name:'daily',description:'استلام المكافأة اليومية'},
  {name:'pay',description:'تحويل رصيد لعضو',options:[{type:6,name:'user',description:'العضو',required:true},{type:4,name:'amount',description:'المبلغ',required:true,min_value:1}]},
  {name:'leaderboard',description:'عرض قائمة الأغنى'},
  {name:'profile',description:'عرض ملفك الاقتصادي ومستواك',options:[{type:6,name:'user',description:'العضو',required:false}]},
  {name:'bank',description:'بنك السيرفر',options:[
    {type:1,name:'balance',description:'عرض رصيد البنك'},
    {type:1,name:'deposit',description:'إيداع في البنك',options:[{type:4,name:'amount',description:'المبلغ',required:true,min_value:1}]},
    {type:1,name:'withdraw',description:'سحب من البنك',options:[{type:4,name:'amount',description:'المبلغ',required:true,min_value:1}]}
  ]},
  {name:'games',description:'فتح قائمة ألعاب ZOMBI أو تشغيل لعبة',options:[{type:3,name:'game',description:'اختياري: شغّل لعبة مباشرة',required:false,choices:gamesChoices}]},
  {name:'store',description:'فتح متجر السيرفر'},
  {name:'premium',description:'عرض حالة Premium أو تفعيل كود',options:[{type:3,name:'code',description:'كود Premium',required:false}]},
  {name:'gang',description:'نظام العصابات',options:[
    {type:1,name:'create',description:'إنشاء عصابة',options:[{type:3,name:'name',description:'اسم العصابة',required:true,max_length:40}]},
    {type:1,name:'info',description:'معلومات عصابتك'},
    {type:1,name:'invite',description:'دعوة عضو',options:[{type:6,name:'user',description:'العضو',required:true}]},
    {type:1,name:'kick',description:'طرد عضو',options:[{type:6,name:'user',description:'العضو',required:true}]},
    {type:1,name:'deputy',description:'تعيين/إزالة نائب',options:[{type:6,name:'user',description:'العضو',required:true}]},
    {type:1,name:'leave',description:'مغادرة العصابة'},
    {type:1,name:'deposit',description:'إيداع في خزنة العصابة',options:[{type:4,name:'amount',description:'المبلغ',required:true,min_value:1}]},
    {type:1,name:'withdraw',description:'سحب من خزنة العصابة',options:[{type:4,name:'amount',description:'المبلغ',required:true,min_value:1}]}
  ]},
  {name:'help',description:'عرض أوامر ZOMBI'},
  {name:'admin',description:'أوامر إدارة ZOMBI',default_member_permissions:MANAGE_GUILD,options:[
    {type:1,name:'clear',description:'حذف رسائل',options:[{type:4,name:'amount',description:'العدد',required:true,min_value:1,max_value:100}]},
    {type:1,name:'kick',description:'طرد عضو',options:[{type:6,name:'user',description:'العضو',required:true},{type:3,name:'reason',description:'السبب',required:false}]},
    {type:1,name:'ban',description:'حظر عضو',options:[{type:6,name:'user',description:'العضو',required:true},{type:3,name:'reason',description:'السبب',required:false}]},
    {type:1,name:'lock',description:'قفل الروم الحالي'},
    {type:1,name:'unlock',description:'فتح الروم الحالي'},
    {type:1,name:'ticketpanel',description:'إرسال/تحديث لوحة التذاكر'},
    {type:1,name:'storepanel',description:'إرسال/تحديث لوحة المتجر'},
    {type:1,name:'rolepanel',description:'إرسال/تحديث لوحة الرتب'},
    {type:1,name:'synccommands',description:'إعادة تسجيل أوامر ZOMBI في هذا السيرفر'}
  ]}
];
function publicCommandPayload(){return JSON.parse(JSON.stringify(commands));}
module.exports={publicCommandPayload};
