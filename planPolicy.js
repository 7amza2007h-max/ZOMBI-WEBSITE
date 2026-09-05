'use strict';

const FEATURE_DEFS = [
  ['economy', 'Economy', '💰'],
  ['bank', 'Bank', '🏦'],
  ['games', 'Games', '🎮'],
  ['tickets', 'Tickets', '🎫'],
  ['store', 'Store', '🛒'],
  ['rolePanel', 'Self Roles', '🔔'],
  ['levels', 'Levels', '🏆'],
  ['voiceRewards', 'Voice Rewards', '🎙️'],
  ['moderation', 'Moderation', '🛡️'],
  ['gangs', 'Gangs', '🏴'],
  ['customBranding', 'Custom Branding', '🎨'],
  ['customCurrency', 'Custom Currency', '🪙'],
  ['gameSettings', 'Game Settings', '⏱️'],
  ['gameQuestions', 'Game Questions', '🧠']
].map(([key, label, emoji]) => ({ key, label, emoji }));

const GAME_DEFS = [
  { id:'quiz',       label:'أسئلة',          emoji:'🧠', publicSupported:true,  editableQuestions:true },
  { id:'guess',      label:'تخمين',          emoji:'🔢', publicSupported:true,  editableQuestions:false },
  { id:'rps',        label:'حجر ورق مقص',    emoji:'✂️', publicSupported:true,  editableQuestions:false },
  { id:'speed',      label:'سرعة',           emoji:'⚡', publicSupported:true,  editableQuestions:true },
  { id:'scramble',   label:'ترتيب',          emoji:'🔤', publicSupported:true,  editableQuestions:true },
  { id:'truefalse',  label:'صح / خطأ',       emoji:'✅', publicSupported:true,  editableQuestions:true },
  { id:'math',       label:'حساب',           emoji:'➗', publicSupported:true,  editableQuestions:false },
  { id:'closest',    label:'الأقرب',         emoji:'🎯', publicSupported:true,  editableQuestions:false },
  { id:'word',       label:'الكلمة',         emoji:'🔎', publicSupported:true,  editableQuestions:true },
  { id:'wheel',      label:'عجلة الحظ',      emoji:'🎡', publicSupported:true,  editableQuestions:false },
  { id:'daily',      label:'اليومي',         emoji:'🏆', publicSupported:true,  editableQuestions:true },
  { id:'mafia',      label:'مافيا',          emoji:'🎭', publicSupported:false, editableQuestions:false },
  { id:'roulette',   label:'روليت',          emoji:'🎰', publicSupported:false, editableQuestions:false },
  { id:'chairs',     label:'الكراسي',        emoji:'🪑', publicSupported:false, editableQuestions:false },
  { id:'killer',     label:'من القاتل',      emoji:'🔪', publicSupported:false, editableQuestions:false }
];

const QUICK_RULE_GAME_IDS = ['quiz','guess','speed','scramble','truefalse','math','closest','word','daily','rps'];
const PUBLIC_GAME_IDS = GAME_DEFS.filter(x=>x.publicSupported).map(x=>x.id);

const LIMIT_DEFS = [
  { key:'storeProducts', label:'منتجات المتجر', min:0, max:100 },
  { key:'selfRoles', label:'Self Roles', min:0, max:100 },
  { key:'ticketTypes', label:'أنواع التذاكر', min:1, max:25 },
  { key:'ticketSupportRoles', label:'رتب دعم التذاكر', min:0, max:50 },
  { key:'questionsPerGame', label:'أسئلة لكل لعبة', min:1, max:1000 },
  { key:'maxRounds', label:'أقصى عدد جولات', min:1, max:25 },
  { key:'maxRoundTimeSeconds', label:'أقصى وقت للجولة (ثانية)', min:5, max:300 },
  { key:'maxWinnerReward', label:'أقصى جائزة للفائز', min:0, max:1000000000 },
  { key:'gangMembers', label:'أقصى أعضاء العصابة', min:2, max:50 }
];

function allFeatureDefaults(value=false){
  return Object.fromEntries(FEATURE_DEFS.map(x=>[x.key, Boolean(value)]));
}
function allGameDefaults(value=false){
  return Object.fromEntries(GAME_DEFS.map(x=>[x.id, Boolean(value)]));
}

const DEFAULT_PLAN_RULES = {
  free: {
    features: {
      ...allFeatureDefaults(false),
      economy:true, bank:true, games:true, tickets:true, store:true, rolePanel:true,
      levels:true, voiceRewards:true, moderation:true,
      gangs:false, customBranding:false, customCurrency:false, gameSettings:false, gameQuestions:false
    },
    games: {
      ...allGameDefaults(false),
      quiz:true, guess:true, rps:true, speed:true, scramble:true, truefalse:true,
      math:true, closest:true, word:true, wheel:true, daily:true
    },
    limits: {
      storeProducts:3,
      selfRoles:3,
      ticketTypes:1,
      ticketSupportRoles:3,
      questionsPerGame:20,
      maxRounds:5,
      maxRoundTimeSeconds:60,
      maxWinnerReward:5000,
      gangMembers:5
    }
  },
  premium: {
    features: allFeatureDefaults(true),
    games: {
      ...allGameDefaults(false),
      quiz:true, guess:true, rps:true, speed:true, scramble:true, truefalse:true,
      math:true, closest:true, word:true, wheel:true, daily:true
    },
    limits: {
      storeProducts:25,
      selfRoles:20,
      ticketTypes:10,
      ticketSupportRoles:20,
      questionsPerGame:500,
      maxRounds:25,
      maxRoundTimeSeconds:180,
      maxWinnerReward:1000000000,
      gangMembers:25
    }
  }
};

function clone(v){ return JSON.parse(JSON.stringify(v)); }
function bool(v, fallback){ return typeof v === 'boolean' ? v : fallback; }
function integer(v, fallback, min, max){
  const n=Number(v);
  return Number.isFinite(n) ? Math.max(min,Math.min(max,Math.round(n))) : fallback;
}

function normalizePlan(planName, input={}){
  const d=DEFAULT_PLAN_RULES[planName] || DEFAULT_PLAN_RULES.free;
  const out={features:{},games:{},limits:{}};
  for(const f of FEATURE_DEFS) out.features[f.key]=bool(input?.features?.[f.key], d.features[f.key]);
  for(const g of GAME_DEFS) out.games[g.id]=bool(input?.games?.[g.id], d.games[g.id]);
  for(const def of LIMIT_DEFS) out.limits[def.key]=integer(input?.limits?.[def.key], d.limits[def.key], def.min, def.max);
  return out;
}

function normalizePlans(input={}){
  return {
    free: normalizePlan('free', input.free||{}),
    premium: normalizePlan('premium', input.premium||{})
  };
}

function planNameForConfig(cfg){
  return cfg?.plan==='premium' && Number(cfg?.premiumUntil||0)>Date.now() ? 'premium' : 'free';
}
function planForConfig(site,cfg){
  const plans=normalizePlans(site?.plans||{});
  return plans[planNameForConfig(cfg)];
}
function featureAllowed(site,cfg,key){
  return Boolean(planForConfig(site,cfg)?.features?.[key]);
}
function gameAllowed(site,cfg,gameId){
  return Boolean(featureAllowed(site,cfg,'games') && planForConfig(site,cfg)?.games?.[gameId]);
}
function limitFor(site,cfg,key){
  const p=planForConfig(site,cfg);
  const def=LIMIT_DEFS.find(x=>x.key===key);
  if(!def) return 0;
  return integer(p?.limits?.[key], DEFAULT_PLAN_RULES[planNameForConfig(cfg)].limits[key], def.min, def.max);
}
function isPublicGame(gameId){ return PUBLIC_GAME_IDS.includes(String(gameId)); }
function gameDef(gameId){ return GAME_DEFS.find(x=>x.id===String(gameId)) || null; }

module.exports={
  FEATURE_DEFS,GAME_DEFS,QUICK_RULE_GAME_IDS,PUBLIC_GAME_IDS,LIMIT_DEFS,DEFAULT_PLAN_RULES,
  normalizePlans,planNameForConfig,planForConfig,featureAllowed,gameAllowed,limitFor,isPublicGame,gameDef,clone
};
