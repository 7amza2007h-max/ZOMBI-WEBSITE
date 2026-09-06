'use strict';

const FEATURE_DEFS = [
  ['economy', 'Economy', '💰'],
  ['textChannelLock', 'قفل وفتح الشات بالأوامر ق / ف', '🔒'],
  ['economyAdmin', 'إدارة أرصدة الأعضاء من Dashboard', '🧾'],
  ['bank', 'Bank', '🏦'],
  ['games', 'Games', '🎮'],
  ['tickets', 'Tickets', '🎫'],
  ['store', 'Store', '🛒'],
  ['rolePanel', 'Self Roles', '🔔'],
  ['levels', 'Levels', '🏆'],
  ['voiceRewards', 'Voice Rewards', '🎙️'],
  ['voiceRooms', 'الرومات الصوتية المؤقتة', '🔊'],
  ['moderation', 'Moderation', '🛡️'],
  ['gangs', 'Gangs', '🏴'],
  ['gangMissions', 'مهمات العصابات', '🎯'],
  ['bankRobbery', 'سرقة البنك المركزي', '🚨'],
  ['customBranding', 'Custom Branding', '🎨'],
  ['customCurrency', 'Custom Currency', '🪙'],
  ['customBotProfile', 'بروفايل البوت لكل سيرفر', '🤖'],
  ['gameSettings', 'Game Settings', '⏱️'],
  ['gameQuestions', 'Game Questions / Killer Cases', '🧠']
].map(([key, label, emoji]) => ({ key, label, emoji }));

const GAME_DEFS = [
  { id:'quiz',       label:'أسئلة',          emoji:'🧠', publicSupported:true, editableQuestions:true },
  { id:'guess',      label:'تخمين',          emoji:'🔢', publicSupported:true, editableQuestions:false },
  { id:'rps',        label:'حجر ورق مقص',    emoji:'✂️', publicSupported:true, editableQuestions:false },
  { id:'speed',      label:'سرعة',           emoji:'⚡', publicSupported:true, editableQuestions:true },
  { id:'scramble',   label:'ترتيب',          emoji:'🔤', publicSupported:true, editableQuestions:true },
  { id:'truefalse',  label:'صح / خطأ',       emoji:'✅', publicSupported:true, editableQuestions:true },
  { id:'math',       label:'حساب',           emoji:'➗', publicSupported:true, editableQuestions:false },
  { id:'closest',    label:'الأقرب',         emoji:'🎯', publicSupported:true, editableQuestions:false },
  { id:'word',       label:'الكلمة',         emoji:'🔎', publicSupported:true, editableQuestions:true },
  { id:'wheel',      label:'عجلة الحظ',      emoji:'🎡', publicSupported:true, editableQuestions:false },
  { id:'daily',      label:'اليومي',         emoji:'🏆', publicSupported:true, editableQuestions:true },
  { id:'mafia',      label:'مافيا',          emoji:'🎭', publicSupported:true, editableQuestions:false },
  { id:'roulette',   label:'روليت',          emoji:'🎰', publicSupported:true, editableQuestions:false },
  { id:'chairs',     label:'الكراسي',        emoji:'🪑', publicSupported:true, editableQuestions:false },
  { id:'killer',     label:'من القاتل',      emoji:'🔪', publicSupported:true, editableQuestions:true }
];

const HEIST_GAME_DEFS = [
  { id:'green',   label:'الزر الأخضر',          emoji:'🟢' },
  { id:'numbers', label:'ترتيب الأرقام',        emoji:'🔢' },
  { id:'memory',  label:'حفظ التسلسل',          emoji:'🧠' },
  { id:'odd',     label:'الرمز المختلف',        emoji:'🔍' },
  { id:'code',    label:'كود الخزنة',           emoji:'🔐' },
  { id:'lights',  label:'ذاكرة الأضواء',        emoji:'💡' },
  { id:'math',    label:'حساب سريع',            emoji:'➗' }
];

const QUICK_RULE_GAME_IDS = ['quiz','guess','speed','scramble','truefalse','math','closest','word','daily','rps'];
const PUBLIC_GAME_IDS = GAME_DEFS.filter(x=>x.publicSupported).map(x=>x.id);

const LIMIT_DEFS = [
  { key:'storeProducts', label:'منتجات متجر الرتب', min:0, max:100 },
  { key:'selfRoles', label:'Self Roles', min:0, max:100 },
  { key:'ticketTypes', label:'أنواع التذاكر', min:1, max:25 },
  { key:'ticketSupportRoles', label:'رتب دعم التذاكر', min:0, max:50 },
  { key:'questionsPerGame', label:'أسئلة لكل لعبة', min:1, max:1000 },
  { key:'killerCases', label:'قضايا من القاتل', min:1, max:500 },
  { key:'maxRounds', label:'أقصى عدد جولات', min:1, max:25 },
  { key:'maxRoundTimeSeconds', label:'أقصى وقت للجولة (ثانية)', min:5, max:300 },
  { key:'maxWinnerReward', label:'أقصى جائزة للفائز', min:0, max:1000000000 },
  { key:'gangMembers', label:'أقصى أعضاء العصابة', min:2, max:50 },
  { key:'gangDeputies', label:'أقصى عدد نواب العصابة', min:0, max:10 },
  { key:'gangMissionTemplates', label:'قوالب مهمات العصابات', min:1, max:100 },
  { key:'maxGamePlayers', label:'أقصى لاعبين للألعاب الجماعية', min:2, max:25 },
  { key:'robberyParticipants', label:'أقصى مشاركين بسرقة البنك', min:2, max:25 },
  { key:'maxTransferAmount', label:'أقصى تحويل Economy', min:1, max:1000000000 },
  { key:'maxBankTransaction', label:'أقصى إيداع/سحب بالبنك', min:1, max:1000000000 },
  { key:'maxClearMessages', label:'أقصى عدد رسائل للحذف', min:1, max:100 },
  { key:'maxDailyReward', label:'أقصى Daily Reward', min:0, max:1000000000 },
  { key:'maxMessageReward', label:'أقصى مكافأة رسائل', min:0, max:1000000000 },
  { key:'maxVoiceReward', label:'أقصى Voice Reward', min:0, max:1000000000 }
];

function allFeatureDefaults(value=false){ return Object.fromEntries(FEATURE_DEFS.map(x=>[x.key,Boolean(value)])); }
function allGameDefaults(value=false){ return Object.fromEntries(GAME_DEFS.map(x=>[x.id,Boolean(value)])); }
function allHeistGameDefaults(value=false){ return Object.fromEntries(HEIST_GAME_DEFS.map(x=>[x.id,Boolean(value)])); }

const DEFAULT_PLAN_RULES = {
  free: {
    features: {
      ...allFeatureDefaults(false),
      economy:true, bank:true, games:true, tickets:true, store:true, rolePanel:true,
      levels:true, voiceRewards:true, moderation:true,
      voiceRooms:false, gangs:false, gangMissions:false, bankRobbery:false,
      customBranding:false, customCurrency:false, customBotProfile:false,
      gameSettings:false, gameQuestions:false, economyAdmin:false
    },
    games: {
      ...allGameDefaults(false),
      quiz:true, guess:true, rps:true, speed:true, scramble:true, truefalse:true,
      math:true, closest:true, word:true, wheel:true, daily:true
    },
    heistGames: {
      ...allHeistGameDefaults(false),
      green:true, numbers:true
    },
    limits: {
      storeProducts:3,selfRoles:3,ticketTypes:1,ticketSupportRoles:3,questionsPerGame:20,killerCases:10,
      maxRounds:5,maxRoundTimeSeconds:60,maxWinnerReward:5000,gangMembers:5,gangDeputies:1,gangMissionTemplates:5,
      maxGamePlayers:10,robberyParticipants:5,maxTransferAmount:10000,maxBankTransaction:25000,maxClearMessages:25,
      maxDailyReward:2000,maxMessageReward:100,maxVoiceReward:100
    }
  },
  premium: {
    features: allFeatureDefaults(true),
    games: allGameDefaults(true),
    heistGames: allHeistGameDefaults(true),
    limits: {
      storeProducts:25,selfRoles:20,ticketTypes:10,ticketSupportRoles:20,questionsPerGame:500,killerCases:500,
      maxRounds:25,maxRoundTimeSeconds:180,maxWinnerReward:1000000000,gangMembers:25,gangDeputies:5,gangMissionTemplates:100,
      maxGamePlayers:25,robberyParticipants:25,maxTransferAmount:1000000000,maxBankTransaction:1000000000,maxClearMessages:100,
      maxDailyReward:1000000000,maxMessageReward:1000000000,maxVoiceReward:1000000000
    }
  }
};

DEFAULT_PLAN_RULES.premium_plus = {features:allFeatureDefaults(true),games:allGameDefaults(true),heistGames:allHeistGameDefaults(true),limits:Object.fromEntries(LIMIT_DEFS.map(d=>[d.key,d.max]))};
const PLAN_IDS=['free','premium','premium_plus'];
const PLAN_LABELS={free:'Free',premium:'Premium',premium_plus:'Premium+'};
function mergePlans(current={},patch={}){return normalizePlans(Object.fromEntries(PLAN_IDS.map(p=>[p,Object.fromEntries(['features','games','heistGames','limits'].map(k=>[k,{...(current[p]?.[k]||{}),...(patch[p]?.[k]||{})}]))])));}
function applySubscription(cfg,days=30,plan='premium'){
 if(!['premium','premium_plus'].includes(plan))throw new Error('خطة غير صالحة.');
 const active=planNameForConfig(cfg);
 const base=active===plan?Math.max(Date.now(),Number(cfg.premiumUntil||0)):Date.now();
 return {...cfg,plan,premiumUntil:base+integer(days,30,1,3650)*86400000};
}
function clone(v){ return JSON.parse(JSON.stringify(v)); }
function bool(v,fallback){ return typeof v==='boolean'?v:fallback; }
function integer(v,fallback,min,max){ const n=Number(v); return Number.isFinite(n)?Math.max(min,Math.min(max,Math.round(n))):fallback; }
function normalizePlan(planName,input={}){
  const d=DEFAULT_PLAN_RULES[planName]||DEFAULT_PLAN_RULES.free,out={features:{},games:{},heistGames:{},limits:{}};
  for(const f of FEATURE_DEFS) out.features[f.key]=bool(input?.features?.[f.key],d.features[f.key]);
  for(const g of GAME_DEFS) out.games[g.id]=bool(input?.games?.[g.id],d.games[g.id]);
  for(const g of HEIST_GAME_DEFS) out.heistGames[g.id]=bool(input?.heistGames?.[g.id],d.heistGames[g.id]);
  for(const def of LIMIT_DEFS) out.limits[def.key]=integer(input?.limits?.[def.key],d.limits[def.key],def.min,def.max);
  return out;
}
function normalizePlans(input={}){ return Object.fromEntries(PLAN_IDS.map(p=>[p,normalizePlan(p,input[p]||{})])); }
function planNameForConfig(cfg){ return ['premium','premium_plus'].includes(cfg?.plan)&&Number(cfg?.premiumUntil||0)>Date.now()?cfg.plan:'free'; }
function planForConfig(site,cfg){ return normalizePlans(site?.plans||{})[planNameForConfig(cfg)]; }
function featureAllowed(site,cfg,key){ return Boolean(planForConfig(site,cfg)?.features?.[key]); }
function gameAllowed(site,cfg,gameId){ return Boolean(featureAllowed(site,cfg,'games')&&planForConfig(site,cfg)?.games?.[gameId]); }
function heistGameAllowed(site,cfg,gameId){ return Boolean(featureAllowed(site,cfg,'bank')&&planForConfig(site,cfg)?.heistGames?.[gameId]); }
function limitFor(site,cfg,key){ const p=planForConfig(site,cfg),def=LIMIT_DEFS.find(x=>x.key===key); if(!def)return 0; return integer(p?.limits?.[key],DEFAULT_PLAN_RULES[planNameForConfig(cfg)].limits[key],def.min,def.max); }
function isPublicGame(gameId){ return PUBLIC_GAME_IDS.includes(String(gameId)); }
function gameDef(gameId){ return GAME_DEFS.find(x=>x.id===String(gameId))||null; }

module.exports={PLAN_IDS,PLAN_LABELS,mergePlans,applySubscription,FEATURE_DEFS,GAME_DEFS,HEIST_GAME_DEFS,QUICK_RULE_GAME_IDS,PUBLIC_GAME_IDS,LIMIT_DEFS,DEFAULT_PLAN_RULES,normalizePlans,planNameForConfig,planForConfig,featureAllowed,gameAllowed,heistGameAllowed,limitFor,isPublicGame,gameDef,clone};
