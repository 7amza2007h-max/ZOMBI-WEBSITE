const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', 'data', 'guilds');
const CODES_FILE = path.join(__dirname, '..', 'data', 'premium-codes.json');
const GLOBAL_FILE = path.join(__dirname, '..', 'data', 'public-site.json');

function clone(value) { return JSON.parse(JSON.stringify(value)); }
function ensureDir(dir) { fs.mkdirSync(dir, { recursive: true }); }
function writeJson(file, data) {
  ensureDir(path.dirname(file));
  const tmp = `${file}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf8');
  try { fs.renameSync(tmp, file); }
  catch { fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf8'); try { fs.unlinkSync(tmp); } catch {} }
}
function readJson(file, fallback) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return clone(fallback); }
}
function snowflake(v='') { const s=String(v||'').trim(); return /^\d{15,25}$/.test(s) ? s : ''; }
function text(v='', max=200) { return String(v??'').trim().slice(0,max); }
function integer(v, fallback, min=0, max=1e9) { const n=Number(v); return Number.isFinite(n) ? Math.max(min, Math.min(max, Math.round(n))) : fallback; }

function defaults(guildId) {
  return {
    guildId: String(guildId),
    plan: 'free',
    premiumUntil: 0,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    setupComplete: false,
    features: { economy:true, bank:true, games:true, tickets:true, store:true, rolePanel:true, levels:true, voiceRewards:true, moderation:true, gangs:false },
    branding: { color:'#7c3aed', name:'ZOMBI', footer:'Powered by ZOMBI', customName:'', customFooter:'' },
    currency: { name:'ZOM', emoji:'🪙' },
    channels: { logs:'', ticketPanel:'', ticketCategory:'', storePanel:'', rolePanel:'', levelUp:'' },
    economy: { dailyAmount:500, dailyCooldownHours:24, messageEvery:15, messageReward:10, messageCooldownSeconds:60, transferCooldownSeconds:10, voiceEveryMinutes:10, voiceReward:10 },
    games: { rounds:5, roundTimeSeconds:25, winnerReward:100 },
    gangs: { maxMembers:7 },
    levels: { xpPerMessage:10, xpCooldownSeconds:30, baseXp:100, growth:50 },
    tickets: { title:'🎫 ZOMBI Support', description:'اضغط الزر بالأسفل لفتح تذكرة دعم.', buttonLabel:'فتح تذكرة', buttonEmoji:'🎫', supportRoleIds:[], panelMessageId:'' },
    store: { title:'🛒 ZOMBI Store', description:'اختر الرتبة التي تريد شراءها.', products:[], panelMessageId:'' },
    rolePanel: { title:'🔔 رتب الإشعارات', description:'اختر الرتب التي تريدها.', items:[], panelMessageId:'' }
  };
}
function guildDir(guildId) { return path.join(ROOT, String(guildId)); }
function fileFor(guildId, name) { return path.join(guildDir(guildId), name); }
function normalizeConfig(input, guildId) {
  const d = defaults(guildId); const x = input || {};
  const premiumUntil = Number(x.premiumUntil||0);
  const plan = (x.plan === 'premium' && premiumUntil > Date.now()) ? 'premium' : 'free';
  const cfg = {
    ...d, ...x, guildId:String(guildId), plan, premiumUntil: plan==='premium' ? premiumUntil : 0,
    features:{...d.features,...(x.features||{})}, branding:{...d.branding,...(x.branding||{})}, currency:{...d.currency,...(x.currency||{})},
    channels:{...d.channels,...(x.channels||{})}, economy:{...d.economy,...(x.economy||{})}, games:{...d.games,...(x.games||{})}, gangs:{...d.gangs,...(x.gangs||{})},
    levels:{...d.levels,...(x.levels||{})}, tickets:{...d.tickets,...(x.tickets||{})}, store:{...d.store,...(x.store||{})}, rolePanel:{...d.rolePanel,...(x.rolePanel||{})}
  };
  for (const k of Object.keys(cfg.channels)) cfg.channels[k]=snowflake(cfg.channels[k]);
  cfg.currency.name=text(cfg.currency.name||'ZOM',20)||'ZOM'; cfg.currency.emoji=text(cfg.currency.emoji||'🪙',16)||'🪙';
  cfg.economy.dailyAmount=integer(cfg.economy.dailyAmount,500,0,1e9); cfg.economy.dailyCooldownHours=integer(cfg.economy.dailyCooldownHours,24,1,720);
  cfg.economy.messageEvery=integer(cfg.economy.messageEvery,15,1,10000); cfg.economy.messageReward=integer(cfg.economy.messageReward,10,0,1e9); cfg.economy.voiceEveryMinutes=integer(cfg.economy.voiceEveryMinutes,10,1,1440); cfg.economy.voiceReward=integer(cfg.economy.voiceReward,10,0,1e9);
  cfg.games.rounds=integer(cfg.games.rounds,5,1,25); cfg.games.roundTimeSeconds=integer(cfg.games.roundTimeSeconds,25,5,180); cfg.games.winnerReward=integer(cfg.games.winnerReward,100,0,1e9); cfg.gangs.maxMembers=integer(cfg.gangs.maxMembers,7,2,25);
  cfg.levels.xpPerMessage=integer(cfg.levels.xpPerMessage,10,1,10000); cfg.levels.xpCooldownSeconds=integer(cfg.levels.xpCooldownSeconds,30,5,3600);
  cfg.tickets.title=text(cfg.tickets.title,d.tickets.title.length?256:256)||d.tickets.title; cfg.tickets.description=text(cfg.tickets.description,2000)||d.tickets.description;
  cfg.tickets.buttonLabel=text(cfg.tickets.buttonLabel,80)||d.tickets.buttonLabel; cfg.tickets.buttonEmoji=text(cfg.tickets.buttonEmoji,32)||'🎫';
  cfg.tickets.supportRoleIds=[...new Set((cfg.tickets.supportRoleIds||[]).map(snowflake).filter(Boolean))].slice(0,20);
  cfg.store.products=Array.isArray(cfg.store.products)?cfg.store.products.map(p=>({roleId:snowflake(p.roleId),name:text(p.name,80),price:integer(p.price,0,1,1e9),emoji:text(p.emoji,32)})).filter(p=>p.roleId).slice(0,25):[];
  cfg.rolePanel.items=Array.isArray(cfg.rolePanel.items)?cfg.rolePanel.items.map(p=>({roleId:snowflake(p.roleId),label:text(p.label,80),emoji:text(p.emoji,32)})).filter(p=>p.roleId).slice(0,20):[];
  cfg.updatedAt=Date.now();
  return cfg;
}
function getConfig(guildId) {
  ensureDir(guildDir(guildId)); const file=fileFor(guildId,'settings.json');
  const cfg=normalizeConfig(readJson(file,defaults(guildId)),guildId); writeJson(file,cfg); return cfg;
}
function saveConfig(guildId, input) { const current=getConfig(guildId); const cfg=normalizeConfig({...current,...input},guildId); writeJson(fileFor(guildId,'settings.json'),cfg); return cfg; }
function patchConfig(guildId, patch) {
  const current=getConfig(guildId); const next=clone(current);
  for (const [section,value] of Object.entries(patch||{})) next[section]=(value&&typeof value==='object'&&!Array.isArray(value))?{...(next[section]||{}),...value}:value;
  return saveConfig(guildId,next);
}
function data(guildId,name,fallback={}) { return readJson(fileFor(guildId,name),fallback); }
function saveData(guildId,name,value) { writeJson(fileFor(guildId,name),value); return value; }
function ensureUserShape(u={}) { return { balance:Number(u.balance||0), bankBalance:Number(u.bankBalance||0), messageCount:Number(u.messageCount||0), lastDaily:Number(u.lastDaily||0), lastMessageReward:Number(u.lastMessageReward||0), lastTransfer:Number(u.lastTransfer||0), xp:Number(u.xp||0), level:Number(u.level||0), purchases:Array.isArray(u.purchases)?u.purchases:[] }; }
function getEconomy(guildId){ return data(guildId,'economy.json',{}); }
function getUser(guildId,userId){ const e=getEconomy(guildId); e[userId]=ensureUserShape(e[userId]); saveData(guildId,'economy.json',e); return e[userId]; }
function updateUser(guildId,userId,fn){ const e=getEconomy(guildId); const u=ensureUserShape(e[userId]); fn(u,e); e[userId]=u; saveData(guildId,'economy.json',e); return u; }
function allGuildIds(){ ensureDir(ROOT); return fs.readdirSync(ROOT,{withFileTypes:true}).filter(d=>d.isDirectory()&&/^\d{15,25}$/.test(d.name)).map(d=>d.name); }
function isPremium(cfg){ return cfg?.plan==='premium' && Number(cfg.premiumUntil||0)>Date.now(); }
function setPremium(guildId,days=30){ const cfg=getConfig(guildId); const base=Math.max(Date.now(),Number(cfg.premiumUntil||0)); cfg.plan='premium'; cfg.premiumUntil=base+Math.max(1,Number(days||30))*86400000; return saveConfig(guildId,cfg); }
function removePremium(guildId){ const cfg=getConfig(guildId); cfg.plan='free'; cfg.premiumUntil=0; return saveConfig(guildId,cfg); }

function getGlobalConfig(){
  const d={premiumPrice:'4.99 JD / month',purchaseUrl:'',announcement:'',supportUrl:'',updatedAt:Date.now()};
  return {...d,...readJson(GLOBAL_FILE,d)};
}
function saveGlobalConfig(input={}){
  const current=getGlobalConfig();
  const next={...current,premiumPrice:text(input.premiumPrice??current.premiumPrice,80),purchaseUrl:text(input.purchaseUrl??current.purchaseUrl,500),announcement:text(input.announcement??current.announcement,500),supportUrl:text(input.supportUrl??current.supportUrl,500),updatedAt:Date.now()};
  writeJson(GLOBAL_FILE,next);return next;
}

function getCodes(){ return readJson(CODES_FILE,[]); }
function saveCodes(c){ writeJson(CODES_FILE,c); return c; }
function createCode(days=30){ const chars='ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; let s='ZOMBI-'; for(let i=0;i<12;i++) s+=chars[Math.floor(Math.random()*chars.length)]; const list=getCodes(); const item={code:s,days:integer(days,30,1,3650),createdAt:Date.now(),usedAt:0,usedByGuildId:''}; list.push(item); saveCodes(list); return item; }
function redeemCode(guildId,code){ const list=getCodes(); const item=list.find(x=>x.code===String(code||'').trim().toUpperCase()); if(!item) throw new Error('كود التفعيل غير صحيح.'); if(item.usedAt) throw new Error('هذا الكود مستخدم مسبقًا.'); item.usedAt=Date.now(); item.usedByGuildId=String(guildId); saveCodes(list); return {item,config:setPremium(guildId,item.days)}; }
module.exports={ defaults,normalizeConfig,getConfig,saveConfig,patchConfig,getEconomy,getUser,updateUser,data,saveData,allGuildIds,isPremium,setPremium,removePremium,getGlobalConfig,saveGlobalConfig,getCodes,createCode,redeemCode };
