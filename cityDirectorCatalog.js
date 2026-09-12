'use strict';

const FAMILIES = [
  { key:'blackout', emoji:'⚡', title:'انقطاع الكهرباء', desc:'شبكة الطاقة تنهار والمدينة تحتاج استجابة سريعة قبل تعطل القطاعات.', difficulty:'hard', types:['code','phrase','sequence','math'] },
  { key:'cyber', emoji:'💻', title:'الهجوم السيبراني', desc:'هجوم رقمي يستهدف أنظمة ZOMBI وعلى الأعضاء فك الرموز وتأمين الشبكة.', difficulty:'elite', types:['code','reverse','cipher','sequence'] },
  { key:'convoy', emoji:'🚚', title:'القافلة المفقودة', desc:'قافلة حساسة اختفت بين قطاعات المدينة ويجب تتبع الإشارات عبر الشاتات.', difficulty:'hard', types:['phrase','code','missing','math'] },
  { key:'vault', emoji:'🏦', title:'إنذار البنك المركزي', desc:'أنظمة البنك دخلت وضع الطوارئ وتحتاج سلسلة تحقق موزعة على المدينة.', difficulty:'elite', types:['code','math','cipher','sequence'] },
  { key:'storm', emoji:'🌪️', title:'العاصفة السوداء', desc:'عاصفة تضرب المدينة وتتعطل الاتصالات؛ تعاونوا لاستعادة نقاط الاتصال.', difficulty:'hard', types:['phrase','reverse','sequence','missing'] },
  { key:'outbreak', emoji:'☣️', title:'منطقة الحجر', desc:'إنذار طارئ أغلق عدة قطاعات وعلى الفريق تنفيذ تعليمات دقيقة لفك الإغلاق.', difficulty:'legendary', types:['code','phrase','math','cipher'] },
  { key:'gangwar', emoji:'🏴', title:'حرب المناطق', desc:'الصراع على مناطق ZOMBI تصاعد؛ اجمعوا نقاط السيطرة قبل خسارة المدينة.', difficulty:'elite', types:['code','phrase','sequence','reverse'] },
  { key:'signal', emoji:'📡', title:'الإشارة الغامضة', desc:'إشارة مجهولة تنتقل من روم إلى آخر؛ فكوا الرسائل قبل أن تختفي.', difficulty:'hard', types:['cipher','reverse','code','missing'] },
  { key:'boss', emoji:'👹', title:'World Boss', desc:'ظهر تهديد ضخم يحتاج تعاون أكثر من لاعب وسلسلة مهمات عبر السيرفر.', difficulty:'legendary', types:['code','math','phrase','sequence','cipher'] },
  { key:'city', emoji:'🚨', title:'حالة طوارئ قصوى', desc:'المدينة في أعلى درجة استنفار. كل مرحلة تنقلكم إلى نقطة جديدة في السيرفر.', difficulty:'legendary', types:['phrase','code','reverse','math','missing'] }
];

const VARIANTS = [
  { key:'alpha', name:'قطاع ألفا', extra:'ابدأوا من أول إشارة ولا تسمحوا بانقطاع السلسلة.' },
  { key:'red', name:'الإنذار الأحمر', extra:'الوقت محدود والخطأ يرفع مستوى الخطر.' },
  { key:'ghost', name:'الطيف الأسود', extra:'الإشارات تتغير بسرعة وتحتاج تركيزًا عاليًا.' },
  { key:'zero', name:'نقطة الصفر', extra:'كل الرومات المفتوحة قد تتحول إلى جزء من المهمة.' },
  { key:'night', name:'عملية منتصف الليل', extra:'نفذوا التسلسل كاملًا قبل انتهاء نافذة العملية.' },
  { key:'omega', name:'بروتوكول أوميغا', extra:'سلسلة مراحل متقدمة لا تنجح إلا بالتعاون.' },
  { key:'lockdown', name:'الإغلاق الكامل', extra:'افتحوا القطاعات واحدًا تلو الآخر.' },
  { key:'hunter', name:'مطاردة الصياد', extra:'تتبعوا الأدلة المنتشرة في شاتات المدينة.' },
  { key:'core', name:'قلب المدينة', extra:'احموا النظام المركزي بجمع رموز التحقق.' },
  { key:'final', name:'الموجة الأخيرة', extra:'آخر فرصة للسيطرة على الحدث قبل العقوبات.' }
];

function builtInEvents(){
  const out=[];
  for(const family of FAMILIES){
    for(const variant of VARIANTS){
      const n=out.length+1;
      out.push({
        id:`builtin-${String(n).padStart(3,'0')}-${family.key}-${variant.key}`,
        name:`${family.title} • ${variant.name}`,
        emoji:family.emoji,
        description:`${family.desc} ${variant.extra}`,
        difficulty:family.difficulty,
        goalMultiplier: family.difficulty==='legendary'?1.2:(family.difficulty==='elite'?1.1:1),
        enabled:true,
        builtin:true,
        missionTypes:[...family.types]
      });
    }
  }
  return out;
}

module.exports = { builtInEvents };
