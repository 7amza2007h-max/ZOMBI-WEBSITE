'use strict';
require('dotenv').config();
const express=require('express');
const session=require('express-session');
const crypto=require('crypto');
const store=require('./sharedStore');
const payments=require('./paymentStore');
const operations=require('./operations');
const access=require('./accessPolicy');
const {pricing}=require('./pricingView');
const {PLAN_IDS,PLAN_LABELS}=require('./planPolicy');
const {
  FEATURE_DEFS,GAME_DEFS,HEIST_GAME_DEFS,QUICK_RULE_GAME_IDS,LIMIT_DEFS,
  normalizePlans,featureAllowed,gameAllowed,heistGameAllowed,limitFor,planNameForConfig
}=require('./planPolicy');
const {normalizeGameContent}=require('./gameDefaults');
const {publicCommandPayload}=require('./discordCommands');
const legacyPreset=require('./legacy-home-preset.json');
const {builtInEvents}=require('./cityDirectorCatalog');

const API='https://discord.com/api/v10';
const OAUTH_TOKEN_URL='https://discord.com/api/oauth2/token';
const MANAGE_GUILD=0x20n,ADMINISTRATOR=0x8n;
const CORE_FEATURES=['economy','bank','games','tickets','store','rolePanel','levels','voiceRewards','voiceRooms','moderation','gangs','gangMissions','bankRobbery','serverGuide','cityDirector'];

const ROLE_PERMISSION_DEFS=[
  ['CreateInstantInvite',0,'عام','إنشاء دعوات','إنشاء روابط دعوة للسيرفر.'],['KickMembers',1,'الإدارة','طرد الأعضاء','طرد أعضاء رتبهم أقل من رتبة المنفذ.'],['BanMembers',2,'الإدارة','حظر الأعضاء','حظر وإلغاء حظر الأعضاء.'],['Administrator',3,'خطير','Administrator','كل الصلاحيات ويتجاوز قيود القنوات بالكامل.'],['ManageChannels',4,'الإدارة','إدارة القنوات','إنشاء وتعديل وحذف القنوات.'],['ManageGuild',5,'الإدارة','إدارة السيرفر','تعديل إعدادات السيرفر العامة.'],['AddReactions',6,'النص','إضافة رياكشن','إضافة تفاعلات جديدة على الرسائل.'],['ViewAuditLog',7,'الإدارة','عرض سجل التدقيق','مشاهدة Audit Log للسيرفر.'],['PrioritySpeaker',8,'الصوت','متحدث ذو أولوية','استخدام Priority Speaker في الفويس.'],['Stream',9,'الصوت','البث ومشاركة الشاشة','بدء بث أو مشاركة الشاشة.'],['ViewChannel',10,'القنوات','رؤية القنوات','رؤية القنوات التي تسمح بها الصلاحيات.'],['SendMessages',11,'النص','إرسال الرسائل','الكتابة في القنوات النصية.'],['SendTTSMessages',12,'النص','رسائل TTS','إرسال رسائل Text-to-Speech.'],['ManageMessages',13,'الإدارة','إدارة الرسائل','حذف رسائل الآخرين وإدارة الرسائل.'],['EmbedLinks',14,'النص','تضمين الروابط','إظهار معاينة Embed للروابط؛ لا يمنع إرسال الرابط نفسه.'],['AttachFiles',15,'النص','إرفاق الملفات','رفع الصور والفيديو والملفات.'],['ReadMessageHistory',16,'النص','قراءة السجل','قراءة الرسائل القديمة في القناة.'],['MentionEveryone',17,'النص','منشن الجميع','استخدام @everyone و@here ومنشن الرتب.'],['UseExternalEmojis',18,'النص','إيموجي خارجي','استخدام إيموجيات من سيرفرات أخرى.'],['ViewGuildInsights',19,'الإدارة','إحصاءات السيرفر','عرض Guild Insights عند توفرها.'],['Connect',20,'الصوت','دخول الفويس','الاتصال بالقنوات الصوتية.'],['Speak',21,'الصوت','التحدث','التحدث داخل القنوات الصوتية.'],['MuteMembers',22,'الصوت','كتم الأعضاء','Mute للأعضاء داخل الفويس.'],['DeafenMembers',23,'الصوت','تصميت الأعضاء','Deafen للأعضاء داخل الفويس.'],['MoveMembers',24,'الصوت','نقل الأعضاء','نقل الأعضاء بين القنوات الصوتية.'],['UseVAD',25,'الصوت','Voice Activity','استخدام اكتشاف الصوت بدل Push-to-Talk.'],['ChangeNickname',26,'الأعضاء','تغيير الاسم الشخصي','تغيير Nickname الخاص به.'],['ManageNicknames',27,'الإدارة','إدارة الأسماء','تعديل Nickname لأعضاء أقل منه.'],['ManageRoles',28,'الإدارة','إدارة الرتب','تعديل الرتب الأقل منه حسب ترتيب Discord.'],['ManageWebhooks',29,'الإدارة','إدارة Webhooks','إنشاء وتعديل وحذف Webhooks.'],['ManageGuildExpressions',30,'الإدارة','إدارة التعبيرات','إدارة الإيموجي والستيكرات والأصوات.'],['UseApplicationCommands',31,'النص','استخدام أوامر التطبيقات','استخدام Slash Commands وContext Commands.'],['RequestToSpeak',32,'الصوت','طلب التحدث','طلب التحدث في Stage.'],['ManageEvents',33,'الإدارة','إدارة الأحداث','إدارة Scheduled Events الخاصة بالآخرين.'],['ManageThreads',34,'الإدارة','إدارة Threads','حذف وأرشفة وإدارة Threads.'],['CreatePublicThreads',35,'النص','إنشاء Thread عام','إنشاء Public/Announcement Threads.'],['CreatePrivateThreads',36,'النص','إنشاء Thread خاص','إنشاء Private Threads.'],['UseExternalStickers',37,'النص','ستيكر خارجي','استخدام Stickers من سيرفرات أخرى.'],['SendMessagesInThreads',38,'النص','الكتابة في Threads','إرسال رسائل داخل Threads.'],['UseEmbeddedActivities',39,'الصوت','Activities','تشغيل Activities داخل القنوات.'],['ModerateMembers',40,'الإدارة','Timeout','تطبيق Communication Timeout على الأعضاء.'],['ViewCreatorMonetizationAnalytics',41,'الإدارة','إحصاءات الاشتراكات','عرض تحليلات Role Subscriptions عند توفرها.'],['UseSoundboard',42,'الصوت','Soundboard','استخدام Soundboard.'],['CreateGuildExpressions',43,'عام','إنشاء تعبيرات','إنشاء Emoji/Sticker/Sound خاص به.'],['CreateEvents',44,'عام','إنشاء أحداث','إنشاء Scheduled Events.'],['UseExternalSounds',45,'الصوت','أصوات خارجية','استخدام أصوات Soundboard من سيرفرات أخرى.'],['SendVoiceMessages',46,'النص','رسائل صوتية','إرسال Voice Messages.'],['SetVoiceChannelStatus',48,'الصوت','حالة الفويس','تغيير حالة القناة الصوتية.'],['SendPolls',49,'النص','إرسال تصويت','إنشاء Polls.'],['UseExternalApps',50,'النص','تطبيقات خارجية','السماح لتطبيقات المستخدم بإرسال ردود عامة.'],['PinMessages',51,'الإدارة','تثبيت الرسائل','تثبيت وإلغاء تثبيت الرسائل.'],['BypassSlowmode',52,'النص','تجاوز Slowmode','تجاوز مدة الانتظار في Slowmode.']
].map(([key,bit,group,label,desc])=>({key,bit,group,label,desc,value:1n<<BigInt(bit)}));
const ROLE_PERMISSION_BY_KEY=new Map(ROLE_PERMISSION_DEFS.map(x=>[x.key,x]));
const CHANNEL_PERMISSION_KEYS=new Set(['CreateInstantInvite','ManageChannels','AddReactions','PrioritySpeaker','Stream','ViewChannel','SendMessages','SendTTSMessages','ManageMessages','EmbedLinks','AttachFiles','ReadMessageHistory','MentionEveryone','UseExternalEmojis','Connect','Speak','MuteMembers','DeafenMembers','MoveMembers','UseVAD','ManageRoles','ManageWebhooks','UseApplicationCommands','RequestToSpeak','ManageThreads','CreatePublicThreads','CreatePrivateThreads','UseExternalStickers','SendMessagesInThreads','UseEmbeddedActivities','UseSoundboard','UseExternalSounds','SendVoiceMessages','SetVoiceChannelStatus','SendPolls','UseExternalApps','PinMessages','BypassSlowmode']);
const CONTENT_KINDS=['links','videos','images','files'];
function roleManagerPermissionMeta(){return ROLE_PERMISSION_DEFS.map(({key,bit,group,label,desc})=>({key,bit,group,label,desc,channel:CHANNEL_PERMISSION_KEYS.has(key)}));}
function jsonScript(v){return JSON.stringify(v).replace(/</g,'\\u003c').replace(/-->/g,'--\\u003e');}
function roleSecuritySnapshot(cfg={}){const d={enabled:true,ownerBypass:true,content:{},channelRules:[]},raw=cfg.roleSecurity||{};d.enabled=raw.enabled!==false;d.ownerBypass=raw.ownerBypass!==false;for(const kind of CONTENT_KINDS){const x=raw.content?.[kind]||{};d.content[kind]={enabled:x.enabled===true,allowedRoleIds:arr(x.allowedRoleIds).map(String),exemptChannelIds:arr(x.exemptChannelIds).map(String),...(kind==='links'?{allowDiscordLinks:x.allowDiscordLinks===true}:{})};}d.channelRules=Array.isArray(raw.channelRules)?raw.channelRules:[];return d;}
function normalizeSecurityPayload(raw,validRoles,validChannels,current={}){const out=roleSecuritySnapshot(current);if(raw&&typeof raw==='object'){out.enabled=raw.enabled!==false;out.ownerBypass=raw.ownerBypass!==false;for(const kind of CONTENT_KINDS){const x=raw.content?.[kind]||{};out.content[kind]={enabled:x.enabled===true,allowedRoleIds:arr(x.allowedRoleIds).map(String).filter(x=>validRoles.has(x)).slice(0,100),exemptChannelIds:arr(x.exemptChannelIds).map(String).filter(x=>validChannels.has(x)).slice(0,200),...(kind==='links'?{allowDiscordLinks:x.allowDiscordLinks===true}:{})};}}return out;}


function esc(v=''){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));}
function panelMediaFields(cfg,key,label='اللوحة'){const media=cfg?.panelMedia?.[key]||{};return `<div class="form-grid z-panel-media-fields"><label class="wide">🖼️ Banner ${esc(label)}<input type="url" name="panelMedia_${key}_bannerUrl" value="${esc(media.bannerUrl||'')}" placeholder="https://.../banner.png"></label><label class="wide">🔹 الصورة المصغرة / Logo ${esc(label)}<input type="url" name="panelMedia_${key}_thumbnailUrl" value="${esc(media.thumbnailUrl||'')}" placeholder="https://.../logo.png"></label><div class="wide hint">عند الضغط على إرسال / تحديث تستخدم اللوحة هذه الصور فورًا. إذا مسحت الرابط ترجع للصورة الافتراضية.</div></div>`;}
function applyPanelMedia(payload,cfg,key){const media=cfg?.panelMedia?.[key]||{};if(!payload||!Array.isArray(payload.embeds)||!payload.embeds.length)return payload;const embed={...(payload.embeds[0]||{})};const banner=String(media.bannerUrl||cfg?.branding?.panelBannerUrl||'').trim(),thumb=String(media.thumbnailUrl||cfg?.branding?.panelLogoUrl||'').trim();if(banner)embed.image={url:banner};if(thumb)embed.thumbnail={url:thumb};payload={...payload,embeds:[embed,...payload.embeds.slice(1)]};return payload;}
function baseUrl(){return String(process.env.PUBLIC_BASE_URL||'http://localhost:3000').replace(/\/$/,'');}
function ownerIds(){return new Set(String(process.env.OWNER_IDS||'').split(',').map(x=>x.trim()).filter(x=>/^\d{15,25}$/.test(x)));}
function isOwner(user){return Boolean(user?.id&&ownerIds().has(String(user.id)));}
function botSyncKey(){const token=String(process.env.BOT_TOKEN||process.env.TOKEN||'').trim();return token?crypto.createHash('sha256').update(`ZOMBI_SYNC:${token}`).digest('hex'):'';}
function requireBotSync(req,res,next){const expected=botSyncKey(),auth=String(req.get('authorization')||''),got=auth.startsWith('Bearer ')?auth.slice(7).trim():'';if(!expected||!got)return res.status(401).json({ok:false,error:'BOT_SYNC_UNAUTHORIZED'});const a=Buffer.from(expected),b=Buffer.from(got);if(a.length!==b.length||!crypto.timingSafeEqual(a,b))return res.status(401).json({ok:false,error:'BOT_SYNC_UNAUTHORIZED'});next();}
function canManage(g){try{const p=BigInt(String(g?.permissions||'0'));return Boolean(g?.owner)||(p&MANAGE_GUILD)===MANAGE_GUILD||(p&ADMINISTRATOR)===ADMINISTRATOR;}catch{return false;}}
function csrf(req){if(!req.session.csrf)req.session.csrf=crypto.randomBytes(24).toString('hex');return req.session.csrf;}
function checkCsrf(req,res,next){if(!req.session?.csrf)return res.status(403).send('CSRF validation failed');if(String(req.body?._csrf||req.get('x-csrf-token')||'')!==String(req.session?.csrf||''))return res.status(403).send('CSRF validation failed');next();}
function requireLogin(req,res,next){if(req.user)return next();req.session.returnTo=req.originalUrl;res.redirect('/auth/discord');}
function requireOwner(req,res,next){if(req.user&&isOwner(req.user))return next();res.status(403).send('Owner only');}
function userGuild(req,gid){return (req.user?.guilds||[]).find(g=>String(g.id)===String(gid));}
function color(cfg){const n=parseInt(String(cfg?.branding?.color||'#7c3aed').replace('#',''),16);return Number.isFinite(n)?n:0x7c3aed;}
function arr(v){return Array.isArray(v)?v:(v?[v]:[]);}
function int(v,fallback,min,max){const n=Number(v);return Number.isFinite(n)?Math.max(min,Math.min(max,Math.round(n))):fallback;}
function capFor(req,cfg,site,key){return featureAllowed(site,cfg,key);}
function maxFor(req,cfg,site,key){return limitFor(site,cfg,key);}
function isGuildOwner(req){return Boolean(String(req.user?.id||'')===String(req.bundle?.guild?.owner_id||''));}
function upgradeRequiredPage(req,site,cfg,detail){const plan=PLAN_LABELS[planNameForConfig(cfg)]||'Free';const price=planNameForConfig(cfg)==='premium'?site.premiumPlusPrice:site.premiumPrice;return layout('ترقية الاشتراك',`<section class="login upgrade-required"><span class="badge">💎 UPGRADE REQUIRED</span><h1>هذا الإعداد أعلى من حد خطتك</h1><p>${esc(detail)}</p><p>الخطة الحالية: <b>${esc(plan)}</b>${price?` • الترقية: <b>${esc(price)}</b>`:''}</p><div class="actions"><a class="btn primary" href="/premium">💎 عرض الاشتراكات</a><a class="btn" href="/dashboard/${req.params.guildId}?section=games">رجوع للألعاب</a></div></section>`,req.user);}
function sendUpgradeRequired(req,res,site,cfg,detail){const current=planNameForConfig(cfg),plans=current==='free'?['premium','premium_plus']:current==='premium'?['premium_plus']:[];if(String(req.get('accept')||'').includes('application/json'))return res.status(403).json({ok:false,code:'SUBSCRIPTION_LIMIT',message:detail,plans});return res.status(403).send(upgradeRequiredPage(req,site,cfg,detail));}
function planBadge(cfg){return (planNameForConfig(cfg)==='free'?'🆓 ':'💎 ')+PLAN_LABELS[planNameForConfig(cfg)];}
function homeGuildId(){return String(process.env.HOME_GUILD_ID||legacyPreset?.guildId||'').trim();}
function isHomeGuild(gid){const home=homeGuildId();return Boolean(home&&String(gid)===home);}
function paymentPlan(v){return String(v)==='premium_plus'?'premium_plus':'premium';}
function resolvedZainCash(site={}){
  const raw=site.zainCash||{},envWallet=String(process.env.ZAIN_CASH_WALLET||'').trim(),envName=String(process.env.ZAIN_CASH_NAME||'').trim();
  const enabledEnv=String(process.env.ZAIN_CASH_ENABLED||'').trim().toLowerCase();
  const enabled=enabledEnv?['1','true','yes','on'].includes(enabledEnv):Boolean(raw.enabled||envWallet);
  const num=(envKey,fallback,min=0.1,max=10000)=>{const v=String(process.env[envKey]||'').trim();const n=v===''?Number(fallback):Number(v);return Number.isFinite(n)?Math.max(min,Math.min(max,Math.round(n*1000)/1000)):Number(fallback||0);};
  const days=(envKey,fallback)=>{const v=String(process.env[envKey]||'').trim();const n=v===''?Number(fallback):Number(v);return Number.isFinite(n)?Math.max(1,Math.min(3650,Math.round(n))):30;};
  const walletNumber=envWallet||String(raw.walletNumber||'').trim(),walletName=envName||String(raw.walletName||'').trim();
  return{enabled:Boolean(enabled&&walletNumber),walletNumber,walletName,premiumAmount:num('ZAIN_CASH_PREMIUM_AMOUNT',raw.premiumAmount??4.99),premiumPlusAmount:num('ZAIN_CASH_PREMIUM_PLUS_AMOUNT',raw.premiumPlusAmount??7.99),premiumDays:days('ZAIN_CASH_PREMIUM_DAYS',raw.premiumDays??30),premiumPlusDays:days('ZAIN_CASH_PREMIUM_PLUS_DAYS',raw.premiumPlusDays??30),instructions:String(process.env.ZAIN_CASH_INSTRUCTIONS||raw.instructions||'حوّل المبلغ المطلوب إلى محفظة Zain Cash ثم ارفع صورة واضحة لإثبات التحويل.').trim().slice(0,1000)};
}
function publicSiteConfig(site){return{...site,zainCash:resolvedZainCash(site)};}
function paymentAmount(zain,plan){return plan==='premium_plus'?Number(zain.premiumPlusAmount):Number(zain.premiumAmount);}
function paymentDays(zain,plan){return plan==='premium_plus'?Number(zain.premiumPlusDays):Number(zain.premiumDays);}
function normalizePayerPhone(v){const s=String(v||'').trim().replace(/[\s()-]/g,'');return /^\+?\d{8,20}$/.test(s)?s:'';}
function parsePaymentProof(raw){
  const value=String(raw||'');const m=value.match(/^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=\r\n]+)$/i);if(!m)throw new Error('ارفع صورة إثبات بصيغة PNG أو JPG أو WEBP.');
  const buf=Buffer.from(m[2].replace(/\s+/g,''),'base64');if(!buf.length||buf.length>3*1024*1024)throw new Error('حجم صورة الإثبات يجب أن يكون أقل من 3MB.');
  const detected=detectDiscordImageMime(buf);if(!['image/png','image/jpeg','image/webp'].includes(detected))throw new Error('ملف إثبات الدفع ليس صورة صالحة.');
  return{proofData:`data:${detected};base64,${buf.toString('base64')}`,proofMime:detected,proofHash:crypto.createHash('sha256').update(buf).digest('hex')};
}
function paymentStatusLabel(status){return({pending:'⏳ بانتظار المراجعة',processing:'🔄 قيد المعالجة',approved:'✅ مقبول',rejected:'❌ مرفوض'})[status]||status;}
function paymentDate(ts){try{return new Date(Number(ts)||Date.now()).toLocaleString('ar-JO',{timeZone:'Asia/Amman'});}catch{return'';}}
async function appendHomeAdminOp(gid,name,op){if(!isHomeGuild(gid))return;const file=String(name||'').trim();if(!file)return;const list=await store.data(gid,file,[]);const next=(Array.isArray(list)?list:[]).filter(x=>!x?.appliedAt).slice(-99);next.push({id:`op_${Date.now().toString(36)}_${Math.random().toString(36).slice(2,8)}`,...op,createdAt:Date.now(),appliedAt:0});await store.saveData(gid,file,next);}

let botApiBackendCache={mode:'',until:0};
const botGetCache=new Map();
const botInflight=new Map();
const sleepMs=ms=>new Promise(resolve=>setTimeout(resolve,Math.max(0,Number(ms)||0)));
function botToken(){return String(process.env.BOT_TOKEN||process.env.TOKEN||process.env.DISCORD_BOT_TOKEN||'').trim();}
function proxySecretCandidates(){
  const list=[];
  for(const key of ['OAUTH_PROXY_SECRET','BOT_API_PROXY_SECRET']){const v=String(process.env[key]||'').trim();if(v)list.push(v);}
  const clientSecret=String(process.env.DISCORD_CLIENT_SECRET||'').trim();
  if(clientSecret)list.push(crypto.createHash('sha256').update(`ZOMBI_PROXY:${clientSecret}`).digest('hex'));
  return [...new Set(list)];
}
function oauthProxyUrl(){
  const raw=String(process.env.OAUTH_PROXY_URL||'').trim();if(!raw)return '';
  try{const u=new URL(raw);if(!u.pathname||u.pathname==='/'||u.pathname==='/bot/request')u.pathname='/oauth/exchange';return u.toString();}catch{return '';}
}
function botProxyConfig(){
  const raw=String(process.env.BOT_API_PROXY_URL||process.env.OAUTH_PROXY_URL||'').trim();if(!raw)return null;
  const secrets=proxySecretCandidates();if(!secrets.length)return null;
  try{const u=new URL(raw);return{url:`${u.origin}/bot/request`,secrets};}catch{return null;}
}
function retryAfterSeconds(response,data){
  const raw=data?.retry_after??response?.headers?.get?.('retry-after')??0;const n=Number(raw||0);return Number.isFinite(n)&&n>0?n:0;
}
function makeDiscordError(response,data,label='Discord API'){
  const e=new Error(data?.message||data?.error_description||data?.error||`${label} ${response?.status||'ERR'}`);
  e.status=Number(response?.status||0);e.discord=data;e.retryAfter=retryAfterSeconds(response,data);return e;
}
async function directBotRequest(route,options={}){
  const token=botToken();
  if(!token){const e=new Error('BOT_TOKEN غير موجود في إعدادات الموقع.');e.code='BOT_TOKEN_MISSING';throw e;}
  const res=await fetch(API+route,{...options,headers:{Authorization:`Bot ${token}`,'Content-Type':'application/json',Accept:'application/json',...(options.headers||{})}});
  if(res.status===204)return null;
  const text=await res.text();let data=null;try{data=text?JSON.parse(text):null;}catch{data=text?{message:text}:null;}
  if(!res.ok)throw makeDiscordError(res,data,'Discord API');
  return data;
}
async function proxyBotRequest(route,options={}){
  const proxy=botProxyConfig();
  if(!proxy){const e=new Error('Discord Proxy غير مهيأ.');e.code='BOT_PROXY_MISSING';throw e;}
  const method=String(options.method||'GET').toUpperCase();let bodyValue=null;
  if(options.body!==undefined&&options.body!==null){if(typeof options.body==='string'){try{bodyValue=JSON.parse(options.body);}catch{bodyValue=options.body;}}else bodyValue=options.body;}
  let lastAuthError=null;
  for(const secret of proxy.secrets){
    const res=await fetch(proxy.url,{method:'POST',headers:{Authorization:`Bearer ${secret}`,'Content-Type':'application/json',Accept:'application/json'},body:JSON.stringify({route:String(route),method,body:bodyValue})});
    const text=await res.text();let payload=null;try{payload=text?JSON.parse(text):null;}catch{payload={error:text};}
    if([401,403].includes(res.status)){lastAuthError=makeDiscordError(res,payload,'ZOMBI Discord Proxy');continue;}
    if(!res.ok||payload?.ok===false){const e=makeDiscordError(res,payload?.data||payload,'Discord API');e.status=Number(payload?.status||res.status);e.retryAfter=Number(payload?.retry_after||e.retryAfter||0);throw e;}
    return payload?.data??null;
  }
  throw lastAuthError||new Error('تعذر توثيق Discord Proxy.');
}
function preferredBotBackend(){
  const now=Date.now();if(botApiBackendCache.mode&&botApiBackendCache.until>now)return botApiBackendCache.mode;
  const mode=botProxyConfig()?'proxy':(botToken()?'direct':'');
  if(!mode)throw new Error('لا يوجد اتصال Discord Bot API. أضف BOT_TOKEN أو OAUTH_PROXY_URL.');
  botApiBackendCache={mode,until:now+10*60*1000};return mode;
}
function botCacheTtl(route){
  if(route==='/users/@me')return 10*60*1000;
  if(route.startsWith('/users/@me/guilds'))return 2*60*1000;
  if(/\/guilds\/\d+\/(channels|roles)/.test(route))return 60*1000;
  if(/\/guilds\/\d+/.test(route))return 60*1000;
  return 20*1000;
}
function invalidateBotCaches(route=''){
  const m=String(route).match(/\/guilds\/(\d{15,25})/);const gid=m?.[1]||'';
  if(gid){for(const key of [...botGetCache.keys()])if(key.includes(`/guilds/${gid}`))botGetCache.delete(key);if(typeof invalidateGuildBundle==='function')invalidateGuildBundle(gid);}
  if(String(route).includes('/users/@me/guilds')){for(const key of [...botGetCache.keys()])if(key.includes('/users/@me/guilds'))botGetCache.delete(key);botGuildListCache.until=0;}
}
async function performBotRequest(route,options={}){
  let mode=preferredBotBackend();
  const call=()=>mode==='proxy'?proxyBotRequest(route,options):directBotRequest(route,options);
  try{return await call();}
  catch(e){
    if(Number(e?.status)===401){
      const alt=mode==='proxy'&&botToken()?'direct':(mode==='direct'&&botProxyConfig()?'proxy':'');
      if(alt){mode=alt;botApiBackendCache={mode,until:Date.now()+2*60*1000};return mode==='proxy'?proxyBotRequest(route,options):directBotRequest(route,options);}
    }
    throw e;
  }
}
async function botFetch(route,options={}){
  const method=String(options.method||'GET').toUpperCase(),key=`${method}:${route}`;
  if(method!=='GET'){
    const result=await performBotRequest(route,options);invalidateBotCaches(route);return result;
  }
  const now=Date.now(),cached=botGetCache.get(key);
  if(cached&&cached.until>now)return cached.data;
  if(botInflight.has(key))return botInflight.get(key);
  const task=(async()=>{
    try{
      let result;
      try{result=await performBotRequest(route,options);}catch(e){
        if(Number(e?.status)===429){
          const waitMs=Math.ceil(Number(e.retryAfter||0)*1000);
          if(waitMs>0&&waitMs<=4500){await sleepMs(waitMs+150);result=await performBotRequest(route,options);}
          else if(cached&&cached.staleUntil>now)return cached.data;
          else throw e;
        }else throw e;
      }
      botGetCache.set(key,{data:result,until:Date.now()+botCacheTtl(route),staleUntil:Date.now()+10*60*1000});return result;
    }finally{botInflight.delete(key);}
  })();
  botInflight.set(key,task);return task;
}

let botGuildListCache={ids:new Set(),guilds:new Map(),bot:null,until:0,staleUntil:0};
async function getBotGuildIdSet(force=false){
  const now=Date.now();
  if(!force&&botGuildListCache.until>now&&botGuildListCache.ids instanceof Set)return botGuildListCache;
  try{
    const [botUser,guilds]=await Promise.all([botFetch('/users/@me'),botFetch('/users/@me/guilds?with_counts=true&limit=200')]);
    if(!botUser?.id)throw new Error('Discord لم يرجع هوية البوت.');
    if(!Array.isArray(guilds))throw new Error('Discord لم يرجع قائمة سيرفرات البوت.');
    const expected=String(process.env.DISCORD_BOT_CLIENT_ID||'').trim();
    if(expected&&String(botUser.id)!==expected){const e=new Error(`BOT_TOKEN يعود لبوت مختلف عن DISCORD_BOT_CLIENT_ID (${botUser.id} != ${expected}).`);e.code='BOT_ID_MISMATCH';throw e;}
    botGuildListCache={ids:new Set(guilds.map(g=>String(g.id))),guilds:new Map(guilds.map(g=>[String(g.id),g])),bot:botUser,until:now+2*60*1000,staleUntil:now+20*60*1000};
    return botGuildListCache;
  }catch(e){
    if(botGuildListCache.ids.size&&botGuildListCache.staleUntil>now&&Number(e?.status)===429)return botGuildListCache;
    throw e;
  }
}
async function getRecentBotHeartbeat(){
  try{
    const hb=await store.data('site','heartbeat.json',{});const at=Number(hb?.at||0);
    if(!at||Date.now()-at>180_000)return null;
    return{...hb,guildIds:Array.isArray(hb.guildIds)?hb.guildIds.map(String).filter(x=>/^\d{15,25}$/.test(x)).slice(0,500):[]};
  }catch{return null;}
}
async function getBotPresenceSnapshot(){
  const heartbeat=await getRecentBotHeartbeat();let api=null,error=null;
  try{api=await getBotGuildIdSet();}catch(e){error=e;}
  const ids=new Set();if(api?.ids)for(const id of api.ids)ids.add(String(id));if(heartbeat?.ready!==false)for(const id of heartbeat?.guildIds||[])ids.add(String(id));
  return{ids,heartbeat,api,error};
}
function detectDiscordImageMime(buf){
  if(!Buffer.isBuffer(buf)||buf.length<4)return '';
  if(buf.length>=8&&buf[0]===0x89&&buf[1]===0x50&&buf[2]===0x4E&&buf[3]===0x47&&buf[4]===0x0D&&buf[5]===0x0A&&buf[6]===0x1A&&buf[7]===0x0A)return 'image/png';
  if(buf[0]===0xFF&&buf[1]===0xD8&&buf[2]===0xFF)return 'image/jpeg';
  if(buf.length>=6&&(buf.subarray(0,6).toString('ascii')==='GIF87a'||buf.subarray(0,6).toString('ascii')==='GIF89a'))return 'image/gif';
  if(buf.length>=12&&buf.subarray(0,4).toString('ascii')==='RIFF'&&buf.subarray(8,12).toString('ascii')==='WEBP')return 'image/webp';
  return '';
}
function discordFormDetails(err){
  const root=err?.discord?.errors||err?.discord?.data?.errors;
  if(!root||typeof root!=='object')return '';
  const found=[];
  const walk=(node,path=[])=>{
    if(!node||typeof node!=='object'||found.length>=6)return;
    if(Array.isArray(node._errors))for(const item of node._errors){if(found.length>=6)break;const msg=String(item?.message||item?.code||'قيمة غير مقبولة');found.push(`${path.join('.')||'body'}: ${msg}`);}
    for(const [key,val] of Object.entries(node)){if(key==='_errors')continue;walk(val,[...path,key]);}
  };
  walk(root,[]);return found.join(' | ');
}
async function profileImageData(urlValue,label='الصورة'){
  const raw=String(urlValue||'').trim();
  if(!raw)return null;
  let u;try{u=new URL(raw);}catch{throw new Error(`${label}: الرابط غير صالح.`);}
  if(u.protocol!=='https:')throw new Error(`${label}: استخدم رابط HTTPS مباشر للصورة.`);
  if(['localhost','127.0.0.1','0.0.0.0','::1'].includes(u.hostname.toLowerCase()))throw new Error(`${label}: رابط محلي غير مسموح.`);
  const response=await fetch(u,{redirect:'follow',headers:{'User-Agent':'ZOMBI-Dashboard/9.6.3','Accept':'image/png,image/jpeg,image/gif;q=0.9,*/*;q=0.2'}});
  if(!response.ok)throw new Error(`${label}: تعذر تحميل الصورة (HTTP ${response.status}).`);
  const headerType=String(response.headers.get('content-type')||'').split(';')[0].trim().toLowerCase();
  if(!headerType.startsWith('image/'))throw new Error(`${label}: الرابط يجب أن يرجع ملف صورة مباشر.`);
  const declared=Number(response.headers.get('content-length')||0),max=8*1024*1024;
  if(declared>max)throw new Error(`${label}: حجم الصورة أكبر من 8MB.`);
  const buf=Buffer.from(await response.arrayBuffer());
  if(!buf.length)throw new Error(`${label}: ملف الصورة فارغ.`);
  if(buf.length>max)throw new Error(`${label}: حجم الصورة أكبر من 8MB.`);
  const type=detectDiscordImageMime(buf);
  if(type==='image/webp')throw new Error(`${label}: Discord لا يقبل WebP في هذا الحقل. استخدم رابط PNG أو JPG أو GIF مباشر.`);
  if(!['image/png','image/jpeg','image/gif'].includes(type))throw new Error(`${label}: نوع الصورة غير مدعوم. استخدم PNG أو JPG أو GIF فقط.`);
  return `data:${type};base64,${buf.toString('base64')}`;
}
const guildBundleCache=new Map();
function invalidateGuildBundle(id){if(id)guildBundleCache.delete(String(id));}
async function getBotGuild(id){try{return await botFetch(`/guilds/${id}?with_counts=true`);}catch(e){if(e.status===404)return null;throw e;}}
const GUILD_BUNDLE_SNAPSHOT='discord-dashboard-bundle.json';
async function readStoredGuildBundle(gid){
  try{
    const snap=await store.data(String(gid),GUILD_BUNDLE_SNAPSHOT,null);
    if(!snap||!snap.guild||!Array.isArray(snap.channels)||!Array.isArray(snap.roles))return null;
    if(!Array.isArray(snap.emojis))snap.emojis=[];
    return snap;
  }catch{return null;}
}
async function writeStoredGuildBundle(gid,data){
  try{await store.saveData(String(gid),GUILD_BUNDLE_SNAPSHOT,{guild:data.guild,channels:data.channels,roles:data.roles,emojis:Array.isArray(data.emojis)?data.emojis:[],at:Date.now()});}catch{}
}
async function getGuildBundle(id,force=false){
  const gid=String(id),now=Date.now(),cached=guildBundleCache.get(gid);
  if(!force&&cached&&cached.until>now)return cached.data;
  let stored=null;
  if(!force){
    stored=await readStoredGuildBundle(gid);
    if(stored&&Number(stored.at||0)>now-15*60_000){
      const emojis=await botFetch(`/guilds/${gid}/emojis`).catch(()=>stored.emojis||[]);
      const data={guild:stored.guild,channels:stored.channels,roles:stored.roles,emojis:Array.isArray(emojis)?emojis:[],_snapshot:true};
      guildBundleCache.set(gid,{data,until:now+60_000,staleUntil:now+30*60_000});
      return data;
    }
  }
  try{
    const [guild,channels,roles,emojis]=await Promise.all([
      getBotGuild(gid),
      botFetch(`/guilds/${gid}/channels`).catch(e=>{if(Number(e?.status)===429&&cached)return cached.data?.channels||[];throw e;}),
      botFetch(`/guilds/${gid}/roles`).catch(e=>{if(Number(e?.status)===429&&cached)return cached.data?.roles||[];throw e;}),
      botFetch(`/guilds/${gid}/emojis`).catch(e=>{if(Number(e?.status)===429&&cached)return cached.data?.emojis||[];return [];})
    ]);
    if(!guild)return null;
    const data={guild,channels:Array.isArray(channels)?channels:[],roles:Array.isArray(roles)?roles:[],emojis:Array.isArray(emojis)?emojis:[]};
    guildBundleCache.set(gid,{data,until:Date.now()+2*60_000,staleUntil:Date.now()+30*60_000});
    writeStoredGuildBundle(gid,data).catch(()=>{});
    return data;
  }catch(e){
    if(Number(e?.status)===429){
      if(cached&&cached.staleUntil>now)return {...cached.data,_stale:true};
      stored=stored||await readStoredGuildBundle(gid);
      if(stored&&Number(stored.at||0)>now-24*60*60_000){
        const data={guild:stored.guild,channels:stored.channels,roles:stored.roles,emojis:Array.isArray(stored.emojis)?stored.emojis:[],_stale:true};
        guildBundleCache.set(gid,{data,until:now+60_000,staleUntil:now+30*60_000});
        return data;
      }
    }
    // Discord 50001/403 يعني غالبًا أن البوت لم يعد داخل السيرفر أو فقد الوصول إليه.
    // رجّع null حتى تعرض الواجهة رسالة "البوت غير موجود" بدل صفحة Missing Access عامة.
    if(Number(e?.status)===403 || Number(e?.status)===404 || Number(e?.code)===50001)return null;
    throw e;
  }
}
async function requireGuildAccess(req,res,next){
  const ug=userGuild(req,req.params.guildId);
  try{
    if(!isOwner(req.user)&&(!ug||!canManage(ug)))return res.status(403).send('ليس لديك صلاحية Manage Server على هذا السيرفر.');
    let bundle;
    try{bundle=await getGuildBundle(req.params.guildId);}catch(e){
      if(Number(e?.status)!==429)throw e;
      bundle={guild:{id:String(req.params.guildId),name:String(ug?.name||'ZOMBI Server'),owner_id:ug?.owner?String(req.user?.id||''):'',icon:ug?.icon||null},channels:[],roles:[],emojis:[],_degraded:true};
    }
    if(!bundle)return res.status(404).send(layout('Bot missing','<section class="login"><h1>🤖 البوت غير موجود في هذا السيرفر</h1><p>أضف ZOMBI أولًا ثم ارجع للـDashboard.</p></section>',req.user));
    if(bundle?.guild&&ug){
      if(!bundle.guild.name)bundle.guild.name=ug.name;
      if(!bundle.guild.icon)bundle.guild.icon=ug.icon;
      if(!bundle.guild.owner_id&&ug.owner)bundle.guild.owner_id=String(req.user?.id||'');
    }
    req.discordGuild=ug||null;req.bundle=bundle;
    if(req.method==='POST'&&bundle?._degraded){
      return res.status(503).send(layout('Discord Rate Limit',`<section class="login"><h1>⏳ Discord مشغول مؤقتًا</h1><p>فتحت الداشبورد للعرض، لكن أوقفت الحفظ مؤقتًا حتى لا تضيع إعدادات الرومات أو الرتب أثناء الـRate Limit.</p><a class="btn primary" href="${esc(req.get('referer')||`/dashboard/${req.params.guildId}`)}">رجوع</a></section>`,req.user));
    }
    if(req.method==='POST'){
      const [cfg,site]=await Promise.all([store.getConfig(req.params.guildId),store.getGlobalConfig()]);
      let keys=access.routeRequirements(req.path);
      // IMPORTANT: /settings is one large HTML form that contains controls from
      // multiple dashboard sections. The route itself performs section-scoped
      // plan checks and restoreLocked() protection. Checking every posted field
      // here makes saving an unrelated section fail just because another hidden
      // section contains a Premium/Premium+ field. Do not pre-block /settings.
      if(req.path.endsWith('/settings')) keys=[];
      const denied=access.missing(site,cfg,keys);if(denied.length)return upgradeResponse(req,res,site,denied);
    }
    next();
  }catch(e){
    if(Number(e?.status)===401){return res.status(503).send(layout('Discord Bot Login',`<section class="login"><h1>🔑 تعذر توثيق ZOMBI مع Discord</h1><p>تأكد أن <b>BOT_TOKEN</b> في Render هو نفس توكن البوت على Monkey. إذا كان Cloudflare Worker مفعّلًا، النسخة الجديدة تحاول المفتاح اليدوي ثم المفتاح المشتق تلقائيًا من DISCORD_CLIENT_SECRET.</p><a class="btn primary" href="/dashboard">رجوع للسيرفرات</a></section>`,req.user));}
    next(e);
  }
}

function upgradeResponse(req,res,site,keys){
 const plans=access.availablePlans(site,keys),labels=plans.map(p=>PLAN_LABELS[p]);
 const message=labels.length?'اشترك في '+labels.join(' أو ')+' لحفظ هذه الميزة.':'هذه الميزة غير متاحة حاليًا في الخطط المدفوعة. تواصل مع مالك البوت.';
 if(req.get('accept')?.includes('application/json'))return res.status(403).json({error:'PLAN_REQUIRED',message,plans});
 return res.status(403).send(layout('ترقية الاشتراك',`<section class="login"><h1>🔒 الميزة غير متاحة في خطتك</h1><p>${esc(message)}</p><a class="btn primary" href="/premium">مقارنة الخطط</a><a class="btn" href="/dashboard/${esc(req.params.guildId)}">رجوع</a></section>`,req.user));
}
function decorateDashboard(html,site,cfg,owner){
 const planData={current:PLAN_LABELS[planNameForConfig(cfg)],prices:{premium:site.premiumPrice,premium_plus:site.premiumPlusPrice}};
 html=html.replace(/<(input|select|textarea|button)\b[^>]*>/g,tag=>{
  const name=tag.match(/\bname="([^"]+)"/)?.[1];if(!name)return tag;
  const keys=access.requirements(name);if(!access.missing(site,cfg,keys).length)return tag;
  const plans=access.availablePlans(site,keys);
  return tag.replace(/\sdisabled(?:="[^"]*")?/g,'').replace(/>$/,` disabled data-plan-locked="true" data-plan-options="${plans.join(',')}">`);
 });
 html=html.replace(/<form\b[^>]*action="([^"]+)"[^>]*>/g,(tag,path)=>{const keys=access.routeRequirements(path);return access.missing(site,cfg,keys).length?tag.replace(/>$/,` data-plan-locked-form="${access.availablePlans(site,keys).join(',')}">`):tag;});
 return html+`<script type="application/json" id="z-plan-context">${JSON.stringify(planData).replace(/</g,'\\u003c')}</script>`;
}
function layout(title,body,user=null){
  const pageClass=title==='Owner'?'owner-page':title==='Dashboard'?'servers-page':'';
  return `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)} • ZOMBI</title><link rel="stylesheet" href="/site/site.css?v=10.0.7"></head><body class="${pageClass}"><div class="z-brand-watermark" aria-hidden="true">ZOMBI</div><header class="top"><a class="brand" href="/"><img src="/assets/zombi-v2-logo.svg" alt="شعار ZOMBI"><span>ZOMBI</span></a><nav><a class="pill" href="https://discord.gg/A6SArZA9J" target="_blank" rel="noopener noreferrer">انضم لسيرفر ZOMBI</a><a href="/demo">جرّب الداشبورد</a><a class="z-upgrade-nav" href="/premium">💎 الاشتراكات</a>${user?`<a href="/dashboard">Dashboard</a><a href="/payments">دفعاتي</a>${isOwner(user)?'<a href="/owner">Owner</a><a href="/owner/health">الصحة والزوار</a>':''}<a class="pill" href="/logout">خروج</a>`:'<a class="pill" href="/auth/discord">تسجيل دخول</a>'}</nav></header><main>${body}</main><footer><span>© ${new Date().getFullYear()} ZOMBI • Discord Bot</span><span class="footer-links"><a href="https://discord.gg/A6SArZA9J" target="_blank" rel="noopener noreferrer">سيرفر ZOMBI</a><a href="/privacy">سياسة الخصوصية</a><a href="/terms">شروط الخدمة</a></span></footer><script defer src="/site/dashboard.js?v=10.0.7"></script><script defer src="/site/role-manager.js?v=10.0.7"></script><script defer src="/site/upgrade.js?v=10.0.7"></script><script defer src="/site/operations-ui.js?v=10.0.7"></script></body></html>`;
}
function inviteUrl(gid=''){const id=String(process.env.DISCORD_BOT_CLIENT_ID||process.env.DISCORD_CLIENT_ID||'');return `https://discord.com/oauth2/authorize?client_id=${encodeURIComponent(id)}&permissions=1099780189206&integration_type=0&scope=bot+applications.commands${gid?`&guild_id=${gid}&disable_guild_select=true`:''}`;}
async function landing(){const ids=await store.allGuildIds().catch(()=>[]),site=publicSiteConfig(await store.getGlobalConfig());return `<section class="hero"><div><span class="badge">PUBLIC DISCORD BOT</span><h1>سيرفرك. مدينتك.<br><b>عالم ZOMBI.</b></h1><p>ابنِ مجتمعك بالألعاب والاقتصاد والتذاكر. أدِر البنك والمتجر والرتب من لوحة تحكم واحدة، بإعدادات مستقلة لكل سيرفر.</p><div class="actions"><a class="btn primary" href="${inviteUrl()}">➕ إضافة إلى Discord</a><a class="btn" href="/dashboard">⚙️ فتح Dashboard</a><a class="btn z-premium-cta" href="#plans">💎 اكتشف Premium وPremium+</a></div><div class="stats"><div><strong>${ids.length}</strong><span>سيرفر مسجل</span></div><div><strong>15+</strong><span>خدمة في لوحة البنك</span></div><div><strong>Free / Premium / Premium+</strong><span>خطط</span></div></div></div><div class="hero-card"><img src="/assets/zombi-v2-logo.svg" alt="شعار ZOMBI"><h3>ZOMBI CITY</h3><p>من أول جولة إلى مدينة متكاملة.</p><div class="hero-command"><span>للأدمن</span><code>-العاب</code></div><div class="hero-command"><span>داخل روم البنك</span><code>لوحة</code></div><div class="hero-command"><span>تحدّ وانهب الكاش</span><code>نهب @العضو</code></div></div></section><section class="features"><h2>كل الأدوات في مكان واحد</h2><div class="grid">${[['🏦','ZOMBI Bank','رصيد، تحويل، حماية كاش وكفالة من لوحة واحدة'],['🎯','Heist Games','7 تحديات نهب مع سجن وكولداون مستقل لكل لعبة'],['🎮','Games','حدد من Dashboard الرتب المسموح لها بدء الألعاب'],['🎫','Tickets','أنواع تذاكر ولوحات احترافية'],['🛒','Store','بيع رتب مقابل عملة السيرفر'],['🔔','Self Roles','لوحات رتب وإشعارات ذاتية'],['🏆','Levels','XP ومستويات ومكافآت'],['💎','Free / Premium / Premium+','تحكم Owner كامل بالمميزات والألعاب لكل خطة']].map(x=>`<article><i>${x[0]}</i><h3>${x[1]}</h3><p>${x[2]}</p></article>`).join('')}</div></section>${pricing(site)}`;}
function iconUrl(g){return g?.icon?`https://cdn.discordapp.com/icons/${g.id}/${g.icon}.png?size=128`:'';}
function textChannels(channels,value){const allowed=new Set([0,5]);return `<option value="">— غير محدد —</option>`+channels.filter(c=>allowed.has(c.type)).sort((a,b)=>(a.position||0)-(b.position||0)).map(c=>`<option value="${c.id}" ${c.id===value?'selected':''}># ${esc(c.name)}</option>`).join('');}
function textChannelMultiOptions(channels,selected=[]){const allowed=new Set([0,5]),set=new Set((selected||[]).map(String));return channels.filter(c=>allowed.has(c.type)).sort((a,b)=>(a.position||0)-(b.position||0)).map(c=>`<option value="${c.id}" ${set.has(String(c.id))?'selected':''}># ${esc(c.name)}</option>`).join('');}
function categories(channels,value){return `<option value="">— غير محدد —</option>`+channels.filter(c=>c.type===4).sort((a,b)=>(a.position||0)-(b.position||0)).map(c=>`<option value="${c.id}" ${c.id===value?'selected':''}>📁 ${esc(c.name)}</option>`).join('');}
function voiceChannels(channels,value){return `<option value="">— غير محدد —</option>`+channels.filter(c=>[2,13].includes(c.type)).sort((a,b)=>(a.position||0)-(b.position||0)).map(c=>`<option value="${c.id}" ${c.id===value?'selected':''}>🔊 ${esc(c.name)}</option>`).join('');}
function multiChannelOptions(channels,selected=[],types=[0,5]){const set=new Set(selected||[]);return channels.filter(c=>types.includes(c.type)).sort((a,b)=>(a.position||0)-(b.position||0)).map(c=>`<option value="${c.id}" ${set.has(c.id)?'selected':''}>${types.includes(2)?'🔊':'#'} ${esc(c.name)}</option>`).join('');}
function checkbox(name,checked,label,disabledAttr=''){return `<label><input type="checkbox" name="${name}" ${checked?'checked':''} ${disabledAttr}> ${label}</label>`;}
function roleOptions(roles,guildId,selected=[]){const set=new Set(selected||[]);return roles.filter(r=>r.id!==guildId&&!r.managed).sort((a,b)=>(b.position||0)-(a.position||0)).map(r=>`<option value="${r.id}" ${set.has(r.id)?'selected':''}>${esc(r.name)}</option>`).join('');}
function emojiOptions(emojis,selectedId=''){const sid=String(selectedId||'');return (Array.isArray(emojis)?emojis:[]).slice().sort((a,b)=>String(a.name||'').localeCompare(String(b.name||''))).map(e=>`<option value="${esc(e.id)}" ${String(e.id)===sid?'selected':''}>${e.animated?'🎞️':'😀'} :${esc(e.name||'emoji')}:</option>`).join('');}

const RB_PERM={VIEW:1n<<10n,SEND:1n<<11n,HISTORY:1n<<16n,CONNECT:1n<<20n};
function setBitPair(allow,deny,bit,mode){allow&=~bit;deny&=~bit;if(mode==='allow')allow|=bit;else if(mode==='deny')deny|=bit;return[allow,deny];}
async function syncRoleBanPermissionsViaApi(guildId,bundle,moderation={}){
  const roleId=String(moderation.roleBanRoleId||'');if(!roleId||!/^\d{15,25}$/.test(roleId))return {changed:0,failed:0};
  const selected=new Set((moderation.roleBanVisibleChannelIds||[]).map(String)),enabled=moderation.roleBanEnabled!==false,allowSend=moderation.roleBanAllowSendMessages!==false,hideVoice=moderation.roleBanHideVoice!==false;
  const textTypes=new Set([0,5,15,16]),voiceTypes=new Set([2,13]);let changed=0,failed=0;
  for(const ch of bundle.channels||[]){
    const type=Number(ch.type);if(!textTypes.has(type)&&!voiceTypes.has(type))continue;
    const existing=(ch.permission_overwrites||[]).find(o=>String(o.id)===roleId&&Number(o.type)===0);let allow=BigInt(existing?.allow||0),deny=BigInt(existing?.deny||0);
    if(textTypes.has(type)){
      if(!enabled){[allow,deny]=setBitPair(allow,deny,RB_PERM.VIEW,'clear');[allow,deny]=setBitPair(allow,deny,RB_PERM.SEND,'clear');[allow,deny]=setBitPair(allow,deny,RB_PERM.HISTORY,'clear');}
      else if(selected.has(String(ch.id))){[allow,deny]=setBitPair(allow,deny,RB_PERM.VIEW,'allow');[allow,deny]=setBitPair(allow,deny,RB_PERM.HISTORY,'allow');[allow,deny]=setBitPair(allow,deny,RB_PERM.SEND,allowSend?'allow':'deny');}
      else{[allow,deny]=setBitPair(allow,deny,RB_PERM.VIEW,'deny');[allow,deny]=setBitPair(allow,deny,RB_PERM.SEND,'clear');[allow,deny]=setBitPair(allow,deny,RB_PERM.HISTORY,'clear');}
    }else{
      const mode=enabled&&hideVoice?'deny':'clear';[allow,deny]=setBitPair(allow,deny,RB_PERM.VIEW,mode);[allow,deny]=setBitPair(allow,deny,RB_PERM.CONNECT,mode);
    }
    try{await botFetch(`/channels/${ch.id}/permissions/${roleId}`,{method:'PUT',body:JSON.stringify({type:0,allow:String(allow),deny:String(deny)})});changed++;}catch(e){failed++;console.warn(`⚠️ ban role overwrite ${ch.id}:`,e?.message||e);}
  }
  return {changed,failed};
}
function lockedNote(ok,text='هذه الخاصية غير متاحة في خطتك الحالية.'){return ok?'':`<span class="lock-note">🔒 ${esc(text)}</span>`;}
function qaText(items){return (items||[]).map(x=>`${x.question} | ${x.answer}`).join('\n');}
function wordsText(items){return (items||[]).map(x=>`${x.scrambled} | ${x.answer}`).join('\n');}
function disabled(ok){return ok?'':'disabled';}
function redirectDashboard(req,res,fallback='overview'){const raw=String(req.body?._returnSection||req.body?._settingsSection||req.query?.section||fallback);const section=raw.replace(/[^a-z0-9_-]/gi,'').slice(0,40)||fallback;return res.redirect(`/dashboard/${req.params.guildId}?section=${encodeURIComponent(section)}&saved=1`);}
const GAME_BUTTON_STYLES={quiz:1,guess:1,rps:1,speed:1,scramble:1,truefalse:2,math:2,closest:2,word:2,wheel:3,daily:3,mafia:4,roulette:4,chairs:2,killer:4};
const GAME_PANEL_ORDER=[['quiz','guess','rps','speed','scramble'],['truefalse','math','closest','word','wheel'],['daily','mafia','roulette','chairs','killer']];
function rawGamesPanelPayload(cfg){
  const byId=new Map(GAME_DEFS.map(g=>[g.id,g]));
  const components=GAME_PANEL_ORDER.map(ids=>({type:1,components:ids.map(id=>{const g=byId.get(id);return{type:2,style:GAME_BUTTON_STYLES[id]||2,custom_id:`pub:game:${id}`,label:String(g?.label||id).slice(0,80),emoji:{name:g?.emoji||'🎮'}};})}));
  const interactiveIds=['memorycolors','reaction','different','sequence','safebutton','mathrush','emojiquiz','higherlower','treasure','codebreaker'];
  components.push({type:1,components:[{type:3,custom_id:'pub:games:interactive',placeholder:'✨ الألعاب التفاعلية الجديدة',min_values:1,max_values:1,options:interactiveIds.map(id=>{const g=byId.get(id);return{label:String(g?.label||id).slice(0,100),value:id,description:'لعبة تفاعلية سريعة داخل Discord',emoji:{name:g?.emoji||'🎮'}};})}]});
  components.push({type:1,components:[
    {type:2,style:3,custom_id:'pub:game:outsider',label:'برا السالفة',emoji:{name:'🕵️'}},
    {type:2,style:1,custom_id:'pub:game:xoTournament',label:'بطولة XO',emoji:{name:'❎'}},
    {type:2,style:4,custom_id:'pub:game:stop',label:'إيقاف اللعبة',emoji:{name:'🛑'}}
  ]});
  return{embeds:[{color:color(cfg),title:'🎮 ألعاب ZOM',description:'اختر اللعبة التي تريد تشغيلها.\n\n🎯 وقت الجولة وعدد الجولات والجائزة النهائية يتم تحديدها من **Dashboard** لكل لعبة.\n⭐ فوز الجولة = **نقطة**، والجائزة تُصرف للفائز النهائي فقط.\n🎭 المافيا والروليت والكراسي ومن القاتل تعمل حسب الخطة التي حددها Owner.\n🕵️ برا السالفة و ❎ بطولة XO موجودتان داخل نفس اللوحة.\n⌨️ تشغيل مباشر من الشات: **# + اسم اللعبة** مثل `#اسئلة`، `#روليت`، `#كراسي`، `#من-القاتل`.\n\n🛑 لإيقاف اللعبة: اضغط زر **إيقاف اللعبة** أو استخدم `#ايقاف` أو `/ايقاف`. المضيف، الرتب المسموحة، والإدارة يستطيعون الإيقاف.',footer:{text:'ZOM Games System'}}],components};
}
const DEFAULT_KILLER_CASES=[
  {story:'وُجدت خزنة مفتوحة في المكتب. كاميرا الممر أظهرت سامر يدخل المكتب رغم إنكاره.',suspects:['أحمد','سامر','وليد'],answer:1,explanation:'الكاميرا أثبتت وجود سامر في المكتب.'},
  {story:'اختفت مفاتيح السيارة ووُجدت بصمة نور على درج المفاتيح رغم قولها إنها لم تدخل الغرفة.',suspects:['نور','ليان','مازن'],answer:0,explanation:'بصمة نور تناقض كلامها.'}
];
function normalizeKillerCases(raw){const src=Array.isArray(raw)&&raw.length?raw:DEFAULT_KILLER_CASES;return src.map(x=>({story:String(x.story||'').slice(0,1500),suspects:(Array.isArray(x.suspects)?x.suspects:[]).map(y=>String(y).slice(0,80)).slice(0,5),answer:Math.max(0,Number(x.answer)||0),explanation:String(x.explanation||'').slice(0,500)})).filter(x=>x.story&&x.suspects.length>=2&&x.answer<x.suspects.length).slice(0,100);}
function killerText(items){return normalizeKillerCases(items).map(x=>`${x.story} | ${x.suspects.join(' ; ')} | ${x.answer+1} | ${x.explanation||''}`).join('\n');}
function parseKillerCases(text,max){const out=[];for(const raw of String(text||'').split(/\r?\n/)){const parts=raw.split('|').map(x=>x.trim());if(parts.length<3)continue;const suspects=parts[1].split(';').map(x=>x.trim()).filter(Boolean).slice(0,5),answer=Math.max(0,Math.min(suspects.length-1,(Number(parts[2])||1)-1));if(parts[0]&&suspects.length>=2)out.push({story:parts[0].slice(0,1500),suspects,answer,explanation:String(parts[3]||'').slice(0,500)});if(out.length>=max)break;}return out;}

async function seedLegacyHome(){
  try{
    const gid=String(process.env.HOME_GUILD_ID||legacyPreset?.guildId||'').trim();if(!gid||!legacyPreset?.config)return;
    const current=await store.getConfig(gid);if(current?.legacyPresetImportedAt||String(current?.legacyPresetVersion||'').startsWith('v8'))return;
    const keep={plan:current.plan,premiumUntil:current.premiumUntil,createdAt:current.createdAt};
    const cfg={...legacyPreset.config,...keep,legacyPresetVersion:'v8.8',legacyPresetImportedAt:Date.now()};
    await store.saveConfig(gid,cfg);
    for(const [name,value] of Object.entries(legacyPreset.data||{}))await store.saveData(gid,name,value);
    console.log(`✅ Legacy home preset V8.7 restored for guild ${gid}`);
  }catch(e){console.warn('⚠️ Legacy home preset restore:',e.message);}
}


function normalizeEventQuickCommands(raw){
  const src=Array.isArray(raw)?raw:[],seen=new Set(),out=[];
  for(const item of src){
    const command=String(item?.command||'').trim().replace(/\s+/g,' ').slice(0,40);if(!command)continue;
    const key=command.toLowerCase();if(seen.has(key))continue;seen.add(key);
    let id=String(item?.id||'').replace(/[^a-zA-Z0-9_-]/g,'').slice(0,60);if(!id)id=`event_${Date.now().toString(36)}_${out.length}`;
    out.push({id,command,label:String(item?.label||command).trim().slice(0,80)||command,points:int(item?.points,0,-1000000,1000000),zom:int(item?.zom,0,0,1000000000),targetMode:['mention','self','either'].includes(item?.targetMode)?item.targetMode:'mention',response:String(item?.response||'').trim().slice(0,500),enabled:item?.enabled!==false});
    if(out.length>=30)break;
  }
  return out;
}
function eventChannelLimit(cfg){const plan=planNameForConfig(cfg);return plan==='premium_plus'?15:plan==='premium'?5:1;}
function eventConfig(cfg){
  const raw=cfg?.event||{},legacy=String(raw.channelId||'').trim();
  const channelIds=[...new Set((Array.isArray(raw.channelIds)?raw.channelIds:(legacy?[legacy]:[])).map(String).map(x=>x.trim()).filter(Boolean))];
  if(legacy&&!channelIds.includes(legacy))channelIds.unshift(legacy);
  return {
    enabled:raw.enabled===true,channelIds,channelId:channelIds[0]||legacy,staffRoleIds:arr(raw.staffRoleIds).map(String).filter(Boolean).slice(0,50),
    publicLeaderboard:raw.publicLeaderboard!==false,leaderboardLimit:int(raw.leaderboardLimit,20,3,25),pointLabel:String(raw.pointLabel||'نقطة').trim().slice(0,30)||'نقطة',
    leaderboardCommand:String(raw.leaderboardCommand||'نقاط').trim().slice(0,40)||'نقاط',resetCommand:String(raw.resetCommand||'ترسيت').trim().slice(0,40)||'ترسيت',directPointsEnabled:raw.directPointsEnabled!==false,
    eventCommand:String(raw.eventCommand||'ايفنت').trim().replace(/\s+/g,' ').slice(0,40)||'ايفنت',eventPoints:int(raw.eventPoints,10,1,1000000),
    promotionEnabled:raw.promotionEnabled===true,promotionCommand:String(raw.promotionCommand||'ترقية').trim().replace(/\s+/g,' ').slice(0,40)||'ترقية',promotionPoints:int(raw.promotionPoints,10,1,1000000),promotionCommandChannelId:String(raw.promotionCommandChannelId||'').trim(),promotionStaffRoleIds:arr(raw.promotionStaffRoleIds).map(String).filter(Boolean).slice(0,50),promotionThreshold:int(raw.promotionThreshold,200,1,1000000000),promotionNotifyChannelId:String(raw.promotionNotifyChannelId||raw.promotionChannelId||'').trim(),promotionNotifyRoleId:String(raw.promotionNotifyRoleId||raw.promotionRoleId||'').trim(),
    decisionEnabled:raw.decisionEnabled===true,decisionStaffRoleIds:arr(raw.decisionStaffRoleIds).map(String).filter(Boolean).slice(0,50),acceptedRoleIds:arr(raw.acceptedRoleIds).map(String).filter(Boolean).slice(0,50),acceptCommand:String(raw.acceptCommand||'قبول ايفنت').trim().replace(/\s+/g,' ').slice(0,40)||'قبول ايفنت',rejectCommand:String(raw.rejectCommand||'رفض ايفنت').trim().replace(/\s+/g,' ').slice(0,40)||'رفض ايفنت',acceptMessage:String(raw.acceptMessage||'✅ تم قبولك في الإيفنت، ونتمنى أن تكون قد الثقة.').trim().slice(0,1000)||'✅ تم قبولك في الإيفنت، ونتمنى أن تكون قد الثقة.',rejectMessage:String(raw.rejectMessage||'❌ تم رفضك في الإيفنت، نتمنى أن تعمل على تحسين نفسك.').trim().slice(0,1000)||'❌ تم رفضك في الإيفنت، نتمنى أن تعمل على تحسين نفسك.',
    quickCommands:normalizeEventQuickCommands(raw.quickCommands?.length?raw.quickCommands:[{id:'create',command:'-انشاء',label:'إنشاء',points:1,zom:0,targetMode:'mention',response:'',enabled:true}])
  };
}
function eventState(raw){
  const state=raw&&typeof raw==='object'?raw:{};return {season:int(state.season,1,1,1000000),users:state.users&&typeof state.users==='object'?state.users:{},history:Array.isArray(state.history)?state.history.slice(0,500):[]};
}

function normalizeApplicationQuestion(q={},i=0){const style=String(q.style||'paragraph')==='short'?'short':'paragraph';return{id:String(q.id||`q${i+1}`).replace(/[^a-zA-Z0-9_-]/g,'_').slice(0,40)||`q${i+1}`,label:String(q.label||`السؤال ${i+1}`).trim().slice(0,45)||`السؤال ${i+1}`,placeholder:String(q.placeholder||'').trim().slice(0,100),style,required:q.required!==false,minLength:int(q.minLength,1,0,4000),maxLength:int(q.maxLength,style==='short'?400:1500,1,4000)};}
function normalizeApplicationType(x={},i=0){const qs=(Array.isArray(x.questions)?x.questions:[]).map(normalizeApplicationQuestion).filter(q=>q.label).slice(0,5);return{id:String(x.id||`application_${i+1}`).replace(/[^a-zA-Z0-9_-]/g,'_').slice(0,50)||`application_${i+1}`,title:String(x.title||`تقديم رقم ${i+1}`).trim().slice(0,80)||`تقديم رقم ${i+1}`,emoji:String(x.emoji||'📝').trim().slice(0,16)||'📝',description:String(x.description||'اضغط الزر بالأسفل لفتح نموذج التقديم.').trim().slice(0,1000),buttonLabel:String(x.buttonLabel||'فتح التقديم').trim().slice(0,80)||'فتح التقديم',panelChannelId:String(x.panelChannelId||'').trim(),reviewChannelId:String(x.reviewChannelId||'').trim(),reviewerRoleIds:arr(x.reviewerRoleIds).map(String).filter(Boolean).slice(0,50),acceptedRoleId:String(x.acceptedRoleId||'').trim(),cooldownHours:int(x.cooldownHours,0,0,8760),acceptMessage:String(x.acceptMessage||'✅ تم قبول طلبك. نتمنى لك التوفيق.').trim().slice(0,1000),rejectMessage:String(x.rejectMessage||'❌ تم رفض طلبك. نتمنى لك التوفيق وتحسين طلبك مستقبلاً.').trim().slice(0,1000),enabled:x.enabled!==false,panelMessageId:String(x.panelMessageId||'').trim(),bannerUrl:String(x.bannerUrl||'').trim(),thumbnailUrl:String(x.thumbnailUrl||'').trim(),questions:qs.length?qs:[normalizeApplicationQuestion({label:'اسمك + عمرك',style:'short'},0),normalizeApplicationQuestion({label:'اذكر خبراتك بالتفصيل'},1),normalizeApplicationQuestion({label:'سبب التقديم'},2)]};}
function normalizeApplicationsConfig(raw={}){return{enabled:raw.enabled!==false,types:(Array.isArray(raw.types)?raw.types:[]).map(normalizeApplicationType).slice(0,25)};}

function normalizeStaffManagement(raw={}){
  const duty=raw.duty||{},event=raw.event||{},leave=raw.leave||{};
  return {
    insights:{enabled:raw.insights?.enabled!==false,command:String(raw.insights?.command||'احصائيات ادارة').trim().slice(0,40),commandChannelId:String(raw.insights?.commandChannelId||''),staffRoleIds:arr(raw.insights?.staffRoleIds).map(String).slice(0,50),viewerRoleIds:arr(raw.insights?.viewerRoleIds).map(String).slice(0,50),promotionRoleIds:arr(raw.insights?.promotionRoleIds).map(String).slice(0,50),promotionChannelId:String(raw.insights?.promotionChannelId||''),promotionTargetRoleId:String(raw.insights?.promotionTargetRoleId||''),promotionEnabled:raw.insights?.promotionEnabled===true,pointsPerHour:int(raw.insights?.pointsPerHour,5,0,1000),ticketPoints:int(raw.insights?.ticketPoints,10,0,1000),ratingPoints:int(raw.insights?.ratingPoints,2,0,1000),threshold:int(raw.insights?.threshold,200,1,1000000),ratingEnabled:raw.insights?.ratingEnabled!==false,transcriptEnabled:raw.insights?.transcriptEnabled!==false},
    adminDecision:{enabled:raw.adminDecision?.enabled===true,commandChannelId:String(raw.adminDecision?.commandChannelId||''),reviewerRoleIds:arr(raw.adminDecision?.reviewerRoleIds).map(String).filter(Boolean).slice(0,50),acceptedRoleIds:arr(raw.adminDecision?.acceptedRoleIds).map(String).filter(Boolean).slice(0,50),acceptCommand:String(raw.adminDecision?.acceptCommand||'مقبول ادارة').trim().replace(/\s+/g,' ').slice(0,40),rejectCommand:String(raw.adminDecision?.rejectCommand||'رفض ادارة').trim().replace(/\s+/g,' ').slice(0,40),acceptMessage:String(raw.adminDecision?.acceptMessage||'✅ تم قبولك في إدارة {server}، ونتمنى أن تكون قد الثقة.').slice(0,1000),rejectMessage:String(raw.adminDecision?.rejectMessage||'❌ تم رفض تقديمك للإدارة في {server}، نتمنى لك التوفيق.').slice(0,1000)},
    duty:{enabled:duty.enabled!==false,panelChannelId:String(duty.panelChannelId||''),reportChannelId:String(duty.reportChannelId||''),allowedRoleIds:arr(duty.allowedRoleIds).map(String).filter(Boolean).slice(0,50),onDutyRoleId:String(duty.onDutyRoleId||''),idleMinutes:int(duty.idleMinutes,45,5,1440),autoStopIdle:Boolean(duty.autoStopIdle),panelMessageId:String(duty.panelMessageId||''),bannerUrl:String(duty.bannerUrl||''),thumbnailUrl:String(duty.thumbnailUrl||'')},
    event:{enabled:event.enabled!==false,panelChannelId:String(event.panelChannelId||''),reviewChannelId:String(event.reviewChannelId||''),reviewerRoleIds:arr(event.reviewerRoleIds).map(String).filter(Boolean).slice(0,50),acceptedRoleIds:arr(event.acceptedRoleIds).map(String).filter(Boolean).slice(0,50),panelMessageId:String(event.panelMessageId||''),bannerUrl:String(event.bannerUrl||''),thumbnailUrl:String(event.thumbnailUrl||''),acceptMessage:String(event.acceptMessage||'✅ تم قبول طلب فعاليتك.').slice(0,1000),rejectMessage:String(event.rejectMessage||'❌ تم رفض طلب فعاليتك.').slice(0,1000)},
    ...(!raw._eventLeaf? (raw.eventLeave?{eventLeave:normalizeStaffManagement({leave:raw.eventLeave,_eventLeaf:true}).leave}:{eventLeave:normalizeStaffManagement({leave:{expiryMessage:'🏖️ انتهت إجازتك من الإيفنت في {server}، يمكنك العودة.'},_eventLeaf:true}).leave}):{}),
    leave:{expiryNotify:leave.expiryNotify!==false,expiryMessage:String(leave.expiryMessage||'🏖️ انتهت إجازتك في {server}، يمكنك العودة إلى الدوام.').slice(0,1000),enabled:leave.enabled!==false,panelChannelId:String(leave.panelChannelId||''),reviewChannelId:String(leave.reviewChannelId||''),reviewerRoleIds:arr(leave.reviewerRoleIds).map(String).filter(Boolean).slice(0,50),leaveRoleId:String(leave.leaveRoleId||''),panelMessageId:String(leave.panelMessageId||''),bannerUrl:String(leave.bannerUrl||''),thumbnailUrl:String(leave.thumbnailUrl||''),acceptMessage:String(leave.acceptMessage||'✅ تم قبول طلب إجازتك.').slice(0,1000),rejectMessage:String(leave.rejectMessage||'❌ تم رفض طلب إجازتك.').slice(0,1000)}
  };
}

async function guildPage(req){
  const {guild,channels,roles}=req.bundle;
  const emojis=Array.isArray(req.bundle.emojis)?req.bundle.emojis:[];
  const [cfg,site,content,economyData,gangData,killerCases,missionTemplates,bankCatalog,eventData,promotionData,directorState,applicationsData,staffData]=await Promise.all([
    store.getConfig(guild.id),store.getGlobalConfig(),store.getGameContent(guild.id),store.getEconomy(guild.id),
    store.data(guild.id,'gangs-public.json',{gangs:{},membership:{}}),
    store.data(guild.id,'killer-cases.json',DEFAULT_KILLER_CASES),
    store.data(guild.id,'gang-missions.json',[]),
    store.data(guild.id,'bank-catalog.json',{jobs:{},companies:{},stocks:{}}),
    store.data(guild.id,'event-system.json',{season:1,users:{},history:[]}),
    store.data(guild.id,'promotion-system.json',{users:{},history:[]}),
    store.data(guild.id,'city-director-state.json',{active:null,lastEventAt:0,history:[]}),
    store.data(guild.id,'applications-config.json',{enabled:true,types:[]}),
    store.data(guild.id,'staff-systems.json',{})
  ]);
  // Welcome is part of the guild config source-of-truth. Legacy welcome-config.json
  // is no longer read here, so Dashboard and Bot can never disagree about welcome settings.
  const token=csrf(req),owner=isOwner(req.user),homeId=String(process.env.HOME_GUILD_ID||legacyPreset?.guildId||'');
  const canFeature=k=>featureAllowed(site,cfg,k), canGameSettings=canFeature('gameSettings'),canQuestions=canFeature('gameQuestions'),canBrand=canFeature('customBranding'),canCurrency=canFeature('customCurrency'),canBotProfile=featureAllowed(site,cfg,'customBotProfile'),canEconomyAdmin=canFeature('economyAdmin'),canPanelDesign=store.isPremium(cfg),canMusic=canFeature('music'),canMusicQueue=canFeature('musicQueue'),canMusicLoop=canFeature('musicLoop'),canMusicSearch=canFeature('musicSearch'),profileLockText='هذه الميزة متاحة حسب خطة هذا السيرفر.';
  const storeLimit=maxFor(req,cfg,site,'storeProducts'),roleLimit=maxFor(req,cfg,site,'selfRoles'),ticketLimit=maxFor(req,cfg,site,'ticketTypes'),questionLimit=maxFor(req,cfg,site,'questionsPerGame'),killerLimit=maxFor(req,cfg,site,'killerCases'),missionLimit=maxFor(req,cfg,site,'gangMissionTemplates'),guideLimit=maxFor(req,cfg,site,'serverGuideButtons'),directorTemplateLimit=maxFor(req,cfg,site,'cityDirectorTemplates'),musicQueueLimit=maxFor(req,cfg,site,'musicQueueSize'),musicVolumeLimit=maxFor(req,cfg,site,'musicMaxVolume'),musicTrackLimit=maxFor(req,cfg,site,'musicMaxTrackMinutes');
  const products=cfg.store.products||[],items=cfg.rolePanel.items||[],ticketTypes=cfg.tickets.types||[],guideItems=cfg.serverGuide?.items||[],directorTemplates=cfg.cityDirector?.templates||[];
  const legacyWarningRoles=Array.isArray(cfg.warnings?.roleIds)?cfg.warnings.roleIds:[cfg.warnings?.role1Id||'',cfg.warnings?.role2Id||'',cfg.warnings?.role3Id||''];
  const warningRolesFor=type=>Array.isArray(cfg.warnings?.systems?.[type]?.roleIds)?cfg.warnings.systems[type].roleIds:(type==='members'?legacyWarningRoles:[]);
  const warningSystemFor=type=>cfg.warnings?.systems?.[type]||{};
  const warningRoleFields=(type,label)=>`<div class="config-card wide"><h4>${label}</h4><div class="form-grid"><label>شات ${label}<select name="warning_${type}_channelId" ${disabled(featureAllowed(site,cfg,'warnings'))}>${textChannels(channels,warningSystemFor(type).channelId||cfg.warnings?.channelId)}</select></label><label class="wide">الرتب التي تستطيع إعطاء وإزالة هذا التحذير<select multiple size="6" name="warning_${type}_allowedRoleIds" ${disabled(featureAllowed(site,cfg,'warnings'))}>${roleOptions(roles,guild.id,warningSystemFor(type).allowedRoleIds||[])}</select><small>مالك السيرفر مسموح له دائمًا. إذا تركتها فارغة تبقى صلاحية الإدارة القديمة فعّالة للتوافق.</small></label>${[0,1,2].map(n=>`<label>التحذير ${n+1}<select name="warning_${type}_roleIds" ${disabled(featureAllowed(site,cfg,'warnings'))}><option value="">— بدون رتبة —</option>${roleOptions(roles,guild.id,warningRolesFor(type)[n]?[warningRolesFor(type)[n]]:[])}</select></label>`).join('')}</div></div>`;
  const featureChecks=CORE_FEATURES.map(k=>{const def=FEATURE_DEFS.find(x=>x.key===k),allowed=featureAllowed(site,cfg,k);return `<label class="${allowed?'':'locked'}"><input type="checkbox" name="feature_${k}" ${cfg.features[k]&&allowed?'checked':''} ${allowed?'':'disabled'}> ${def?.emoji||''} ${esc(def?.label||k)}${allowed?'':' 🔒'}</label>`;}).join('');
  const gameRows=GAME_DEFS.map(g=>{const allowed=gameAllowed(site,cfg,g.id),r=cfg.games.quickGameSettings?.[g.id]||{rounds:5,roundTimeSeconds:25,winnerReward:300,cooldownSeconds:60,rewardMin:100,rewardMax:300,xpReward:25,allowedChannelIds:[],startRoleIds:[]},roundMax=maxFor(req,cfg,site,'maxRounds'),timeMax=maxFor(req,cfg,site,'maxRoundTimeSeconds'),rewardMax=maxFor(req,cfg,site,'maxWinnerReward'),enabled=canGameSettings&&allowed?'':'disabled';return `<tr><td><b>${g.emoji} ${esc(g.label)}</b><small><code>#${esc(g.label)}</code></small></td><td><input type="checkbox" name="game_enabled_${g.id}" ${cfg.games.enabled?.[g.id]!==false&&allowed?'checked':''} ${allowed?'':'disabled'}></td><td><input type="number" name="game_rounds_${g.id}" value="${Number(r.rounds||5)}" min="1" max="${roundMax}" ${enabled}></td><td><input type="number" name="game_time_${g.id}" value="${Number(r.roundTimeSeconds||25)}" min="5" max="${timeMax}" ${enabled}></td><td><input type="number" name="game_cooldown_${g.id}" value="${Number(r.cooldownSeconds||0)}" min="0" max="86400" ${enabled}></td><td><input type="number" name="game_reward_min_${g.id}" value="${Number(r.rewardMin??r.winnerReward??0)}" min="0" max="${rewardMax}" ${enabled}></td><td><input type="number" name="game_reward_max_${g.id}" value="${Number(r.rewardMax??r.winnerReward??0)}" min="0" max="${rewardMax}" ${enabled}></td><td><input type="number" name="game_xp_${g.id}" value="${Number(r.xpReward||0)}" min="0" max="100000" ${enabled}></td><td><select multiple size="3" name="game_channels_${g.id}" ${enabled}>${textChannelMultiOptions(channels,r.allowedChannelIds||[])}</select><small>فارغ = كل الرومات</small></td><td><select multiple size="3" name="game_roles_${g.id}" ${enabled}>${roleOptions(roles,guild.id,r.startRoleIds||[])}</select><small>فارغ = الرتب العامة</small></td></tr>`;}).join('');
  const heistGuildRows=HEIST_GAME_DEFS.map(g=>{const allowed=heistGameAllowed(site,cfg,g.id);return `<label class="${allowed?'':'locked'}"><input type="checkbox" name="heist_game_${g.id}" ${cfg.bank?.heistGamesEnabled?.[g.id]!==false&&allowed?'checked':''} ${allowed?'':'disabled'}> ${g.emoji} ${esc(g.label)}${allowed?'':' 🔒 حسب الخطة'}</label>`;}).join('');
  const suggestionRows=Array.from({length:6},(_,idx)=>{const r=cfg.suggestions?.channels?.[idx]||{};return `<div class="suggestion-channel-row"><label>${idx===0?'شات الأفكار الرئيسي':`شات أفكار ${idx+1}`}<select name="suggestionChannelId_${idx}"><option value="">— غير مستخدم —</option>${textChannels(channels,r.channelId||'')}</select></label><label>نوع الاقتراح<input name="suggestionLabel_${idx}" value="${esc(r.label||r.type||'')}" placeholder="مثال: اقتراحات الألعاب"></label><label>Emoji<input name="suggestionEmoji_${idx}" value="${esc(r.emoji||'💡')}" maxlength="16"></label><label>لون<input type="color" name="suggestionColor_${idx}" value="${/^#[0-9a-f]{6}$/i.test(String(r.color||''))?esc(r.color):'#E11D48'}"></label><label class="toggle-line"><input type="checkbox" name="suggestionEnabled_${idx}" ${r.enabled!==false?'checked':''}> مفعّل</label></div>`;}).join('');
  const rulesRows=(cfg.rules?.types||[]).map((r,idx)=>`<form class="config-card" method="post" action="/dashboard/${guild.id}/rules/update"><input type="hidden" name="_csrf" value="${token}"><input type="hidden" name="_returnSection" value="rules"><input type="hidden" name="ruleId" value="${esc(r.id)}"><div class="form-grid"><label>اسم النوع<input name="label" value="${esc(r.label||'')}" required></label><label>Emoji<input name="emoji" value="${esc(r.emoji||'📜')}"></label><label>الترتيب<input type="number" name="sortOrder" value="${Number(r.sortOrder||((idx+1)*10))}" min="0" max="9999"></label><label><input type="checkbox" name="enabled" ${r.enabled!==false?'checked':''}> مفعّل</label><label class="wide">وصف قصير يظهر بالقائمة<input name="description" maxlength="100" value="${esc(r.description||'')}"></label><label class="wide">نص القوانين<textarea name="content" rows="14" maxlength="12000" required>${esc(r.content||'')}</textarea></label></div><div class="card-actions"><button class="btn primary">💾 حفظ النوع</button><button class="btn danger" formaction="/dashboard/${guild.id}/rules/delete" onclick="return confirm('حذف نوع القوانين؟')">حذف</button></div></form>`).join('')||'<p>لا توجد أنواع قوانين حتى الآن.</p>';
  const topUsers=Object.entries(economyData||{}).sort((a,b)=>Number(b[1]?.balance||0)-Number(a[1]?.balance||0)).slice(0,15).map(([id,u])=>`<tr><td><code>${id}</code></td><td>${Number(u?.balance||0).toLocaleString()}</td><td>${Number(u?.bankBalance||0).toLocaleString()}</td><td>${Number(u?.level||0)}</td></tr>`).join('')||'<tr><td colspan="4">لا توجد بيانات أعضاء حتى الآن.</td></tr>';
  const gangs=Object.values(gangData?.gangs||{});const gangRows=gangs.length?gangs.map(g=>`<tr><td>${esc(g.name)}</td><td><code>${esc(g.leaderId||g.bossId||'')}</code></td><td>${Number((g.members||g.memberIds||[]).length)}</td><td>${Number((g.deputies||g.deputyIds||[]).length)}</td><td>${Number(g.bank??g.vault??0).toLocaleString()}</td><td>${Number(g.missionsCompleted??g.stats?.missionsWon??0)}</td><td><form class="mini" method="post" action="/dashboard/${guild.id}/gangs/bank"><input type="hidden" name="_csrf" value="${token}"><input type="hidden" name="gangId" value="${esc(g.id)}"><input type="number" name="amount" value="${Number(g.bank??g.vault??0)}" min="0"><button>الخزنة</button></form><form class="mini" method="post" action="/dashboard/${guild.id}/gangs/reset-mission"><input type="hidden" name="_csrf" value="${token}"><input type="hidden" name="gangId" value="${esc(g.id)}"><button>تصفير المهمة</button></form><form class="mini" method="post" action="/dashboard/${guild.id}/gangs/delete" onsubmit="return confirm('حذف العصابة ورومها ورتبتها؟')"><input type="hidden" name="_csrf" value="${token}"><input type="hidden" name="gangId" value="${esc(g.id)}"><button class="danger">حذف</button></form></td></tr>`).join(''):'<tr><td colspan="7">لا توجد عصابات بعد.</td></tr>';
  const ticketQuestionFields=(prefix,questions=[])=>Array.from({length:5},(_,i)=>{const q=questions[i]||{};return `<div class="config-card compact-card"><h4>سؤال ${i+1}</h4><div class="form-grid"><label class="wide">السؤال<input name="${prefix}_q${i}_label" maxlength="45" value="${esc(q.label||'')}"></label><label>النوع<select name="${prefix}_q${i}_style"><option value="short" ${q.style==='short'?'selected':''}>قصير</option><option value="paragraph" ${q.style!=='short'?'selected':''}>طويل</option></select></label><label><input type="checkbox" name="${prefix}_q${i}_required" ${q.required!==false?'checked':''}> مطلوب</label><label class="wide">Placeholder<input name="${prefix}_q${i}_placeholder" maxlength="100" value="${esc(q.placeholder||'')}"></label></div></div>`;}).join('');
  const ticketRows=ticketTypes.map(t=>`<form class="config-card" method="post" action="/dashboard/${guild.id}/tickets/type/update"><input type="hidden" name="_csrf" value="${token}"><input type="hidden" name="typeId" value="${esc(t.id)}"><div class="form-grid"><label>الاسم<input name="label" value="${esc(t.label)}"></label><label>Emoji<input name="emoji" value="${esc(t.emoji||'🎫')}"></label><label>Category<select name="categoryId">${categories(channels,t.categoryId||cfg.channels.ticketCategory)}</select></label><label>أقصى تذاكر للعضو<input type="number" name="maxOpenPerUser" value="${Number(t.maxOpenPerUser||1)}" min="1" max="10"></label><label class="wide">الوصف<textarea name="description">${esc(t.description||'')}</textarea></label><label class="wide">رسالة الترحيب<textarea name="welcomeMessage">${esc(t.welcomeMessage||'')}</textarea></label><label>رتب مشاهدة التذكرة<select multiple name="viewRoleIds">${roleOptions(roles,guild.id,t.viewRoleIds||t.supportRoleIds)}</select></label><label>رتب استلام التذكرة<select multiple name="claimRoleIds">${roleOptions(roles,guild.id,t.claimRoleIds||t.viewRoleIds||t.supportRoleIds)}</select></label><label>رتب المنشن عند الفتح<select multiple name="pingRoleIds">${roleOptions(roles,guild.id,t.pingRoleIds||t.claimRoleIds)}</select></label><label>رتب زر استدعاء المسؤول<select multiple name="summonRoleIds">${roleOptions(roles,guild.id,t.summonRoleIds||t.claimRoleIds)}</select></label><label>رتب زر استدعاء الإداري<select multiple name="adminRoleIds">${roleOptions(roles,guild.id,t.adminRoleIds)}</select></label><label><input type="checkbox" name="enabled" ${t.enabled!==false?'checked':''}> مفعلة</label></div><h4>أسئلة فتح التذكرة — حتى 5 أسئلة</h4>${ticketQuestionFields('edit',t.questions||[])}<div class="card-actions"><button class="btn">حفظ النوع</button><button class="btn danger" formaction="/dashboard/${guild.id}/tickets/type/delete" name="typeId" value="${esc(t.id)}">حذف</button></div></form>`).join('')||'<p>لا يوجد أنواع تذاكر.</p>';
  const productRows=products.map(p=>`<form class="config-card product-card" method="post" action="/dashboard/${guild.id}/store/update"><input type="hidden" name="_csrf" value="${token}"><input type="hidden" name="productId" value="${esc(p.id)}"><div class="form-grid"><label>Role<select name="roleId">${roleOptions(roles,guild.id,[p.roleId])}</select></label><label>اسم الرتبة<input name="name" value="${esc(p.name)}"></label><label>السعر<input type="number" name="price" value="${Number(p.price||1)}" min="1"></label><label>القسم<input name="category" value="${esc(p.category||'رتب الأعضاء')}"></label><label>Emoji<input name="emoji" value="${esc(p.emoji||'🏷️')}"></label><label>الترتيب<input type="number" name="sortOrder" value="${Number(p.sortOrder||0)}" min="0"></label><label>الوصول<select name="accessMode"><option value="everyone" ${p.accessMode==='everyone'?'selected':''}>للجميع</option><option value="admins" ${p.accessMode==='admins'?'selected':''}>الإدارة فقط</option><option value="roles" ${p.accessMode==='roles'?'selected':''}>رتب محددة</option></select></label><label>الرتب المسموحة<select multiple name="allowedRoleIds">${roleOptions(roles,guild.id,p.allowedRoleIds)}</select></label><label class="wide">الوصف<textarea name="description">${esc(p.description||'')}</textarea></label><label class="wide">المميزات — سطر لكل ميزة<textarea name="features">${esc((p.features||[]).join('\n'))}</textarea></label><label class="wide">رابط الصورة<input name="imageUrl" value="${esc(p.imageUrl||'')}"></label><label class="wide">رابط Banner<input name="bannerUrl" value="${esc(p.bannerUrl||'')}"></label><label><input type="checkbox" name="enabled" ${p.enabled!==false?'checked':''}> مفعلة</label></div><div class="card-actions"><button class="btn primary">حفظ الرتبة</button><button class="btn danger" formaction="/dashboard/${guild.id}/store/delete" name="productId" value="${esc(p.id)}">حذف</button></div></form>`).join('')||'<p>لا توجد منتجات.</p>';
  const roleRows=items.map(p=>`<form class="config-card compact-card" method="post" action="/dashboard/${guild.id}/roles/update"><input type="hidden" name="_csrf" value="${token}"><input type="hidden" name="roleId" value="${p.roleId}"><div class="form-grid"><label>الرتبة<select name="newRoleId">${roleOptions(roles,guild.id,[p.roleId])}</select></label><label>اسم الزر<input name="label" value="${esc(p.label||'')}"></label><label>Emoji<input name="emoji" value="${esc(p.emoji||'🔔')}"></label><label>اللون<select name="style"><option ${p.style==='Primary'?'selected':''}>Primary</option><option ${p.style==='Secondary'?'selected':''}>Secondary</option><option ${p.style==='Success'?'selected':''}>Success</option><option ${p.style==='Danger'?'selected':''}>Danger</option></select></label></div><div class="card-actions"><button class="btn">حفظ</button><button class="btn danger" formaction="/dashboard/${guild.id}/roles/delete">حذف</button></div></form>`).join('')||'<p>لا توجد رتب.</p>';
  const reactionRoleItems=Array.isArray(cfg.reactionRoles?.items)?cfg.reactionRoles.items:[];
  const reactionRoleRows=reactionRoleItems.map(item=>{const emoji=emojis.find(e=>String(e.id)===String(item.emojiId));const role=roles.find(r=>String(r.id)===String(item.roleId));const channel=channels.find(c=>String(c.id)===String(item.channelId));return `<form class="config-card compact-card" method="post" action="/dashboard/${guild.id}/reaction-roles/update"><input type="hidden" name="_csrf" value="${token}"><input type="hidden" name="itemId" value="${esc(item.id)}"><div class="form-grid"><label>روم الرسالة<select name="channelId" required>${textChannels(channels,item.channelId)}</select></label><label class="wide">نص الرسالة<textarea name="messageContent" maxlength="2000" required placeholder="اكتب الرسالة التي تريد أن يرسلها البوت هنا...">${esc(item.messageContent||'')}</textarea></label><label>الرتبة<select name="roleId" required><option value="">اختر رتبة</option>${roleOptions(roles,guild.id,[item.roleId])}</select></label><label>إيموجي السيرفر<select name="emojiId" required><option value="">اختر إيموجي</option>${emojiOptions(emojis,item.emojiId)}</select></label><label><input type="checkbox" name="enabled" ${item.enabled!==false?'checked':''}> مفعّل</label></div><p class="muted">${emoji?`${emoji.animated?'🎞️':'😀'} :${esc(emoji.name)}:`:'Emoji'} → ${esc(role?.name||item.roleId)} • #${esc(channel?.name||item.channelId)}${item.messageId?` • Message ${esc(item.messageId)}`:''}</p><div class="card-actions"><button class="btn primary">💾 حفظ وتحديث الرسالة</button><button class="btn danger" formaction="/dashboard/${guild.id}/reaction-roles/delete" onclick="return confirm('حذف ربط الرياكشن؟')">حذف</button></div></form>`;}).join('')||'<p class="muted">لا يوجد ربط رياكشن حتى الآن.</p>';
  const richKillers=(Array.isArray(killerCases)?killerCases:[]).map((c,index)=>({id:c.id||`case_${index+1}`,enabled:c.enabled!==false,title:c.title||`قضية ${index+1}`,story:c.story||'',suspects:Array.isArray(c.suspects)?c.suspects:[],clues:Array.isArray(c.clues)?c.clues:[],hints:Array.isArray(c.hints)?c.hints:[],killer:c.killer||c.suspects?.[Number(c.answer)||0]||'',answer:typeof c.answer==='string'?c.answer:(c.explanation||'')}));
  const killerRows=richKillers.map(c=>`<form class="config-card killer-card" method="post" action="/dashboard/${guild.id}/killer/update"><input type="hidden" name="_csrf" value="${token}"><input type="hidden" name="caseId" value="${esc(c.id)}"><div class="form-grid"><label>عنوان القضية<input name="title" value="${esc(c.title)}"></label><label>القاتل<input name="killer" value="${esc(c.killer)}"></label><label class="wide">القصة<textarea name="story">${esc(c.story)}</textarea></label><label class="wide">المشتبه بهم — سطر لكل اسم<textarea name="suspects">${esc(c.suspects.join('\n'))}</textarea></label><label class="wide">الأدلة — سطر لكل دليل<textarea name="clues">${esc(c.clues.join('\n'))}</textarea></label><label class="wide">3 تلميحات — سطر لكل تلميح<textarea name="hints">${esc(c.hints.join('\n'))}</textarea></label><label class="wide">شرح الحل<textarea name="answer">${esc(c.answer)}</textarea></label><label><input type="checkbox" name="enabled" ${c.enabled?'checked':''}> مفعلة</label></div><div class="card-actions"><button class="btn">حفظ القضية</button><button class="btn danger" formaction="/dashboard/${guild.id}/killer/delete">حذف</button></div></form>`).join('')||'<p>لا توجد قضايا.</p>';
  const bankJobsText=Object.entries(bankCatalog?.jobs||{}).map(([id,v])=>`${id} | ${v.name||''} | ${Number(v.salary||0)}`).join('\n');
  const bankCompaniesText=Object.entries(bankCatalog?.companies||{}).map(([id,v])=>`${id} | ${v.name||''} | ${v.description||''} | ${Number(v.priceGold||0)}`).join('\n');
  const bankStocksText=Object.entries(bankCatalog?.stocks||{}).map(([symbol,v])=>`${symbol} | ${v.name||''} | ${Number(v.price||0)}`).join('\n');
  const missionRows=(Array.isArray(missionTemplates)?missionTemplates:[]).map(m=>`<form class="config-card mission-card" method="post" action="/dashboard/${guild.id}/gang-missions/update"><input type="hidden" name="_csrf" value="${token}"><input type="hidden" name="missionId" value="${esc(m.id)}"><div class="form-grid"><label>اسم المهمة<input name="name" value="${esc(m.name||'')}"></label><label>الصعوبة<select name="difficulty"><option value="hard" ${m.difficulty==='hard'?'selected':''}>صعبة</option><option value="elite" ${m.difficulty==='elite'?'selected':''}>نخبة</option><option value="legendary" ${m.difficulty==='legendary'?'selected':''}>أسطورية</option></select></label><label>أقل مشاركين<input type="number" name="minParticipants" value="${Number(m.minParticipants||2)}" min="2" max="25"></label><label><input type="checkbox" name="enabled" ${m.enabled!==false?'checked':''}> مفعلة</label><label class="wide">الوصف<textarea name="description">${esc(m.description||'')}</textarea></label><label class="wide">المراحل — سطر لكل مرحلة<textarea name="steps">${esc((m.steps||[]).join('\n'))}</textarea></label></div><div class="card-actions"><button class="btn">حفظ المهمة</button><button class="btn danger" formaction="/dashboard/${guild.id}/gang-missions/delete">حذف</button></div></form>`).join('')||'<p>لا توجد قوالب مهمات.</p>';

  const guideRows=guideItems.map(item=>`<form class="config-card compact-card guide-item-card" method="post" action="/dashboard/${guild.id}/guide/update"><input type="hidden" name="_csrf" value="${token}"><input type="hidden" name="_returnSection" value="guide"><input type="hidden" name="itemId" value="${esc(item.id)}"><div class="form-grid"><label>اسم الزر<input name="label" value="${esc(item.label||'')}"></label><label>Emoji<input name="emoji" value="${esc(item.emoji||'➡️')}"></label><label>الروم<select name="channelId">${textChannels(channels,item.channelId)}</select></label><label>الترتيب<input type="number" name="sortOrder" value="${Number(item.sortOrder||0)}" min="0" max="9999"></label><label><input type="checkbox" name="enabled" ${item.enabled!==false?'checked':''}> مفعّل</label></div><div class="card-actions"><button class="btn primary">💾 حفظ الزر</button><button class="btn danger" formaction="/dashboard/${guild.id}/guide/delete">حذف</button></div></form>`).join('')||'<p>لا توجد اختصارات بعد. أضف أول زر من النموذج أعلاه.</p>';
  const directorRows=directorTemplates.map(item=>`<form class="config-card compact-card director-template-card" method="post" action="/dashboard/${guild.id}/city-director/template/update"><input type="hidden" name="_csrf" value="${token}"><input type="hidden" name="_returnSection" value="director"><input type="hidden" name="templateId" value="${esc(item.id)}"><div class="form-grid"><label>اسم الحدث<input name="name" value="${esc(item.name||'')}"></label><label>Emoji<input name="emoji" value="${esc(item.emoji||'🌆')}"></label><label>الصعوبة<select name="difficulty"><option value="normal" ${item.difficulty==='normal'?'selected':''}>عادي</option><option value="hard" ${item.difficulty==='hard'?'selected':''}>صعب</option><option value="elite" ${item.difficulty==='elite'?'selected':''}>نخبة</option><option value="legendary" ${item.difficulty==='legendary'?'selected':''}>أسطوري</option></select></label><label>مضاعف الهدف<input type="number" step="0.05" min="0.25" max="5" name="goalMultiplier" value="${Number(item.goalMultiplier||1)}"></label><label><input type="checkbox" name="enabled" ${item.enabled!==false?'checked':''}> مفعّل</label><label class="wide">وصف الحدث<textarea name="description">${esc(item.description||'')}</textarea></label></div><div class="card-actions"><button class="btn primary">💾 حفظ الحدث</button><button class="btn danger" formaction="/dashboard/${guild.id}/city-director/template/delete">حذف</button></div></form>`).join('')||'<p>لا توجد قوالب أحداث.</p>';
  const activeDirector=directorState?.active||cfg.cityDirector?.runtimeState||null;
  const activeDirectorParticipants=Number(activeDirector?.participantCount??Object.keys(activeDirector?.participants||{}).length);
  const activeDirectorText=activeDirector?`<div class="warn director-live"><b>🟢 حدث يعمل الآن:</b> ${esc(activeDirector.name||'حدث المدينة')} • التقدم ${Number(activeDirector.progress||0).toLocaleString()}/${Number(activeDirector.goal||0).toLocaleString()} • المشاركون ${activeDirectorParticipants}</div>`:'<div class="tabs-note">⚪ لا يوجد حدث City Director يعمل الآن.</div>';
  const builtinDirectorEvents=cfg.cityDirector?.useBuiltinEvents===false?[]:builtInEvents();
  const directorTemplateOptions=[...builtinDirectorEvents,...directorTemplates.filter(x=>x.enabled!==false)].map(x=>`<option value="${esc(x.id)}">${esc((x.emoji||'🌆')+' '+(x.name||x.id)+(x.builtin?' • مدمج':''))}</option>`).join('');

  const evt=eventConfig(cfg),evtState=eventState(eventData);
  const promoState=promotionData&&typeof promotionData==='object'?promotionData:{users:{},history:[]};
  const promoUsers=promoState.users&&typeof promoState.users==='object'?promoState.users:{};
  const eventChannelsMax=eventChannelLimit(cfg),eventPlan=PLAN_LABELS[planNameForConfig(cfg)]||'Free';
  const eventTop=Object.entries(evtState.users||{}).sort((a,b)=>Number(b[1]?.points||0)-Number(a[1]?.points||0)||Number(b[1]?.updatedAt||0)-Number(a[1]?.updatedAt||0)).slice(0,25);
  const eventTopRows=eventTop.length?eventTop.map(([uid,u],i)=>`<tr><td>${i+1}</td><td><code>${esc(uid)}</code></td><td><b>${Number(u?.points||0).toLocaleString()}</b></td><td>${Number(u?.added||0).toLocaleString()}</td><td>${Number(u?.removed||0).toLocaleString()}</td><td>${Number(u?.zomAwarded||0).toLocaleString()}</td></tr>`).join(''):'<tr><td colspan="6">لا توجد نقاط مسجلة حتى الآن.</td></tr>';
  const eventHistoryRows=(evtState.history||[]).slice(0,25).map(h=>`<tr><td>${h.at?esc(new Date(Number(h.at)).toLocaleString('ar-JO')):'-'}</td><td>${esc(h.type||'-')}</td><td><code>${esc(h.actorId||'-')}</code></td><td><code>${esc(h.targetId||'-')}</code></td><td>${Number(h.delta||0)>0?'+':''}${Number(h.delta||0)}</td><td>${Number(h.zom||0).toLocaleString()}</td><td>${esc(h.command||h.note||'')}</td></tr>`).join('')||'<tr><td colspan="7">لا يوجد سجل أيفنت بعد.</td></tr>';
  const promotionTopRows=Object.entries(promoUsers).sort((a,b)=>Number(b[1]?.points||0)-Number(a[1]?.points||0)||Number(b[1]?.updatedAt||0)-Number(a[1]?.updatedAt||0)).slice(0,25).map(([uid,u],i)=>`<tr><td>${i+1}</td><td><code>${esc(uid)}</code></td><td>${Number(u?.points||0).toLocaleString()}</td><td>${Number(u?.added||0).toLocaleString()}</td><td>${Number(u?.removed||0).toLocaleString()}</td><td>${u?.notified?'✅':'—'}</td></tr>`).join('')||'<tr><td colspan="6">لا توجد نقاط ترقية حتى الآن.</td></tr>';
  const promotionHistoryRows=(Array.isArray(promoState.history)?promoState.history:[]).slice(0,30).map(h=>`<tr><td>${new Date(Number(h.at||Date.now())).toLocaleString('ar-JO')}</td><td>${esc(h.type||'')}</td><td><code>${esc(h.actorId||'')}</code></td><td><code>${esc(h.targetId||'')}</code></td><td>${Number(h.delta||0)}</td><td>${esc(h.command||'')}</td></tr>`).join('')||'<tr><td colspan="6">لا يوجد سجل ترقية حتى الآن.</td></tr>';
  const eventActionRows=evt.quickCommands.map(a=>`<form class="config-card event-action-card" method="post" action="/dashboard/${guild.id}/event/actions/update"><input type="hidden" name="_csrf" value="${token}"><input type="hidden" name="_returnSection" value="event"><input type="hidden" name="actionId" value="${esc(a.id)}"><div class="form-grid"><label>الأمر<input name="command" value="${esc(a.command)}" placeholder="-انشاء" required></label><label>اسم الإجراء<input name="label" value="${esc(a.label)}" placeholder="إنشاء"></label><label>نقاط الأيفنت<input type="number" name="points" value="${Number(a.points||0)}" min="-1000000" max="1000000"></label><label>ZOM يضاف<input type="number" name="zom" value="${Number(a.zom||0)}" min="0" max="1000000000"></label><label>المستهدف<select name="targetMode"><option value="mention" ${a.targetMode==='mention'?'selected':''}>لازم منشن عضو</option><option value="self" ${a.targetMode==='self'?'selected':''}>صاحب الأمر نفسه</option><option value="either" ${a.targetMode==='either'?'selected':''}>المنشن أو صاحب الأمر</option></select></label><label><input type="checkbox" name="enabled" ${a.enabled!==false?'checked':''}> مفعّل</label><label class="wide">رد إضافي اختياري<textarea name="response" placeholder="مثال: ✅ تم تسجيل {user} • نقاطه الآن {points}">${esc(a.response||'')}</textarea><small>المتغيرات: {user} {points} {amount} {zom} {command}</small></label></div><div class="card-actions"><button class="btn primary">💾 حفظ الأمر</button><button class="btn danger" formaction="/dashboard/${guild.id}/event/actions/delete" name="actionId" value="${esc(a.id)}" onclick="return confirm('حذف أمر الأيفنت؟')">حذف</button></div></form>`).join('')||'<p>لا توجد أوامر إضافية.</p>';

  const panelCards=[['bank','🏦','لوحة البنك'],['games','🎮','لوحة الألعاب'],['tickets','🎫','لوحة التذاكر'],['store','🛒','لوحة المتجر'],['roles','🔔','لوحة الرتب'],['name','✏️','لوحة تغيير الاسم'],['guide','🧭','دليل السيرفر'],['rules','📜','لوحة القوانين'],['voice','🎙️','لوحة الرومات المؤقتة']].map(([key,emoji,label])=>`<article class="config-card compact-card"><h3>${emoji} ${label}</h3><p>${key==='guide'?'🧭 العنوان والوصف واللون والبنر والأزرار تُدار من قسم دليل السيرفر.':canPanelDesign?'💎 تستطيع تخصيص العنوان والوصف واللون والـLogo والـBanner والـFooter والأزرار/القوائم لهذه اللوحة فقط.':'🔒 تخصيص تصميم هذه اللوحة متاح لـ Premium وPremium+.'}</p><div class="card-actions"><form method="post" action="/dashboard/${guild.id}/send/${key}"><input type="hidden" name="_csrf" value="${token}"><button class="btn">📨 إرسال / تحديث</button></form>${key==='guide'?`<a class="btn primary" href="/dashboard/${guild.id}?section=guide">🧭 إعداد الدليل</a>`:key==='rules'?`<a class="btn primary" href="/dashboard/${guild.id}?section=rules">📜 إعداد القوانين</a>`:canPanelDesign?`<a class="btn primary" href="/dashboard/${guild.id}/panels/${key}">💎 تخصيص اللوحة</a>`:`<a class="btn" href="/premium">🔒 Premium</a>`}</div></article>`).join('');

  const discordCacheNotice=req.bundle?._degraded?`<div class="warn">⚠️ Discord عامل Rate Limit مؤقتًا. فتحت الداشبورد بوضع احتياطي حتى لا تتوقف الصفحة؛ قوائم الرومات والرتب قد تظهر فارغة مؤقتًا ثم ترجع تلقائيًا بعد انتهاء الحد.</div>`:req.bundle?._stale?`<div class="tabs-note">🧊 يتم عرض آخر نسخة محفوظة من رومات ورتب Discord مؤقتًا بسبب Rate Limit.</div>`:'';
  const applications=normalizeApplicationsConfig(applicationsData);
  const staff=normalizeStaffManagement(staffData);
  const applicationQuestionFields=(prefix,questions=[])=>Array.from({length:5},(_,i)=>{const q=questions[i]||{};return `<div class="config-card compact-card"><h4>السؤال ${i+1}</h4><div class="form-grid"><label class="wide">نص السؤال<input name="${prefix}_q${i}_label" maxlength="45" value="${esc(q.label||'')}"></label><label>نوع الجواب<select name="${prefix}_q${i}_style"><option value="paragraph" ${q.style!=='short'?'selected':''}>جواب طويل</option><option value="short" ${q.style==='short'?'selected':''}>جواب قصير</option></select></label><label>إلزامي<select name="${prefix}_q${i}_required"><option value="1" ${q.required!==false?'selected':''}>نعم</option><option value="0" ${q.required===false?'selected':''}>لا</option></select></label><label class="wide">Placeholder<input name="${prefix}_q${i}_placeholder" maxlength="100" value="${esc(q.placeholder||'')}"></label></div></div>`;}).join('');
  const applicationRows=applications.types.map((a,idx)=>`<form class="config-card application-card" method="post" action="/dashboard/${guild.id}/applications/update"><input type="hidden" name="_csrf" value="${token}"><input type="hidden" name="_returnSection" value="applications"><input type="hidden" name="typeId" value="${esc(a.id)}"><h3>${esc(a.emoji)} ${esc(a.title)}</h3><div class="form-grid"><label>اسم التقديم<input name="title" maxlength="80" value="${esc(a.title)}" required></label><label>Emoji<input name="emoji" maxlength="16" value="${esc(a.emoji)}"></label><label>اسم زر التقديم<input name="buttonLabel" maxlength="80" value="${esc(a.buttonLabel)}"></label><label>Cooldown بالساعات<input type="number" name="cooldownHours" min="0" max="8760" value="${Number(a.cooldownHours||0)}"></label><label>شات لوحة التقديم<select name="panelChannelId" required><option value="">اختر شات</option>${textChannels(channels,a.panelChannelId)}</select></label><label>شات استقبال الطلبات<select name="reviewChannelId" required><option value="">اختر شات</option>${textChannels(channels,a.reviewChannelId)}</select></label><label class="wide">رتب مراجعة الطلبات<select multiple size="5" name="reviewerRoleIds">${roleOptions(roles,guild.id,a.reviewerRoleIds)}</select></label><label>رتبة عند القبول<select name="acceptedRoleId"><option value="">— بدون رتبة —</option>${roleOptions(roles,guild.id,a.acceptedRoleId?[a.acceptedRoleId]:[])}</select></label><label><input type="checkbox" name="enabled" ${a.enabled?'checked':''}> التقديم مفتوح</label><label class="wide">وصف اللوحة<textarea name="description">${esc(a.description)}</textarea></label><label class="wide">🖼️ رابط Banner اللوحة<input type="url" name="bannerUrl" value="${esc(a.bannerUrl||'')}" placeholder="https://.../banner.png"></label><label class="wide">🔹 رابط الصورة المصغرة / Logo<input type="url" name="thumbnailUrl" value="${esc(a.thumbnailUrl||'')}" placeholder="https://.../logo.png"></label><label class="wide">رسالة القبول الخاصة<textarea name="acceptMessage">${esc(a.acceptMessage)}</textarea></label><label class="wide">رسالة الرفض الخاصة<textarea name="rejectMessage">${esc(a.rejectMessage)}</textarea></label></div><h4>أسئلة النموذج — Discord يسمح بحد أقصى 5 أسئلة في النافذة الواحدة</h4>${applicationQuestionFields('edit',a.questions)}<div class="card-actions"><button class="btn primary">💾 حفظ</button><button class="btn" formaction="/dashboard/${guild.id}/applications/send">📨 إرسال / تحديث اللوحة</button><button class="btn danger" formaction="/dashboard/${guild.id}/applications/delete" onclick="return confirm('حذف هذا التقديم؟')">حذف</button></div></form>`).join('')||'<p>لا يوجد تقديمات بعد. أنشئ أول تقديم من النموذج أعلاه.</p>';
  return decorateDashboard(`<section class="dash-head"><div><a href="/dashboard">← السيرفرات</a><h1>${esc(guild.name)}</h1><p><code>${guild.id}</code> • ${planBadge(cfg)} ${owner?'• 👑 Owner':''}</p></div>${iconUrl(guild)?`<img class="guild-icon" src="${iconUrl(guild)}">`:''}</section>
  ${discordCacheNotice}<div class="tabs-note">✅ كل إعداد هنا يخص هذا السيرفر فقط. الـOwner يحدد من لوحة Owner ما هو مجاني وما هو Premium.</div>${site.announcement?`<div class="warn">📢 ${esc(site.announcement)}</div>`:''}
  ${owner&&guild.id===homeId?`<section class="panel legacy-panel"><h2>🧰 إعدادات سيرفر ZOMBI الأصلي</h2><p>هذه الصفحة مرتبطة بنسخة السيرفر القديم. إذا أردت إعادة كل إعدادات النسخة الاحتياطية كما كانت اضغط الزر التالي.</p><form method="post" action="/dashboard/${guild.id}/restore-legacy" onsubmit="return confirm('إرجاع إعدادات النسخة الاحتياطية لسيرفرك فقط؟')"><input type="hidden" name="_csrf" value="${token}"><button class="btn danger">♻️ استرجاع إعدادات سيرفري القديمة</button></form></section>`:''}

  <form class="panel z-welcome-standalone" data-z-page="welcome" method="post" action="/dashboard/${guild.id}/welcome/save"><input type="hidden" name="_csrf" value="${token}"><input type="hidden" name="_returnSection" value="welcome">
    <h2>👋 نظام الترحيب</h2>
<div class="form-grid"><label><input type="checkbox" name="welcomeEnabled" ${cfg.welcome?.enabled?'checked':''}> تفعيل الترحيب عند دخول عضو جديد</label><label>روم الترحيب<select name="welcomeChannel">${textChannels(channels,cfg.welcome?.channelId||'')}</select></label><label>روم القوانين<select name="welcomeRulesChannel">${textChannels(channels,cfg.welcome?.rulesChannelId||'')}</select></label><label class="wide">رابط صورة الترحيب العلوية<input type="url" name="welcomeBannerUrl" value="${esc(cfg.welcome?.bannerUrl||'')}" placeholder="https://.../welcome-banner.png"></label><label>عنوان الترحيب<input name="welcomeTitle" value="${esc(cfg.welcome?.title||'')}" placeholder="مثال: حياك الله في ZOMBI"></label><label class="wide">وصف قصير تحت الصورة<textarea name="welcomeDescription" maxlength="400" placeholder="مثال: نتمنى لك وقت ممتع معنا">${esc(cfg.welcome?.description||'')}</textarea></label><label>القسم 1 — الاسم<input name="welcomeLabel_0" value="${esc(cfg.welcome?.channels?.[0]?.label||'قوانين السيرفر')}"></label><label>القسم 1 — الإيموجي<input name="welcomeEmoji_0" value="${esc(cfg.welcome?.channels?.[0]?.emoji||'📜')}"></label><label class="wide">القسم 1 — الروم<select name="welcomeRefChannel_0">${textChannels(channels,cfg.welcome?.channels?.[0]?.channelId||cfg.welcome?.rulesChannelId||'')}</select></label><label>القسم 2 — الاسم<input name="welcomeLabel_1" value="${esc(cfg.welcome?.channels?.[1]?.label||'الشات العام')}"></label><label>القسم 2 — الإيموجي<input name="welcomeEmoji_1" value="${esc(cfg.welcome?.channels?.[1]?.emoji||'💬')}"></label><label class="wide">القسم 2 — الروم<select name="welcomeRefChannel_1">${textChannels(channels,cfg.welcome?.channels?.[1]?.channelId||'')}</select></label><label>القسم 3 — الاسم<input name="welcomeLabel_2" value="${esc(cfg.welcome?.channels?.[2]?.label||'السوشال ميديا')}"></label><label>القسم 3 — الإيموجي<input name="welcomeEmoji_2" value="${esc(cfg.welcome?.channels?.[2]?.emoji||'🌐')}"></label><label class="wide">القسم 3 — الروم<select name="welcomeRefChannel_2">${textChannels(channels,cfg.welcome?.channels?.[2]?.channelId||'')}</select></label><div class="wide hint">الصورة ستظهر أعلى الرسالة، وتحتها ينزل منشن العضو + قائمة الأقسام التي تحددها هنا. إذا تركت رابط الصورة فارغًا سيستخدم ZOMBI الصورة الافتراضية.</div></div>
    <div class="card-actions"><button type="submit" class="btn primary">💾 حفظ إعدادات الترحيب</button></div>
  </form>

  <form class="panel" method="post" action="/dashboard/${guild.id}/settings"><input type="hidden" name="_csrf" value="${token}"><input type="hidden" name="_settingsSection" value="all">
    <h2>⚙️ الإعدادات العامة والهوية</h2>
    <div class="form-grid"><label>حالة البوت<input name="presenceText" value="${esc(cfg.system?.presenceText||'ZOM Economy | /help')}"></label><label>Presence<select name="presenceStatus"><option value="online" ${cfg.system?.presenceStatus==='online'?'selected':''}>Online</option><option value="idle" ${cfg.system?.presenceStatus==='idle'?'selected':''}>Idle</option><option value="dnd" ${cfg.system?.presenceStatus==='dnd'?'selected':''}>DND</option><option value="invisible" ${cfg.system?.presenceStatus==='invisible'?'selected':''}>Invisible</option></select></label><label>اسم العملة ${lockedNote(canCurrency)}<input name="currencyName" value="${esc(cfg.currency.name)}" ${disabled(canCurrency)}></label><label>Emoji العملة<input name="currencyEmoji" value="${esc(cfg.currency.emoji)}"></label><label>لون Embed ${lockedNote(canBrand)}<input name="brandColor" value="${esc(cfg.branding.color)}" ${disabled(canBrand)}></label><label>اسم ZOMBI في اللوحات ${lockedNote(canBrand)}<input name="customName" value="${esc(cfg.branding.customName)}" ${disabled(canBrand)}></label><label>Footer مخصص ${lockedNote(canBrand)}<input name="customFooter" value="${esc(cfg.branding.customFooter)}" ${disabled(canBrand)}></label><label>اسم البوت داخل السيرفر ${lockedNote(canBotProfile,profileLockText)}<input name="botNickname" value="${esc(cfg.branding.botNickname||'')}" ${disabled(canBotProfile)}></label><label class="wide">Logo البوت في لوحات هذا السيرفر ${lockedNote(canBotProfile,profileLockText)}<input type="url" name="avatarUrl" value="${esc(cfg.branding.avatarUrl||'')}" placeholder="https://.../avatar.png" ${disabled(canBotProfile)}></label><label class="wide">Banner لوحات البوت داخل هذا السيرفر ${lockedNote(canBotProfile,profileLockText)}<input type="url" name="bannerUrl" value="${esc(cfg.branding.bannerUrl||'')}" placeholder="https://.../banner.png" ${disabled(canBotProfile)}></label><label class="wide">Bio مخصص للوحات هذا السيرفر ${lockedNote(canBotProfile,profileLockText)}<textarea name="botBio" maxlength="190" ${disabled(canBotProfile)}>${esc(cfg.branding.bio||'')}</textarea></label><label class="wide">Logo اللوحات Premium ${lockedNote(canBotProfile,profileLockText)}<input name="panelLogoUrl" value="${esc(cfg.branding.panelLogoUrl||'')}" ${disabled(canBotProfile)}></label><label class="wide">Banner اللوحات Premium ${lockedNote(canBotProfile,profileLockText)}<input name="panelBannerUrl" value="${esc(cfg.branding.panelBannerUrl||'')}" ${disabled(canBotProfile)}></label><label class="wide">رابط خط الزخرفة / Divider<input type="url" name="lineUrl" value="${esc(cfg.branding.lineUrl||'')}" placeholder="https://.../line.gif"></label><label class="wide">الرتب المسموح لها باستخدام أمر خط<select multiple size="6" name="lineRoleIds">${roleOptions(roles,guild.id,cfg.branding.lineRoleIds||[])}</select><small>اختر رتبة أو أكثر. مالك السيرفر وAdministrator مسموح لهم دائمًا. إذا تركتها فارغة يبقى الأمر للإدارة فقط.</small></label></div>
    <div class="warn small">✅ Premium يستطيع تغيير Nickname وصورة البوت وBanner وBio بشكل مختلف داخل كل سيرفر. استخدم رابط HTTPS مباشر للصورة؛ مسح الرابط يعيد البوت للصورة/البنر العام في هذا السيرفر.</div>
    <h3>📍 تحديد كل الرومات من Dashboard</h3><div class="form-grid"><label>Game Panel<select name="gamePanel">${textChannels(channels,cfg.channels.gamePanel)}</select></label><label>Ticket Panel<select name="ticketPanel">${textChannels(channels,cfg.channels.ticketPanel)}</select></label><label>Ticket Category<select name="ticketCategory">${categories(channels,cfg.channels.ticketCategory)}</select></label><label>Store Panel<select name="storePanel">${textChannels(channels,cfg.channels.storePanel)}</select></label><label>Self Roles Panel<select name="rolePanel">${textChannels(channels,cfg.channels.rolePanel)}</select></label><label>Level / TOP<select name="levelUp">${textChannels(channels,cfg.channels.levelUp)}</select><small>كلمة توب للـXP تعمل هنا فقط.</small></label><label>شات الكوين / الرصيد / TOP<select name="zom">${textChannels(channels,cfg.channels.zom||'')}</select><small>كلمة توب ورصيد/تحويل ZOM تعمل هنا فقط.</small></label><label>Bank Panel<select name="bankPanel">${textChannels(channels,cfg.channels.bankPanel)}</select></label><label>البنك المركزي / السرقة<select name="centralBank">${textChannels(channels,cfg.channels.centralBank)}</select></label><label>Category العصابات<select name="gangCategory">${categories(channels,cfg.channels.gangCategory)}</select></label><label>Logs العصابات<select name="gangLogs">${textChannels(channels,cfg.channels.gangLogs)}</select></label><label>روم إنشاء Voice<select name="voiceCreate">${voiceChannels(channels,cfg.channels.voiceCreate)}</select></label><label>شات تحكم Voice<select name="voiceControl">${textChannels(channels,cfg.channels.voiceControl)}</select></label><label>Category Voice<select name="voiceCategory">${categories(channels,cfg.channels.voiceCategory)}</select></label><label>لوحة تغيير الاسم<select name="nameChangePanel">${textChannels(channels,cfg.channels.nameChangePanel)}</select></label><label>لوحة دليل السيرفر<select name="serverGuidePanel">${textChannels(channels,cfg.channels.serverGuidePanel)}</select></label><label>روم City Director<select name="cityDirector">${textChannels(channels,cfg.channels.cityDirector)}</select></label><label class="wide">رومات مكافأة الرسائل<select multiple name="messageChannelIds">${multiChannelOptions(channels,cfg.economy.messageChannelIds,[0,5])}</select></label><label class="wide">رومات مكافأة الفويس<select multiple name="voiceChannelIds">${multiChannelOptions(channels,cfg.economy.voiceChannelIds,[2,13])}</select></label></div>
    <h3>🧩 تشغيل وإيقاف الأنظمة</h3><div class="checks">${featureChecks}</div>
    <h3>🧭 دليل السيرفر التفاعلي</h3>${panelMediaFields(cfg,'guide','لوحة دليل السيرفر')}<div class="form-grid"><label><input type="checkbox" name="serverGuideEnabled" ${cfg.serverGuide?.enabled!==false?'checked':''}> تفعيل دليل السيرفر</label><label>لون اللوحة<input name="serverGuideColor" value="${esc(cfg.serverGuide?.color||'#7c3aed')}" placeholder="#7c3aed"></label><label class="wide">العنوان<input name="serverGuideTitle" value="${esc(cfg.serverGuide?.title||'🧭 دليل السيرفر')}"></label><label class="wide">الوصف<textarea name="serverGuideDescription">${esc(cfg.serverGuide?.description||'')}</textarea></label><label>Footer<input name="serverGuideFooter" value="${esc(cfg.serverGuide?.footer||'ZOMBI • SERVER GUIDE')}"></label><label class="wide">Banner URL<input type="url" name="serverGuideBannerUrl" value="${esc(cfg.serverGuide?.bannerUrl||'')}" placeholder="https://..."></label></div>
    <h3>🌆 ZOMBI City Director — 100 حدث حي</h3>
    <div class="warn small">🔥 يحتوي النظام على <b>100 حدث مدمج</b> + قوالبك الخاصة. المهمات تنتقل بين الشاتات المفتوحة، والحل يكتب مباشرة داخل الشات بدون أوامر. النجاح يحتاج لاعبين اثنين على الأقل افتراضيًا.</div>
    <div class="form-grid">
      <label><input type="checkbox" name="cityDirectorEnabled" ${cfg.cityDirector?.enabled?'checked':''}> تشغيل النظام</label>
      <label><input type="checkbox" name="cityDirectorAutoEnabled" ${cfg.cityDirector?.autoEnabled?'checked':''}> أحداث تلقائية</label>
      <label><input type="checkbox" name="cityDirectorUseBuiltinEvents" ${cfg.cityDirector?.useBuiltinEvents!==false?'checked':''}> استخدام الـ100 حدث المدمجة</label>
      <label><input type="checkbox" name="cityDirectorSpreadAllOpenChannels" ${cfg.cityDirector?.spreadAllOpenChannels!==false?'checked':''}> وزّع المراحل على كل الشاتات المفتوحة</label>
      <label>بين كل حدث وحدث (دقيقة)<input type="number" name="cityDirectorIntervalMinutes" value="${Number(cfg.cityDirector?.intervalMinutes||120)}" min="5" max="10080"></label>
      <label>مدة الحدث الدنيا (دقيقة)<input type="number" name="cityDirectorDurationMinutes" value="${Number(cfg.cityDirector?.durationMinutes||10)}" min="1" max="180"></label>
      <label>أقل عدد مشاركين<input type="number" name="cityDirectorMinParticipants" value="${Number(cfg.cityDirector?.minParticipants||2)}" min="2" max="500"></label>
      <label>أقصى مشاركين<input type="number" name="cityDirectorMaxParticipants" value="${Number(cfg.cityDirector?.maxParticipants||30)}" min="2" max="500"></label>
      <label>عدد المراحل إذا لم تستخدم كل الشاتات<input type="number" name="cityDirectorMissionStages" value="${Number(cfg.cityDirector?.missionStages||8)}" min="2" max="100"></label>
      <label>وقت كل مهمة (ثانية)<input type="number" name="cityDirectorTaskSeconds" value="${Number(cfg.cityDirector?.taskSeconds||45)}" min="15" max="300"></label>
      <label>نسبة النجاح المطلوبة %<input type="number" name="cityDirectorSuccessPercent" value="${Number(cfg.cityDirector?.successPercent||70)}" min="50" max="100"></label>
      <label>أقل جائزة<input type="number" name="cityDirectorRewardMin" value="${Number(cfg.cityDirector?.rewardMin||500)}" min="0"></label>
      <label>أعلى جائزة<input type="number" name="cityDirectorRewardMax" value="${Number(cfg.cityDirector?.rewardMax||1500)}" min="0"></label>
      <label><input type="checkbox" name="cityDirectorMentionEveryone" ${cfg.cityDirector?.mentionEveryone?'checked':''}> منشن @everyone عند بداية الحدث</label>
      <label><input type="checkbox" name="cityDirectorPenaltiesEnabled" ${cfg.cityDirector?.penaltiesEnabled!==false?'checked':''}> 23 عقوبة عشوائية عند فشل الحدث</label>
      <label>خصم ZOM الأساسي<input type="number" name="cityDirectorCashPenaltyAmount" value="${Number(cfg.cityDirector?.cashPenaltyAmount||1000)}" min="0"></label>
      <label>خصم البنك الأساسي<input type="number" name="cityDirectorBankPenaltyAmount" value="${Number(cfg.cityDirector?.bankPenaltyAmount||1500)}" min="0"></label>
      <label>مدة منع الكتابة (دقيقة)<input type="number" name="cityDirectorMutePenaltyMinutes" value="${Number(cfg.cityDirector?.mutePenaltyMinutes||120)}" min="5" max="10080"></label>
      <label>روم منع الكتابة عند وقوع العقوبة<select name="cityDirectorPunishmentChannelId">${textChannels(channels,cfg.cityDirector?.punishmentChannelId||'')}</select></label>
      <label class="wide">رومات مستثناة من مهمات المدينة<select multiple name="cityDirectorExcludedChannelIds">${multiChannelOptions(channels,cfg.cityDirector?.excludedChannelIds||[],[0,5])}</select><small>اتركها فارغة لاستخدام جميع الشاتات العامة المفتوحة التي يستطيع الأعضاء والبوت الكتابة فيها.</small></label>
    </div>
    <div class="tabs-note">🎲 العقوبات العشوائية تشمل: خصم ZOM، خصم البنك، منع كتابة مؤقت، نسب من الرصيد، غرامات مزدوجة، منع من الأحداث، حرمان أو تخفيض الجائزة القادمة، وتأخير/إضعاف المساهمة القادمة.</div>
    <h3>💡 ZOMBI Suggestions Center</h3>
    <div class="v2-feature-card">
      <div><strong>اقتراحات متعددة الشاتات</strong><p>حدد أكثر من شات، وكل شات له نوع اقتراح مستقل. العضو يكتب مباشرة أو يضغط زر <b>اقترح</b> فتظهر له نافذة كتابة، وبعدها ينزل الاقتراح بلوحة فيها الشعار والتصويت ✅ ❌.</p></div>
      <label class="toggle-line"><input type="checkbox" name="suggestionsEnabled" ${cfg.suggestions?.enabled!==false?'checked':''}> تفعيل نظام الاقتراحات</label>
    </div>
    <div class="suggestion-channel-grid">${suggestionRows}</div>
    <h3>💰 Economy</h3><div class="form-grid"><label>Daily Reward<input type="number" name="dailyAmount" value="${cfg.economy.dailyAmount}" min="0" max="${maxFor(req,cfg,site,'maxDailyReward')}"></label><label>Daily Cooldown Hours<input type="number" name="dailyCooldownHours" value="${cfg.economy.dailyCooldownHours}" min="1"></label><label>كل كم رسالة<input type="number" name="messageEvery" value="${cfg.economy.messageEvery}" min="1"></label><label>مكافأة الرسائل<input type="number" name="messageReward" value="${cfg.economy.messageReward}" min="0" max="${maxFor(req,cfg,site,'maxMessageReward')}"></label><label>Cooldown الرسائل ثانية<input type="number" name="messageCooldownSeconds" value="${cfg.economy.messageCooldownSeconds}" min="0"></label><label>Cooldown التحويل ثانية<input type="number" name="transferCooldownSeconds" value="${cfg.economy.transferCooldownSeconds}" min="0"></label><label>كل كم دقيقة Voice<input type="number" name="voiceEveryMinutes" value="${cfg.economy.voiceEveryMinutes}" min="1"></label><label>Voice Reward<input type="number" name="voiceReward" value="${cfg.economy.voiceReward}" min="0" max="${maxFor(req,cfg,site,'maxVoiceReward')}"></label><label class="wide">🚫 استثناء أعضاء من توب الكوين<textarea name="coinTopExcludedUserIds" placeholder="ID أو منشن — كل شخص بسطر">${esc((cfg.economy?.topExcludedUserIds||[]).join('\n'))}</textarea><small>هؤلاء لن يظهروا في أمر توب الكوين / توب كوين / coin top حتى لو رصيدهم أعلى.</small></label></div>
    <h3>🏦 Bank</h3><div class="config-card"><h3>🎨 تصميم لوحة البنك</h3><p class="hint">هذه الإعدادات تخص اللوحة التي يرسلها أمر <code>/لوحة</code>. رابط صورة البنك يُرسل كصورة مستقلة لحالها فوق رسالة اللوحة، والـLogo يظهر بجانب العنوان، والنصوص تظهر داخل اللوحة.</p><div class="form-grid"><label>عنوان لوحة البنك<input name="bankTitle" value="${esc(cfg.bank?.title||'🏦 ZOMBI City Bank')}" maxlength="256"></label><label>السطر تحت العنوان / اسم المركز<input name="bankPanelCenterName" value="${esc(cfg.bank?.panelCenterName||'ZOMB • BANK CENTER')}" maxlength="120"></label><label>لون اللوحة<input type="color" name="bankPanelColor" value="${/^#[0-9a-f]{6}$/i.test(String(cfg.bank?.panelColor||''))?esc(cfg.bank.panelColor):'#8B5CF6'}"></label><label>Footer<input name="bankPanelFooter" value="${esc(cfg.bank?.panelFooter||'ZOMBI • Bank • اللوحة الرسمية')}" maxlength="500"></label><label class="wide">الكتابة تحت عنوان لوحة البنك<textarea name="bankDescription" rows="7" maxlength="2000">${esc(cfg.bank?.description||'')}</textarea></label><label class="wide">🖼️ صورة مستقلة فوق لوحة البنك<input type="url" name="panelMedia_bank_bannerUrl" value="${esc(cfg.panelMedia?.bank?.bannerUrl||'')}" placeholder="https://.../bank-banner.png"></label><label class="wide">🔹 Logo / صورة صغيرة بجانب العنوان<input type="url" name="panelMedia_bank_thumbnailUrl" value="${esc(cfg.panelMedia?.bank?.thumbnailUrl||'')}" placeholder="https://.../bank-logo.png"></label></div><div class="hint">💡 بعد الحفظ اضغط <b>إرسال / تحديث لوحة البنك</b> أو استخدم <code>/لوحة</code> لتظهر التغييرات.</div></div><div class="form-grid"><div class="wide bank-guide"><strong>البنك الكامل • 7 ألعاب نهب • حماية • كفالة</strong><p>للنهب اكتب <code>نهب @العضو</code>. النجاح ينقل 15% من الكاش، والفشل يسجن اللاعب. من لوحة البنك يستطيع العضو شراء حماية للكاش أو دفع الكفالة.</p></div><label><input type="checkbox" name="heistEnabled" ${cfg.bank?.heistEnabled!==false?'checked':''}> تفعيل ألعاب النهب</label><label>كولداون كل لعبة (ثوانٍ)<input type="number" name="heistGameCooldownSeconds" min="60" max="604800" value="${cfg.bank?.heistGameCooldownSeconds??7200}"></label><label>مدة التحدي (ثوانٍ)<input type="number" name="heistTimeSeconds" min="10" max="120" value="${cfg.bank?.heistTimeSeconds??25}"></label><label>مدة السجن (ساعات)<input type="number" name="heistJailHours" min="1" max="24" value="${cfg.bank?.heistJailHours??2}"></label><label>سعر الكفالة<input type="number" name="heistBailPrice" min="0" value="${cfg.bank?.heistBailPrice??50000}"></label><label>سعر حماية الكاش<input type="number" name="cashProtectionPrice" min="0" value="${cfg.bank?.cashProtectionPrice??25000}"></label><label>مدة الحماية (دقائق)<input type="number" name="cashProtectionMinutes" min="1" value="${cfg.bank?.cashProtectionMinutes??60}"></label><label>كولداون شراء الحماية (دقائق)<input type="number" name="cashProtectionCooldownMinutes" min="1" value="${cfg.bank?.cashProtectionCooldownMinutes??240}"></label><div class="wide"><strong>ألعاب النهب المفعلة لهذا السيرفر</strong><div class="checks heist-checks">${heistGuildRows}</div><p class="hint">Owner يحدد من لوحة Owner الألعاب المتاحة أصلًا لخطة Free وPremium؛ مدير السيرفر يستطيع فقط إيقاف لعبة متاحة له.</p></div><label><input type="checkbox" name="bankDepositEnabled" ${cfg.bank?.depositEnabled!==false?'checked':''}> إيداع</label><label><input type="checkbox" name="bankWithdrawEnabled" ${cfg.bank?.withdrawEnabled!==false?'checked':''}> سحب</label><label>أقصى عملية<input type="number" name="bankMaxTransaction" value="${cfg.bank?.maxTransaction||1}" min="1" max="${maxFor(req,cfg,site,'maxBankTransaction')}"></label><label>قيمة الذهب<input type="number" name="bankGoldValue" value="${cfg.bank?.goldValue||100000}" min="1"></label><label>Cooldown الراتب ساعات<input type="number" name="bankSalaryCooldownHours" value="${cfg.bank?.salaryCooldownHours??4}" min="0"></label><label>أقصى راتب<input type="number" name="bankMaxSalary" value="${cfg.bank?.maxSalary??1000}" min="0"></label><label>ربح التداول %<input type="number" name="bankTradeProfitPercent" value="${cfg.bank?.tradeProfitPercent??15}" min="0"></label><label>جلسة التداول دقائق<input type="number" name="bankTradeSessionMinutes" value="${cfg.bank?.tradeSessionMinutes??5}" min="1"></label><label>أقصى قرض<input type="number" name="bankMaxLoan" value="${cfg.bank?.maxLoan??100000}" min="0"></label><label>فائدة القرض %<input type="number" name="bankLoanInterestPercent" value="${cfg.bank?.loanInterestPercent??10}" min="0"></label><label>راتب موظف شركة بداية<input type="number" name="companyEmployeeStartSalary" value="${cfg.bank?.companyEmployeeStartSalary??4000}" min="0"></label><label>زيادة راتب الموظف<input type="number" name="companyEmployeeSalaryIncrease" value="${cfg.bank?.companyEmployeeSalaryIncrease??500}" min="0"></label><label>ترقية الشركة ساعات<input type="number" name="companyLevelUpHours" value="${cfg.bank?.companyLevelUpHours??24}" min="1"></label><label>راتب المالك بداية<input type="number" name="companyOwnerStartSalary" value="${cfg.bank?.companyOwnerStartSalary??100000}" min="0"></label><label>زيادة راتب المالك<input type="number" name="companyOwnerSalaryIncrease" value="${cfg.bank?.companyOwnerSalaryIncrease??5000}" min="0"></label><label>💼 أقل مكافأة عمل<input type="number" name="bankWorkRewardMin" value="${cfg.bank?.workRewardMin??150}" min="0"></label><label>💼 أعلى مكافأة عمل<input type="number" name="bankWorkRewardMax" value="${cfg.bank?.workRewardMax??500}" min="0"></label><label>⏱️ كولداون العمل بالدقائق<input type="number" name="bankWorkCooldownMinutes" value="${cfg.bank?.workCooldownMinutes??60}" min="1"></label><label>💹 فائدة الادخار %<input type="number" name="bankSavingsInterestPercent" value="${cfg.bank?.savingsInterestPercent??1}" min="0" max="100"></label><label>⏱️ كولداون الفائدة بالساعات<input type="number" name="bankSavingsInterestCooldownHours" value="${cfg.bank?.savingsInterestCooldownHours??24}" min="1"></label><label>💹 سقف مكافأة الفائدة<input type="number" name="bankSavingsInterestMaxReward" value="${cfg.bank?.savingsInterestMaxReward??10000}" min="0"></label><label>🎨 لون لوحة توب البنك<input type="color" name="bankTopColor" value="${/^#[0-9a-f]{6}$/i.test(String(cfg.bank?.topColor||''))?esc(cfg.bank.topColor):'#E11D48'}"></label><label>🖼️ شعار لوحة التوب<input name="bankTopLogoUrl" value="${esc(cfg.bank?.topLogoUrl||cfg.branding?.panelLogoUrl||'')}" placeholder="https://..."></label><label class="wide">🚫 استثناء أعضاء من توب البنك<textarea name="bankTopExcludedUserIds" placeholder="ID أو منشن — كل شخص بسطر">${esc((cfg.bank?.topExcludedUserIds||[]).join('\n'))}</textarea><small>هؤلاء لن يظهروا في TOP 10 حتى لو رصيد البنك عندهم أعلى.</small></label></div><div class="form-grid"><label class="wide">الوظائف — id | الاسم | الراتب<textarea name="bankJobsText">${esc(bankJobsText)}</textarea></label><label class="wide">الشركات — id | الاسم | الوصف | سعر الذهب<textarea name="bankCompaniesText">${esc(bankCompaniesText)}</textarea></label><label class="wide">الأسهم — SYMBOL | الاسم | السعر<textarea name="bankStocksText">${esc(bankStocksText)}</textarea></label></div>
    <h3>🏆 Levels</h3><div class="form-grid"><label>XP لكل رسالة<input type="number" name="xpPerMessage" value="${cfg.levels.xpPerMessage}" min="1"></label><label>XP Cooldown<input type="number" name="xpCooldownSeconds" value="${cfg.levels.xpCooldownSeconds}" min="5"></label><label>Base XP<input type="number" name="baseXp" value="${cfg.levels.baseXp}" min="10"></label><label>Growth<input type="number" name="levelGrowth" value="${cfg.levels.growth}" min="0"></label><label class="wide">🖼️ Banner اللفل / XP<input type="url" name="levelsBannerUrl" value="${esc(cfg.levels?.bannerUrl||'')}" placeholder="https://.../banner.png"></label><label class="wide">🔹 Logo / Thumbnail اللفل<input type="url" name="levelsThumbnailUrl" value="${esc(cfg.levels?.thumbnailUrl||'')}" placeholder="https://.../logo.png"></label></div>
    <h3>🏴 العصابات ومهماتها</h3><div class="form-grid"><label>أقصى أعضاء<input type="number" name="gangMaxMembers" value="${cfg.gangs.maxMembers}" min="2" max="${maxFor(req,cfg,site,'gangMembers')}"></label><label>أقصى نواب<input type="number" name="gangMaxDeputies" value="${cfg.gangs.maxDeputies||0}" min="0" max="${maxFor(req,cfg,site,'gangDeputies')}"></label><label>تكلفة إنشاء العصابة<input type="number" name="gangCreateCost" value="${cfg.gangs.createCost||0}" min="0"></label><label>لون رتبة العصابة<input name="gangRoleColor" value="${esc(cfg.gangs.roleColor||'#2b2d31')}"></label><label><input type="checkbox" name="gangBankEnabled" ${cfg.gangs.bankEnabled!==false?'checked':''}> خزنة العصابة</label><label><input type="checkbox" name="gangMissionsEnabled" ${cfg.gangs.missionsEnabled!==false?'checked':''}> المهمات</label><label>أقل مشاركين للمهمة<input type="number" name="gangMinMissionParticipants" value="${cfg.gangs.minMissionParticipants||2}" min="2" max="25"></label><label>أقصى مراحل للمهمة<input type="number" name="gangMaxMissionSteps" value="${cfg.gangs.maxMissionSteps||5}" min="1" max="10"></label><label>محاولات اللغز<input type="number" name="gangPuzzleMaxAttempts" value="${cfg.gangs.puzzleMaxAttempts||2}" min="1"></label><label>محاولات الشات<input type="number" name="gangChatMaxAttempts" value="${cfg.gangs.chatMaxAttempts||2}" min="1"></label><label>محاولات Relay<input type="number" name="gangRelayMaxAttempts" value="${cfg.gangs.relayMaxAttempts||2}" min="1"></label><label>Cooldown المهمة بالدقائق<input type="number" name="gangMissionCooldownMinutes" value="${cfg.gangs.missionCooldownMinutes||240}" min="1"></label><label>مدة المهمة بالدقائق<input type="number" name="gangMissionDurationMinutes" value="${cfg.gangs.missionDurationMinutes||30}" min="5"></label><label>أقل مكافأة<input type="number" name="gangMissionRewardMin" value="${cfg.gangs.missionRewardMin||0}" min="0"></label><label>أعلى مكافأة<input type="number" name="gangMissionRewardMax" value="${cfg.gangs.missionRewardMax||0}" min="0"></label><label>مدة مرحلة Voice بالثواني<input type="number" name="gangMissionVoiceSeconds" value="${cfg.gangs.missionVoiceSeconds||60}" min="10"></label></div>
    <h3>🚨 سرقة البنك المركزي • مهمات متغيرة بين الشاتات</h3>
    <div class="warn small">🔥 كل عملية تتكوّن من مراحل عشوائية تنتقل فعليًا بين شاتات السيرفر. الخطأ يرفع مستوى إنذار البنك، وعند امتلائه تفشل العملية.</div>
    <div class="form-grid">
      <label><input type="checkbox" name="robberyEnabled" ${cfg.robbery?.enabled===true?'checked':''}> السرقة متاحة الآن</label>
      <label>عدد المشاركين المطلوب<input type="number" name="robberyMinParticipants" value="${cfg.robbery?.minParticipants||5}" min="2" max="${maxFor(req,cfg,site,'robberyParticipants')}"></label>
      <label>عدد مراحل كل سرقة<input type="number" name="robberyStageCount" value="${cfg.robbery?.stageCount||10}" min="5" max="20"></label>
      <label>الصعوبة<select name="robberyDifficulty"><option value="normal" ${cfg.robbery?.difficulty==='normal'?'selected':''}>عادي</option><option value="hard" ${!cfg.robbery?.difficulty||cfg.robbery?.difficulty==='hard'?'selected':''}>صعب</option><option value="elite" ${cfg.robbery?.difficulty==='elite'?'selected':''}>نخبة</option><option value="legendary" ${cfg.robbery?.difficulty==='legendary'?'selected':''}>أسطوري</option></select></label>
      <label>وقت المرحلة بالثواني<input type="number" name="robberyStageTimeSeconds" value="${cfg.robbery?.stageTimeSeconds||60}" min="20" max="300"></label>
      <label>المحاولات لكل مرحلة<input type="number" name="robberyMaxAttemptsPerStage" value="${cfg.robbery?.maxAttemptsPerStage||3}" min="1" max="6"></label>
      <label>أقصى مستوى إنذار<input type="number" name="robberyAlarmMax" value="${cfg.robbery?.alarmMax||5}" min="2" max="10"></label>
      <label>اختيار الشاتات<select name="robberyChannelMode"><option value="all" ${cfg.robbery?.channelMode!=='selected'?'selected':''}>كل الشاتات المتاحة تلقائيًا</option><option value="selected" ${cfg.robbery?.channelMode==='selected'?'selected':''}>شاتات أحددها أنا</option></select></label>
      <label>أقصى عدد شاتات بالعملية<input type="number" name="robberyChannelCount" value="${cfg.robbery?.channelCount||8}" min="2" max="20"></label>
      <label class="wide">الشاتات المسموحة عند الاختيار اليدوي<select multiple size="8" name="robberyChannelIds">${multiChannelOptions(channels,cfg.robbery?.channelIds||[],[0,5])}</select><small>Ctrl/⌘ لاختيار أكثر من شات. لن يكرر البوت نفس الشات في مرحلتين متتاليتين.</small></label>
      <label>المنشن عند فتح السرقة<select name="robberyMentionMode"><option value="none" ${cfg.robbery?.mentionMode==='none'?'selected':''}>بدون منشن</option><option value="everyone" ${!cfg.robbery?.mentionMode||cfg.robbery?.mentionMode==='everyone'?'selected':''}>@everyone</option><option value="here" ${cfg.robbery?.mentionMode==='here'?'selected':''}>@here</option><option value="role" ${cfg.robbery?.mentionMode==='role'?'selected':''}>منشن رتبة محددة</option></select></label>
      <label>رتبة المنشن<select name="robberyMentionRoleId"><option value="">اختر الرتبة</option>${roleOptions(roles,guild.id,[cfg.robbery?.mentionRoleId||''])}</select></label>
      <label>مدة التجمع دقيقة<input type="number" name="robberyLobbyMinutes" value="${cfg.robbery?.lobbyMinutes||10}" min="2" max="60"></label>
      <label>مدة العملية كاملة دقيقة<input type="number" name="robberyMissionMinutes" value="${cfg.robbery?.missionMinutes||25}" min="5" max="180"></label>
      <label>المكافأة لخزنة العصابة<input type="number" name="robberyReward" value="${cfg.robbery?.reward||50000}" min="1"></label>
      <label>Cooldown ساعات<input type="number" name="robberyCooldownHours" value="${cfg.robbery?.cooldownHours||12}" min="0"></label>
      <label>قناع<input type="number" name="robberyMask" value="${cfg.robbery?.equipment?.mask||0}" min="0"></label>
      <label>جهاز اختراق<input type="number" name="robberyHacking" value="${cfg.robbery?.equipment?.hacking||0}" min="0"></label>
      <label>مثقاب<input type="number" name="robberyDrill" value="${cfg.robbery?.equipment?.drill||0}" min="0"></label>
      <label>جهاز اتصال<input type="number" name="robberyRadio" value="${cfg.robbery?.equipment?.radio||0}" min="0"></label>
      <label>سيارة هروب<input type="number" name="robberyCar" value="${cfg.robbery?.equipment?.car||0}" min="0"></label>
    </div>
    <h3>🎵 نظام الموسيقى</h3>
    <div class="warn small">${canMusic?'✅ النظام متاح في خطتك الحالية.':'🔒 نظام الموسيقى غير متاح في خطتك الحالية حسب إعدادات Owner.'} • الطابور: <b>${canMusicQueue?'مفعّل':'مقفل'}</b> • التكرار: <b>${canMusicLoop?'مفعّل':'مقفل'}</b> • البحث بالاسم: <b>${canMusicSearch?'مفعّل':'مقفل'}</b> • حد الطابور: <b>${musicQueueLimit}</b> • أقصى صوت: <b>${musicVolumeLimit}%</b> • أقصى مدة: <b>${musicTrackLimit} دقيقة</b>.</div>
    <div class="form-grid">
      <label><input type="checkbox" name="musicEnabled" ${cfg.music?.enabled!==false?'checked':''} ${canMusic?'':'disabled'}> تشغيل الموسيقى في هذا السيرفر</label>
      <label><input type="checkbox" name="musicAllowEveryone" ${cfg.music?.allowEveryone!==false?'checked':''} ${canMusic?'':'disabled'}> السماح لكل عضو داخل نفس الفويس بالتحكم</label>
      <label class="wide">رتب DJ / التحكم<select multiple size="6" name="musicControllerRoleIds" ${canMusic?'':'disabled'}>${roleOptions(roles,guild.id,cfg.music?.controllerRoleIds||[])}</select><small>إذا أوقفت السماح للجميع، الإدارة أو الرتب المحددة هنا فقط تقدر تتحكم.</small></label>
      <label>الصوت الافتراضي %<input type="number" name="musicDefaultVolume" value="${Number(cfg.music?.defaultVolume??60)}" min="1" max="${musicVolumeLimit}" data-plan-max="${musicVolumeLimit}" data-limit-label="مستوى صوت الموسيقى" ${canMusic?'':'disabled'}></label>
      <label>مغادرة تلقائية بعد ثوانٍ<input type="number" name="musicAutoLeaveSeconds" value="${Number(cfg.music?.autoLeaveSeconds??180)}" min="30" max="3600" ${canMusic?'':'disabled'}></label>
      <label><input type="checkbox" name="musicAnnounceNowPlaying" ${cfg.music?.announceNowPlaying!==false?'checked':''} ${canMusic?'':'disabled'}> إرسال رسالة الآن يتم التشغيل</label>
    </div>
    <h3>🔊 الرومات الصوتية المؤقتة</h3><div class="form-grid"><label><input type="checkbox" name="voiceRoomsEnabled" ${cfg.voiceRooms?.enabled===true?'checked':''}> تشغيل النظام</label><label>اسم الروم<input name="voiceRoomName" value="${esc(cfg.voiceRooms?.roomName||'🎙️・{username}')}"></label><label>User Limit<input type="number" name="voiceUserLimit" value="${cfg.voiceRooms?.userLimit||0}" min="0" max="99"></label><label>Bitrate<input type="number" name="voiceBitrate" value="${cfg.voiceRooms?.bitrate||64000}" min="8000" max="384000"></label><label class="wide">🖼️ Banner لوحة التحكم الصوتي<input type="url" name="voiceBannerUrl" value="${esc(cfg.voiceRooms?.bannerUrl||'')}" placeholder="https://.../banner.png"></label><label class="wide">🔹 Logo / Thumbnail لوحة التحكم الصوتي<input type="url" name="voiceThumbnailUrl" value="${esc(cfg.voiceRooms?.thumbnailUrl||'')}" placeholder="https://.../logo.png"></label></div>
    <h3>📋 مركز لوقات ZOMBI — روم منفصل لكل نظام</h3>
    <input type="hidden" name="loggingPresent" value="1">
    <div class="checks"><label><input type="checkbox" name="modLogActions" ${cfg.moderation?.logActions!==false?'checked':''}> ✅ تفعيل نظام اللوقات</label>${Object.entries({audit:'إجراءات الإدارة والرومات والرتب',messages:'حذف وتعديل الرسائل',members:'دخول وخروج وتغييرات الأعضاء',voice:'الفويس والكتم والكاميرا',games:'الألعاب',commands:'أوامر السلاش',actions:'إجراءات عامة للبوت'}).map(([k,label])=>`<label><input type="checkbox" name="log_${k}" ${cfg.logging?.[k]!==false?'checked':''}> ${label}</label>`).join('')}</div>
    <div class="warn small">💡 تقدر تختار <b>شات مختلف لكل نظام</b>. إذا تركت أي خانة فارغة، اللوق يرجع تلقائيًا إلى <b>Logs العام</b>. وإذا تركت Logs العام فارغًا والنظام له روم مخصص، يظل اللوق المخصص يعمل.</div>
    <div class="form-grid log-channel-grid">
      <label>📚 Logs العام / احتياطي<select name="logs">${textChannels(channels,cfg.channels.logs)}</select></label>
      <label>🏦 لوق البنك<select name="logBank">${textChannels(channels,cfg.channels.logBank)}</select></label>
      <label>💰 لوق ZOM / Economy<select name="logEconomy">${textChannels(channels,cfg.channels.logEconomy)}</select></label>
      <label>🏴 لوق العصابات<select name="logGangs">${textChannels(channels,cfg.channels.logGangs||cfg.channels.gangLogs)}</select></label>
      <label>🚨 لوق سرقة البنك / النهب<select name="logRobbery">${textChannels(channels,cfg.channels.logRobbery)}</select></label>
      <label>🎫 لوق التذاكر<select name="logTickets">${textChannels(channels,cfg.channels.logTickets)}</select></label>
      <label>🛒 لوق المتجر<select name="logStore">${textChannels(channels,cfg.channels.logStore)}</select></label>
      <label>⚠️ لوق التحذيرات<select name="logWarnings">${textChannels(channels,cfg.channels.logWarnings)}</select></label>
      <label>🎮 لوق الألعاب<select name="logGames">${textChannels(channels,cfg.channels.logGames)}</select></label>
      <label>🏆 لوق Levels / XP<select name="logLevels">${textChannels(channels,cfg.channels.logLevels)}</select></label>
      <label>🔊 لوق Voice<select name="logVoice">${textChannels(channels,cfg.channels.logVoice)}</select></label>
      <label>🎵 لوق الموسيقى<select name="logMusic">${textChannels(channels,cfg.channels.logMusic)}</select></label>
      <label>🛡️ لوق الإدارة / Moderation<select name="logModeration">${textChannels(channels,cfg.channels.logModeration)}</select></label>
      <label>🗑️ لوق الرسائل<select name="logMessages">${textChannels(channels,cfg.channels.logMessages)}</select></label>
      <label>👥 لوق الأعضاء<select name="logMembers">${textChannels(channels,cfg.channels.logMembers)}</select></label>
      <label>⌨️ لوق الأوامر<select name="logCommands">${textChannels(channels,cfg.channels.logCommands)}</select></label>
      <label>🖼️ لوق إرسال/تحديث اللوحات<select name="logPanels">${textChannels(channels,cfg.channels.logPanels)}</select></label>
      <label>🔔 لوق Self Roles<select name="logRoles">${textChannels(channels,cfg.channels.logRoles)}</select></label>
      <label>🪪 لوق تغيير الاسم<select name="logNameChange">${textChannels(channels,cfg.channels.logNameChange)}</select></label>
      <label>💎 لوق Premium<select name="logPremium">${textChannels(channels,cfg.channels.logPremium)}</select></label>
      <label>🎉 لوق الأيفنت<select name="logEvent">${textChannels(channels,cfg.channels.logEvent)}</select></label>
      <label>⚙️ لوق النظام / أخطاء<select name="logSystem">${textChannels(channels,cfg.channels.logSystem)}</select></label>
    </div>
    <p class="hint">البوت يحتاج في كل روم لوق: View Channel + Send Messages + Embed Links. لوق الإدارة الكامل يستفيد أيضًا من View Audit Log.</p>
    <h3>🛡️ Moderation</h3><div class="checks"><label><input type="checkbox" name="modClearEnabled" ${cfg.moderation?.clearEnabled!==false?'checked':''}> Clear</label><label><input type="checkbox" name="modKickEnabled" ${cfg.moderation?.kickEnabled!==false?'checked':''}> Kick</label><label><input type="checkbox" name="modBanEnabled" ${cfg.moderation?.banEnabled!==false?'checked':''}> Discord Ban</label><label><input type="checkbox" name="modLockEnabled" ${cfg.moderation?.lockEnabled!==false?'checked':''}> Lock</label></div>
    <div class="config-card"><h3>⏱️ Timeout مخصص بالرتب</h3><p class="hint">حتى Administrator لا يستطيع استخدام <code>/timeout</code> إلا إذا كانت رتبته ضمن القائمة أدناه. مالك السيرفر فقط يمكن استثناؤه من الخيار.</p><div class="form-grid">
      <label><input type="checkbox" name="timeoutEnabled" ${cfg.moderation?.timeoutEnabled!==false?'checked':''}> تفعيل /timeout و /untimeout</label>
      <label><input type="checkbox" name="timeoutOwnerBypass" ${cfg.moderation?.timeoutOwnerBypass!==false?'checked':''}> السماح لمالك السيرفر دائمًا</label>
      <label><input type="checkbox" name="timeoutRespectHierarchy" ${cfg.moderation?.timeoutRespectHierarchy!==false?'checked':''}> منع معاقبة رتبة مساوية/أعلى</label>
      <label><input type="checkbox" name="timeoutRequireReason" ${cfg.moderation?.timeoutRequireReason===true?'checked':''}> السبب إجباري</label>
      <label>أقصى مدة Timeout بالدقائق<input type="number" name="timeoutMaxMinutes" value="${Number(cfg.moderation?.timeoutMaxMinutes||10080)}" min="1" max="40320"><small>10080 = 7 أيام، والحد الأقصى من Discord هو 28 يومًا.</small></label>
      <label class="wide">الرتب المسموح لها باستخدام Timeout<select multiple name="timeoutAllowedRoleIds">${roleOptions(roles,guild.id,cfg.moderation?.timeoutAllowedRoleIds||[])}</select><small>Administrator لا يتجاوز هذه القائمة.</small></label>
    </div></div>
    <div class="config-card"><h3>🔊 أمر move — سحب عضو إلى رومك</h3><p class="hint">اكتب <code>move @member</code>، أو اعمل Reply على رسالة العضو واكتب <code>move</code>. لازم منفذ الأمر يكون داخل Voice، والعضو المطلوب يكون داخل Voice آخر. حتى Administrator لا يتجاوز قائمة الرتب أدناه.</p><div class="form-grid">
      <label><input type="checkbox" name="moveEnabled" ${cfg.moderation?.moveEnabled!==false?'checked':''}> تفعيل أمر move</label>
      <label><input type="checkbox" name="moveOwnerBypass" ${cfg.moderation?.moveOwnerBypass!==false?'checked':''}> السماح لمالك السيرفر دائمًا</label>
      <label class="wide">الرتب المسموح لها باستخدام move<select multiple name="moveAllowedRoleIds">${roleOptions(roles,guild.id,cfg.moderation?.moveAllowedRoleIds||[])}</select><small>اختيار الرتبة هنا هو الذي يسمح باستخدام الأمر؛ صلاحية Administrator وحدها لا تكفي.</small></label>
      <label class="wide">رومات الفويس المسموح سحب الأعضاء منها<select multiple name="moveSourceChannelIds">${multiChannelOptions(channels,cfg.moderation?.moveSourceChannelIds||[],[2,13])}</select><small>اتركها فارغة للسماح بالسحب من أي روم صوتي.</small></label>
      <label class="wide">رومات الفويس المسموح السحب إليها<select multiple name="moveDestinationChannelIds">${multiChannelOptions(channels,cfg.moderation?.moveDestinationChannelIds||[],[2,13])}</select><small>الروم المقصود هو الروم الموجود فيه منفذ أمر move. اتركها فارغة للسماح بأي روم.</small></label>
    </div><div class="warn small">⚠️ ZOMBI BOT يحتاج View Channel + Connect + Move Members في رومات الفويس حتى يقدر ينقل العضو.</div></div>
    <div class="config-card"><h3>💥 رتبة ban</h3><p class="hint">الأمر النصي: <code>ban @member السبب</code> — الإلغاء: <code>unban @member</code>. ويوجد أيضًا <code>/roleban</code> و <code>/unroleban</code>. عند التطبيق تُحفظ رتب العضو ثم تُزال الرتب القابلة للإزالة وتُعطى رتبة ban 💥.</p><div class="form-grid">
      <label><input type="checkbox" name="roleBanEnabled" ${cfg.moderation?.roleBanEnabled===true?'checked':''}> تفعيل ban 💥</label>
      <label>رتبة العقوبة<select name="roleBanRoleId"><option value="">— اختر رتبة موجودة —</option>${roleOptions(roles,guild.id,cfg.moderation?.roleBanRoleId?[cfg.moderation.roleBanRoleId]:[])}</select><small>البوت سيستخدم هذه الرتبة نفسها ولن ينشئ رتبة جديدة تلقائيًا.</small></label>
      <label><input type="checkbox" name="roleBanOwnerBypass" ${cfg.moderation?.roleBanOwnerBypass!==false?'checked':''}> السماح لمالك السيرفر دائمًا</label>
      <label><input type="checkbox" name="roleBanRespectHierarchy" ${cfg.moderation?.roleBanRespectHierarchy!==false?'checked':''}> منع معاقبة رتبة مساوية/أعلى</label>
      <label><input type="checkbox" name="roleBanAllowSendMessages" ${cfg.moderation?.roleBanAllowSendMessages!==false?'checked':''}> السماح بالكتابة في الشاتات المسموحة</label>
      <label><input type="checkbox" name="roleBanHideVoice" ${cfg.moderation?.roleBanHideVoice!==false?'checked':''}> إخفاء الفويسات عن رتبة ban</label>
      <label class="wide">الرتب المسموح لها بإعطاء/فك ban 💥<select multiple name="roleBanAllowedRoleIds">${roleOptions(roles,guild.id,cfg.moderation?.roleBanAllowedRoleIds||[])}</select><small>حتى Administrator لا يستطيع تنفيذ الأمر إذا لم تكن رتبته هنا.</small></label>
      <label class="wide">الشاتات التي تبقى ظاهرة لرتبة ban 💥<select multiple name="roleBanVisibleChannelIds">${textChannelMultiOptions(channels,cfg.moderation?.roleBanVisibleChannelIds||[])}</select><small>كل الشاتات النصية الأخرى تُخفى عن رتبة ban 💥 تلقائيًا. يجب اختيار رتبة العقوبة من القائمة؛ لن يتم إنشاء رتب مكررة تلقائيًا.</small></label>
    </div><div class="warn small">⚠️ لازم رتبة ZOMBI BOT تكون أعلى من رتبة ban 💥 وأعلى من الرتب التي تريد إزالتها، ومعه Manage Roles. Timeout يحتاج Moderate Members.</div></div>

    <h3>🛡️ إدارة الرتب والصلاحيات المتقدمة</h3>
    <section class="config-card z-role-manager" id="z-role-manager" data-guild-id="${guild.id}" data-csrf="${token}">
      <div class="z-rm-hero"><div><span class="badge">ZOMBI ROLE CONTROL</span><h2>تحكم كامل بالرتبة والقنوات والحماية</h2><p>اختر رتبة ثم عدّل صلاحيات السيرفر، وما تستطيع رؤيته وفعله داخل كل قناة. حماية الروابط والفيديو تعمل من ZOMBI حتى لو كان العضو يحمل Administrator.</p></div><div class="z-rm-shield">🛡️</div></div>
      <div class="z-rm-toolbar"><label>الرتبة<select id="z-rm-role"><option value="">تحميل الرتب...</option></select></label><div class="z-rm-actions"><button class="btn" type="button" id="z-rm-safe-preset">🔐 إدارة مقيدة آمنة</button><button class="btn" type="button" id="z-rm-reload">↻ تحديث من Discord</button></div></div>
      <div class="warn small z-rm-admin-warning" id="z-rm-admin-warning" hidden>⚠️ <b>Administrator</b> الحقيقي يتجاوز كل Channel Overwrites في Discord. إذا بدك تخفي شاتات عن هذه الرتبة استخدم «إدارة مقيدة آمنة» بدل Administrator.</div>
      <div class="z-rm-tabs" role="tablist"><button type="button" class="active" data-rm-tab="server">صلاحيات السيرفر</button><button type="button" data-rm-tab="channels">صلاحيات الشاتات</button><button type="button" data-rm-tab="protection">حماية المحتوى</button></div>
      <div class="z-rm-view" data-rm-view="server"><div id="z-rm-server-permissions" class="z-rm-permission-groups"><div class="hint">اختر رتبة للبدء.</div></div></div>
      <div class="z-rm-view" data-rm-view="channels" hidden><div class="z-rm-channel-toolbar"><input id="z-rm-channel-search" placeholder="🔎 ابحث عن شات أو Category..."><select id="z-rm-channel-filter"><option value="all">كل القنوات</option><option value="text">النصية</option><option value="voice">الصوتية</option><option value="category">Categories</option></select></div><div class="hint">لكل صلاحية: <b>وراثة</b> = اترك قرار Discord كما هو، <b>سماح</b> = ✅، <b>منع</b> = ❌. المنع لا يتغلب على Administrator الحقيقي.</div><div id="z-rm-channels"></div></div>
      <div class="z-rm-view" data-rm-view="protection" hidden><div class="z-rm-security-note">🚫 عند المخالفة يحذف ZOMBI الرسالة فورًا، ثم يرسل <b>DM خاص للعضو فقط</b>. لا يرسل تنبيهًا عامًا في الشات.</div><div id="z-rm-protection"></div></div>
      <div class="z-rm-save"><span id="z-rm-status">لم يتم إجراء تغييرات.</span><button class="btn primary" type="button" id="z-rm-save">💾 حفظ وتطبيق على Discord</button></div>
    </section>
    <h3>⚠️ التحذيرات</h3><p class="hint">ثلاثة أنظمة مستقلة: لكل نوع شات خاص، رتب مخوّلة، وسجل ورتب مستويات منفصلة. لا توجد عقوبات تلقائية؛ النظام يحفظ السبب ويعطي رتبة مستوى التحذير المختارة فقط.</p><div class="form-grid">${warningRoleFields('members','👤 تحذيرات الأعضاء')}${warningRoleFields('administration','🛡️ تحذيرات الإدارة')}${warningRoleFields('events','🎉 تحذيرات الإيفنت')}<div class="wide hint"><b>الأوامر:</b> <code>تحذير @عضو</code> • <code>تحذير إدارة @عضو</code> • <code>تحذير إيفنت @عضو</code>. لإزالة آخر تحذير استبدل «تحذير» بـ «إزالة تحذير». البوت يفتح زر كتابة السبب مثل النظام القديم.</div></div>
    <h3>🔤 لعبة تجميع الحروف</h3><div class="config-card"><p>صاحب الأمر يكون الحكم. أول لاعب عشوائي، وإذا كانت الكلمة صحيحة يختار اللاعب التالي، وإذا كانت خاطئة يخرج والبوت يختار عشوائيًا. آخر لاعب يفوز بالجائزة.</p><div class="form-grid">
      <label><input type="checkbox" checked disabled> اللعبة مفعلة دائمًا</label><input type="hidden" name="letterChainEnabled" value="1">
      <label>أمر اللعبة<input name="letterChainCommand" value="${esc(cfg.games.letterChain?.command||'#تجميع-الحروف')}" maxlength="40"></label>
      <label>وقت دخول اللاعبين (ثانية)<input type="number" name="letterChainLobbySeconds" value="${Number(cfg.games.letterChain?.lobbySeconds||25)}" min="5" max="300"></label>
      <label>وقت كتابة الكلمة (ثانية)<input type="number" name="letterChainAnswerSeconds" value="${Number(cfg.games.letterChain?.answerSeconds||15)}" min="5" max="120"></label>
      <label>وقت الحكم (ثانية)<input type="number" name="letterChainJudgeSeconds" value="${Number(cfg.games.letterChain?.judgeSeconds||20)}" min="5" max="120"></label>
      <label>الجائزة ZOM<input type="number" name="letterChainWinnerReward" value="${Number(cfg.games.letterChain?.winnerReward??300)}" min="0" max="${maxFor(req,cfg,site,'maxWinnerReward')}"></label>
      <label>أقل عدد لاعبين<input type="number" name="letterChainMinPlayers" value="${Number(cfg.games.letterChain?.minPlayers||3)}" min="2" max="25"></label>
      <label>أقصى عدد لاعبين<input type="number" name="letterChainMaxPlayers" value="${Number(cfg.games.letterChain?.maxPlayers||20)}" min="2" max="25"></label>
      <label class="wide">الرومات المسموح تشغيل اللعبة فيها<select multiple size="5" name="letterChainChannelIds">${textChannelMultiOptions(channels,cfg.games.letterChain?.channelIds||[])}</select><small>فارغ = كل الرومات.</small></label>
      <label class="wide">الرتب المسموح لها بدء اللعبة<select multiple size="5" name="letterChainStartRoleIds">${roleOptions(roles,guild.id,cfg.games.letterChain?.startRoleIds||[])}</select><small>مالك السيرفر مسموح دائمًا، وباقي الأعضاء فقط حسب الرتب التي تختارها هنا.</small></label>
      <label class="wide">بنك الحروف<textarea name="letterChainLetterPool" rows="3" maxlength="300">${esc(cfg.games.letterChain?.letterPool||'ا أ إ آ ب ت ث ج ح خ د ذ ر ز س ش ص ض ط ظ ع غ ف ق ك ل م ن ه و ي ة ى ؤ ئ ء')}</textarea><small>يفصل بين الحروف بمسافة. كل حرف لا يتكرر حتى يتم استهلاك البنك كاملًا.</small></label>
    </div></div>
    <h3>🎡 عجلة الحظ / الروليت / الكراسي</h3><div class="form-grid"><label class="wide">جوائز عجلة الحظ — افصل بفاصلة<input name="wheelRewards" value="${esc((cfg.games.wheelRewards||[]).join(', '))}"></label><label><input type="checkbox" name="rouletteEnabled" ${cfg.games.rouletteEnabled!==false?'checked':''}> تشغيل الروليت</label><label>وقت دور الروليت ثانية<input type="number" name="rouletteTurnSeconds" value="${cfg.games.rouletteTurnSeconds||25}" min="10" max="120"></label><label>Revive<input type="number" name="rouletteCostRevive" value="${cfg.games.rouletteActionCosts?.revive||0}" min="0"></label><label>Link<input type="number" name="rouletteCostLink" value="${cfg.games.rouletteActionCosts?.link||0}" min="0"></label><label>Protect<input type="number" name="rouletteCostProtect" value="${cfg.games.rouletteActionCosts?.protect||0}" min="0"></label><label>Freeze<input type="number" name="rouletteCostFreeze" value="${cfg.games.rouletteActionCosts?.freeze||0}" min="0"></label><label>Double<input type="number" name="rouletteCostDouble" value="${cfg.games.rouletteActionCosts?.double||0}" min="0"></label><label>Curse<input type="number" name="rouletteCostCurse" value="${cfg.games.rouletteActionCosts?.curse||0}" min="0"></label><label>Unlink<input type="number" name="rouletteCostUnlink" value="${cfg.games.rouletteActionCosts?.unlink||0}" min="0"></label><label>Add<input type="number" name="rouletteCostAdd" value="${cfg.games.rouletteActionCosts?.add||0}" min="0"></label><label>عداد بدء الكراسي<input type="number" name="chairsStartCountdownSeconds" value="${cfg.games.chairs?.startCountdownSeconds||5}" min="1" max="60"></label><label>فاصل الجولات ms<input type="number" name="chairsBetweenRoundsMs" value="${cfg.games.chairs?.betweenRoundsMs||2500}" min="250"></label></div>
    <h3>🎮 الألعاب</h3>
    <div class="config-card"><h3>🖼️ تخصيص لوحة الألعاب وبداية اللعبة</h3><p class="hint">كل سيرفر له إعداداته الخاصة. روابط الصور والنصوص هنا تُستخدم فقط لهذا السيرفر.</p><div class="form-grid">
      <label class="wide">عنوان لوحة الألعاب<input name="gamePanelTitle" value="${esc(cfg.games?.panelTitle||'🎮 ألعاب ZOM')}" maxlength="256" placeholder="🎮 ألعاب ZOM"></label>
      <label class="wide">النص داخل لوحة الألعاب<textarea name="gamePanelDescription" rows="8" maxlength="4096" placeholder="اتركه فارغًا لاستخدام النص الافتراضي">${esc(cfg.games?.panelDescription||'')}</textarea><small>تقدر تكتب النص كاملًا كما تريد، ويدعم تنسيق Discord مثل **عريض** والأسطر الجديدة.</small></label>
      <label class="wide">Footer لوحة الألعاب<input name="gamePanelFooter" value="${esc(cfg.games?.panelFooter||'ZOM Games System')}" maxlength="2048" placeholder="ZOM Games System"></label>
      <label class="wide">🎮 صورة بداية الألعاب / الشعار الصغير<input type="url" name="gameStartImageUrl" value="${esc(cfg.games?.startImageUrl||'')}" placeholder="https://.../game-logo.png"><small>هذه هي الصورة الصغيرة التي تظهر في لوحات بدء/جولات الألعاب. إذا تركتها فارغة يرجع شعار ZOMBI الافتراضي.</small></label>
    </div></div>
    ${panelMediaFields(cfg,'games','لوحة الألعاب')}${lockedNote(canGameSettings,'تعديل إعدادات الألعاب غير متاح في خطتك.')}<div class="z-game-command-guide"><b>⌨️ طريقة تشغيل الألعاب من الشات</b><p>اكتب <code>#</code> ثم اسم اللعبة: <code>#اسئلة</code> <code>#تخمين</code> <code>#سرعة</code> <code>#ترتيب</code> <code>#صح-خطأ</code> <code>#حساب</code> <code>#الاقرب</code> <code>#كلمة</code> <code>#عجلة</code> <code>#يومي</code> <code>#مافيا</code> <code>#روليت</code> <code>#كراسي</code> <code>#من-القاتل</code> <code>#تجميع-الحروف</code> <code>#برا-السالفة</code> <code>#xo</code>.</p><small>إذا تجاوزت قيمة الحد الذي حدده Owner لخطتك، لن يتم الحفظ وستظهر رسالة ترقية الاشتراك.</small></div><div class="form-grid"><label class="wide">الرتب المسموح لها ببدء الألعاب<select multiple name="gameStartRoleIds">${roleOptions(roles,guild.id,cfg.games?.startRoleIds)}</select><small class="hint">الأدمن وManage Server مسموح لهم دائمًا. إذا لم تختَر رتبة إضافية، تبقى الألعاب للإدارة فقط.</small></label></div><div class="table-wrap game-table"><table><thead><tr><th>اللعبة</th><th>تشغيل</th><th>الجولات</th><th>الوقت</th><th>Cooldown</th><th>Reward Min</th><th>Reward Max</th><th>XP</th><th>الرومات</th><th>رتب البدء</th></tr></thead><tbody>${gameRows}</tbody></table></div><div class="form-grid"><label>Roulette Min<input type="number" name="rouletteMinPlayers" value="${cfg.games.lobby?.roulette?.minPlayers||2}" min="2" max="${maxFor(req,cfg,site,'maxGamePlayers')}" data-plan-max="${maxFor(req,cfg,site,'maxGamePlayers')}" data-limit-label="عدد لاعبي الروليت"></label><label>Roulette Max<input type="number" name="rouletteMaxPlayers" value="${cfg.games.lobby?.roulette?.maxPlayers||20}" min="2" max="${maxFor(req,cfg,site,'maxGamePlayers')}" data-plan-max="${maxFor(req,cfg,site,'maxGamePlayers')}" data-limit-label="عدد لاعبي الروليت"></label><label>Chairs Min<input type="number" name="chairsMinPlayers" value="${cfg.games.lobby?.chairs?.minPlayers||2}" min="2" max="${maxFor(req,cfg,site,'maxGamePlayers')}" data-plan-max="${maxFor(req,cfg,site,'maxGamePlayers')}" data-limit-label="عدد لاعبي الكراسي"></label><label>Chairs Max<input type="number" name="chairsMaxPlayers" value="${cfg.games.lobby?.chairs?.maxPlayers||20}" min="2" max="${maxFor(req,cfg,site,'maxGamePlayers')}" data-plan-max="${maxFor(req,cfg,site,'maxGamePlayers')}" data-limit-label="عدد لاعبي الكراسي"></label><label>Mafia Min<input type="number" name="mafiaMinPlayers" value="${cfg.games.lobby?.mafia?.minPlayers||4}" min="4" max="${maxFor(req,cfg,site,'maxGamePlayers')}" data-plan-max="${maxFor(req,cfg,site,'maxGamePlayers')}" data-limit-label="عدد لاعبي المافيا"></label><label>Mafia Max<input type="number" name="mafiaMaxPlayers" value="${cfg.games.lobby?.mafia?.maxPlayers||20}" min="4" max="${maxFor(req,cfg,site,'maxGamePlayers')}" data-plan-max="${maxFor(req,cfg,site,'maxGamePlayers')}" data-limit-label="عدد لاعبي المافيا"></label><label>🕵️ مكافأة برا السالفة<input type="number" name="outsiderReward" value="${cfg.games.outsider?.reward??300}" min="0"></label><label>🕵️ أقل لاعبين<input type="number" name="outsiderMinPlayers" value="${cfg.games.outsider?.minPlayers??3}" min="3" max="25"></label><label>🕵️ أقصى لاعبين<input type="number" name="outsiderMaxPlayers" value="${cfg.games.outsider?.maxPlayers??20}" min="3" max="25"></label><label>❎ جائزة بطل XO<input type="number" name="xoTournamentReward" value="${cfg.games.xoTournament?.reward??0}" min="0"></label><label>❎ أقل لاعبين XO<input type="number" name="xoTournamentMinPlayers" value="${cfg.games.xoTournament?.minPlayers??2}" min="2" max="25"></label><label>❎ أقصى لاعبين XO<input type="number" name="xoTournamentMaxPlayers" value="${cfg.games.xoTournament?.maxPlayers??16}" min="2" max="25"></label></div>
    <h3>✏️ تغيير الاسم</h3>${panelMediaFields(cfg,'name','لوحة تغيير الاسم')}<div class="form-grid"><label><input type="checkbox" name="nameChangeEnabled" ${cfg.nameChange?.enabled===true?'checked':''}> تشغيل النظام</label><label>عنوان اللوحة<input name="nameChangeTitle" value="${esc(cfg.nameChange?.title||'')}"></label><label>اسم الزر<input name="nameChangeButtonLabel" value="${esc(cfg.nameChange?.buttonLabel||'تغيير اسمي')}"></label><label>Emoji<input name="nameChangeButtonEmoji" value="${esc(cfg.nameChange?.buttonEmoji||'✏️')}"></label><label>عنوان Modal<input name="nameChangeModalTitle" value="${esc(cfg.nameChange?.modalTitle||'')}"></label><label>اسم الحقل<input name="nameChangeInputLabel" value="${esc(cfg.nameChange?.inputLabel||'')}"></label><label>Placeholder<input name="nameChangeInputPlaceholder" value="${esc(cfg.nameChange?.inputPlaceholder||'')}"></label><label>Cooldown ثانية<input type="number" name="nameChangeCooldownSeconds" value="${cfg.nameChange?.cooldownSeconds||30}" min="0"></label><label>لون<input name="nameChangeColor" value="${esc(cfg.nameChange?.color||'#8B5CF6')}"></label><label class="wide">الوصف<textarea name="nameChangeDescription">${esc(cfg.nameChange?.description||'')}</textarea></label><label class="wide">رسالة النجاح<textarea name="nameChangeSuccessMessage">${esc(cfg.nameChange?.successMessage||'')}</textarea></label><label class="wide">Banner<input name="nameChangeBannerUrl" value="${esc(cfg.nameChange?.bannerUrl||'')}"></label></div>
    <h3>🎫 شكل التذاكر</h3>${panelMediaFields(cfg,'tickets','لوحة التذاكر')}<div class="form-grid"><label>العنوان<input name="ticketTitle" value="${esc(cfg.tickets.title)}"></label><label>اسم زر الفتح<input name="ticketButtonLabel" value="${esc(cfg.tickets.buttonLabel)}"></label><label>Emoji<input name="ticketButtonEmoji" value="${esc(cfg.tickets.buttonEmoji)}"></label><label class="wide">الوصف<textarea name="ticketDescription">${esc(cfg.tickets.description)}</textarea></label><label class="wide">رتب الدعم العامة<select multiple name="supportRoleIds">${roleOptions(roles,guild.id,cfg.tickets.supportRoleIds)}</select></label></div>
    <h3>🛒 شكل متجر الرتب — مثل النظام القديم</h3>${panelMediaFields(cfg,'store','لوحة المتجر')}<div class="form-grid"><label>العنوان<input name="storeTitle" value="${esc(cfg.store.title)}"></label><label>Footer<input name="storeFooter" value="${esc(cfg.store.footer||'ZOMBI • ZOM Store')}"></label><label>لون Embed<input name="storeAccentColor" value="${esc(cfg.store.accentColor||cfg.branding.color)}"></label><label class="wide">الوصف<textarea name="storeDescription">${esc(cfg.store.description)}</textarea></label><label class="wide">Logo / Thumbnail<input name="storeThumbnailUrl" value="${esc(cfg.store.thumbnailUrl||'')}"></label><label class="wide">Banner اللوحة<input name="storeBannerUrl" value="${esc(cfg.store.bannerUrl||'')}"></label><label class="wide">Banner تفاصيل الرتبة الافتراضي<input name="storeDetailBannerUrl" value="${esc(cfg.store.detailBannerUrl||'')}"></label></div>
    <h3>🔔 Self Roles</h3>${panelMediaFields(cfg,'roles','لوحة رتب الإشعارات')}<div class="form-grid"><label>العنوان<input name="rolePanelTitle" value="${esc(cfg.rolePanel.title)}"></label><label>Footer<input name="rolePanelFooter" value="${esc(cfg.rolePanel.footer||'ZOMBI • ROLE CENTER')}"></label><label class="wide">الوصف<textarea name="rolePanelDescription">${esc(cfg.rolePanel.description)}</textarea></label></div>
    <h3>⚡ الرتبة التلقائية</h3><div class="form-grid"><label><input type="checkbox" name="autoRoleEnabled" ${cfg.autoRole?.enabled?'checked':''}> تفعيل إعطاء رتبة تلقائيًا عند دخول عضو جديد</label><label>الرتبة التلقائية<select name="autoRoleRoleId"><option value="">— بدون رتبة —</option>${roleOptions(roles,guild.id,cfg.autoRole?.roleId?[cfg.autoRole.roleId]:[])}</select></label><label><input type="checkbox" name="autoRoleIncludeBots" ${cfg.autoRole?.includeBots?'checked':''}> إعطاء الرتبة للبوتات أيضًا</label><div class="wide hint">يجب أن تكون رتبة ZOMBI BOT أعلى من الرتبة المختارة وأن يملك البوت صلاحية Manage Roles.</div></div>
    <div class="card-actions"><button class="btn primary" type="submit" name="_saveSection" value="overview">💾 حفظ إعدادات الرئيسية</button><button class="btn" type="submit" name="forceBotProfile" value="1" ${canBotProfile?'':'disabled'}>🔄 حفظ وإعادة تطبيق بروفايل البوت${canBotProfile?'':' 🔒 Premium'}</button></div>
  </form>

  <section class="panel command-sync"><h2>⚡ Discord Panels & Commands</h2><div class="card-actions"><form method="post" action="/dashboard/${guild.id}/sync-commands"><input type="hidden" name="_csrf" value="${token}"><button class="btn primary">🔄 مزامنة أوامر السيرفر</button></form><form method="post" action="/dashboard/${guild.id}/send/all"><input type="hidden" name="_csrf" value="${token}"><button class="btn">📨 إرسال / تحديث كل اللوحات</button></form></div><h3>💎 تخصيص كل لوحة بشكل مستقل</h3><p class="hint">${canPanelDesign?'اشتراكك يسمح بالتخصيص. افتح أي لوحة وعدّل شكلها ثم أرسل/حدّث اللوحة.':'الخيار مقفول على Free. بعد تفعيل Premium أو Premium+ تستطيع تخصيص كل لوحة.'}</p><div class="stack">${panelCards}</div></section>

  <section class="panel"><h2>🧠 محتوى الألعاب <small>${questionLimit} لكل نوع</small></h2>${lockedNote(canQuestions)}<form method="post" action="/dashboard/${guild.id}/questions"><input type="hidden" name="_csrf" value="${token}"><div class="form-grid"><label class="wide">Quiz — سؤال | جواب<textarea name="quizText" ${disabled(canQuestions)}>${esc(qaText(content.quizQuestions))}</textarea></label><label class="wide">True/False<textarea name="trueFalseText" ${disabled(canQuestions)}>${esc(qaText(content.trueFalseQuestions))}</textarea></label><label class="wide">Word — الحروف | الجواب<textarea name="wordText" ${disabled(canQuestions)}>${esc(wordsText(content.wordQuestions))}</textarea></label><label class="wide">Speed — كلمة بكل سطر<textarea name="speedText" ${disabled(canQuestions)}>${esc((content.speedWords||[]).join('\n'))}</textarea></label><label class="wide">Daily — سؤال | جواب<textarea name="dailyText" ${disabled(canQuestions)}>${esc(qaText(content.dailyQuestions))}</textarea></label></div><button class="btn primary" ${disabled(canQuestions)}>حفظ المحتوى</button></form></section>

  <section class="panel"><h2>🔪 من القاتل <small>${richKillers.length}/${killerLimit}</small></h2>${lockedNote(canQuestions)}<form class="config-card" method="post" action="/dashboard/${guild.id}/killer/add"><input type="hidden" name="_csrf" value="${token}"><h3>+ إضافة قضية</h3><div class="form-grid"><label>العنوان<input name="title" required></label><label>القاتل<input name="killer" required></label><label class="wide">القصة<textarea name="story" required></textarea></label><label>المشتبه بهم — سطر لكل اسم<textarea name="suspects" required></textarea></label><label>الأدلة<textarea name="clues" required></textarea></label><label>3 تلميحات<textarea name="hints" required></textarea></label><label class="wide">شرح الحل<textarea name="answer" required></textarea></label><label><input type="checkbox" name="enabled" checked> مفعلة</label></div><button class="btn">إضافة</button></form><div class="stack">${killerRows}</div></section>

  <section class="panel"><h2>🏴 قوالب مهمات العصابات <small>${Array.isArray(missionTemplates)?missionTemplates.length:0}/${missionLimit}</small></h2><form class="config-card" method="post" action="/dashboard/${guild.id}/gang-missions/add"><input type="hidden" name="_csrf" value="${token}"><h3>+ إضافة مهمة</h3><div class="form-grid"><label>الاسم<input name="name" required></label><label>الصعوبة<select name="difficulty"><option value="hard">صعبة</option><option value="elite">نخبة</option><option value="legendary">أسطورية</option></select></label><label>أقل مشاركين<input type="number" name="minParticipants" value="2" min="2"></label><label><input type="checkbox" name="enabled" checked> مفعلة</label><label class="wide">الوصف<textarea name="description"></textarea></label><label class="wide">المراحل — سطر لكل مرحلة<textarea name="steps" required></textarea></label></div><button class="btn">إضافة</button></form><div class="stack">${missionRows}</div></section>

  <section class="panel"><h2>🏴 العصابات الحالية</h2><div class="table-wrap"><table><thead><tr><th>العصابة</th><th>القائد</th><th>الأعضاء</th><th>النواب</th><th>الخزنة</th><th>المهمات</th><th>تحكم</th></tr></thead><tbody>${gangRows}</tbody></table></div></section>

  <section class="panel"><h2>🎫 أنواع التذاكر <small>${ticketTypes.length}/${ticketLimit}</small></h2><p class="muted">كل عضو يقدر يفتح تذكرة. حدد هنا من يشاهدها ومن يستلمها ومن يتم منشنه أو استدعاؤه.</p><form class="config-card" method="post" action="/dashboard/${guild.id}/tickets/type/add"><input type="hidden" name="_csrf" value="${token}"><div class="form-grid"><label>الاسم<input name="label" required></label><label>Emoji<input name="emoji" value="🎫"></label><label>Category<select name="categoryId">${categories(channels,cfg.channels.ticketCategory)}</select></label><label>Max Open<input type="number" name="maxOpenPerUser" value="1" min="1" max="10"></label><label class="wide">الوصف<textarea name="description"></textarea></label><label class="wide">رسالة الترحيب<textarea name="welcomeMessage"></textarea></label><label>رتب مشاهدة التذكرة<select multiple name="viewRoleIds">${roleOptions(roles,guild.id)}</select></label><label>رتب استلام التذكرة<select multiple name="claimRoleIds">${roleOptions(roles,guild.id)}</select></label><label>رتب المنشن عند الفتح<select multiple name="pingRoleIds">${roleOptions(roles,guild.id)}</select></label><label>رتب زر استدعاء المسؤول<select multiple name="summonRoleIds">${roleOptions(roles,guild.id)}</select></label><label>رتب زر استدعاء الإداري<select multiple name="adminRoleIds">${roleOptions(roles,guild.id)}</select></label><label><input type="checkbox" name="enabled" checked> مفعلة</label></div><h4>أسئلة فتح التذكرة — حتى 5 أسئلة</h4>${ticketQuestionFields('new',[])}<button class="btn">إضافة نوع</button></form><div class="stack">${ticketRows}</div></section>

  <section class="panel"><h2>🛒 متجر الرتب القديم المطوّر <small>${products.length}/${storeLimit}</small></h2><p>القسم + السعر + المميزات + الصورة + Banner + رتب خاصة/إدارة، مثل نظام متجرك القديم.</p><form class="config-card" method="post" action="/dashboard/${guild.id}/store/add"><input type="hidden" name="_csrf" value="${token}"><div class="form-grid"><label>Role<select name="roleId" required><option value="">اختر رتبة</option>${roleOptions(roles,guild.id)}</select></label><label>الاسم<input name="name"></label><label>السعر<input type="number" name="price" min="1" required></label><label>القسم<input name="category" value="رتب الأعضاء"></label><label>Emoji<input name="emoji" value="🏷️"></label><label>الترتيب<input type="number" name="sortOrder" value="10"></label><label>الوصول<select name="accessMode"><option value="everyone">للجميع</option><option value="admins">الإدارة فقط</option><option value="roles">رتب محددة</option></select></label><label>الرتب المسموحة<select multiple name="allowedRoleIds">${roleOptions(roles,guild.id)}</select></label><label class="wide">الوصف<textarea name="description"></textarea></label><label class="wide">المميزات — سطر لكل ميزة<textarea name="features"></textarea></label><label class="wide">رابط الصورة<input name="imageUrl"></label><label class="wide">رابط Banner<input name="bannerUrl"></label><label><input type="checkbox" name="enabled" checked> مفعلة</label></div><button class="btn primary">إضافة رتبة</button></form><div class="stack">${productRows}</div></section>

  <section class="panel"><h2>🔔 Self Roles <small>${items.length}/${roleLimit}</small></h2><form class="config-card" method="post" action="/dashboard/${guild.id}/roles/add"><input type="hidden" name="_csrf" value="${token}"><div class="form-grid"><label>الرتبة<select name="roleId" required><option value="">اختر رتبة</option>${roleOptions(roles,guild.id)}</select></label><label>اسم الزر<input name="label"></label><label>Emoji<input name="emoji" value="🔔"></label><label>اللون<select name="style"><option>Primary</option><option>Secondary</option><option>Success</option><option>Danger</option></select></label></div><button class="btn">إضافة</button></form><div class="stack">${roleRows}</div></section>

  <section class="panel" data-z-page="reactionroles"><h2>⭐ رتب الرياكشن</h2><p class="muted">اكتب الرسالة من الداشبورد، واختر الروم والرتبة والإيموجي. البوت يرسل الرسالة تلقائيًا ويضع عليها الرياكشن، وأي عضو يضغطه يأخذ الرتبة.</p>
    <form class="config-card" method="post" action="/dashboard/${guild.id}/reaction-roles/settings"><input type="hidden" name="_csrf" value="${token}"><div class="form-grid"><label><input type="checkbox" name="enabled" ${cfg.reactionRoles?.enabled!==false?'checked':''}> تشغيل نظام رتب الرياكشن</label><label><input type="checkbox" name="removeOnUnreact" ${cfg.reactionRoles?.removeOnUnreact!==false?'checked':''}> إزالة الرتبة عند إزالة الرياكشن</label></div><button class="btn primary">💾 حفظ إعدادات النظام</button></form>
    <form class="config-card" method="post" action="/dashboard/${guild.id}/reaction-roles/add"><input type="hidden" name="_csrf" value="${token}"><h3>➕ إنشاء رسالة رتب جديدة</h3><div class="form-grid"><label>روم الرسالة<select name="channelId" required><option value="">اختر روم</option>${textChannels(channels,'')}</select></label><label class="wide">نص الرسالة<textarea name="messageContent" maxlength="2000" required placeholder="مثال: اضغط على الرياكشن بالأسفل للحصول على الرتبة..."></textarea></label><label>الرتبة<select name="roleId" required><option value="">اختر رتبة</option>${roleOptions(roles,guild.id)}</select></label><label>الإيموجي من السيرفر<select name="emojiId" required><option value="">اختر إيموجي</option>${emojiOptions(emojis,'')}</select></label><label><input type="checkbox" name="enabled" checked> مفعّل</label></div><div class="hint">ما عاد تحتاج Message ID. بعد الحفظ البوت يرسل النص في الروم المحدد ويضيف الإيموجي تلقائيًا. لازم رتبة البوت تكون أعلى من الرتبة المختارة ويملك Manage Roles وSend Messages وAdd Reactions.</div><button class="btn primary">⭐ إرسال الرسالة وربط الرتبة</button></form>
    <div class="stack">${reactionRoleRows}</div>
  </section>

  <section class="panel server-guide-panel"><h2>🧭 أزرار دليل السيرفر <small>${guideItems.length}/${guideLimit}</small></h2><p>اعمل لوحة اختصارات احترافية؛ كل زر ينقل العضو مباشرة للروم الذي تحدده.</p><form class="config-card" method="post" action="/dashboard/${guild.id}/guide/add"><input type="hidden" name="_csrf" value="${token}"><input type="hidden" name="_returnSection" value="guide"><div class="form-grid"><label>اسم الزر<input name="label" placeholder="القوانين" required></label><label>Emoji<input name="emoji" value="➡️"></label><label>الروم<select name="channelId" required><option value="">اختر روم</option>${textChannels(channels,'')}</select></label><label>الترتيب<input type="number" name="sortOrder" value="10" min="0" max="9999"></label><label><input type="checkbox" name="enabled" checked> مفعّل</label></div><button class="btn primary">➕ إضافة اختصار</button></form><div class="stack">${guideRows}</div></section>

  <section class="panel city-director-panel"><h2>🌆 City Director • 100 حدث مدمج <small>+ ${directorTemplates.length}/${directorTemplateLimit} مخصص</small></h2><p>اختر من 100 حدث جاهز قوي أو أضف أحداثك الخاصة. كل حدث يوزع مهمات نصية حيّة بين الشاتات المفتوحة.</p>${activeDirectorText}<div class="director-actions"><form method="post" action="/dashboard/${guild.id}/city-director/start"><input type="hidden" name="_csrf" value="${token}"><input type="hidden" name="_returnSection" value="director"><select name="templateId"><option value="">🎲 حدث عشوائي</option>${directorTemplateOptions}</select><button class="btn primary">🚨 تشغيل حدث الآن</button></form><form method="post" action="/dashboard/${guild.id}/city-director/stop"><input type="hidden" name="_csrf" value="${token}"><input type="hidden" name="_returnSection" value="director"><button class="btn danger">🛑 إيقاف الحدث الحالي</button></form></div><form class="config-card" method="post" action="/dashboard/${guild.id}/city-director/template/add"><input type="hidden" name="_csrf" value="${token}"><input type="hidden" name="_returnSection" value="director"><div class="form-grid"><label>اسم الحدث<input name="name" required></label><label>Emoji<input name="emoji" value="🌆"></label><label>الصعوبة<select name="difficulty"><option value="normal">عادي</option><option value="hard">صعب</option><option value="elite">نخبة</option><option value="legendary">أسطوري</option></select></label><label>مضاعف الهدف<input type="number" step="0.05" min="0.25" max="5" name="goalMultiplier" value="1"></label><label><input type="checkbox" name="enabled" checked> مفعّل</label><label class="wide">الوصف<textarea name="description" required></textarea></label></div><button class="btn primary">➕ إضافة حدث</button></form><div class="stack">${directorRows}</div></section>

  <section class="panel rules-system-panel"><h2>📜 ZOMBI Rules Center</h2><p>أنشئ أنواع قوانين متعددة. العضو يختار النوع من لوحة القوانين، ويظهر النص له برسالة خاصة Ephemeral لا يراها غيره.</p>
    <form class="config-card" method="post" action="/dashboard/${guild.id}/rules/settings"><input type="hidden" name="_csrf" value="${token}"><input type="hidden" name="_returnSection" value="rules"><div class="form-grid"><label><input type="checkbox" name="enabled" ${cfg.rules?.enabled!==false?'checked':''}> تفعيل نظام القوانين</label><label>شات لوحة القوانين<select name="channelId">${textChannels(channels,cfg.rules?.channelId||'')}</select></label><label>عنوان اللوحة<input name="title" value="${esc(cfg.rules?.title||'📜 ZOMBI • قوانين السيرفر')}"></label><label>لون اللوحة<input type="color" name="color" value="${/^#[0-9a-f]{6}$/i.test(String(cfg.rules?.color||''))?esc(cfg.rules.color):'#E11D48'}"></label><label class="wide">وصف اللوحة<textarea name="description">${esc(cfg.rules?.description||'')}</textarea></label><label class="wide">Logo صغير اختياري<input type="url" name="logoUrl" value="${esc(cfg.rules?.logoUrl||'')}" placeholder="https://.../logo.png"></label><label class="wide">GIF / Banner وسط اللوحة<input type="url" name="bannerUrl" value="${esc(cfg.rules?.bannerUrl||'')}" placeholder="اتركه فارغًا لاستخدام بانر ZOMBI الافتراضي"></label><label class="wide">Footer<input name="footer" value="${esc(cfg.rules?.footer||'ZOMBI • RULES CENTER')}"></label></div><div class="card-actions"><button class="btn primary">💾 حفظ إعدادات القوانين</button><button class="btn" formaction="/dashboard/${guild.id}/send/rules">📨 إرسال / تحديث اللوحة</button></div></form>
    <h3>➕ إضافة نوع قوانين</h3><form class="config-card" method="post" action="/dashboard/${guild.id}/rules/add"><input type="hidden" name="_csrf" value="${token}"><input type="hidden" name="_returnSection" value="rules"><div class="form-grid"><label>اسم النوع<input name="label" placeholder="قوانين المدينة" required></label><label>Emoji<input name="emoji" value="📜"></label><label>الترتيب<input type="number" name="sortOrder" value="10" min="0" max="9999"></label><label><input type="checkbox" name="enabled" checked> مفعّل</label><label class="wide">وصف قصير<input name="description" maxlength="100" placeholder="القوانين العامة داخل المدينة"></label><label class="wide">نص القوانين<textarea name="content" rows="12" maxlength="12000" placeholder="1. القانون الأول...
2. القانون الثاني..." required></textarea></label></div><button class="btn">➕ إضافة النوع</button></form><div class="stack">${rulesRows}</div></section>

  <section class="panel event-system-panel"><h2>🎉 Event / ايفنت</h2><p>نظام نقاط فعاليات يدعم أكثر من شات حسب الخطة، مع رتب محددة. الترتيب يظهر من الأعلى للأقل، وتقدر تضيف أوامر مثل <code>-انشاء</code> وتحدد لكل أمر نقاط وZOM من الداشبورد.</p>
    <form class="config-card" method="post" action="/dashboard/${guild.id}/event/settings"><input type="hidden" name="_csrf" value="${token}"><input type="hidden" name="_returnSection" value="event"><div class="form-grid">
      <label><input type="checkbox" name="enabled" ${evt.enabled?'checked':''}> تفعيل نظام الأيفنت</label>
      <label class="wide event-channels-field">شاتات الأيفنت <span class="event-plan-limit">${esc(eventPlan)} • الحد ${eventChannelsMax}</span><select multiple size="7" name="eventChannelIds" data-event-channel-select data-max="${eventChannelsMax}">${textChannelMultiOptions(channels,evt.channelIds)}</select><small>اختار أكثر من شات باستخدام Ctrl/⌘. الأوامر لن تعمل خارج الشاتات المحددة. <b data-event-channel-count>${Math.min(evt.channelIds.length,eventChannelsMax)}</b>/${eventChannelsMax} محدد.</small></label>
      <label>لوق الأيفنت<select name="logEvent">${textChannels(channels,cfg.channels.logEvent||'')}</select></label>
      <label>اسم النقطة<input name="pointLabel" value="${esc(evt.pointLabel)}" placeholder="نقطة"></label>
      <label>أمر عرض الترتيب<input name="leaderboardCommand" value="${esc(evt.leaderboardCommand)}" placeholder="نقاط"></label>
      <label>أمر الترسيت<input name="resetCommand" value="${esc(evt.resetCommand)}" placeholder="ترسيت"></label>
      <label>أمر تسجيل الإيفنت<input name="eventCommand" value="${esc(evt.eventCommand)}" placeholder="ايفنت"></label>
      <label>نقاط كل إيفنت<input type="number" name="eventPoints" value="${evt.eventPoints}" min="1" max="1000000"></label>
      <label>عدد الأشخاص بالترتيب<input type="number" name="leaderboardLimit" value="${evt.leaderboardLimit}" min="3" max="25"></label>
      <label><input type="checkbox" name="publicLeaderboard" ${evt.publicLeaderboard?'checked':''}> أي عضو يقدر يكتب «${esc(evt.leaderboardCommand)}»</label>
      <label><input type="checkbox" name="directPointsEnabled" ${evt.directPointsEnabled?'checked':''}> تفعيل إضافة/خصم النقاط بصيغة 1+ و1-</label>
      <label class="wide">الرتب المسموح لها إضافة/خصم/ترسيت واستخدام أوامر الأيفنت<select multiple size="8" name="staffRoleIds">${roleOptions(roles,guild.id,evt.staffRoleIds)}</select><small>تقدر تحدد أكثر من رتبة. Administrator وManage Server مسموح لهم تلقائيًا أيضًا.</small></label>
    </div><button class="btn primary">💾 حفظ إعدادات الأيفنت</button></form>

    <form class="config-card" style="margin-top:18px" method="post" action="/dashboard/${guild.id}/event/panels"><input type="hidden" name="_csrf" value="${token}"><input type="hidden" name="_returnSection" value="event"><h3>🧩 تحكم لوحات الإدارة من نظام الأيفنت</h3><p class="hint">حدد من هنا شات لوحة الإدارة، طلب الفعالية، والإجازة بدون الانتقال لقسم آخر. نفس القيم تتزامن مع قسم إدارة الطاقم.</p><div class="form-grid"><label>لوحة الإدارة / الدوام<select name="dutyPanelChannelId"><option value="">— اختر الشات —</option>${textChannels(channels,staff.duty.panelChannelId)}</select></label><label>تقارير الإدارة / الدوام<select name="dutyReportChannelId"><option value="">— اختر الشات —</option>${textChannels(channels,staff.duty.reportChannelId)}</select></label><label>لوحة طلب الفعالية<select name="eventPanelChannelId"><option value="">— اختر الشات —</option>${textChannels(channels,staff.event.panelChannelId)}</select></label><label>استقبال طلبات الفعالية<select name="eventReviewChannelId"><option value="">— اختر الشات —</option>${textChannels(channels,staff.event.reviewChannelId)}</select></label><label>لوحة طلب الإجازة<select name="leavePanelChannelId"><option value="">— اختر الشات —</option>${textChannels(channels,staff.leave.panelChannelId)}</select></label><label>استقبال طلبات الإجازة<select name="leaveReviewChannelId"><option value="">— اختر الشات —</option>${textChannels(channels,staff.leave.reviewChannelId)}</select></label></div><button class="btn primary">💾 حفظ شاتات اللوحات</button></form>

    <form class="config-card" style="margin-top:18px" method="post" action="/dashboard/${guild.id}/event/decision-settings"><input type="hidden" name="_csrf" value="${token}"><input type="hidden" name="_returnSection" value="event"><h3>✅❌ قبول / رفض الإيفنت</h3><p class="hint">حدد الرتب التي تستطيع قبول أو رفض الشخص. الأوامر تعمل داخل شاتات الإيفنت المحددة وترسل النتيجة للشخص على الخاص.</p><div class="form-grid"><label><input type="checkbox" name="decisionEnabled" ${evt.decisionEnabled?'checked':''}> تفعيل نظام القبول والرفض</label><label>أمر القبول<input name="acceptCommand" value="${esc(evt.acceptCommand)}" placeholder="قبول ايفنت"></label><label>أمر الرفض<input name="rejectCommand" value="${esc(evt.rejectCommand)}" placeholder="رفض ايفنت"></label><label class="wide">الرتب المسموح لها بالقبول والرفض<select multiple size="8" name="decisionStaffRoleIds">${roleOptions(roles,guild.id,evt.decisionStaffRoleIds)}</select><small>تقدر تحدد أكثر من رتبة. Administrator وManage Server مسموح لهم تلقائيًا.</small></label><label class="wide">الرتب التي يأخذها العضو عند القبول<select multiple size="8" name="acceptedRoleIds">${roleOptions(roles,guild.id,evt.acceptedRoleIds||[])}</select><small>تُضاف فقط عند تنفيذ أمر القبول داخل هذا السيرفر.</small></label><label class="wide">رسالة القبول على الخاص<textarea name="acceptMessage" maxlength="1000">${esc(evt.acceptMessage)}</textarea><small>تقدر تستخدم <code>{user}</code> لاسم الشخص و<code>{mention}</code> للمنشن.</small></label><label class="wide">رسالة الرفض على الخاص<textarea name="rejectMessage" maxlength="1000">${esc(evt.rejectMessage)}</textarea><small>تقدر تستخدم <code>{user}</code> لاسم الشخص و<code>{mention}</code> للمنشن.</small></label></div><button class="btn primary">💾 حفظ قبول / رفض الإيفنت</button></form>

    <form class="config-card" style="margin-top:18px" method="post" action="/dashboard/${guild.id}/event/promotion-settings"><input type="hidden" name="_csrf" value="${token}"><input type="hidden" name="_returnSection" value="event"><h3>📈 نقاط الترقية — نظام منفصل عن نقاط الإيفنت</h3><p class="hint">هذه النقاط مستقلة 100% عن نقاط الإيفنت وXP وZOM. أمر <code>${esc(evt.promotionCommand)}</code> يضيف نقاط الترقية فقط.</p>
      <div class="form-grid">
        <label><input type="checkbox" name="promotionEnabled" ${evt.promotionEnabled?'checked':''}> تفعيل نظام نقاط الترقية</label>
        <label>أمر الترقية<input name="promotionCommand" value="${esc(evt.promotionCommand)}" placeholder="ترقية"></label>
        <label>نقاط كل استخدام<input type="number" name="promotionPoints" value="${evt.promotionPoints}" min="1" max="1000000"></label>
        <label>حد الترقية<input type="number" name="promotionThreshold" value="${evt.promotionThreshold}" min="1" max="1000000000"></label>
        <label>شات أمر الترقية<select name="promotionCommandChannelId">${textChannels(channels,evt.promotionCommandChannelId||'')}</select></label>
        <label>شات إشعار الوصول للترقية<select name="promotionNotifyChannelId">${textChannels(channels,evt.promotionNotifyChannelId||'')}</select></label>
        <label>رتبة مسؤول الترقية<select name="promotionNotifyRoleId"><option value="">— بدون رتبة —</option>${roleOptions(roles,guild.id,evt.promotionNotifyRoleId?[evt.promotionNotifyRoleId]:[])}</select></label>
        <label class="wide">الرتب المسموح لها باستخدام أمر الترقية<select multiple size="8" name="promotionStaffRoleIds">${roleOptions(roles,guild.id,evt.promotionStaffRoleIds)}</select><small>يمكن تحديد أكثر من رتبة. Administrator وManage Server مسموح لهم تلقائيًا.</small></label>
      </div><button class="btn primary">💾 حفظ إعدادات الترقية</button>
    </form>


    <div class="event-help-grid">
      <article class="config-card compact-card"><h3>➕ إضافة نقاط</h3><code>1+ @العضو نقاط</code><p>يضيف نقطة. تقدر تغيّر الرقم لأي كمية.</p></article>
      <article class="config-card compact-card"><h3>➖ خصم نقاط</h3><code>1- @العضو نقاط</code><p>يخصم نقطة من الشخص.</p></article>
      <article class="config-card compact-card"><h3>🏆 الترتيب</h3><code>${esc(evt.leaderboardCommand)}</code><p>يعرض النقاط من الأعلى إلى الأقل. ومع منشن يعرض نقاط عضو واحد.</p></article>
      <article class="config-card compact-card"><h3>♻️ الترسيت</h3><code>${esc(evt.resetCommand)}</code><p>يصفّر الكل ويبدأ موسم جديد. ومع منشن يصفّر شخصًا واحدًا.</p></article>
      <article class="config-card compact-card"><h3>🎟️ تسجيل إيفنت</h3><code>${esc(evt.eventCommand)} @العضو</code><p>يضيف تلقائيًا <b>${evt.eventPoints}</b> ${esc(evt.pointLabel)} إلى نقاط الإيفنت فقط.</p></article><article class="config-card compact-card"><h3>📈 نقاط الترقية</h3><code>${esc(evt.promotionCommand)} @العضو</code><p>يضيف <b>${evt.promotionPoints}</b> نقطة ترقية مستقلة ويعرض الرصيد الحالي من <b>${evt.promotionThreshold}</b>.</p></article><article class="config-card compact-card"><h3>✅ قبول إيفنت</h3><code>${esc(evt.acceptCommand)} @العضو</code><p>يرسل رسالة القبول للشخص على الخاص.</p></article><article class="config-card compact-card"><h3>❌ رفض إيفنت</h3><code>${esc(evt.rejectCommand)} @العضو</code><p>يرسل رسالة الرفض للشخص على الخاص.</p></article>
    </div>

    <h3>⚡ أوامر الأيفنت المخصصة</h3><p class="hint">مثال: اعمل أمر <code>-انشاء</code> وخليه يضيف +1 نقطة و250 ZOM للشخص اللي تعمل له منشن. كل الأوامر تعمل فقط داخل شاتات الأيفنت المحددة وللرتب المحددة.</p>
    <form class="config-card" method="post" action="/dashboard/${guild.id}/event/actions/add"><input type="hidden" name="_csrf" value="${token}"><input type="hidden" name="_returnSection" value="event"><div class="form-grid"><label>الأمر<input name="command" value="-انشاء" placeholder="-انشاء" required></label><label>اسم الإجراء<input name="label" value="إنشاء"></label><label>نقاط الأيفنت<input type="number" name="points" value="1" min="-1000000" max="1000000"></label><label>ZOM يضاف<input type="number" name="zom" value="0" min="0" max="1000000000"></label><label>المستهدف<select name="targetMode"><option value="mention">لازم منشن عضو</option><option value="self">صاحب الأمر نفسه</option><option value="either">المنشن أو صاحب الأمر</option></select></label><label><input type="checkbox" name="enabled" checked> مفعّل</label><label class="wide">رد إضافي اختياري<textarea name="response" placeholder="✅ تم تسجيل {user} • نقاطه الآن {points}"></textarea></label></div><button class="btn">➕ إضافة أمر</button></form>
    <div class="stack">${eventActionRows}</div>

    <h3>🧾 تعديل نقاط عضو من الداشبورد</h3><form class="inline-form event-member-form" method="post" action="/dashboard/${guild.id}/event/member"><input type="hidden" name="_csrf" value="${token}"><input type="hidden" name="_returnSection" value="event"><input name="userId" placeholder="User ID" required><select name="action"><option value="add">إضافة</option><option value="remove">خصم</option><option value="set">تعيين</option><option value="reset">تصفير الشخص</option></select><input type="number" name="amount" value="1" min="0" max="1000000000"><button class="btn">تنفيذ</button></form>
    <form method="post" action="/dashboard/${guild.id}/event/reset" onsubmit="return confirm('تصفير جميع نقاط الأيفنت وبدء موسم جديد؟')"><input type="hidden" name="_csrf" value="${token}"><input type="hidden" name="_returnSection" value="event"><button class="btn danger">♻️ ترسيت جميع النقاط</button></form>

    <h3>📈 إدارة نقاط الترقية لشخص واحد</h3><form class="inline-form event-member-form" method="post" action="/dashboard/${guild.id}/event/promotion-member"><input type="hidden" name="_csrf" value="${token}"><input type="hidden" name="_returnSection" value="event"><input name="userId" placeholder="User ID" required><select name="action"><option value="add">إضافة</option><option value="remove">خصم</option><option value="set">تعيين</option><option value="reset">تصفير هذا الشخص فقط</option></select><input type="number" name="amount" value="1" min="0" max="1000000000"><button class="btn">تنفيذ</button></form>
    <h3>📊 نقاط الترقية الحالية</h3><div class="table-wrap"><table><thead><tr><th>#</th><th>User ID</th><th>نقاط الترقية</th><th>المضاف</th><th>المخصوم</th><th>تم إشعار الحد</th></tr></thead><tbody>${promotionTopRows}</tbody></table></div>
    <h3>📜 آخر عمليات نقاط الترقية</h3><div class="table-wrap"><table><thead><tr><th>الوقت</th><th>النوع</th><th>المنفّذ</th><th>المستهدف</th><th>التغيير</th><th>الأمر</th></tr></thead><tbody>${promotionHistoryRows}</tbody></table></div>

    <h3>🏆 الترتيب الحالي — الموسم ${evtState.season}</h3><div class="table-wrap"><table><thead><tr><th>#</th><th>User ID</th><th>النقاط</th><th>المضاف</th><th>المخصوم</th><th>ZOM من الأيفنت</th></tr></thead><tbody>${eventTopRows}</tbody></table></div>
    <h3>📜 آخر عمليات الأيفنت</h3><div class="table-wrap"><table><thead><tr><th>الوقت</th><th>النوع</th><th>المنفّذ</th><th>المستهدف</th><th>النقاط</th><th>ZOM</th><th>الأمر</th></tr></thead><tbody>${eventHistoryRows}</tbody></table></div>
  </section>


  <section class="panel" data-z-page="staff-stats"><h2>📊 إحصائيات الإدارة</h2><form id="staff-stats-filter" class="form-grid"><label>الإداري (ID أو منشن)<input name="userId" placeholder="اختياري — عرض أصحاب السجلات"></label><label>الفترة<select name="period"><option value="all">كل السجل المحفوظ</option><option value="week">آخر 7 أيام</option><option value="month">آخر 30 يومًا</option></select></label><button class="btn primary">عرض / تحديث</button></form><p class="hint">تظهر الرتب المحددة في إعدادات ملفات الإدارة فقط. الرسائل والفويس للشفت كاملًا؛ ساعات الدوام حسب الفترة. البيانات القديمة حسب السجل المحفوظ.</p><div id="staff-stats-result" aria-live="polite"></div></section>
  <section class="panel staff-management-panel" id="staff-management"><h2>🛡️ إدارة الطاقم — الدوام والفعاليات والإجازات</h2><p class="hint">كل نظام له <b>شات لوحة ثابتة</b> وشات منفصل لاستقبال التقارير أو الطلبات. لوحات ZOMBI تستخدم الشعار والبنر المتحرك تلقائيًا.</p>
    <div class="stack">
      <form class="config-card" method="post" action="/dashboard/${guild.id}/staff-management/save"><input type="hidden" name="_csrf" value="${token}"><input type="hidden" name="_returnSection" value="staff-management"><input type="hidden" name="kind" value="insights"><h3>📊 ملفات الإدارة والتقييم والترقيات</h3><div class="form-grid"><label><input type="checkbox" name="enabled" ${staff.insights.enabled?'checked':''}> تفعيل ملفات الإدارة</label><label>أمر إحصائيات الإدارة<input name="command" maxlength="40" value="${esc(staff.insights.command||'احصائيات ادارة')}" required></label><label>شات أمر إحصائيات الإدارة<select name="commandChannelId"><option value="">— اختر الشات —</option>${textChannels(channels,staff.insights.commandChannelId)}</select></label><label class="wide">رتب الأشخاص الذين يظهر لهم ملف إداري<select multiple size="6" name="staffRoleIds">${roleOptions(roles,guild.id,staff.insights.staffRoleIds)}</select></label><label class="wide">رتب المسؤولين المسموح لهم مشاهدة الملفات<select multiple size="6" name="viewerRoleIds">${roleOptions(roles,guild.id,staff.insights.viewerRoleIds)}</select></label><label>نقاط لكل ساعة دوام كاملة<input type="number" name="pointsPerHour" min="0" max="1000" value="${staff.insights.pointsPerHour}"></label><label>نقاط لكل تكت مغلق ومستلم<input type="number" name="ticketPoints" min="0" max="1000" value="${staff.insights.ticketPoints}"></label><label>نقاط لكل نجمة تقييم<input type="number" name="ratingPoints" min="0" max="1000" value="${staff.insights.ratingPoints}"></label><label>حد نقاط طلب الترقية<input type="number" name="threshold" min="1" value="${staff.insights.threshold}"></label><label><input type="checkbox" name="promotionEnabled" ${staff.insights.promotionEnabled?'checked':''}> إرسال طلب ترقية عند بلوغ الحد</label><label>شات مراجعة الترقيات<select name="promotionChannelId"><option value="">— اختر الشات —</option>${textChannels(channels,staff.insights.promotionChannelId)}</select></label><label class="wide">الرتب المسموح لها اعتماد أو رفض الترقية<select multiple size="6" name="promotionRoleIds">${roleOptions(roles,guild.id,staff.insights.promotionRoleIds)}</select></label><label>رتبة تمنح عند اعتماد الترقية<select name="promotionTargetRoleId"><option value="">— تسجيل القرار فقط —</option>${roleOptions(roles,guild.id,staff.insights.promotionTargetRoleId?[staff.insights.promotionTargetRoleId]:[])}</select></label><label><input type="checkbox" name="ratingEnabled" ${staff.insights.ratingEnabled?'checked':''}> تقييم دعم التكتات على الخاص</label><label><input type="checkbox" name="transcriptEnabled" ${staff.insights.transcriptEnabled?'checked':''}> إرسال نسخة التكت لصاحبه ولشات لوق التكتات</label></div><p class="hint">العرض في Discord لا يعمل تلقائيًا مع الرسائل. استخدم فقط: <b>احصائيات ادارة</b> أو <b>احصائيات ادارة @الشخص</b> داخل الشات المحدد. ويمكن إضافة أسبوعي أو شهري. تتبع النشاط يبقى بالخلفية بدون رسائل مزعجة.</p><div class="card-actions"><button class="btn primary">💾 حفظ الإعدادات</button></div></form>
<form class="config-card" method="post" action="/dashboard/${guild.id}/staff-management/save"><input type="hidden" name="_csrf" value="${token}"><input type="hidden" name="_returnSection" value="staff-management"><input type="hidden" name="kind" value="duty"><h3>🕐 دوام الإدارة</h3><div class="form-grid"><label><input type="checkbox" name="enabled" ${staff.duty.enabled?'checked':''}> تفعيل النظام</label><label>شات لوحة الدوام<select name="panelChannelId" required>${textChannels(channels,staff.duty.panelChannelId)}</select></label><label>شات تقارير الدوام<select name="targetChannelId" required>${textChannels(channels,staff.duty.reportChannelId)}</select></label><label class="wide">رتب الإدارة المسموح لها بالدوام<select multiple size="6" name="roleIds">${roleOptions(roles,guild.id,staff.duty.allowedRoleIds)}</select></label><label>رتبة On Duty<select name="extraRoleId"><option value="">— بدون رتبة —</option>${roleOptions(roles,guild.id,staff.duty.onDutyRoleId?[staff.duty.onDutyRoleId]:[])}</select></label><label>اعتبار الإداري خامل بعد (دقيقة)<input type="number" name="idleMinutes" min="5" max="1440" value="${Number(staff.duty.idleMinutes||45)}"></label><label><input type="checkbox" name="autoStopIdle" ${staff.duty.autoStopIdle?'checked':''}> إيقاف الدوام تلقائيًا عند الخمول</label><label class="wide">🖼️ Banner لوحة الدوام<input type="url" name="bannerUrl" value="${esc(staff.duty.bannerUrl||'')}" placeholder="https://.../banner.png"></label><label class="wide">🔹 Logo / Thumbnail<input type="url" name="thumbnailUrl" value="${esc(staff.duty.thumbnailUrl||'')}" placeholder="https://.../logo.png"></label></div><div class="card-actions"><button class="btn primary">💾 حفظ</button><button class="btn" formaction="/dashboard/${guild.id}/staff-management/send">📨 إرسال / تحديث لوحة الدوام</button></div></form>

      <form class="config-card" method="post" action="/dashboard/${guild.id}/staff-management/save"><input type="hidden" name="_csrf" value="${token}"><input type="hidden" name="_returnSection" value="staff-management"><input type="hidden" name="kind" value="event"><h3>🎉 طلب فعالية</h3><div class="form-grid"><label><input type="checkbox" name="enabled" ${staff.event.enabled?'checked':''}> تفعيل النظام</label><label>شات لوحة طلب الفعالية<select name="panelChannelId" required>${textChannels(channels,staff.event.panelChannelId)}</select></label><label>شات استقبال طلبات الفعاليات<select name="targetChannelId" required>${textChannels(channels,staff.event.reviewChannelId)}</select></label><label class="wide">رتب القبول والرفض<select multiple size="6" name="roleIds">${roleOptions(roles,guild.id,staff.event.reviewerRoleIds)}</select></label><label class="wide">الرتب التي يأخذها صاحب طلب الفعالية عند القبول<select multiple size="6" name="acceptedRoleIds">${roleOptions(roles,guild.id,staff.event.acceptedRoleIds||[])}</select></label><label class="wide">رسالة القبول الخاصة<textarea name="acceptMessage">${esc(staff.event.acceptMessage)}</textarea></label><label class="wide">رسالة الرفض الخاصة<textarea name="rejectMessage">${esc(staff.event.rejectMessage)}</textarea></label><label class="wide">🖼️ Banner لوحة طلب الفعالية<input type="url" name="bannerUrl" value="${esc(staff.event.bannerUrl||'')}" placeholder="https://.../banner.png"></label><label class="wide">🔹 Logo / Thumbnail<input type="url" name="thumbnailUrl" value="${esc(staff.event.thumbnailUrl||'')}" placeholder="https://.../logo.png"></label></div><div class="warn small">📌 زر <b>طلب فعالية</b> يكون أسفل اللوحة فقط. بعد تعبئة النموذج ينرسل Embed منفصل لشات الاستقبال مع أزرار القبول والرفض.</div><div class="card-actions"><button class="btn primary">💾 حفظ</button><button class="btn" formaction="/dashboard/${guild.id}/staff-management/send">📨 إرسال / تحديث لوحة الفعالية</button></div></form>

      <form class="config-card" method="post" action="/dashboard/${guild.id}/staff-management/save"><input type="hidden" name="_csrf" value="${token}"><input type="hidden" name="_returnSection" value="staff-management"><input type="hidden" name="kind" value="adminDecision"><h3>✅ قبول ورفض المتقدمين للإدارة</h3><div class="form-grid"><label><input type="checkbox" name="enabled" ${staff.adminDecision.enabled?'checked':''}> تفعيل النظام</label><label>شات أوامر قبول ورفض تقديم الإدارة<select name="commandChannelId" required>${textChannels(channels,staff.adminDecision.commandChannelId)}</select></label><label class="wide">الرتب المسموح لها بقبول ورفض المتقدمين<select multiple size="6" name="roleIds">${roleOptions(roles,guild.id,staff.adminDecision.reviewerRoleIds)}</select></label><label class="wide">الرتب التي يأخذها المتقدم عند القبول<select multiple size="6" name="acceptedRoleIds">${roleOptions(roles,guild.id,staff.adminDecision.acceptedRoleIds||[])}</select></label><label>أمر القبول<input name="acceptCommand" maxlength="40" value="${esc(staff.adminDecision.acceptCommand)}" required></label><label>أمر الرفض<input name="rejectCommand" maxlength="40" value="${esc(staff.adminDecision.rejectCommand)}" required></label><label class="wide">رسالة القبول الخاصة<textarea name="acceptMessage">${esc(staff.adminDecision.acceptMessage)}</textarea></label><label class="wide">رسالة الرفض الخاصة<textarea name="rejectMessage">${esc(staff.adminDecision.rejectMessage)}</textarea></label></div><p class="hint">استخدم الأمر مع منشن الشخص لإرسال قرار تقديم الإدارة على الخاص. {user} اسم الشخص، {mention} منشنه، {server} اسم السيرفر.</p><div class="card-actions"><button class="btn primary">💾 حفظ</button></div></form>
<form class="config-card" method="post" action="/dashboard/${guild.id}/staff-management/save"><input type="hidden" name="_csrf" value="${token}"><input type="hidden" name="_returnSection" value="staff-management"><input type="hidden" name="kind" value="leave"><h3>🏖️ طلب إجازة</h3><div class="form-grid"><label><input type="checkbox" name="enabled" ${staff.leave.enabled?'checked':''}> تفعيل النظام</label><label>شات لوحة طلب الإجازة<select name="panelChannelId" required>${textChannels(channels,staff.leave.panelChannelId)}</select></label><label>شات استقبال طلبات الإجازة<select name="targetChannelId" required>${textChannels(channels,staff.leave.reviewChannelId)}</select></label><label class="wide">رتب القبول والرفض<select multiple size="6" name="roleIds">${roleOptions(roles,guild.id,staff.leave.reviewerRoleIds)}</select></label><label><input type="checkbox" name="expiryNotify" ${staff.leave.expiryNotify?'checked':''}> إرسال خاص عند انتهاء الإجازة</label><label class="wide">رسالة انتهاء الإجازة — {server} اسم السيرفر، {user} الشخص<textarea name="expiryMessage">${esc(staff.leave.expiryMessage)}</textarea></label><label>رتبة الإجازة عند القبول<select name="extraRoleId"><option value="">— بدون رتبة —</option>${roleOptions(roles,guild.id,staff.leave.leaveRoleId?[staff.leave.leaveRoleId]:[])}</select></label><label class="wide">رسالة القبول الخاصة<textarea name="acceptMessage">${esc(staff.leave.acceptMessage)}</textarea></label><label class="wide">رسالة الرفض الخاصة<textarea name="rejectMessage">${esc(staff.leave.rejectMessage)}</textarea></label><label class="wide">🖼️ Banner لوحة الإجازة<input type="url" name="bannerUrl" value="${esc(staff.leave.bannerUrl||'')}" placeholder="https://.../banner.png"></label><label class="wide">🔹 Logo / Thumbnail<input type="url" name="thumbnailUrl" value="${esc(staff.leave.thumbnailUrl||'')}" placeholder="https://.../logo.png"></label></div><div class="warn small">📌 زر <b>طلب إجازة</b> يكون أسفل اللوحة فقط، والطلب نفسه ينرسل Embed إلى شات الاستقبال المحدد.</div><div class="card-actions"><button class="btn primary">💾 حفظ</button><button class="btn" formaction="/dashboard/${guild.id}/staff-management/send">📨 إرسال / تحديث لوحة الإجازة</button></div></form><form class="config-card" method="post" action="/dashboard/${guild.id}/staff-management/save"><input type="hidden" name="_csrf" value="${token}"><input type="hidden" name="_returnSection" value="staff-management"><input type="hidden" name="kind" value="eventLeave"><h3>🏖️ إجازة الإيفنت</h3><div class="form-grid"><label><input type="checkbox" name="enabled" ${staff.eventLeave.enabled?'checked':''}> تفعيل النظام</label><label>شات لوحة طلب الإجازة<select name="panelChannelId" required>${textChannels(channels,staff.eventLeave.panelChannelId)}</select></label><label>شات استقبال طلبات الإجازة<select name="targetChannelId" required>${textChannels(channels,staff.eventLeave.reviewChannelId)}</select></label><label class="wide">رتب القبول والرفض<select multiple size="6" name="roleIds">${roleOptions(roles,guild.id,staff.eventLeave.reviewerRoleIds)}</select></label><label><input type="checkbox" name="expiryNotify" ${staff.eventLeave.expiryNotify?'checked':''}> إرسال خاص عند انتهاء الإجازة</label><label class="wide">رسالة انتهاء الإجازة — {server} اسم السيرفر، {user} الشخص<textarea name="expiryMessage">${esc(staff.eventLeave.expiryMessage)}</textarea></label><label>رتبة الإجازة عند القبول<select name="extraRoleId"><option value="">— بدون رتبة —</option>${roleOptions(roles,guild.id,staff.eventLeave.leaveRoleId?[staff.eventLeave.leaveRoleId]:[])}</select></label><label class="wide">رسالة القبول الخاصة<textarea name="acceptMessage">${esc(staff.eventLeave.acceptMessage)}</textarea></label><label class="wide">رسالة الرفض الخاصة<textarea name="rejectMessage">${esc(staff.eventLeave.rejectMessage)}</textarea></label><label class="wide">🖼️ Banner لوحة إجازة الإيفنت<input type="url" name="bannerUrl" value="${esc(staff.eventLeave.bannerUrl||'')}" placeholder="https://.../banner.png"></label><label class="wide">🔹 Logo / Thumbnail<input type="url" name="thumbnailUrl" value="${esc(staff.eventLeave.thumbnailUrl||'')}" placeholder="https://.../logo.png"></label></div><div class="warn small">📌 زر <b>طلب إجازة</b> يكون أسفل اللوحة فقط، والطلب نفسه ينرسل Embed إلى شات الاستقبال المحدد.</div><div class="card-actions"><button class="btn primary">💾 حفظ</button><button class="btn" formaction="/dashboard/${guild.id}/staff-management/send">📨 إرسال / تحديث لوحة الإجازة</button></div></form>
    </div>
  </section>

  <section class="panel applications-panel"><h2>📝 نظام التقديمات</h2><p class="hint">أنشئ أكثر من تقديم، وكل تقديم له شات لوحة وشات استقبال وأسئلة ورتب مراجعة خاصة. يمكنك إرسال اللوحة إلى شاتها مباشرة.</p><form class="config-card" method="post" action="/dashboard/${guild.id}/applications/add"><input type="hidden" name="_csrf" value="${token}"><input type="hidden" name="_returnSection" value="applications"><h3>➕ إنشاء تقديم جديد</h3><div class="form-grid"><label>اسم التقديم<input name="title" maxlength="80" placeholder="تقديم إدارة" required></label><label>Emoji<input name="emoji" maxlength="16" value="📝"></label><label>اسم زر التقديم<input name="buttonLabel" maxlength="80" value="فتح التقديم"></label><label>Cooldown بالساعات<input type="number" name="cooldownHours" min="0" max="8760" value="0"></label><label>شات لوحة التقديم<select name="panelChannelId" required><option value="">اختر شات</option>${textChannels(channels,'')}</select></label><label>شات استقبال الطلبات<select name="reviewChannelId" required><option value="">اختر شات</option>${textChannels(channels,'')}</select></label><label class="wide">رتب مراجعة الطلبات<select multiple size="5" name="reviewerRoleIds">${roleOptions(roles,guild.id)}</select></label><label>رتبة عند القبول<select name="acceptedRoleId"><option value="">— بدون رتبة —</option>${roleOptions(roles,guild.id)}</select></label><label><input type="checkbox" name="enabled" checked> التقديم مفتوح</label><label class="wide">وصف اللوحة<textarea name="description">اضغط الزر بالأسفل لفتح نموذج التقديم.</textarea></label><label class="wide">🖼️ رابط Banner اللوحة<input type="url" name="bannerUrl" placeholder="https://.../banner.png"></label><label class="wide">🔹 رابط الصورة المصغرة / Logo<input type="url" name="thumbnailUrl" placeholder="https://.../logo.png"></label><label class="wide">رسالة القبول الخاصة<textarea name="acceptMessage">✅ تم قبول طلبك. نتمنى لك التوفيق.</textarea></label><label class="wide">رسالة الرفض الخاصة<textarea name="rejectMessage">❌ تم رفض طلبك. نتمنى لك التوفيق وتحسين طلبك مستقبلاً.</textarea></label></div><h4>أسئلة النموذج</h4>${applicationQuestionFields('new',[{label:'اسمك + عمرك',style:'short',required:true},{label:'اذكر خبراتك بالتفصيل',style:'paragraph',required:true},{label:'سبب التقديم',style:'paragraph',required:true}])}<button class="btn primary">➕ إنشاء التقديم</button></form><div class="stack">${applicationRows}</div></section>

  <section class="panel"><h2>🧾 إدارة أرصدة الأعضاء ${lockedNote(canEconomyAdmin)}</h2><form class="inline-form" method="post" action="/dashboard/${guild.id}/economy/user"><input type="hidden" name="_csrf" value="${token}"><input name="userId" placeholder="User ID" required ${disabled(canEconomyAdmin)}><select name="account" ${disabled(canEconomyAdmin)}><option value="wallet">المحفظة</option><option value="bank">البنك</option></select><select name="action" ${disabled(canEconomyAdmin)}><option value="set">تعيين</option><option value="add">إضافة</option><option value="remove">خصم</option></select><input type="number" name="amount" min="0" required ${disabled(canEconomyAdmin)}><button class="btn" ${disabled(canEconomyAdmin)}>تنفيذ</button></form><div class="table-wrap"><table><thead><tr><th>User ID</th><th>المحفظة</th><th>البنك</th><th>Level</th></tr></thead><tbody>${topUsers}</tbody></table></div></section>


  <div class="two"><section class="panel"><h2>💎 Premium / Premium+</h2><a class="btn primary" href="/premium">مقارنة الخطط والاشتراك</a><p>${store.isPremium(cfg)?`مفعّل حتى <b>${new Date(cfg.premiumUntil).toLocaleDateString('ar-JO')}</b>`:'الخطة الحالية مجانية.'}</p><form method="post" action="/dashboard/${guild.id}/redeem"><input type="hidden" name="_csrf" value="${token}"><input name="code" placeholder="ZOMBI-XXXXXXXXXXXX"><button class="btn">تفعيل كود</button></form></section><section class="panel"><h2>📌 حدود الخطة</h2>${LIMIT_DEFS.map(d=>`<p>${esc(d.label)}: <b>${maxFor(req,cfg,site,d.key).toLocaleString()}</b></p>`).join('')}</section></div>`,site,cfg,owner);
}

function panelMarkerId(marker){let h=0x811c9dc5;for(const ch of String(marker||'ZOMB-PANEL-V2')){h^=ch.charCodeAt(0);h=Math.imul(h,0x01000193)>>>0;}return(h%2147483646)+1;}
function cleanPanelText(v,max=4000){return String(v??'').trim().slice(0,max);}
function makeDashboardPanelV2(payload,centerName='ZOMB • CONTROL CENTER',marker='ZOMB-PANEL-V2'){
  const embed=Array.isArray(payload?.embeds)&&payload.embeds.length?payload.embeds[0]:{};
  const accent=Number(embed?.color||0x7c3aed)||0x7c3aed;
  const title=cleanPanelText(embed?.title||'ZOMBI',220);
  const desc=cleanPanelText(embed?.description||'',2600);
  const footer=cleanPanelText(embed?.footer?.text||'ZOMBI • Powered by ZOM Bot',500);
  const fields=Array.isArray(embed?.fields)?embed.fields.slice(0,8):[];
  const fieldText=fields.map(f=>`${f?.name?`**${cleanPanelText(f.name,120)}**`:''}${f?.value?`\n${cleanPanelText(f.value,300)}`:''}`.trim()).filter(Boolean).join('\n\n');
  const body=[desc,fieldText].filter(Boolean).join('\n\n');
  const assetBase=`${baseUrl()}/panel-assets`;
  const customBanner=String(embed?.image?.url||'').trim();
  const customLogo=String(embed?.thumbnail?.url||'').trim();
  const bannerUrl=/^https?:\/\//i.test(customBanner)?customBanner:`${assetBase}/zombi-header-loop.gif`;
  const logoUrl=/^https?:\/\//i.test(customLogo)?customLogo:`${assetBase}/zombi-orb.gif`;
  const parts=[
    {type:12,items:[{media:{url:bannerUrl},description:'ZOMBI'}]},
    {type:9,components:[{type:10,content:`## ${title}\n-# ✦ ${cleanPanelText(centerName,120)} ✦`}],accessory:{type:11,media:{url:logoUrl},description:'ZOMBI'}},
    {type:14,divider:true,spacing:1}
  ];
  if(body)parts.push({type:10,content:body});
  const rows=Array.isArray(payload?.components)?payload.components.slice(0,5):[];
  if(rows.length){parts.push({type:12,items:[{media:{url:`${assetBase}/zombi-divider.gif`},description:'ZOMBI divider'}]});parts.push(...rows);}
  if(footer)parts.push({type:10,content:`-# ✦ ${footer} ✦`});
  return{components:[{type:17,accent_color:accent,id:panelMarkerId(marker),components:parts}],flags:32768,allowed_mentions:payload?.allowed_mentions||{parse:[]}};
}
function toV2EditPayloadRaw(payload){const out={...payload};delete out.flags;delete out.content;delete out.embeds;return out;}
async function sendPanelMessage(channelId,messageId,payload){
  if(!channelId)throw new Error('حدد الروم أولًا.');
  if(messageId){
    try{
      const old=await botFetch(`/channels/${channelId}/messages/${messageId}`);
      const isV2=Boolean(Number(old?.flags||0)&32768);
      if(isV2)return await botFetch(`/channels/${channelId}/messages/${messageId}`,{method:'PATCH',body:JSON.stringify(toV2EditPayloadRaw(payload))});
      await botFetch(`/channels/${channelId}/messages/${messageId}`,{method:'DELETE'}).catch(()=>null);
    }catch{}
  }
  return botFetch(`/channels/${channelId}/messages`,{method:'POST',body:JSON.stringify(payload)});
}

function legacyHomeGamesPanelPayload(cfg){
  const rows=[
    [['quiz','أسئلة','🧠',1],['guess','تخمين','🔢',1],['rps','حجر ورق','✂️',1],['speed','سرعة','⚡',1],['scramble','ترتيب','🔤',1]],
    [['truefalse','صح / خطأ','✅',2],['math','حساب','➗',2],['closest','الأقرب','🎯',2],['word','الكلمة','🔎',2],['wheel','عجلة الحظ','🎡',3]],
    [['daily','اليومي','🏆',3],['mafia','مافيا','🎭',4],['roulette','روليت','🎰',4],['chairs','كراسي','🪑',2],['killer','من القاتل','🔪',4]]
  ].map(row=>({type:1,components:row.map(([id,label,emoji,style])=>({type:2,style,custom_id:`game_${id}`,label,emoji:{name:emoji}}))}));
  return {embeds:[{color:0x3498DB,title:'🎮 ألعاب ZOM',description:'اختر اللعبة التي تريد تشغيلها.\n\n🎯 وقت الجولة وعدد الجولات والجائزة النهائية يتم تحديدها من **Dashboard** لكل لعبة.\n⭐ فوز الجولة = **نقطة**، والجائزة تُصرف للفائز النهائي فقط.\n🎭 المافيا والروليت لها نظام مستقل.\n🪑 الكراسي و 🔪 من القاتل موجودة.\n\n👑 لوحة الإدارة متاحة للإدارة فقط.',footer:{text:'ZOM Games System'}}],components:rows};
}
function legacyHomeTicketPanelPayload(cfg){
  const types=(cfg.tickets?.types||[]).filter(x=>x.enabled!==false).slice(0,24);if(!types.length)throw new Error('أضف نوع تذكرة أولًا.');
  const options=types.map(t=>({label:String(t.name||t.label||'تذكرة').slice(0,100),value:String(t.id).slice(0,100),description:String(t.description||'فتح تكت جديد').slice(0,100),...(t.emoji?{emoji:{name:String(t.emoji)}}:{})}));
  options.push({label:'إعادة اختيار',value:'__zombi_reselect__',description:'إلغاء الاختيار الحالي واختيار نوع آخر',emoji:{name:'↩️'}});
  const typeLines=types.map(t=>`• ${t.emoji||'🎫'} **${t.label||t.name||'تذكرة'}**${t.description?` — ${String(t.description).slice(0,90)}`:''}`).join('\n');
  return {embeds:[{color:0x7C3AED,title:cfg.tickets?.title||'🎫 ZOMBI Tickets',description:`${cfg.tickets?.description||'اختر نوع التكت الذي تريد فتحه من القائمة بالأسفل.'}\n\n**الأنواع المتاحة:**\n${typeLines}\n\n↩️ **إعادة اختيار** لا تفتح تكت؛ فقط تسمح لك بتغيير اختيارك.\n📋 بعد اختيار نوع فعلي سيظهر نموذج الاسم والعمر وسبب فتح التكت.`,footer:{text:cfg.branding?.customFooter||'ZOMBI Support'}}],components:[{type:1,components:[{type:3,custom_id:'pub:ticket:select',placeholder:'🎫 اختر نوع التكت الذي تريد فتحه...',min_values:1,max_values:1,options}]}]};
}

function legacyHomeStorePanelPayload(cfg){
  const products=(cfg.store?.products||[]).filter(p=>p.enabled!==false).sort((a,b)=>Number(a.sortOrder||0)-Number(b.sortOrder||0));if(!products.length)throw new Error('أضف منتجات أولًا.');
  const publicProducts=products.filter(p=>!p.accessMode||p.accessMode==='everyone'),restricted=products.some(p=>p.accessMode&&p.accessMode!=='everyone');
  const groups=new Map();for(const p of publicProducts){const k=String(p.category||'رتب الأعضاء').slice(0,80)||'رتب الأعضاء';if(!groups.has(k))groups.set(k,[]);groups.get(k).push(p);}const components=[];let idx=0;
  for(const [category,items] of [...groups.entries()].slice(0,restricted?4:5)){components.push({type:1,components:[{type:3,custom_id:`pub:store:select:${idx++}`,placeholder:category.slice(0,150),options:items.slice(0,25).map(p=>({label:String(p.name||'Role').slice(0,100),description:`السعر: ${Number(p.price||0).toLocaleString()} ZOM`.slice(0,100),value:String(p.id),...(p.emoji?{emoji:{name:String(p.emoji)}}:{})}))}]});}
  if(restricted&&components.length<5)components.push({type:1,components:[{type:2,style:2,custom_id:'pub:store:private',label:'الرتب الخاصة',emoji:{name:'🔒'}}]});
  const embed={color:parseInt(String(cfg.store?.accentColor||'#B00020').replace('#',''),16)||0xB00020,title:cfg.store?.title||'متجر الرتب',description:`${cfg.store?.description||'افتح القائمة واختار الرتبة التي تريد معرفة سعرها ومميزاتها، وبعدها اضغط زر الشراء.'}\n\n💰 الأسعار بالـ **ZOM**${restricted?'\n🔒 يوجد قسم رتب خاصة حسب صلاحيات العضو.':''}`,footer:{text:cfg.store?.footer||'ZOMBI • ZOM Store'}};
  const thumb=cfg.store?.thumbnailUrl||cfg.branding?.panelLogoUrl;if(thumb)embed.thumbnail={url:thumb};const banner=cfg.store?.bannerUrl||cfg.branding?.panelBannerUrl;if(banner)embed.image={url:banner};return{embeds:[embed],components:components.slice(0,5)};
}
function legacyHomeRolePanelPayload(cfg,bundle){
  const items=(cfg.rolePanel?.items||[]).slice(0,25),styleMap={Primary:1,Secondary:2,Success:3,Danger:4},rows=[];
  for(let i=0;i<items.length;i+=5)rows.push({type:1,components:items.slice(i,i+5).map(x=>({type:2,style:styleMap[x.style]||1,custom_id:`zombi_selfrole_${x.roleId}`,label:String(x.label||bundle.roles.find(r=>r.id===x.roleId)?.name||'Notification').slice(0,80),...(x.emoji?{emoji:{name:String(x.emoji)}}:{})}))});
  return{embeds:[{color:0x2F8CFF,title:cfg.rolePanel?.title||'🔔 ZOMBI • مركز الإشعارات',description:cfg.rolePanel?.description||'اختر الرتب التي تريدها من الأزرار بالأسفل.',footer:{text:cfg.rolePanel?.footer||'ZOMBI • ROLE CENTER'}}],components:rows.slice(0,5)};
}


function legacyHomeBankPanelPayload(cfg){
  const bankColor=/^#[0-9a-f]{6}$/i.test(String(cfg.bank?.panelColor||''))?parseInt(String(cfg.bank.panelColor).slice(1),16):0x8b5cf6;
  return {
    embeds:[{
      color:bankColor,
      title:cfg.bank?.title||'🏦 ZOMBI City Bank',
      description:String(cfg.bank?.description||'').trim()||'مرحبًا بك في البنك المركزي.\n\nإدارة الكاش والبنك والشركات والتداول، بالإضافة إلى **حماية الكاش** و**الكفالة** وحالة ألعاب النهب.\n\n🎯 للنهب: اكتب نهب ثم منشن العضو. النجاح = 15% من كاشه.',
      footer:{text:cfg.bank?.panelFooter||'ZOMBI • Bank • اللوحة الرسمية'}
    }],
    components:[
      {type:1,components:[
        {type:2,style:1,custom_id:'bank_balance',label:'حسابي',emoji:{name:'🏦'}},
        {type:2,style:3,custom_id:'bank_deposit',label:'إيداع',emoji:{name:'📥'}},
        {type:2,style:4,custom_id:'bank_withdraw',label:'سحب',emoji:{name:'📤'}},
        {type:2,style:1,custom_id:'bank_transfer',label:'تحويل',emoji:{name:'💸'}},
        {type:2,style:2,custom_id:'bank_gold',label:'الذهب',emoji:{name:'🪙'}}
      ]},
      {type:1,components:[
        {type:2,style:3,custom_id:'bank_loan',label:'قرض',emoji:{name:'🏦'}},
        {type:2,style:4,custom_id:'bank_repay_loan',label:'تسديد قرض',emoji:{name:'💳'}},
        {type:2,style:2,custom_id:'bank_history',label:'السجل',emoji:{name:'📜'}},
        {type:2,style:2,custom_id:'bank_job',label:'الوظائف',emoji:{name:'💼'}},
        {type:2,style:3,custom_id:'bank_salary',label:'راتبي',emoji:{name:'💰'}}
      ]},
      {type:1,components:[
        {type:2,style:2,custom_id:'bank_companies',label:'الشركات',emoji:{name:'🏢'}},
        {type:2,style:3,custom_id:'bank_my_companies',label:'شركاتي',emoji:{name:'🏙️'}},
        {type:2,style:1,custom_id:'bank_portfolio',label:'محفظتي',emoji:{name:'📊'}},
        {type:2,style:1,custom_id:'bank_trade',label:'تداول',emoji:{name:'📈'}},
        {type:2,style:2,custom_id:'bank_top',label:'التوب',emoji:{name:'🏆'}}
      ]},
      {type:1,components:[
        {type:2,style:3,custom_id:'bank_cash_protection',label:'حماية الكاش',emoji:{name:'🛡️'}},
        {type:2,style:4,custom_id:'bank_bail',label:'دفع الكفالة',emoji:{name:'🔓'}},
        {type:2,style:2,custom_id:'bank_heist_status',label:'حالة النهب',emoji:{name:'🎯'}}
      ]}
    ]
  };
}

function rawBankPanelPayload(cfg,site){
 if(!featureAllowed(site,cfg,'bank'))throw new Error('البنك غير متاح لهذه الخطة.');
 return legacyHomeBankPanelPayload(cfg);
}

function rawStorePanelPayload(cfg,site){
  const products=(cfg.store?.products||[]).filter(p=>p.enabled!==false).slice(0,limitFor(site,cfg,'storeProducts')).sort((a,b)=>Number(a.sortOrder||0)-Number(b.sortOrder||0));
  if(!products.length)throw new Error('أضف منتجات أولًا.');
  const publicProducts=products.filter(p=>!p.accessMode||p.accessMode==='everyone'),restricted=products.some(p=>p.accessMode&&p.accessMode!=='everyone');
  const customCurrency=featureAllowed(site,cfg,'customCurrency'),customBrand=featureAllowed(site,cfg,'customBranding'),customProfile=featureAllowed(site,cfg,'customBotProfile'),currencyName=customCurrency?(cfg.currency?.name||'ZOM'):'ZOM';
  const groups=new Map();for(const p of publicProducts){const k=String(p.category||'رتب الأعضاء').slice(0,80)||'رتب الأعضاء';if(!groups.has(k))groups.set(k,[]);groups.get(k).push(p);}
  const components=[];let idx=0;for(const [category,items] of [...groups.entries()].slice(0,restricted?4:5)){components.push({type:1,components:[{type:3,custom_id:`pub:store:select:${idx++}`,placeholder:category.slice(0,150),options:items.slice(0,25).map(p=>({label:String(p.name||'Role').slice(0,100),description:`السعر: ${Number(p.price||0).toLocaleString()} ${currencyName}`.slice(0,100),value:String(p.id),...(p.emoji?{emoji:{name:p.emoji}}:{})}))}]});}
  if(restricted&&components.length<5)components.push({type:1,components:[{type:2,style:2,custom_id:'pub:store:private',label:'الرتب الخاصة',emoji:{name:'🔒'}}]});
  const embed={color:parseInt(String(customBrand?(cfg.store?.accentColor||cfg.branding?.color||'#7c3aed'):'#7c3aed').replace('#',''),16)||0x7c3aed,title:cfg.store?.title||'متجر الرتب',description:`${cfg.store?.description||'اختر الرتبة من القائمة.'}\n\n${publicProducts.length?`💰 الأسعار بالـ **${currencyName}** • الرتب العامة: **${publicProducts.length}**`:'❌ لا توجد رتب عامة حاليًا.'}${restricted?'\n🔒 يوجد **قسم رتب خاصة** يظهر حسب صلاحيات العضو.':''}`,footer:{text:customBrand?(cfg.store?.footer||cfg.branding?.customFooter||'ZOMBI • ZOM Store'):'Powered by ZOMBI'}};
  if(customProfile){const thumb=cfg.store?.thumbnailUrl||cfg.branding?.panelLogoUrl||cfg.branding?.avatarUrl;if(thumb)embed.thumbnail={url:thumb};const image=cfg.store?.bannerUrl||cfg.branding?.panelBannerUrl||cfg.branding?.bannerUrl;if(image)embed.image={url:image};}return{embeds:[embed],components:components.slice(0,5)};
}
function rawGuidePanelPayload(cfg,guildId){
  if(cfg.serverGuide?.enabled===false)throw new Error('فعّل دليل السيرفر أولًا.');
  const items=(cfg.serverGuide?.items||[]).filter(x=>x.enabled!==false).sort((a,b)=>Number(a.sortOrder||0)-Number(b.sortOrder||0)).slice(0,25);
  if(!items.length)throw new Error('أضف اختصارًا واحدًا على الأقل إلى دليل السيرفر.');
  const rows=[];
  for(let i=0;i<items.length;i+=5){
    rows.push({type:1,components:items.slice(i,i+5).map(item=>({
      type:2,style:5,label:String(item.label||'انتقال').slice(0,80),
      url:`https://discord.com/channels/${guildId}/${item.channelId}`,
      ...(item.emoji?{emoji:{name:String(item.emoji).slice(0,32)}}:{})
    }))});
  }
  const hex=parseInt(String(cfg.serverGuide?.color||cfg.branding?.color||'#7c3aed').replace('#',''),16);
  const embed={color:Number.isFinite(hex)?hex:0x7c3aed,title:cfg.serverGuide?.title||'🧭 دليل السيرفر',description:cfg.serverGuide?.description||'اختر القسم الذي تريد الانتقال إليه من الأزرار بالأسفل.',footer:{text:cfg.serverGuide?.footer||'ZOMBI • SERVER GUIDE'}};
  if(cfg.serverGuide?.bannerUrl)embed.image={url:cfg.serverGuide.bannerUrl};
  return{embeds:[embed],components:rows};
}

function applyGuildBrandToPayload(payload,cfg,bundle){
  const brand=String(bundle?.guild?.name||cfg?.branding?.customName||'Server').trim().slice(0,80)||'Server';
  const walk=(value,key='')=>{
    if(typeof value==='string'){
      if(['custom_id','url','proxy_url','icon_url'].includes(String(key).toLowerCase()))return value;
      return value.replace(/ZOMBI/gi,brand);
    }
    if(Array.isArray(value))return value.map(v=>walk(v,key));
    if(value&&typeof value==='object'){
      const out={};
      for(const [k,v] of Object.entries(value))out[k]=walk(v,k);
      return out;
    }
    return value;
  };
  return walk(payload);
}

async function sendPanel(which,guildId,bundle,options={}){const [cfg,site]=await Promise.all([options.config||store.getConfig(guildId),store.getGlobalConfig()]);
  const key=which==='roles'?'rolePanel':which;
  if(site.emergency?.[key]?.disabled&&!options.preview)throw new Error(site.emergency[key].reason||'النظام متوقف للصيانة.');
  const sendOrUpdate=async(channelId,messageId,payload)=>{
    const designCfg=structuredClone(cfg);if(!store.isPremium(cfg)&&designCfg.panelDesigns)delete designCfg.panelDesigns[which];
    payload=operations.applyDesign(payload,designCfg,which);
    payload=applyPanelMedia(payload,cfg,which);
    payload=applyGuildBrandToPayload(payload,cfg,bundle);
    const centers={bank:'ZOMB • BANK CENTER',games:'ZOMB • GAMES CENTER',tickets:'ZOMB • SUPPORT CENTER',store:'ZOMB • STORE CENTER',roles:'ZOMB • ROLE CENTER',guide:'ZOMB • SERVER GUIDE',name:'ZOMB • NAME CENTER',voice:'ZOMB • VOICE CENTER'};
    const panelBrand=String(bundle?.guild?.name||cfg?.branding?.customName||'Server').trim().slice(0,80)||'Server';
    const center=which==='bank'&&String(cfg.bank?.panelCenterName||'').trim()?String(cfg.bank.panelCenterName).trim().slice(0,120):(centers[which]||'ZOMB • CONTROL CENTER').replace(/^ZOMB/i,panelBrand);
    payload=makeDashboardPanelV2(payload,center,`ZOMB-${String(which||'panel').toUpperCase()}-PANEL-V2`);
    if(options.preview){const e=new Error('PREVIEW');e.previewPayload=payload;throw e;}
    return sendPanelMessage(channelId,messageId,payload);
  };
  // All guilds, including the original home guild, now use the same guild-scoped panel path.

  if(which==='bank'){const payload=rawBankPanelPayload(cfg,site);const m=await sendOrUpdate(cfg.channels.bankPanel,cfg.bank?.panelMessageId,payload);cfg.bank.panelMessageId=m.id;await store.saveConfig(guildId,cfg);return;}
  if(which==='games'){if(!featureAllowed(site,cfg,'games'))throw new Error('Games غير متاحة لهذه الخطة.');const payload=rawGamesPanelPayload(cfg);const m=await sendOrUpdate(cfg.channels.gamePanel,cfg.games?.panelMessageId,payload);cfg.games.panelMessageId=m.id;await store.saveConfig(guildId,cfg);return;}
  if(which==='tickets'){if(!featureAllowed(site,cfg,'tickets'))throw new Error('Tickets غير متاحة لهذه الخطة.');const types=(cfg.tickets.types||[]).filter(t=>t.enabled!==false).slice(0,limitFor(site,cfg,'ticketTypes'));if(!types.length)throw new Error('أضف نوع تذكرة أولًا.');const rows=[];for(let i=0;i<types.length;i+=5)rows.push({type:1,components:types.slice(i,i+5).map(t=>({type:2,style:1,custom_id:`pub:ticket:open:${t.id}`,label:String(t.label||'تذكرة').slice(0,80),...(t.emoji?{emoji:{name:t.emoji}}:{})}))});const footer=featureAllowed(site,cfg,'customBranding')?(cfg.branding.customFooter||cfg.branding.footer):'Powered by ZOMBI';const payload={embeds:[{color:color(cfg),title:cfg.tickets.title,description:cfg.tickets.description,footer:{text:footer}}],components:rows.slice(0,5)};const m=await sendOrUpdate(cfg.channels.ticketPanel,cfg.tickets.panelMessageId,payload);cfg.tickets.panelMessageId=m.id;await store.saveConfig(guildId,cfg);return;}
  if(which==='rules'){
    if(!cfg.rules?.channelId)throw new Error('حدد شات لوحة القوانين أولًا.');
    const types=(cfg.rules.types||[]).filter(x=>x.enabled!==false).slice(0,25);if(!types.length)throw new Error('أضف نوع قوانين واحدًا على الأقل.');
    const banner=cfg.rules.bannerUrl||`${baseUrl()}/panel-assets/zombi-rules-banner.gif`;
    const logo=cfg.rules.logoUrl||cfg.branding?.panelLogoUrl||cfg.branding?.avatarUrl||`${baseUrl()}/assets/zombi-logo.png`;
    const hex=parseInt(String(cfg.rules.color||'#E11D48').replace('#',''),16);
    const embed={color:Number.isFinite(hex)?hex:0xE11D48,title:cfg.rules.title||'📜 ZOMBI • قوانين السيرفر',description:cfg.rules.description||'اختر نوع القوانين من القائمة بالأسفل.',footer:{text:cfg.rules.footer||'ZOMBI • RULES CENTER'}};
    if(logo)embed.thumbnail={url:logo};if(banner)embed.image={url:banner};
    const options=types.map(t=>({label:String(t.label||'قوانين').slice(0,100),value:String(t.id).slice(0,100),description:String(t.description||'اضغط لعرض القوانين').slice(0,100),...(t.emoji?{emoji:{name:String(t.emoji)}}:{})}));
    const payload={embeds:[embed],components:[{type:1,components:[{type:3,custom_id:'zombi_rules_select',placeholder:'📜 اختر نوع القوانين...',min_values:1,max_values:1,options}]}],allowed_mentions:{parse:[]}};
    const m=await sendOrUpdate(cfg.rules.channelId,cfg.rules.panelMessageId,payload);cfg.rules.panelMessageId=m.id;await store.saveConfig(guildId,cfg);return;
  }
  if(which==='store'){if(!featureAllowed(site,cfg,'store'))throw new Error('Store غير متاح لهذه الخطة.');const payload=rawStorePanelPayload(cfg,site);const m=await sendOrUpdate(cfg.channels.storePanel,cfg.store.panelMessageId,payload);cfg.store.panelMessageId=m.id;await store.saveConfig(guildId,cfg);await botFetch(`/channels/${cfg.channels.storePanel}/pins/${m.id}`,{method:'PUT'}).catch(()=>{});return;}
  if(which==='name'){if(!cfg.nameChange?.enabled)throw new Error('فعّل نظام تغيير الاسم أولًا.');if(!cfg.channels.nameChangePanel)throw new Error('حدد روم لوحة تغيير الاسم أولًا.');const hex=parseInt(String(cfg.nameChange.color||'#8B5CF6').replace('#',''),16);const embed={color:Number.isFinite(hex)?hex:0x8B5CF6,title:cfg.nameChange.title||'تغيير اسمك في السيرفر',description:cfg.nameChange.description||'اضغط الزر لتغيير اسمك.',footer:{text:'ZOMBI • NAME CENTER'}};if(cfg.nameChange.bannerUrl)embed.image={url:cfg.nameChange.bannerUrl};const payload={embeds:[embed],components:[{type:1,components:[{type:2,style:1,custom_id:'zombi_name_change_open',label:String(cfg.nameChange.buttonLabel||'تغيير اسمي').slice(0,80),emoji:{name:String(cfg.nameChange.buttonEmoji||'✏️')}}]}]};const m=await sendOrUpdate(cfg.channels.nameChangePanel,cfg.nameChange.panelMessageId,payload);cfg.nameChange.panelMessageId=m.id;await store.saveConfig(guildId,cfg);return;}
  if(which==='roles'){if(!featureAllowed(site,cfg,'rolePanel'))throw new Error('Self Roles غير متاحة لهذه الخطة.');const items=(cfg.rolePanel.items||[]).slice(0,limitFor(site,cfg,'selfRoles'));if(!items.length)throw new Error('أضف رتب Self Roles أولًا.');const roleMap=new Map(bundle.roles.map(r=>[r.id,r])),styleMap={Primary:1,Secondary:2,Success:3,Danger:4},rows=[];for(let i=0;i<items.length;i+=5)rows.push({type:1,components:items.slice(i,i+5).map(x=>({type:2,style:styleMap[x.style]||2,custom_id:`pub:role:${x.roleId}`,label:String(x.label||roleMap.get(x.roleId)?.name||'Role').slice(0,80),...(x.emoji?{emoji:{name:x.emoji}}:{})}))});const payload={embeds:[{color:color(cfg),title:cfg.rolePanel.title,description:cfg.rolePanel.description,footer:{text:cfg.rolePanel.footer||'ZOMBI • ROLE CENTER'}}],components:rows.slice(0,5)};const m=await sendOrUpdate(cfg.channels.rolePanel,cfg.rolePanel.panelMessageId,payload);cfg.rolePanel.panelMessageId=m.id;await store.saveConfig(guildId,cfg);return;}
  if(which==='guide'){if(!featureAllowed(site,cfg,'serverGuide'))throw new Error('دليل السيرفر غير متاح لهذه الخطة.');if(!cfg.channels?.serverGuidePanel)throw new Error('حدد روم لوحة دليل السيرفر أولًا.');const payload=rawGuidePanelPayload(cfg,guildId);const m=await sendOrUpdate(cfg.channels.serverGuidePanel,cfg.serverGuide?.panelMessageId,payload);cfg.serverGuide.panelMessageId=m.id;await store.saveConfig(guildId,cfg);return;}
  if(which==='voice'){
    if(cfg.voiceRooms?.enabled===false)throw new Error('فعّل الرومات المؤقتة أولًا.');const channelId=cfg.voiceRooms?.controlChannelId||cfg.channels?.voiceControl;if(!channelId)throw new Error('حدد روم تحكم الرومات المؤقتة أولًا.');
    const brand=String(bundle?.guild?.name||cfg.branding?.customName||'Server').slice(0,80);const embed={color:parseInt(String(cfg.branding?.color||'#5865F2').replace('#',''),16)||0x5865F2,title:'🎛️ لوحة التحكم بالرومات الصوتية',description:'استخدم الأزرار بالأسفل لإدارة رومك الصوتي المؤقت. يجب أن تكون داخل رومك لاستخدام اللوحة.',footer:{text:`${brand} • Temporary Voice Rooms`}};if(cfg.voiceRooms?.bannerUrl)embed.image={url:cfg.voiceRooms.bannerUrl};if(cfg.voiceRooms?.thumbnailUrl)embed.thumbnail={url:cfg.voiceRooms.thumbnailUrl};
    const payload={embeds:[embed],components:[{type:1,components:[{type:2,style:4,custom_id:'voice_lock',label:'قفل',emoji:{name:'🔒'}},{type:2,style:3,custom_id:'voice_unlock',label:'فتح',emoji:{name:'🔓'}},{type:2,style:2,custom_id:'voice_hide',label:'إخفاء',emoji:{name:'🙈'}},{type:2,style:1,custom_id:'voice_show',label:'إظهار',emoji:{name:'👁️'}}]},{type:1,components:[{type:2,style:1,custom_id:'voice_rename',label:'تغيير الاسم',emoji:{name:'✏️'}},{type:2,style:1,custom_id:'voice_limit',label:'تحديد العدد',emoji:{name:'👥'}},{type:2,style:4,custom_id:'voice_kick',label:'طرد عضو',emoji:{name:'🚫'}},{type:2,style:2,custom_id:'voice_transfer',label:'نقل الملكية',emoji:{name:'👑'}}]},{type:1,components:[{type:2,style:4,custom_id:'voice_delete',label:'حذف الروم',emoji:{name:'🗑️'}}]}],allowed_mentions:{parse:[]}};
    const m=await sendOrUpdate(channelId,cfg.voiceRooms?.controlMessageId,payload);cfg.voiceRooms.controlChannelId=channelId;cfg.channels.voiceControl=channelId;cfg.voiceRooms.controlMessageId=m.id;await store.saveConfig(guildId,cfg);return;
  }
}

function parsePairs(text,max,kind='qa'){const out=[];for(const raw of String(text||'').split(/\r?\n/)){const line=raw.trim();if(!line)continue;const pos=line.indexOf('|');if(pos<0)continue;const a=line.slice(0,pos).trim(),b=line.slice(pos+1).trim();if(!a||!b)continue;out.push(kind==='word'?{scrambled:a,answer:b}:{question:a,answer:b});if(out.length>=max)break;}return out;}
function parseWords(text,max){return String(text||'').split(/\r?\n/).map(x=>x.trim()).filter(Boolean).slice(0,max);}
function slug(v){return String(v||'').trim().toLowerCase().replace(/[^a-z0-9\u0600-\u06ff_-]+/g,'-').replace(/-+/g,'-').replace(/^-|-$/g,'').slice(0,30);}

function parseBankJobs(text){const out={};for(const raw of String(text||'').split(/\r?\n/)){const [id,name,salary]=raw.split('|').map(x=>String(x||'').trim());if(!id||!name)continue;out[slug(id)]={name:name.slice(0,80),salary:int(salary,0,0,1000000000)};}return out;}
function parseBankCompanies(text){const out={};for(const raw of String(text||'').split(/\r?\n/)){const [id,name,description,priceGold]=raw.split('|').map(x=>String(x||'').trim());if(!id||!name)continue;const key=slug(id);out[key]={id:key,name:name.slice(0,80),description:String(description||'').slice(0,300),priceGold:int(priceGold,0,0,1000000000)};}return out;}
function parseBankStocks(text){const out={};for(const raw of String(text||'').split(/\r?\n/)){const [symbol,name,price]=raw.split('|').map(x=>String(x||'').trim());const key=String(symbol||'').toUpperCase().replace(/[^A-Z0-9_-]/g,'').slice(0,20);if(!key||!name)continue;out[key]={symbol:key,name:name.slice(0,80),price:int(price,0,0,1000000000)};}return out;}

function planSummaryHtml(site,planName){const p=site.plans[planName];const feats=FEATURE_DEFS.filter(f=>p.features[f.key]).map(f=>`${f.emoji} ${f.label}`).join(' • ')||'—';const games=GAME_DEFS.filter(g=>g.publicSupported&&p.games[g.id]).map(g=>g.label).join('، ')||'—';return `<p><b>الميزات:</b> ${esc(feats)}</p><p><b>الألعاب:</b> ${esc(games)}</p><p><b>Store:</b> ${p.limits.storeProducts} • <b>Self Roles:</b> ${p.limits.selfRoles} • <b>Ticket Types:</b> ${p.limits.ticketTypes} • <b>Questions:</b> ${p.limits.questionsPerGame}</p>`;}

async function start(){
  const required=['DISCORD_CLIENT_ID','DISCORD_CLIENT_SECRET','PUBLIC_BASE_URL','SESSION_SECRET','DATABASE_URL'];const missing=required.filter(k=>!String(process.env[k]||'').trim());if(missing.length)console.warn('⚠️ Missing env:',missing.join(', '));
  await store.ensureDb();await payments.ensureDb();await seedLegacyHome();const app=express();app.use('/panel-assets',express.static(require('path').join(__dirname,'assets','panels'),{maxAge:'1h'}));app.set('trust proxy',1);app.use(express.urlencoded({extended:true,limit:'8mb'}));app.use(express.json({limit:'8mb'}));for(const prefix of ['/site','/assets'])app.get(prefix+'/:file',(req,res)=>{const allowed=['site.css','dashboard.js','role-manager.js','upgrade.js','operations-ui.js','zombi-logo.png','zombi-v2-logo.svg','zombi-site-background.png'];if(!allowed.includes(req.params.file))return res.sendStatus(404);res.set('Cache-Control','no-store, max-age=0');res.sendFile(require('path').join(__dirname,req.params.file));});
  let sessionStore;if(String(process.env.DATABASE_URL||'').trim()){const {Pool}=require('pg');const sslDisabled=String(process.env.DATABASE_SSL||'').toLowerCase()==='false';const rawDb=String(process.env.DATABASE_URL||'').trim();let sessionConnectionString=rawDb;try{const u=new URL(rawDb);for(const k of ['sslmode','sslcert','sslkey','sslrootcert','channel_binding'])u.searchParams.delete(k);sessionConnectionString=u.toString();}catch{}const sessionPool=new Pool({connectionString:sessionConnectionString,ssl:sslDisabled?false:{rejectUnauthorized:false},max:1,connectionTimeoutMillis:10000,idleTimeoutMillis:15000,keepAlive:true});class PgSessionStore extends session.Store{get(sid,cb){sessionPool.query('SELECT sess,expire_at FROM zombi_web_sessions WHERE sid=$1',[sid]).then(r=>{const row=r.rows[0];if(!row||Number(row.expire_at||0)<Date.now())return cb(null,null);cb(null,row.sess);}).catch(cb);}set(sid,sess,cb){const exp=sess?.cookie?.expires?new Date(sess.cookie.expires).getTime():Date.now()+7*86400000;sessionPool.query(`INSERT INTO zombi_web_sessions(sid,sess,expire_at) VALUES($1,$2::jsonb,$3) ON CONFLICT(sid) DO UPDATE SET sess=EXCLUDED.sess,expire_at=EXCLUDED.expire_at`,[sid,JSON.stringify(sess||{}),exp]).then(()=>cb&&cb()).catch(e=>cb&&cb(e));}destroy(sid,cb){sessionPool.query('DELETE FROM zombi_web_sessions WHERE sid=$1',[sid]).then(()=>cb&&cb()).catch(e=>cb&&cb(e));}}sessionStore=new PgSessionStore();}
  app.use(session({store:sessionStore,secret:process.env.SESSION_SECRET||crypto.randomBytes(32).toString('hex'),resave:false,saveUninitialized:false,cookie:{httpOnly:true,sameSite:'lax',secure:baseUrl().startsWith('https://'),maxAge:7*86400000}}));app.use((req,_res,next)=>{req.user=req.session.user||null;next();});
  operations.install(app,{store,layout,requireLogin,requireOwner,requireGuildAccess,checkCsrf,csrf,botFetch,requireBotSync,pricing,publicSiteConfig,
    previewPanel:async(which,gid,bundle,config)=>{try{await sendPanel(which,gid,bundle,{preview:true,config});}catch(e){if(e.previewPayload)return e.previewPayload;throw e;}throw new Error('لا توجد لوحة للمعاينة.');}});
  // Secure bot <-> website fallback sync. Used only when a shared DATABASE_URL is not configured on both hosts.
  app.get('/api/bot-sync/global',requireBotSync,async(_req,res,next)=>{try{res.json({ok:true,global:await store.getGlobalConfig(),source:(await store.health()).mode});}catch(e){next(e);}});
  app.get('/api/bot-sync/guild/:guildId',requireBotSync,async(req,res,next)=>{try{res.json({ok:true,config:await store.getConfig(req.params.guildId),source:(await store.health()).mode});}catch(e){next(e);}});
  app.put('/api/bot-sync/guild/:guildId',requireBotSync,async(req,res,next)=>{try{const input=req.body?.config||req.body||{};const config=await store.saveConfig(req.params.guildId,input);res.json({ok:true,config});}catch(e){next(e);}});
  app.get('/api/bot-sync/guild/:guildId/data/:name',requireBotSync,async(req,res,next)=>{try{const name=String(req.params.name||'').trim();if(!/^[a-zA-Z0-9._-]{1,120}$/.test(name))return res.status(400).json({ok:false,error:'اسم ملف البيانات غير صالح.'});const data=await store.data(req.params.guildId,name,{});res.json({ok:true,data});}catch(e){next(e);}});
  app.put('/api/bot-sync/guild/:guildId/data/:name',requireBotSync,async(req,res,next)=>{try{const name=String(req.params.name||'').trim();if(!/^[a-zA-Z0-9._-]{1,120}$/.test(name))return res.status(400).json({ok:false,error:'اسم ملف البيانات غير صالح.'});const data=await store.saveData(req.params.guildId,name,req.body?.data??req.body??{});res.json({ok:true,data});}catch(e){next(e);}});
  app.post('/api/bot-sync/redeem',requireBotSync,async(req,res)=>{try{const guildId=String(req.body?.guildId||'').trim(),code=String(req.body?.code||'').trim();if(!/^\d{15,25}$/.test(guildId)||!code)return res.status(400).json({ok:false,error:'بيانات التفعيل غير صالحة.'});const result=await store.redeemCode(guildId,code);res.json({ok:true,result});}catch(e){res.status(400).json({ok:false,error:e?.message||'تعذر تفعيل الاشتراك.'});}});
  app.post('/api/bot-sync/heartbeat',requireBotSync,async(req,res,next)=>{try{
    const body=req.body&&typeof req.body==='object'?req.body:{};
    const payload={
      at:Number(body.at)||Date.now(),
      ready:body.ready!==false,
      ping:Math.max(0,Math.min(120000,Number(body.ping)||0)),
      version:String(body.version||'').slice(0,40),
      botId:String(body.botId||'').slice(0,30),
      botTag:String(body.botTag||'').slice(0,100),
      guildCount:Math.max(0,Math.min(5000,Number(body.guildCount)||0)),
      guildIds:Array.isArray(body.guildIds)?body.guildIds.map(String).filter(x=>/^\d{15,25}$/.test(x)).slice(0,500):[]
    };
    await store.saveData('site','heartbeat.json',payload);
    res.json({ok:true});
  }catch(e){next(e);}});
  app.put('/api/bot-sync/guild/:guildId/discord-bundle',requireBotSync,async(req,res,next)=>{try{
    const gid=String(req.params.guildId||'').trim(),body=req.body&&typeof req.body==='object'?req.body:{};
    if(!/^\d{15,25}$/.test(gid))return res.status(400).json({ok:false,error:'Guild ID invalid'});
    const guild=body.guild&&typeof body.guild==='object'?body.guild:null;
    const channels=Array.isArray(body.channels)?body.channels.slice(0,1000):[];
    const roles=Array.isArray(body.roles)?body.roles.slice(0,500):[];
    const emojis=Array.isArray(body.emojis)?body.emojis.slice(0,500):[];
    if(!guild||String(guild.id||'')!==gid)return res.status(400).json({ok:false,error:'Guild bundle invalid'});
    const payload={guild,channels,roles,emojis,at:Number(body.at)||Date.now(),source:'bot-gateway-cache'};
    await store.saveData(gid,GUILD_BUNDLE_SNAPSHOT,payload);invalidateGuildBundle(gid);
    res.json({ok:true,channels:channels.length,roles:roles.length,emojis:emojis.length});
  }catch(e){next(e);}});
  app.get('/',async(req,res,next)=>{try{res.send(layout('Home',await landing(),req.user));}catch(e){next(e);}});
  app.get('/privacy',async(req,res,next)=>{try{const site=await store.getGlobalConfig();res.send(layout('سياسة الخصوصية',`<section class="legal"><h1>سياسة الخصوصية</h1><p>توضح هذه الصفحة كيف يستخدم ZOMBI البيانات اللازمة لتشغيل البوت ولوحة التحكم.</p><h2>البيانات التي نستخدمها</h2><p>عند تسجيل الدخول عبر Discord نستخدم بيانات <b>identify</b> وقائمة السيرفرات <b>guilds</b> حتى نعرض لك السيرفرات التي تملك صلاحية إدارتها. يخزن ZOMBI إعدادات السيرفر والبيانات اللازمة للأنظمة التي يفعّلها مدير السيرفر مثل الاقتصاد، التذاكر، المتجر، المستويات، العصابات والألعاب.</p><h2>الاستخدام والمشاركة</h2><p>تُستخدم البيانات لتقديم وظائف ZOMBI وإدارة السيرفر. لا نبيع بيانات المستخدمين للمعلنين. قد تمر طلبات Discord عبر البنية المستضيفة للخدمة لتنفيذ الأوامر والمزامنة.</p><h2>إحصائيات الزيارات</h2><p>نستخدم معرّفًا عشوائيًا في ملف تعريف ارتباط لحساب المتصفحات الفريدة ومشاهدات الصفحات العامة. لا نسجل عنوان IP أو بيانات حساب Discord في هذه الإحصائيات. نحفظ بصمة المعرّف وآخر زيارة للعد الكلي، وتفاصيل الأيام لمدة 31 يومًا. حذف ملفات الارتباط أو استخدام جهاز آخر قد يؤدي إلى احتساب زيارة فريدة جديدة.</p><h2>الاحتفاظ والحذف</h2><p>قد تبقى إعدادات وبيانات السيرفر ما دامت الخدمة مستخدمة. يمكن لمالك السيرفر التواصل لطلب حذف بيانات سيرفره، مع مراعاة ما يلزم للاحتفاظ بسجلات تشغيل أو التزامات قانونية إن وجدت.</p><h2>Discord</h2><p>استخدام Discord نفسه يخضع أيضًا لسياسات وشروط Discord.</p>${site.supportUrl?`<p><a class="btn" href="${esc(site.supportUrl)}">التواصل مع الدعم</a></p>`:''}<p class="hint">آخر تحديث: 5 سبتمبر 2026</p></section>`,req.user));}catch(e){next(e);}});
  app.get('/terms',async(req,res,next)=>{try{const site=await store.getGlobalConfig();res.send(layout('شروط الخدمة',`<section class="legal"><h1>شروط الخدمة</h1><p>باستخدام ZOMBI أو Dashboard فإنك توافق على استخدام الخدمة بشكل قانوني ووفق شروط Discord.</p><h2>صلاحيات السيرفر</h2><p>يجب أن تكون مخولًا لإضافة البوت أو تعديل إعدادات السيرفر. بعض الوظائف تحتاج صلاحيات Discord مثل Manage Channels وManage Roles، ويجب أن تكون رتبة البوت أعلى من الرتب التي يديرها.</p><h2>Free وPremium وPremium+</h2><p>الميزات والحدود المتاحة لكل خطة يحددها مالك ZOMBI وقد تتغير. مدة Premium تبدأ حسب الكود أو التفعيل الممنوح للسيرفر، ولا يمنح Premium حق تغيير حساب البوت العالمي لكل سيرفر؛ التخصيص لكل سيرفر يقتصر على الخيارات التي يوفرها Dashboard.</p><h2>الاستخدام المقبول</h2><p>لا تستخدم الخدمة للإساءة، التخريب، الاحتيال، انتهاك حقوق الآخرين أو مخالفة قواعد Discord. يجوز تعطيل الوصول عند إساءة الاستخدام.</p><h2>توفر الخدمة</h2><p>نسعى لاستمرار الخدمة لكن لا نضمن عدم الانقطاع أو فقدان البيانات بسبب أعطال خارجية. يُنصح بالاحتفاظ بنسخ احتياطية للإعدادات المهمة.</p>${site.supportUrl?`<p><a class="btn" href="${esc(site.supportUrl)}">التواصل مع الدعم</a></p>`:''}<p class="hint">آخر تحديث: 5 سبتمبر 2026</p></section>`,req.user));}catch(e){next(e);}});
  app.get('/auth/discord',(req,res)=>{
    const state=crypto.randomBytes(24).toString('hex'),now=Date.now();
    const states=Array.isArray(req.session.oauthStates)?req.session.oauthStates:[];
    req.session.oauthStates=[...states.filter(x=>x&&Number(x.at)>now-10*60*1000),{value:state,at:now}].slice(-5);
    const redirect=process.env.DISCORD_CALLBACK_URL||`${baseUrl()}/auth/discord/callback`;
    const q=new URLSearchParams({client_id:process.env.DISCORD_CLIENT_ID||'',response_type:'code',redirect_uri:redirect,scope:'identify guilds',state});
    res.redirect(`https://discord.com/oauth2/authorize?${q}`);
  });
  app.get('/auth/discord/callback',async(req,res,next)=>{try{
    if(req.query.error)throw new Error(`Discord OAuth: ${String(req.query.error_description||req.query.error)}`);
    const incomingState=String(req.query.state||''),states=Array.isArray(req.session.oauthStates)?req.session.oauthStates:[];
    const stateIndex=states.findIndex(x=>String(x?.value||'')===incomingState&&Date.now()-Number(x?.at||0)<10*60*1000);
    if(!req.query.code||!incomingState||stateIndex<0)return res.status(400).send(layout('OAuth Error','<section class="login"><h1>❌ فشل تسجيل الدخول</h1><p>جلسة تسجيل الدخول انتهت أو غير صالحة.</p><a class="btn" href="/auth/discord">تسجيل الدخول</a></section>',req.user));
    req.session.oauthStates=states.filter((_,i)=>i!==stateIndex);
    const redirect=process.env.DISCORD_CALLBACK_URL||`${baseUrl()}/auth/discord/callback`;
    async function requestJson(url,options,label,maxShortRetries=1){
      for(let attempt=0;;attempt++){
        const response=await fetch(url,options),raw=await response.text();let data=null;
        try{data=raw?JSON.parse(raw):{};}catch{const err=new Error(`${label} رجّع رد غير متوقع (${response.status}): ${raw.replace(/\s+/g,' ').slice(0,180)}`);err.status=response.status;throw err;}
        if(response.ok)return data;
        const err=new Error(data?.error||data?.error_description||data?.message||`${label} failed (${response.status})`);err.status=response.status;err.data=data;err.retryAfter=Number(data?.retry_after||response.headers.get('retry-after')||0);
        const waitMs=Math.ceil(Number(err.retryAfter||0)*1000);
        if(response.status===429&&attempt<maxShortRetries&&waitMs>0&&waitMs<=5000){await sleepMs(waitMs+150);continue;}
        throw err;
      }
    }
    async function loginViaProxy(code){
      const proxyUrl=oauthProxyUrl();if(!proxyUrl)return null;
      const secrets=proxySecretCandidates();if(!secrets.length){const e=new Error('OAUTH Proxy موجود لكن لا يوجد مفتاح توثيق متاح.');e.status=500;throw e;}
      let authError=null;
      for(const secret of secrets){
        try{
          const data=await requestJson(proxyUrl,{method:'POST',headers:{Authorization:`Bearer ${secret}`,'Content-Type':'application/json',Accept:'application/json'},body:JSON.stringify({code:String(code),redirect_uri:redirect})},'ZOMBI OAuth Proxy',1);
          if(!data?.ok||!data?.user)throw new Error(data?.error||'OAuth Proxy لم يرجع بيانات المستخدم.');
          return{user:data.user,guilds:Array.isArray(data.guilds)?data.guilds:[]};
        }catch(e){if([401,403].includes(Number(e?.status||0))){authError=e;continue;}throw e;}
      }
      throw authError||new Error('تعذر توثيق OAuth Proxy.');
    }
    async function loginDirect(code){
      const clientId=String(process.env.DISCORD_CLIENT_ID||'').trim(),clientSecret=String(process.env.DISCORD_CLIENT_SECRET||'').trim();
      if(!clientId||!clientSecret)throw new Error('DISCORD_CLIENT_ID / DISCORD_CLIENT_SECRET غير مكتملة.');
      const body=new URLSearchParams({client_id:clientId,client_secret:clientSecret,grant_type:'authorization_code',code:String(code),redirect_uri:redirect});
      const td=await requestJson(OAUTH_TOKEN_URL,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded',Accept:'application/json'},body},'Discord OAuth token',1);
      if(!td?.access_token)throw new Error('Discord لم يرجع access token.');
      const headers={Authorization:`Bearer ${td.access_token}`,Accept:'application/json'};
      const user=await requestJson(`${API}/users/@me`,{headers},'Discord user profile',1);
      await sleepMs(75);
      const guilds=await requestJson(`${API}/users/@me/guilds`,{headers},'Discord guild list',1);
      return{user,guilds:Array.isArray(guilds)?guilds:[]};
    }
    const authResult=(await loginViaProxy(req.query.code))||await loginDirect(req.query.code),user=authResult.user,guilds=authResult.guilds;
    req.session.user={id:user.id,username:user.username,displayName:user.global_name||user.username,avatar:user.avatar,guilds:Array.isArray(guilds)?guilds:[]};
    const to=req.session.returnTo||'/dashboard';delete req.session.returnTo;res.redirect(to);
  }catch(e){
    if(Number(e?.status)===429){const seconds=Math.max(1,Math.ceil(Number(e?.retryAfter||30)));res.set('Retry-After',String(seconds));return res.status(429).send(layout('OAuth Rate Limit',`<section class="login"><h1>⏳ Discord مشغول مؤقتًا</h1><p>تم إيقاف المحاولة بدل تكرار الطلبات. انتظر تقريبًا ${seconds} ثانية ثم اضغط تسجيل الدخول مرة واحدة.</p><a class="btn primary" href="/auth/discord">تسجيل الدخول من جديد</a><a class="btn" href="/">رجوع</a></section>`,req.user));}
    next(e);
  }});
  app.get('/login',(req,res)=>res.redirect('/auth/discord'));app.get('/logout',(req,res)=>req.session.destroy(()=>res.redirect('/')));

  app.get('/checkout',requireLogin,async(req,res,next)=>{try{
    const plan=paymentPlan(req.query.plan),site=await store.getGlobalConfig(),zain=resolvedZainCash(site);
    if(!zain.enabled)return res.status(503).send(layout('Zain Cash',`<section class="login"><h1>🟡 الدفع عبر Zain Cash غير مفعّل</h1><p>لم يتم إعداد رقم المحفظة بعد. تواصل مع مالك ZOMBI.</p><a class="btn" href="/premium">رجوع للاشتراكات</a></section>`,req.user));
    const manageable=(req.user.guilds||[]).filter(canManage).slice(0,100),presence=await getBotPresenceSnapshot(),installed=manageable.filter(g=>presence.ids.has(String(g.id)));
    const amount=paymentAmount(zain,plan),days=paymentDays(zain,plan),token=csrf(req),planLabel=PLAN_LABELS[plan];
    const options=installed.map(g=>`<option value="${esc(g.id)}">${esc(g.name)} — ${esc(g.id)}</option>`).join('');
    const body=`<section class="z-pay-wrap"><div class="z-pay-head"><span class="badge">ZAIN CASH PAYMENT</span><h1>🟡 اشترك في ${esc(planLabel)}</h1><p>الدفع يدوي وآمن: حوّل المبلغ ثم ارفع صورة التحويل. التفعيل يتم بعد موافقة Owner.</p></div>
      <div class="z-pay-grid"><article class="panel z-wallet-card"><span class="z-wallet-mark">Z</span><h2>بيانات التحويل</h2><div class="z-wallet-amount">${amount.toFixed(3).replace(/\.000$/,'')} <small>JOD</small></div><dl><div><dt>المحفظة</dt><dd dir="ltr">${esc(zain.walletNumber)}</dd></div><div><dt>اسم صاحب المحفظة</dt><dd>${esc(zain.walletName||'—')}</dd></div><div><dt>مدة الاشتراك</dt><dd>${days} يوم</dd></div></dl><p class="hint">${esc(zain.instructions)}</p></article>
      <form id="zainCheckoutForm" class="panel z-payment-form" method="post" action="/checkout"><input type="hidden" name="_csrf" value="${token}"><input type="hidden" name="plan" value="${plan}"><input type="hidden" name="proofData" id="proofData"><h2>إرسال إثبات الدفع</h2>${installed.length?`<label>السيرفر<select name="guildId" required><option value="">اختر السيرفر</option>${options}</select></label>`:'<div class="warn">ما عندك سيرفر مثبت عليه ZOMBI وتملك فيه Manage Server. أضف البوت أولًا.</div>'}<label>رقم الهاتف الذي تم التحويل منه<input name="payerPhone" dir="ltr" inputmode="tel" placeholder="07XXXXXXXX أو +962..." required></label><label>رقم العملية <small>(اختياري إذا ظاهر بالإيصال)</small><input name="transactionRef" dir="ltr" maxlength="100" placeholder="Transaction ID"></label><label>صورة إثبات التحويل<input id="paymentProofFile" type="file" accept="image/png,image/jpeg,image/webp" required><small>PNG / JPG / WEBP — الحد الأقصى 3MB</small></label><button class="btn primary" ${installed.length?'':'disabled'}>📤 إرسال طلب الدفع</button><a class="btn" href="/payments">عرض دفعاتي</a></form></div></section>
      <script>(function(){const f=document.getElementById('zainCheckoutForm'),file=document.getElementById('paymentProofFile'),hidden=document.getElementById('proofData');if(!f||!file||!hidden)return;let prepared=false;f.addEventListener('submit',function(e){if(prepared)return;e.preventDefault();const x=file.files&&file.files[0];if(!x){file.setCustomValidity('ارفع صورة إثبات الدفع');file.reportValidity();return;}file.setCustomValidity('');if(x.size>3*1024*1024){alert('حجم الصورة أكبر من 3MB.');return;}if(!['image/png','image/jpeg','image/webp'].includes(x.type)){alert('استخدم PNG أو JPG أو WEBP.');return;}const r=new FileReader();r.onload=function(){hidden.value=String(r.result||'');prepared=true;f.requestSubmit();};r.onerror=function(){alert('تعذر قراءة صورة الإثبات.');};r.readAsDataURL(x);});})();</script>`;
    res.send(layout('الدفع عبر Zain Cash',body,req.user));
  }catch(e){next(e);}});

  app.post('/checkout',requireLogin,checkCsrf,async(req,res,next)=>{try{
    const plan=paymentPlan(req.body.plan),site=await store.getGlobalConfig(),zain=resolvedZainCash(site);if(!zain.enabled)throw new Error('الدفع عبر Zain Cash غير مفعّل.');
    const gid=String(req.body.guildId||'').trim(),g=userGuild(req,gid);if(!g||!canManage(g))return res.status(403).send(layout('Payment Error','<section class="login"><h1>❌ لا تملك صلاحية إدارة هذا السيرفر</h1><a class="btn" href="/checkout?plan='+plan+'">رجوع</a></section>',req.user));
    if(!await getBotGuild(gid).catch(()=>null))throw new Error('بوت ZOMBI غير موجود في السيرفر المحدد.');
    const currentPlan=planNameForConfig(await store.getConfig(gid));if(currentPlan==='premium_plus'&&plan==='premium')throw new Error('هذا السيرفر لديه Premium+ فعّال. اختر Premium+ للتجديد بدل Premium.');
    const payerPhone=normalizePayerPhone(req.body.payerPhone);if(!payerPhone)throw new Error('رقم الهاتف غير صالح.');
    const proof=parsePaymentProof(req.body.proofData),amount=paymentAmount(zain,plan),days=paymentDays(zain,plan);
    const item=await payments.create({userId:req.user.id,username:req.user.displayName||req.user.username||'',guildId:gid,guildName:g.name||gid,plan,amount,days,payerPhone,transactionRef:String(req.body.transactionRef||'').trim(),...proof});
    res.send(layout('تم إرسال طلب الدفع',`<section class="login z-payment-success"><div class="z-success-icon">✓</div><h1>تم إرسال طلب الدفع</h1><p>رقم الطلب: <code>${esc(item.id)}</code></p><p>الخطة: <b>${esc(PLAN_LABELS[item.plan])}</b> • ${item.amount.toFixed(3).replace(/\.000$/,'')} JOD • ${item.days} يوم</p><p>الحالة: <b>⏳ بانتظار مراجعة Owner</b></p><div class="actions"><a class="btn primary" href="/payments">متابعة حالة الدفع</a><a class="btn" href="/dashboard/${esc(gid)}">Dashboard</a></div></section>`,req.user));
  }catch(e){next(e);}});

  app.get('/payments',requireLogin,async(req,res,next)=>{try{
    const items=await payments.list({userId:req.user.id,limit:100});
    const rows=items.map(x=>`<tr><td><code>${esc(x.id)}</code><small>${esc(paymentDate(x.createdAt))}</small></td><td><b>${esc(x.guildName||x.guildId)}</b><small>${esc(x.guildId)}</small></td><td>${esc(PLAN_LABELS[x.plan]||x.plan)}<small>${Number(x.amount).toFixed(3).replace(/\.000$/,'')} JOD • ${x.days} يوم</small></td><td><span class="z-payment-status z-status-${esc(x.status)}">${paymentStatusLabel(x.status)}</span>${x.reviewNote?`<small>${esc(x.reviewNote)}</small>`:''}</td></tr>`).join('');
    res.send(layout('دفعاتي',`<section class="dash-head"><div><h1>💳 دفعاتي</h1><p>تابع حالة طلبات Zain Cash الخاصة بك.</p></div><a class="btn primary" href="/premium">اشتراك جديد</a></section><section class="panel"><div class="table-wrap"><table><thead><tr><th>الطلب</th><th>السيرفر</th><th>الخطة</th><th>الحالة</th></tr></thead><tbody>${rows||'<tr><td colspan="4">لا توجد طلبات دفع بعد.</td></tr>'}</tbody></table></div></section>`,req.user));
  }catch(e){next(e);}});

  app.get('/dashboard',requireLogin,async(req,res,next)=>{try{
    const manageable=(req.user.guilds||[]).filter(canManage).slice(0,100);
    const presence=await getBotPresenceSnapshot();
    const reliable=Boolean(presence.api||presence.heartbeat?.guildIds?.length||presence.heartbeat?.guildCount===0);
    const statuses=manageable.map(g=>({g,installed:presence.ids.has(String(g.id))?true:(reliable?false:null)}));
    const installed=statuses.filter(x=>x.installed===true),missing=statuses.filter(x=>x.installed===false),unknown=statuses.filter(x=>x.installed===null);
    const cards=(await Promise.all(installed.map(async({g})=>{const cfg=await store.getConfig(g.id);return `<a class="server" href="/dashboard/${g.id}"><div class="server-icon">${g.icon?`<img src="https://cdn.discordapp.com/icons/${g.id}/${g.icon}.png">`:'🤖'}</div><div><b>${esc(g.name)}</b><span>${planBadge(cfg)}</span></div><em>إدارة ←</em></a>`;}))).join('');
    const add=missing.map(({g})=>`<a class="server muted" href="${inviteUrl(g.id)}"><div class="server-icon">➕</div><div><b>${esc(g.name)}</b><span>البوت غير مضاف</span></div><em>إضافة</em></a>`).join('');
    const unknownCards=unknown.map(({g})=>`<div class="server muted"><div class="server-icon">⚠️</div><div><b>${esc(g.name)}</b><span>تعذر التحقق من وجود البوت الآن</span></div><em>تحقق من BOT_TOKEN</em></div>`).join('');
    const apiWarning=presence.error&&!presence.heartbeat?`<section class="panel"><b>⚠️ تعذر فحص ZOMBI Bot من Discord.</b><p class="hint">${esc(presence.error?.message||'تحقق من BOT_TOKEN / OAUTH Proxy في إعدادات الاستضافة.')}</p></section>`:'';
    res.send(layout('Dashboard',`<section class="dash-head"><div><h1>سيرفراتك</h1><p>تظهر السيرفرات التي لديك فيها Manage Server.</p></div></section>${apiWarning}<div class="servers">${cards||(!unknownCards?'<p>لا يوجد سيرفرات مضافة تستطيع إدارتها.</p>':'')}</div>${unknownCards?`<h2>حالة غير مؤكدة</h2><div class="servers">${unknownCards}</div>`:''}${add?`<h2>إضافة ZOMBI لسيرفر آخر</h2><div class="servers">${add}</div>`:''}`,req.user));
  }catch(e){next(e);}});
  app.get('/dashboard/:guildId',requireLogin,requireGuildAccess,async(req,res,next)=>{try{const cfg=await store.getConfig(req.params.guildId);if(!cfg.setupComplete)return res.redirect(`/dashboard/${req.params.guildId}/setup`);res.send(layout(req.bundle.guild.name,await guildPage(req),req.user));}catch(e){next(e);}});

  app.get('/dashboard/:guildId/role-manager/state',requireLogin,requireGuildAccess,async(req,res,next)=>{try{
    const cfg=await store.getConfig(req.params.guildId),{guild,roles,channels}=req.bundle;
    const stateRoles=roles.sort((a,b)=>(b.position||0)-(a.position||0)).map(r=>({id:String(r.id),name:r.id===guild.id?'@everyone':String(r.name||''),position:Number(r.position||0),permissions:String(r.permissions||'0'),managed:Boolean(r.managed),color:Number(r.color||0)}));
    const allowedTypes=new Set([0,2,4,5,13,15,16]);
    const stateChannels=channels.filter(c=>allowedTypes.has(c.type)&&!c.thread_metadata).sort((a,b)=>(a.position||0)-(b.position||0)).map(c=>({id:String(c.id),name:String(c.name||''),type:Number(c.type),parentId:String(c.parent_id||''),position:Number(c.position||0),overwrites:(Array.isArray(c.permission_overwrites)?c.permission_overwrites:[]).map(o=>({id:String(o.id),type:Number(o.type),allow:String(o.allow||'0'),deny:String(o.deny||'0')}))}));
    res.json({ok:true,guild:{id:String(guild.id),name:String(guild.name||'')},permissions:roleManagerPermissionMeta(),roles:stateRoles,channels:stateChannels,security:roleSecuritySnapshot(cfg)});
  }catch(e){next(e);}});

  app.post('/dashboard/:guildId/role-manager/apply',requireLogin,requireGuildAccess,checkCsrf,async(req,res,next)=>{try{
    const gid=String(req.params.guildId),roleId=String(req.body?.roleId||''),bundle=req.bundle,role=bundle.roles.find(r=>String(r.id)===roleId);
    if(!role)return res.status(400).json({ok:false,message:'الرتبة غير موجودة في السيرفر.'});
    if(role.managed)return res.status(400).json({ok:false,message:'هذه رتبة Managed من Discord/Integration ولا يمكن تعديلها يدويًا.'});
    const validRoles=new Set(bundle.roles.map(r=>String(r.id))),validChannels=new Set(bundle.channels.map(c=>String(c.id)));
    const errors=[];let roleUpdated=false,channelsUpdated=0,securityUpdated=false;
    if(req.body?.serverPermissionsDirty===true){
      const selected=new Set(arr(req.body.serverPermissions).map(String).filter(k=>ROLE_PERMISSION_BY_KEY.has(k)));let managedMask=0n,desired=0n;for(const def of ROLE_PERMISSION_DEFS){managedMask|=def.value;if(selected.has(def.key))desired|=def.value;}const current=BigInt(String(role.permissions||'0')),nextBits=(current&~managedMask)|desired;
      try{await botFetch(`/guilds/${gid}/roles/${roleId}`,{method:'PATCH',body:JSON.stringify({permissions:nextBits.toString()})});roleUpdated=true;}catch(e){errors.push(`صلاحيات الرتبة: ${e.message}`);}
    }
    const channelChanges=Array.isArray(req.body?.channelChanges)?req.body.channelChanges.slice(0,200):[];
    for(const change of channelChanges){const channelId=String(change?.channelId||'');if(!validChannels.has(channelId))continue;const channel=bundle.channels.find(c=>String(c.id)===channelId);if(!channel)continue;const existing=(Array.isArray(channel.permission_overwrites)?channel.permission_overwrites:[]).find(o=>String(o.id)===roleId&&Number(o.type)===0);let allow=BigInt(String(existing?.allow||'0')),deny=BigInt(String(existing?.deny||'0'));for(const [key,state] of Object.entries(change?.states||{})){const def=ROLE_PERMISSION_BY_KEY.get(key);if(!def||!CHANNEL_PERMISSION_KEYS.has(key)||!['allow','deny','inherit'].includes(state))continue;allow&=~def.value;deny&=~def.value;if(state==='allow')allow|=def.value;else if(state==='deny')deny|=def.value;}try{await botFetch(`/channels/${channelId}/permissions/${roleId}`,{method:'PUT',body:JSON.stringify({type:0,allow:allow.toString(),deny:deny.toString()})});channelsUpdated++;}catch(e){errors.push(`#${channel?.name||channelId}: ${e.message}`);}}
    const cfg=await store.getConfig(gid);let security=normalizeSecurityPayload(req.body?.security,validRoles,validChannels,cfg);
    const changes=Array.isArray(req.body?.contentChanges)?req.body.contentChanges.slice(0,300):[];const map=new Map((Array.isArray(cfg.roleSecurity?.channelRules)?cfg.roleSecurity.channelRules:[]).map(x=>[`${x.roleId}:${x.channelId}`,{...x}]));
    for(const change of changes){const channelId=String(change?.channelId||'');if(!validChannels.has(channelId))continue;const key=`${roleId}:${channelId}`,row={roleId,channelId};for(const kind of CONTENT_KINDS)row[kind]=['allow','deny','inherit'].includes(change?.[kind])?change[kind]:'inherit';if(CONTENT_KINDS.some(k=>row[k]!=='inherit'))map.set(key,row);else map.delete(key);}
    security.channelRules=[...map.values()].filter(x=>validRoles.has(String(x.roleId))&&validChannels.has(String(x.channelId))).slice(0,1000);cfg.roleSecurity=security;await store.saveConfig(gid,cfg);securityUpdated=true;
    const adminSelected=arr(req.body.serverPermissions).map(String).includes('Administrator');
    res.status(errors.length?207:200).json({ok:errors.length===0,partial:errors.length>0,roleUpdated,channelsUpdated,securityUpdated,warning:adminSelected?'Administrator يتجاوز قيود القنوات في Discord؛ حماية ZOMBI للروابط/الوسائط تبقى فعالة.':'',errors,message:errors.length?'تم حفظ جزء من التغييرات مع وجود أخطاء.':'تم حفظ وتطبيق الصلاحيات بنجاح.'});
  }catch(e){next(e);}});

  app.post('/dashboard/:guildId/sync-commands',requireLogin,requireGuildAccess,checkCsrf,async(req,res)=>{try{const appId=String(process.env.DISCORD_CLIENT_ID||'').trim();if(!appId)throw new Error('DISCORD_CLIENT_ID غير موجود.');const syncCfg=await store.getConfig(req.params.guildId);const result=await botFetch(`/applications/${appId}/guilds/${req.params.guildId}/commands`,{method:'PUT',body:JSON.stringify(publicCommandPayload(syncCfg?.currency?.name||''))});res.send(layout('Commands Synced',`<section class="login"><h1>✅ تمت مزامنة أوامر السيرفر</h1><p>تم تسجيل <b>${Array.isArray(result)?result.length:'كل'}</b> أمر. ارجع لديسكورد واكتب <code>/games</code> أو <code>/roulette</code>.</p><a class="btn primary" href="/dashboard/${req.params.guildId}">رجوع للداشبورد</a></section>`,req.user));}catch(e){res.status(400).send(layout('Command Sync Error',`<section class="login"><h1>❌ تعذر مزامنة الأوامر</h1><p>${esc(e.message)}</p><a class="btn" href="/dashboard/${req.params.guildId}">رجوع</a></section>`,req.user));}});

  app.post('/dashboard/:guildId/settings',requireLogin,requireGuildAccess,checkCsrf,async(req,res,next)=>{try{
    const [cfg,site]=await Promise.all([store.getConfig(req.params.guildId),store.getGlobalConfig()]);
    const beforeSettings=structuredClone(cfg);
    // Never interpret a missing section marker as "save everything". Older
    // frontend builds occasionally lost _settingsSection during submit, which
    // made unchecked/missing controls from unrelated pages overwrite saved
    // values. A full save is now allowed only when the request explicitly says
    // _settingsSection=all.
    const rawSaveSection=Array.isArray(req.body?._saveSection)?req.body._saveSection.at(-1):req.body?._saveSection;
    const rawSettingsSection=Array.isArray(req.body?._settingsSection)?req.body._settingsSection.at(-1):req.body?._settingsSection;
    const requestedSection=String(rawSaveSection||rawSettingsSection||'overview').replace(/[^a-z0-9_-]/gi,'').slice(0,40)||'overview';
    const knownSections=new Set(['all','permissions','warnings','logs','overview','welcome','line','economy','members','xp','store','games','city','heist','gangs','robbery','roles','name','tickets','voice','guide','director','suggestions','rules','music','premium','event']);
    const settingsSection=knownSections.has(requestedSection)?requestedSection:'overview';
    const saves=(...names)=>settingsSection==='all'||names.includes(settingsSection);
    const has=name=>Object.prototype.hasOwnProperty.call(req.body||{},name);

    // Only validate the section that is actually being saved. Hidden fields in
    // other dashboard pages must never block this request.
    const rejectOverLimit=(raw,limitKey,label)=>{
      if(raw===undefined||raw===''||Number(raw)<=Number(maxFor(req,cfg,site,limitKey)))return false;
      return sendUpgradeRequired(req,res,site,cfg,`${label}: الحد الحالي في خطتك هو ${Number(maxFor(req,cfg,site,limitKey)).toLocaleString()}. هذه القيمة تحتاج ترقية الاشتراك، أو يرفع Owner الحد المسموح للخطة من لوحة المالك.`);
    };
    if(saves('guide')){
      if(featureAllowed(site,cfg,'serverGuide'))cfg.features.serverGuide=Boolean(req.body.serverGuideEnabled);
      cfg.serverGuide={...cfg.serverGuide,enabled:Boolean(req.body.serverGuideEnabled),title:String(req.body.serverGuideTitle||cfg.serverGuide?.title||'🧭 دليل السيرفر').slice(0,256),description:String(req.body.serverGuideDescription||cfg.serverGuide?.description||'').slice(0,2000),footer:String(req.body.serverGuideFooter||cfg.serverGuide?.footer||'ZOMBI • SERVER GUIDE').slice(0,160),color:/^#[0-9a-f]{6}$/i.test(String(req.body.serverGuideColor||''))?String(req.body.serverGuideColor):String(cfg.serverGuide?.color||'#7c3aed'),bannerUrl:String(req.body.serverGuideBannerUrl||'').trim()};
    }
    if(saves('director')){
      if(featureAllowed(site,cfg,'cityDirector'))cfg.features.cityDirector=Boolean(req.body.cityDirectorEnabled);
      cfg.cityDirector={...cfg.cityDirector,
        enabled:Boolean(req.body.cityDirectorEnabled),
        autoEnabled:Boolean(req.body.cityDirectorAutoEnabled),
        useBuiltinEvents:Boolean(req.body.cityDirectorUseBuiltinEvents),
        spreadAllOpenChannels:Boolean(req.body.cityDirectorSpreadAllOpenChannels),
        intervalMinutes:int(req.body.cityDirectorIntervalMinutes,cfg.cityDirector?.intervalMinutes||120,5,10080),
        durationMinutes:int(req.body.cityDirectorDurationMinutes,cfg.cityDirector?.durationMinutes||10,1,180),
        minParticipants:int(req.body.cityDirectorMinParticipants,cfg.cityDirector?.minParticipants||2,2,500),
        maxParticipants:int(req.body.cityDirectorMaxParticipants,cfg.cityDirector?.maxParticipants||30,2,500),
        missionStages:int(req.body.cityDirectorMissionStages,cfg.cityDirector?.missionStages||8,2,100),
        taskSeconds:int(req.body.cityDirectorTaskSeconds,cfg.cityDirector?.taskSeconds||45,15,300),
        successPercent:int(req.body.cityDirectorSuccessPercent,cfg.cityDirector?.successPercent||70,50,100),
        rewardMin:int(req.body.cityDirectorRewardMin,cfg.cityDirector?.rewardMin||500,0,1000000000),
        rewardMax:int(req.body.cityDirectorRewardMax,cfg.cityDirector?.rewardMax||1500,0,1000000000),
        penaltiesEnabled:Boolean(req.body.cityDirectorPenaltiesEnabled),
        cashPenaltyAmount:int(req.body.cityDirectorCashPenaltyAmount,cfg.cityDirector?.cashPenaltyAmount||1000,0,1000000000),
        bankPenaltyAmount:int(req.body.cityDirectorBankPenaltyAmount,cfg.cityDirector?.bankPenaltyAmount||1500,0,1000000000),
        mutePenaltyMinutes:int(req.body.cityDirectorMutePenaltyMinutes,cfg.cityDirector?.mutePenaltyMinutes||120,5,10080),
        punishmentChannelId:String(req.body.cityDirectorPunishmentChannelId||''),
        excludedChannelIds:arr(req.body.cityDirectorExcludedChannelIds).filter(x=>/^\d{15,25}$/.test(String(x))).slice(0,100),
        mentionEveryone:Boolean(req.body.cityDirectorMentionEveryone)
      };
      if(cfg.cityDirector.maxParticipants<cfg.cityDirector.minParticipants)cfg.cityDirector.maxParticipants=cfg.cityDirector.minParticipants;
      if(cfg.cityDirector.rewardMax<cfg.cityDirector.rewardMin)cfg.cityDirector.rewardMax=cfg.cityDirector.rewardMin;
    }

    const panelMediaSections={bank:'city',games:'games',tickets:'tickets',store:'store',roles:'roles',name:'name',guide:'guide',rules:'rules'};
    cfg.panelMedia={...(cfg.panelMedia||{})};
    for(const [key,section] of Object.entries(panelMediaSections)){
      if(!saves(section))continue;
      const bannerField=`panelMedia_${key}_bannerUrl`,thumbField=`panelMedia_${key}_thumbnailUrl`;
      if(has(bannerField)||has(thumbField)){
        const previous=cfg.panelMedia[key]||{};
        cfg.panelMedia[key]={
          ...previous,
          bannerUrl:has(bannerField)?String(req.body[bannerField]||'').trim():String(previous.bannerUrl||''),
          thumbnailUrl:has(thumbField)?String(req.body[thumbField]||'').trim():String(previous.thumbnailUrl||'')
        };
      }
    }

    if(saves('welcome')){
      const welcomeChannelId=String(req.body.welcomeChannel||'').trim();
      const welcomeRulesChannelId=String(req.body.welcomeRulesChannel||'').trim();
      const validWelcomeTextChannel=id=>!id||req.bundle.channels.some(c=>String(c.id)===String(id)&&[0,5].includes(Number(c.type)));
      if(!validWelcomeTextChannel(welcomeChannelId))return res.status(400).send('روم الترحيب غير صالح لهذا السيرفر.');
      if(!validWelcomeTextChannel(welcomeRulesChannelId))return res.status(400).send('روم القوانين غير صالح لهذا السيرفر.');
      if(Boolean(req.body.welcomeEnabled)&&!welcomeChannelId)return res.status(400).send('اختر روم الترحيب قبل تفعيل النظام.');
      const welcomeChannels=Array.from({length:3},(_,idx)=>({
        label:String(req.body[`welcomeLabel_${idx}`]||'').trim().slice(0,60),
        emoji:String(req.body[`welcomeEmoji_${idx}`]||'📌').trim().slice(0,16)||'📌',
        channelId:String(req.body[`welcomeRefChannel_${idx}`]||'').trim()
      })).filter(item=>item.channelId);
      for(const item of welcomeChannels){
        if(!validWelcomeTextChannel(item.channelId))return res.status(400).send(`روم ${item.label||'القسم'} غير صالح لهذا السيرفر.`);
      }
      cfg.welcome={
        ...(cfg.welcome||{}),
        enabled:Boolean(req.body.welcomeEnabled),
        channelId:welcomeChannelId,
        rulesChannelId:welcomeRulesChannelId,
        bannerUrl:String(req.body.welcomeBannerUrl||'').trim(),
        title:String(req.body.welcomeTitle||'').trim().slice(0,120),
        description:String(req.body.welcomeDescription||'').trim().slice(0,400),
        channels:welcomeChannels
      };
    }

    if(saves('economy')){
      if(rejectOverLimit(req.body.dailyAmount,'maxDailyReward','Daily Reward'))return;
      if(rejectOverLimit(req.body.messageReward,'maxMessageReward','مكافأة الرسائل'))return;
      if(rejectOverLimit(req.body.voiceReward,'maxVoiceReward','Voice Reward'))return;
    }
    if(saves('city')&&rejectOverLimit(req.body.bankMaxTransaction,'maxBankTransaction','أقصى عملية بالبنك'))return;
    if(saves('gangs')){
      if(rejectOverLimit(req.body.gangMaxMembers,'gangMembers','أقصى أعضاء العصابة'))return;
      if(rejectOverLimit(req.body.gangMaxDeputies,'gangDeputies','أقصى نواب العصابة'))return;
    }
    if(saves('robbery')&&rejectOverLimit(req.body.robberyMinParticipants,'robberyParticipants','عدد المشاركين بسرقة البنك'))return;
    if(saves('music')&&rejectOverLimit(req.body.musicDefaultVolume,'musicMaxVolume','مستوى صوت الموسيقى'))return;

    if(saves('games')){
      const checks=[];
      const limits={
        maxRounds:limitFor(site,cfg,'maxRounds'),
        maxRoundTimeSeconds:limitFor(site,cfg,'maxRoundTimeSeconds'),
        maxWinnerReward:limitFor(site,cfg,'maxWinnerReward'),
        maxGamePlayers:limitFor(site,cfg,'maxGamePlayers')
      };
      for(const g of GAME_DEFS){
        checks.push(
          [req.body[`game_rounds_${g.id}`],limits.maxRounds,`${g.label}: عدد الجولات`],
          [req.body[`game_time_${g.id}`],limits.maxRoundTimeSeconds,`${g.label}: وقت الجولة`],
          [req.body[`game_reward_${g.id}`],limits.maxWinnerReward,`${g.label}: جائزة الفائز`]
        );
      }
      for(const name of ['rouletteMinPlayers','rouletteMaxPlayers','chairsMinPlayers','chairsMaxPlayers','mafiaMinPlayers','mafiaMaxPlayers']){
        checks.push([req.body[name],limits.maxGamePlayers,'عدد اللاعبين']);
      }
      const exceeded=checks.find(([raw,max])=>raw!==undefined&&raw!==''&&Number(raw)>Number(max));
      if(exceeded)return sendUpgradeRequired(req,res,site,cfg,`${exceeded[2]}: الحد الحالي في خطتك هو ${Number(exceeded[1]).toLocaleString()}. هذه القيمة تحتاج ترقية الاشتراك، أو يرفع Owner الحد المسموح للخطة من لوحة المالك.`);
    }

    const oldBotProfile={
      botNickname:String(cfg.branding?.botNickname||''),
      avatarUrl:String(cfg.branding?.avatarUrl||''),
      bannerUrl:String(cfg.branding?.bannerUrl||''),
      bio:String(cfg.branding?.bio||'')
    };

    if(saves('overview')){
      cfg.system={
        ...cfg.system,
        presenceText:has('presenceText')?String(req.body.presenceText||'ZOM Economy | /help').slice(0,128):String(cfg.system?.presenceText||'ZOM Economy | /help'),
        presenceStatus:has('presenceStatus')&&['online','idle','dnd','invisible'].includes(String(req.body.presenceStatus))?String(req.body.presenceStatus):(cfg.system?.presenceStatus||'online')
      };
      // Only feature toggles physically present in this section are changed.
      // This prevents a section save from disabling hidden features.
      for(const k of CORE_FEATURES){
        if(has(`feature_${k}`))cfg.features[k]=featureAllowed(site,cfg,k)?Boolean(req.body[`feature_${k}`]):false;
      }
    }

    // Branding / bot identity lives in the Premium section in the UI.
    // Keep overview compatible with older dashboard builds, but only touch fields
    // that were actually posted so saving one section never wipes another one.
    if(saves('overview','premium','line')){
      if(featureAllowed(site,cfg,'customBranding')){
        if(has('brandColor'))cfg.branding.color=String(req.body.brandColor||cfg.branding.color);
        if(has('customName'))cfg.branding.customName=String(req.body.customName||'').slice(0,80);
        if(has('customFooter'))cfg.branding.customFooter=String(req.body.customFooter||'').slice(0,160);
      }
      if(featureAllowed(site,cfg,'customBotProfile')){
        if(has('botNickname'))cfg.branding.botNickname=String(req.body.botNickname||'').slice(0,32);
        if(has('avatarUrl'))cfg.branding.avatarUrl=String(req.body.avatarUrl||'').trim();
        if(has('bannerUrl'))cfg.branding.bannerUrl=String(req.body.bannerUrl||'').trim();
        if(has('botBio'))cfg.branding.bio=String(req.body.botBio||'').trim().slice(0,190);
        if(has('panelLogoUrl'))cfg.branding.panelLogoUrl=String(req.body.panelLogoUrl||'').trim();
        if(has('panelBannerUrl'))cfg.branding.panelBannerUrl=String(req.body.panelBannerUrl||'').trim();
      }
      if(has('lineUrl'))cfg.branding.lineUrl=String(req.body.lineUrl||'').trim();if(has('lineRoleIds'))cfg.branding.lineRoleIds=arr(req.body.lineRoleIds).slice(0,50);
    }

    if(saves('economy')){
      if(featureAllowed(site,cfg,'customCurrency'))cfg.currency.name=String(req.body.currencyName||cfg.currency.name).slice(0,20);
      cfg.currency.emoji=String(req.body.currencyEmoji||cfg.currency.emoji).slice(0,16);
      cfg.economy={
        ...cfg.economy,
        dailyAmount:int(req.body.dailyAmount,cfg.economy.dailyAmount,0,maxFor(req,cfg,site,'maxDailyReward')),
        dailyCooldownHours:int(req.body.dailyCooldownHours,cfg.economy.dailyCooldownHours,1,720),
        messageEvery:int(req.body.messageEvery,cfg.economy.messageEvery,1,10000),
        messageReward:int(req.body.messageReward,cfg.economy.messageReward,0,maxFor(req,cfg,site,'maxMessageReward')),
        messageCooldownSeconds:int(req.body.messageCooldownSeconds,cfg.economy.messageCooldownSeconds,0,86400),
        transferCooldownSeconds:int(req.body.transferCooldownSeconds,cfg.economy.transferCooldownSeconds,0,86400),
        topExcludedUserIds:[...new Set(String(req.body.coinTopExcludedUserIds||'').match(/\d{15,25}/g)||[])].slice(0,100),
        voiceEveryMinutes:int(req.body.voiceEveryMinutes,cfg.economy.voiceEveryMinutes,1,1440),
        voiceReward:int(req.body.voiceReward,cfg.economy.voiceReward,0,maxFor(req,cfg,site,'maxVoiceReward')),
        messageChannelIds:arr(req.body.messageChannelIds).slice(0,50),
        voiceChannelIds:arr(req.body.voiceChannelIds).slice(0,50)
      };
    }

    // Channel selectors are physically moved between pages by dashboard.js.
    // Update only selectors that were submitted so another page can never be erased.
    if(saves('logs') && has('loggingPresent')){
      cfg.moderation={...cfg.moderation,logActions:Boolean(req.body.modLogActions)};
      cfg.logging={...cfg.logging};
      for(const key of ['audit','messages','members','voice','games','commands','actions'])cfg.logging[key]=Boolean(req.body['log_'+key]);
      const selected=String(req.body.logs||'');
      if(selected&&!req.bundle.channels.some(c=>c.id===selected&&[0,5].includes(c.type)))return res.status(400).send('روم اللوج غير صالح لهذا السيرفر.');
    }
    const channelSections={
      logs:'logs',logBank:'city',logEconomy:'economy',logGangs:'gangs',logRobbery:'robbery',logTickets:'tickets',logStore:'store',logWarnings:'warnings',logGames:'games',logLevels:'xp',logVoice:'voice',logMusic:'music',logModeration:'members',logMessages:'logs',logMembers:'logs',logCommands:'logs',logPanels:'logs',logRoles:'roles',logNameChange:'name',logPremium:'premium',logEvent:'event',logSystem:'logs',
      levelUp:'xp',zom:'economy',gamePanel:'games',ticketPanel:'tickets',ticketCategory:'tickets',storePanel:'store',rolePanel:'roles',bankPanel:'city',centralBank:'robbery',gangCategory:'gangs',gangLogs:'gangs',voiceCreate:'voice',voiceControl:'voice',voiceCategory:'voice',nameChangePanel:'name',serverGuidePanel:'guide',cityDirector:'director'
    };
    const setSystemChannel=(name,value)=>{
      value=String(value||'');
      cfg.channels[name]=value; // backward-compatible mirror
      if(name==='logs'){cfg.logs={...(cfg.logs||{}),channelId:value};return;}
      if(name==='gamePanel'){cfg.games={...(cfg.games||{}),panelChannelId:value};return;}
      if(name==='ticketPanel'){cfg.tickets={...(cfg.tickets||{}),panelChannelId:value};return;}
      if(name==='ticketCategory'){cfg.tickets={...(cfg.tickets||{}),categoryId:value};return;}
      if(name==='storePanel'){cfg.store={...(cfg.store||{}),panelChannelId:value};return;}
      if(name==='rolePanel'){cfg.rolePanel={...(cfg.rolePanel||{}),channelId:value};return;}
      if(name==='levelUp'){cfg.levels={...(cfg.levels||{}),levelUpChannelId:value};return;}
      if(name==='bankPanel'){cfg.bank={...(cfg.bank||{}),panelChannelId:value};return;}
      if(name==='centralBank'){cfg.bank={...(cfg.bank||{}),centralBankChannelId:value};return;}
      if(name==='gangCategory'){cfg.gangs={...(cfg.gangs||{}),categoryId:value};return;}
      if(name==='gangLogs'){cfg.gangs={...(cfg.gangs||{}),logsChannelId:value};return;}
      if(name==='voiceCreate'){cfg.voiceRooms={...(cfg.voiceRooms||{}),createChannelId:value};return;}
      if(name==='voiceControl'){cfg.voiceRooms={...(cfg.voiceRooms||{}),controlChannelId:value};return;}
      if(name==='voiceCategory'){cfg.voiceRooms={...(cfg.voiceRooms||{}),categoryId:value};return;}
      if(name==='nameChangePanel'){cfg.nameChange={...(cfg.nameChange||{}),panelChannelId:value};return;}
      if(name==='serverGuidePanel'){cfg.serverGuide={...(cfg.serverGuide||{}),panelChannelId:value};return;}
      if(name==='cityDirector'){cfg.cityDirector={...(cfg.cityDirector||{}),channelId:value};return;}
    };
    for(const [name,section] of Object.entries(channelSections)){
      if(has(name)&&saves(section))setSystemChannel(name,req.body[name]);
    }

    if(saves('city')){
      cfg.bank={
        ...cfg.bank,
        depositEnabled:Boolean(req.body.bankDepositEnabled),
        withdrawEnabled:Boolean(req.body.bankWithdrawEnabled),
        maxTransaction:int(req.body.bankMaxTransaction,cfg.bank?.maxTransaction||1,1,maxFor(req,cfg,site,'maxBankTransaction')),
        title:String(req.body.bankTitle??cfg.bank?.title??'').trim().slice(0,256),
        description:String(req.body.bankDescription??cfg.bank?.description??'').trim().slice(0,2000),
        panelFooter:String(req.body.bankPanelFooter??cfg.bank?.panelFooter??'').trim().slice(0,500),
        panelCenterName:String(req.body.bankPanelCenterName??cfg.bank?.panelCenterName??'').trim().slice(0,120),
        panelColor:/^#[0-9a-f]{6}$/i.test(String(req.body.bankPanelColor||''))?String(req.body.bankPanelColor):String(cfg.bank?.panelColor||'#8B5CF6'),
        goldValue:int(req.body.bankGoldValue,cfg.bank?.goldValue||100000,1,1000000000),
        salaryCooldownHours:int(req.body.bankSalaryCooldownHours,cfg.bank?.salaryCooldownHours??4,0,720),
        maxSalary:int(req.body.bankMaxSalary,cfg.bank?.maxSalary??1000,0,1000000000),
        tradeProfitPercent:int(req.body.bankTradeProfitPercent,cfg.bank?.tradeProfitPercent??15,0,1000),
        tradeSessionMinutes:int(req.body.bankTradeSessionMinutes,cfg.bank?.tradeSessionMinutes??5,1,1440),
        maxLoan:int(req.body.bankMaxLoan,cfg.bank?.maxLoan??100000,0,1000000000),
        loanInterestPercent:int(req.body.bankLoanInterestPercent,cfg.bank?.loanInterestPercent??10,0,1000),
        companyEmployeeStartSalary:int(req.body.companyEmployeeStartSalary,cfg.bank?.companyEmployeeStartSalary??4000,0,1000000000),
        companyEmployeeSalaryIncrease:int(req.body.companyEmployeeSalaryIncrease,cfg.bank?.companyEmployeeSalaryIncrease??500,0,1000000000),
        companyLevelUpHours:int(req.body.companyLevelUpHours,cfg.bank?.companyLevelUpHours??24,1,8760),
        companyOwnerStartSalary:int(req.body.companyOwnerStartSalary,cfg.bank?.companyOwnerStartSalary??100000,0,1000000000),
        companyOwnerSalaryIncrease:int(req.body.companyOwnerSalaryIncrease,cfg.bank?.companyOwnerSalaryIncrease??5000,0,1000000000),
        workRewardMin:int(req.body.bankWorkRewardMin,cfg.bank?.workRewardMin??150,0,1000000000),
        workRewardMax:int(req.body.bankWorkRewardMax,cfg.bank?.workRewardMax??500,0,1000000000),
        workCooldownMinutes:int(req.body.bankWorkCooldownMinutes,cfg.bank?.workCooldownMinutes??60,1,10080),
        savingsInterestPercent:int(req.body.bankSavingsInterestPercent,cfg.bank?.savingsInterestPercent??1,0,100),
        savingsInterestCooldownHours:int(req.body.bankSavingsInterestCooldownHours,cfg.bank?.savingsInterestCooldownHours??24,1,720),
        savingsInterestMaxReward:int(req.body.bankSavingsInterestMaxReward,cfg.bank?.savingsInterestMaxReward??10000,0,1000000000),
        topColor:/^#[0-9a-f]{6}$/i.test(String(req.body.bankTopColor||''))?String(req.body.bankTopColor):String(cfg.bank?.topColor||'#E11D48'),
        topLogoUrl:String(req.body.bankTopLogoUrl||'').trim(),
        topExcludedUserIds:[...new Set(String(req.body.bankTopExcludedUserIds||'').match(/\d{15,25}/g)||[])].slice(0,100)
      };
      if(cfg.bank.workRewardMax<cfg.bank.workRewardMin)cfg.bank.workRewardMax=cfg.bank.workRewardMin;
      if(featureAllowed(site,cfg,'bank')){
        await store.saveData(req.params.guildId,'bank-catalog.json',{
          jobs:parseBankJobs(req.body.bankJobsText),
          companies:parseBankCompanies(req.body.bankCompaniesText),
          stocks:parseBankStocks(req.body.bankStocksText)
        });
      }
    }

    if(saves('suggestions')){
      cfg.suggestions={
        ...(cfg.suggestions||{}),
        enabled:Boolean(req.body.suggestionsEnabled),
        channels:Array.from({length:6},(_,idx)=>({
          channelId:String(req.body[`suggestionChannelId_${idx}`]||''),
          label:String(req.body[`suggestionLabel_${idx}`]||'اقتراحات').slice(0,80),
          type:String(req.body[`suggestionLabel_${idx}`]||`type-${idx+1}`).slice(0,40),
          emoji:String(req.body[`suggestionEmoji_${idx}`]||'💡').slice(0,16),
          color:/^#[0-9a-f]{6}$/i.test(String(req.body[`suggestionColor_${idx}`]||''))?String(req.body[`suggestionColor_${idx}`]):'#E11D48',
          enabled:Boolean(req.body[`suggestionEnabled_${idx}`])
        })).filter(r=>/^\d{15,25}$/.test(r.channelId)).slice(0,20)
      };
    }

    if(saves('heist')){
      cfg.bank={
        ...cfg.bank,
        heistEnabled:Boolean(req.body.heistEnabled),
        heistGameCooldownSeconds:int(req.body.heistGameCooldownSeconds,cfg.bank?.heistGameCooldownSeconds||7200,60,604800),
        heistTimeSeconds:int(req.body.heistTimeSeconds,cfg.bank?.heistTimeSeconds||25,10,120),
        heistJailHours:int(req.body.heistJailHours,cfg.bank?.heistJailHours||2,1,24),
        heistBailPrice:int(req.body.heistBailPrice,cfg.bank?.heistBailPrice||50000,0,1000000000),
        cashProtectionPrice:int(req.body.cashProtectionPrice,cfg.bank?.cashProtectionPrice||25000,0,1000000000),
        cashProtectionMinutes:int(req.body.cashProtectionMinutes,cfg.bank?.cashProtectionMinutes||60,1,10080),
        cashProtectionCooldownMinutes:int(req.body.cashProtectionCooldownMinutes,cfg.bank?.cashProtectionCooldownMinutes||240,1,43200)
      };
      cfg.bank.heistGamesEnabled={...(cfg.bank.heistGamesEnabled||{})};
      for(const g of HEIST_GAME_DEFS){
        if(heistGameAllowed(site,cfg,g.id))cfg.bank.heistGamesEnabled[g.id]=Boolean(req.body[`heist_game_${g.id}`]);
      }
    }

    if(saves('xp')){
      cfg.levels={
        ...cfg.levels,
        xpPerMessage:int(req.body.xpPerMessage,cfg.levels.xpPerMessage,1,10000),
        xpCooldownSeconds:int(req.body.xpCooldownSeconds,cfg.levels.xpCooldownSeconds,5,3600),
        baseXp:int(req.body.baseXp,cfg.levels.baseXp,10,1000000),
        growth:int(req.body.levelGrowth,cfg.levels.growth,0,1000000),
        bannerUrl:String(req.body.levelsBannerUrl||'').trim(),
        thumbnailUrl:String(req.body.levelsThumbnailUrl||'').trim()
      };
    }

    if(saves('members')){
      const validRoleIds=new Set(req.bundle.roles.filter(r=>!r.managed&&String(r.id)!==String(req.params.guildId)).map(r=>String(r.id)));
      const validTextChannelIds=new Set(req.bundle.channels.filter(c=>[0,5,15,16].includes(Number(c.type))).map(c=>String(c.id)));
      const validVoiceChannelIds=new Set(req.bundle.channels.filter(c=>[2,13].includes(Number(c.type))).map(c=>String(c.id)));
      const timeoutRoles=arr(req.body.timeoutAllowedRoleIds).map(String).filter(id=>validRoleIds.has(id)).slice(0,50);
      const moveRoles=arr(req.body.moveAllowedRoleIds).map(String).filter(id=>validRoleIds.has(id)).slice(0,50);
      const moveSourceChannels=arr(req.body.moveSourceChannelIds).map(String).filter(id=>validVoiceChannelIds.has(id)).slice(0,100);
      const moveDestinationChannels=arr(req.body.moveDestinationChannelIds).map(String).filter(id=>validVoiceChannelIds.has(id)).slice(0,100);
      let roleBanAllowedRoles=arr(req.body.roleBanAllowedRoleIds).map(String).filter(id=>validRoleIds.has(id)).slice(0,50);
      const previousRoleBanRoleId=String(cfg.moderation?.roleBanRoleId||'').trim();
      let roleBanRoleId=String(req.body.roleBanRoleId||'').trim();
      // Never create a new punishment role just because the selector was missing/blank.
      // If the dashboard section submit did not include the selector, keep the last valid saved role.
      if(!roleBanRoleId&&previousRoleBanRoleId&&validRoleIds.has(previousRoleBanRoleId))roleBanRoleId=previousRoleBanRoleId;
      const roleBanVisibleChannels=arr(req.body.roleBanVisibleChannelIds).map(String).filter(id=>validTextChannelIds.has(id)).slice(0,100);
      if(roleBanRoleId&&!validRoleIds.has(roleBanRoleId))return res.status(400).send('رتبة ban 💥 غير صالحة لهذا السيرفر. اختر رتبة موجودة من القائمة.');
      const requestedRoleBanEnabled=Boolean(req.body.roleBanEnabled);
      if(requestedRoleBanEnabled&&!roleBanRoleId){
        return res.status(400).send('اختر رتبة العقوبة من Dashboard أولًا. تم إيقاف الإنشاء التلقائي حتى لا تتكرر رتب ban داخل السيرفر.');
      }
      roleBanAllowedRoles=roleBanAllowedRoles.filter(id=>id!==roleBanRoleId);
      cfg.moderation={
        ...cfg.moderation,
        clearEnabled:Boolean(req.body.modClearEnabled),
        kickEnabled:Boolean(req.body.modKickEnabled),
        banEnabled:Boolean(req.body.modBanEnabled),
        lockEnabled:Boolean(req.body.modLockEnabled),
        logActions:cfg.moderation?.logActions!==false,
        timeoutEnabled:Boolean(req.body.timeoutEnabled),
        timeoutAllowedRoleIds:timeoutRoles,
        timeoutMaxMinutes:int(req.body.timeoutMaxMinutes,cfg.moderation?.timeoutMaxMinutes||10080,1,40320),
        timeoutRequireReason:Boolean(req.body.timeoutRequireReason),
        timeoutOwnerBypass:Boolean(req.body.timeoutOwnerBypass),
        timeoutRespectHierarchy:Boolean(req.body.timeoutRespectHierarchy),
        moveEnabled:Boolean(req.body.moveEnabled),
        moveAllowedRoleIds:moveRoles,
        moveOwnerBypass:Boolean(req.body.moveOwnerBypass),
        moveSourceChannelIds:moveSourceChannels,
        moveDestinationChannelIds:moveDestinationChannels,
        roleBanEnabled:requestedRoleBanEnabled,
        roleBanRoleId,
        roleBanAllowedRoleIds:roleBanAllowedRoles,
        roleBanVisibleChannelIds:roleBanVisibleChannels,
        roleBanOwnerBypass:Boolean(req.body.roleBanOwnerBypass),
        roleBanRespectHierarchy:Boolean(req.body.roleBanRespectHierarchy),
        roleBanAllowSendMessages:Boolean(req.body.roleBanAllowSendMessages),
        roleBanHideVoice:Boolean(req.body.roleBanHideVoice)
      };
    }

    if(saves('warnings')){
      if(['warningChannelId','warningRoleIds','warning_members_roleIds','warning_administration_roleIds','warning_events_roleIds','warning_members_channelId','warning_administration_channelId','warning_events_channelId','warning_members_allowedRoleIds','warning_administration_allowedRoleIds','warning_events_allowedRoleIds'].some(has)){
        if(!featureAllowed(site,cfg,'warnings'))return sendUpgradeRequired(req,res,site,cfg,'نظام التحذيرات غير متاح لخطة هذا السيرفر حسب إعدادات الأونر.');
        const legacyWarningChannelId=String(req.body.warningChannelId||cfg.warnings?.channelId||'');
        const warningRoleSets={
          members:arr(req.body.warning_members_roleIds??req.body.warningRoleIds).map(id=>String(id).trim()),
          administration:arr(req.body.warning_administration_roleIds).map(id=>String(id).trim()),
          events:arr(req.body.warning_events_roleIds).map(id=>String(id).trim())
        };
        const warningChannelIds={members:String(req.body.warning_members_channelId??legacyWarningChannelId),administration:String(req.body.warning_administration_channelId??legacyWarningChannelId),events:String(req.body.warning_events_channelId??legacyWarningChannelId)};
        const warningAllowedRoleSets={members:arr(req.body.warning_members_allowedRoleIds).map(id=>String(id).trim()).filter(Boolean),administration:arr(req.body.warning_administration_allowedRoleIds).map(id=>String(id).trim()).filter(Boolean),events:arr(req.body.warning_events_allowedRoleIds).map(id=>String(id).trim()).filter(Boolean)};
        if(Object.values(warningChannelIds).some(id=>id&&!req.bundle.channels.some(c=>c.id===id&&[0,5].includes(c.type))))return res.status(400).send('أحد شاتات التحذيرات غير صالح لهذا السيرفر.');
        const allWarningRoles=[...Object.values(warningRoleSets).flat(),...Object.values(warningAllowedRoleSets).flat()];
        if(allWarningRoles.some(id=>id&&!req.bundle.roles.some(r=>r.id===id&&!r.managed&&id!==req.params.guildId)))return res.status(400).send('رتبة تحذير غير صالحة لهذا السيرفر.');
        cfg.warnings={...cfg.warnings,channelId:warningChannelIds.members,roleIds:warningRoleSets.members,role1Id:warningRoleSets.members[0]||'',role2Id:warningRoleSets.members[1]||'',role3Id:warningRoleSets.members[2]||'',systems:{members:{channelId:warningChannelIds.members,allowedRoleIds:warningAllowedRoleSets.members,roleIds:warningRoleSets.members},administration:{channelId:warningChannelIds.administration,allowedRoleIds:warningAllowedRoleSets.administration,roleIds:warningRoleSets.administration},events:{channelId:warningChannelIds.events,allowedRoleIds:warningAllowedRoleSets.events,roleIds:warningRoleSets.events}}};
      }
    }

    if(saves('gangs')){
      cfg.gangs={
        ...cfg.gangs,
        maxMembers:int(req.body.gangMaxMembers,cfg.gangs.maxMembers,2,maxFor(req,cfg,site,'gangMembers')),
        maxDeputies:int(req.body.gangMaxDeputies,cfg.gangs.maxDeputies||0,0,maxFor(req,cfg,site,'gangDeputies')),
        createCost:int(req.body.gangCreateCost,cfg.gangs.createCost||0,0,1000000000),
        bankEnabled:Boolean(req.body.gangBankEnabled),
        missionsEnabled:Boolean(req.body.gangMissionsEnabled),
        missionCooldownMinutes:int(req.body.gangMissionCooldownMinutes,cfg.gangs.missionCooldownMinutes||240,1,10080),
        missionDurationMinutes:int(req.body.gangMissionDurationMinutes,cfg.gangs.missionDurationMinutes||30,5,180),
        missionRewardMin:int(req.body.gangMissionRewardMin,cfg.gangs.missionRewardMin||0,0,1000000000),
        missionRewardMax:int(req.body.gangMissionRewardMax,cfg.gangs.missionRewardMax||0,0,1000000000),
        minMissionParticipants:int(req.body.gangMinMissionParticipants,cfg.gangs.minMissionParticipants||2,2,25),
        maxMissionSteps:int(req.body.gangMaxMissionSteps,cfg.gangs.maxMissionSteps||5,1,10),
        puzzleMaxAttempts:int(req.body.gangPuzzleMaxAttempts,cfg.gangs.puzzleMaxAttempts||2,1,20),
        chatMaxAttempts:int(req.body.gangChatMaxAttempts,cfg.gangs.chatMaxAttempts||2,1,20),
        relayMaxAttempts:int(req.body.gangRelayMaxAttempts,cfg.gangs.relayMaxAttempts||2,1,20),
        missionVoiceSeconds:int(req.body.gangMissionVoiceSeconds,cfg.gangs.missionVoiceSeconds||60,10,3600),
        roleColor:String(req.body.gangRoleColor||cfg.gangs.roleColor||'#2b2d31')
      };
      if(cfg.gangs.missionRewardMax<cfg.gangs.missionRewardMin)cfg.gangs.missionRewardMax=cfg.gangs.missionRewardMin;
    }

    if(saves('robbery')){
      const robberyMentionMode=['none','everyone','here','role'].includes(String(req.body.robberyMentionMode||''))?String(req.body.robberyMentionMode):'everyone';
      const robberyMentionRoleId=String(req.body.robberyMentionRoleId||'').trim();
      if(robberyMentionMode==='role'&&(!robberyMentionRoleId||!req.bundle.roles.some(r=>r.id===robberyMentionRoleId&&!r.managed&&r.id!==req.params.guildId)))return res.status(400).send('رتبة منشن السرقة غير صالحة لهذا السيرفر.');
      cfg.robbery={
        ...cfg.robbery,
        enabled:Boolean(req.body.robberyEnabled),
        minParticipants:int(req.body.robberyMinParticipants,cfg.robbery?.minParticipants||5,2,maxFor(req,cfg,site,'robberyParticipants')),
        mentionMode:robberyMentionMode,
        mentionRoleId:robberyMentionRoleId,
        stageCount:int(req.body.robberyStageCount,cfg.robbery?.stageCount||10,5,20),
        difficulty:['normal','hard','elite','legendary'].includes(String(req.body.robberyDifficulty||''))?String(req.body.robberyDifficulty):'hard',
        stageTimeSeconds:int(req.body.robberyStageTimeSeconds,cfg.robbery?.stageTimeSeconds||60,20,300),
        maxAttemptsPerStage:int(req.body.robberyMaxAttemptsPerStage,cfg.robbery?.maxAttemptsPerStage||3,1,6),
        alarmMax:int(req.body.robberyAlarmMax,cfg.robbery?.alarmMax||5,2,10),
        channelMode:String(req.body.robberyChannelMode)==='selected'?'selected':'all',
        channelCount:int(req.body.robberyChannelCount,cfg.robbery?.channelCount||8,2,20),
        channelIds:arr(req.body.robberyChannelIds).filter(x=>req.bundle.channels.some(c=>String(c.id)===String(x)&&[0,5].includes(c.type))).slice(0,50),
        lobbyMinutes:int(req.body.robberyLobbyMinutes,cfg.robbery?.lobbyMinutes||10,2,60),
        missionMinutes:int(req.body.robberyMissionMinutes,cfg.robbery?.missionMinutes||25,5,180),
        reward:int(req.body.robberyReward,cfg.robbery?.reward||50000,1,1000000000),
        cooldownHours:int(req.body.robberyCooldownHours,cfg.robbery?.cooldownHours||12,0,720),
        equipment:{
          mask:int(req.body.robberyMask,cfg.robbery?.equipment?.mask||0,0,1000000000),
          hacking:int(req.body.robberyHacking,cfg.robbery?.equipment?.hacking||0,0,1000000000),
          drill:int(req.body.robberyDrill,cfg.robbery?.equipment?.drill||0,0,1000000000),
          radio:int(req.body.robberyRadio,cfg.robbery?.equipment?.radio||0,0,1000000000),
          car:int(req.body.robberyCar,cfg.robbery?.equipment?.car||0,0,1000000000)
        }
      };
    }

    if(saves('music')){
      const musicAllowed=featureAllowed(site,cfg,'music');
      if(has('musicEnabled')&&!musicAllowed&&Boolean(req.body.musicEnabled))return sendUpgradeRequired(req,res,site,cfg,'نظام الموسيقى غير متاح في خطتك الحالية.');
      const availableRoles=Array.isArray(req.bundle?.roles)?req.bundle.roles:[];
      const validRoleIds=new Set(availableRoles.filter(r=>!r.managed&&String(r.id)!==String(req.params.guildId)).map(r=>String(r.id)));
      const previousMusic=cfg.music||{};
      cfg.music={
        ...previousMusic,
        // Checkboxes and an empty multi-select are omitted by browsers when cleared.
        // Because this block only runs while saving the Music section, omission means false/empty.
        // Preserve the previous values only when the current plan does not allow editing Music.
        enabled:musicAllowed?Boolean(req.body.musicEnabled):previousMusic.enabled!==false,
        allowEveryone:musicAllowed?Boolean(req.body.musicAllowEveryone):previousMusic.allowEveryone!==false,
        controllerRoleIds:musicAllowed?arr(req.body.musicControllerRoleIds).map(String).filter(id=>validRoleIds.has(id)).slice(0,50):(Array.isArray(previousMusic.controllerRoleIds)?previousMusic.controllerRoleIds:[]),
        defaultVolume:musicAllowed?int(req.body.musicDefaultVolume,previousMusic.defaultVolume||60,1,maxFor(req,cfg,site,'musicMaxVolume')):Number(previousMusic.defaultVolume||60),
        autoLeaveSeconds:musicAllowed?int(req.body.musicAutoLeaveSeconds,previousMusic.autoLeaveSeconds||180,30,3600):Number(previousMusic.autoLeaveSeconds||180),
        announceNowPlaying:musicAllowed?Boolean(req.body.musicAnnounceNowPlaying):previousMusic.announceNowPlaying!==false
      };
    }

    if(saves('voice')){
    }

    if(saves('voice')){
      cfg.voiceRooms={
        ...cfg.voiceRooms,
        enabled:Boolean(req.body.voiceRoomsEnabled),
        roomName:String(req.body.voiceRoomName||cfg.voiceRooms?.roomName||'🎙️・{username}').slice(0,80),
        userLimit:int(req.body.voiceUserLimit,cfg.voiceRooms?.userLimit||0,0,99),
        bitrate:int(req.body.voiceBitrate,cfg.voiceRooms?.bitrate||64000,8000,384000),
        bannerUrl:String(req.body.voiceBannerUrl||'').trim(),
        thumbnailUrl:String(req.body.voiceThumbnailUrl||'').trim()
      };
      if(has('voiceChannelIds'))cfg.economy={...cfg.economy,voiceChannelIds:arr(req.body.voiceChannelIds).slice(0,50)};
    }

    if(saves('name')){
      cfg.nameChange={
        ...cfg.nameChange,
        enabled:Boolean(req.body.nameChangeEnabled),
        title:String(req.body.nameChangeTitle||cfg.nameChange?.title||'').slice(0,160),
        description:String(req.body.nameChangeDescription||cfg.nameChange?.description||'').slice(0,1200),
        buttonLabel:String(req.body.nameChangeButtonLabel||cfg.nameChange?.buttonLabel||'تغيير اسمي').slice(0,80),
        buttonEmoji:String(req.body.nameChangeButtonEmoji||cfg.nameChange?.buttonEmoji||'✏️').slice(0,32),
        modalTitle:String(req.body.nameChangeModalTitle||cfg.nameChange?.modalTitle||'').slice(0,80),
        inputLabel:String(req.body.nameChangeInputLabel||cfg.nameChange?.inputLabel||'').slice(0,80),
        inputPlaceholder:String(req.body.nameChangeInputPlaceholder||cfg.nameChange?.inputPlaceholder||'').slice(0,120),
        successMessage:String(req.body.nameChangeSuccessMessage||cfg.nameChange?.successMessage||'').slice(0,1200),
        cooldownSeconds:int(req.body.nameChangeCooldownSeconds,cfg.nameChange?.cooldownSeconds||30,0,86400),
        color:String(req.body.nameChangeColor||cfg.nameChange?.color||'#8B5CF6'),
        bannerUrl:String(req.body.nameChangeBannerUrl||'').trim()
      };
    }

    if(saves('tickets')){
      cfg.tickets={
        ...cfg.tickets,
        title:String(req.body.ticketTitle||cfg.tickets.title).slice(0,256),
        description:String(req.body.ticketDescription||cfg.tickets.description).slice(0,2000),
        buttonLabel:String(req.body.ticketButtonLabel||cfg.tickets.buttonLabel).slice(0,80),
        buttonEmoji:String(req.body.ticketButtonEmoji||cfg.tickets.buttonEmoji).slice(0,32),
        supportRoleIds:arr(req.body.supportRoleIds).slice(0,maxFor(req,cfg,site,'ticketSupportRoles'))
      };
    }

    if(saves('store')){
      cfg.store={
        ...cfg.store,
        title:String(req.body.storeTitle||cfg.store.title).slice(0,256),
        description:String(req.body.storeDescription||cfg.store.description).slice(0,2000),
        footer:String(req.body.storeFooter||cfg.store.footer||'ZOMBI • ZOM Store').slice(0,160),
        accentColor:String(req.body.storeAccentColor||cfg.store.accentColor||cfg.branding.color),
        thumbnailUrl:String(req.body.storeThumbnailUrl||'').trim(),
        bannerUrl:String(req.body.storeBannerUrl||'').trim(),
        detailBannerUrl:String(req.body.storeDetailBannerUrl||'').trim()
      };
    }

    if(saves('roles')){
      cfg.rolePanel={
        ...cfg.rolePanel,
        title:String(req.body.rolePanelTitle||cfg.rolePanel.title).slice(0,256),
        description:String(req.body.rolePanelDescription||cfg.rolePanel.description).slice(0,2000),
        footer:String(req.body.rolePanelFooter||cfg.rolePanel.footer||'ZOMBI • ROLE CENTER').slice(0,160)
      };
      const autoRoleId=String(req.body.autoRoleRoleId||'').trim();
      const currentGuildId=String(req.params.guildId||'').trim();
      const availableRoles=Array.isArray(req.bundle?.roles)?req.bundle.roles:[];
      if(autoRoleId&&!availableRoles.some(r=>String(r.id)===autoRoleId&&String(r.id)!==currentGuildId&&!r.managed)){
        return res.status(400).send('الرتبة التلقائية غير صالحة لهذا السيرفر.');
      }
      cfg.autoRole={
        enabled:Boolean(req.body.autoRoleEnabled)&&Boolean(autoRoleId),
        roleId:autoRoleId,
        includeBots:Boolean(req.body.autoRoleIncludeBots)
      };
    }

    if(saves('games')){
      const canRules=featureAllowed(site,cfg,'gameSettings');
      cfg.games.panelTitle=String(req.body.gamePanelTitle??cfg.games?.panelTitle??'🎮 ألعاب ZOM').trim().slice(0,256)||'🎮 ألعاب ZOM';
      cfg.games.panelDescription=String(req.body.gamePanelDescription??cfg.games?.panelDescription??'').trim().slice(0,4096);
      cfg.games.panelFooter=String(req.body.gamePanelFooter??cfg.games?.panelFooter??'ZOM Games System').trim().slice(0,2048)||'ZOM Games System';
      cfg.games.startImageUrl=String(req.body.gameStartImageUrl??cfg.games?.startImageUrl??'').trim().slice(0,2000);
      cfg.panelDesigns=cfg.panelDesigns||{};
      cfg.panelDesigns.games={...(cfg.panelDesigns.games||{}),title:cfg.games.panelTitle,description:cfg.games.panelDescription,footer:cfg.games.panelFooter};
      for(const g of GAME_DEFS){
        const allowed=gameAllowed(site,cfg,g.id);
        cfg.games.enabled[g.id]=allowed&&Boolean(req.body[`game_enabled_${g.id}`]);
        if(canRules&&allowed){
          const old=cfg.games.quickGameSettings[g.id]||{};
          const minReward=int(req.body[`game_reward_min_${g.id}`],old.rewardMin??old.winnerReward??0,0,maxFor(req,cfg,site,'maxWinnerReward'));
          const maxReward=int(req.body[`game_reward_max_${g.id}`],old.rewardMax??old.winnerReward??300,minReward,maxFor(req,cfg,site,'maxWinnerReward'));
          cfg.games.quickGameSettings[g.id]={
            rounds:int(req.body[`game_rounds_${g.id}`],old.rounds||5,1,maxFor(req,cfg,site,'maxRounds')),
            roundTimeSeconds:int(req.body[`game_time_${g.id}`],old.roundTimeSeconds||25,5,maxFor(req,cfg,site,'maxRoundTimeSeconds')),
            winnerReward:maxReward,
            cooldownSeconds:int(req.body[`game_cooldown_${g.id}`],old.cooldownSeconds||0,0,86400),
            rewardMin:minReward,
            rewardMax:maxReward,
            xpReward:int(req.body[`game_xp_${g.id}`],old.xpReward||0,0,100000),
            allowedChannelIds:arr(req.body[`game_channels_${g.id}`]).map(String).filter(id=>/^\d{15,25}$/.test(id)).slice(0,50),
            startRoleIds:arr(req.body[`game_roles_${g.id}`]).map(String).filter(id=>/^\d{15,25}$/.test(id)).slice(0,50)
          };
        }
      }
      cfg.games.startRoleIds=arr(req.body.gameStartRoleIds).map(String).filter(id=>/^\d{15,25}$/.test(id)).slice(0,25);
      cfg.games.wheelRewards=String(req.body.wheelRewards||'').split(/[\s,]+/).map(x=>Number(x)).filter(Number.isFinite).map(x=>Math.max(0,Math.round(x))).slice(0,30);
      if(!cfg.games.wheelRewards.length)cfg.games.wheelRewards=[50,75,100,150,200,300];
      cfg.games.rouletteEnabled=Boolean(req.body.rouletteEnabled);
      cfg.games.rouletteTurnSeconds=int(req.body.rouletteTurnSeconds,cfg.games.rouletteTurnSeconds||25,10,120);
      cfg.games.rouletteActionCosts={
        revive:int(req.body.rouletteCostRevive,cfg.games.rouletteActionCosts?.revive||0,0,1000000000),
        link:int(req.body.rouletteCostLink,cfg.games.rouletteActionCosts?.link||0,0,1000000000),
        protect:int(req.body.rouletteCostProtect,cfg.games.rouletteActionCosts?.protect||0,0,1000000000),
        freeze:int(req.body.rouletteCostFreeze,cfg.games.rouletteActionCosts?.freeze||0,0,1000000000),
        double:int(req.body.rouletteCostDouble,cfg.games.rouletteActionCosts?.double||0,0,1000000000),
        curse:int(req.body.rouletteCostCurse,cfg.games.rouletteActionCosts?.curse||0,0,1000000000),
        unlink:int(req.body.rouletteCostUnlink,cfg.games.rouletteActionCosts?.unlink||0,0,1000000000),
        add:int(req.body.rouletteCostAdd,cfg.games.rouletteActionCosts?.add||0,0,1000000000)
      };
      cfg.games.letterChain={
        ...cfg.games.letterChain,
        enabled:true,
        command:String(req.body.letterChainCommand||cfg.games.letterChain?.command||'#تجميع-الحروف').trim().replace(/\s+/g,' ').slice(0,40)||'#تجميع-الحروف',
        lobbySeconds:int(req.body.letterChainLobbySeconds,cfg.games.letterChain?.lobbySeconds||25,5,300),
        answerSeconds:int(req.body.letterChainAnswerSeconds,cfg.games.letterChain?.answerSeconds||15,5,120),
        judgeSeconds:int(req.body.letterChainJudgeSeconds,cfg.games.letterChain?.judgeSeconds||20,5,120),
        winnerReward:int(req.body.letterChainWinnerReward,cfg.games.letterChain?.winnerReward??300,0,maxFor(req,cfg,site,'maxWinnerReward')),
        minPlayers:int(req.body.letterChainMinPlayers,cfg.games.letterChain?.minPlayers||3,2,25),
        maxPlayers:int(req.body.letterChainMaxPlayers,cfg.games.letterChain?.maxPlayers||20,2,25),
        channelIds:arr(req.body.letterChainChannelIds).map(String).filter(id=>/^\d{15,25}$/.test(id)).slice(0,50),
        startRoleIds:arr(req.body.letterChainStartRoleIds).map(String).filter(id=>/^\d{15,25}$/.test(id)).slice(0,50),
        letterPool:String(req.body.letterChainLetterPool||cfg.games.letterChain?.letterPool||'').trim().slice(0,300)
      };
      if(cfg.games.letterChain.maxPlayers<cfg.games.letterChain.minPlayers)cfg.games.letterChain.maxPlayers=cfg.games.letterChain.minPlayers;
      cfg.games.chairs={
        ...cfg.games.chairs,
        startCountdownSeconds:int(req.body.chairsStartCountdownSeconds,cfg.games.chairs?.startCountdownSeconds||5,1,60),
        betweenRoundsMs:int(req.body.chairsBetweenRoundsMs,cfg.games.chairs?.betweenRoundsMs||2500,250,30000)
      };
      const playerMax=maxFor(req,cfg,site,'maxGamePlayers');
      cfg.games.lobby=cfg.games.lobby||{};
      for(const id of ['roulette','chairs']){
        const min=int(req.body[`${id}MinPlayers`],cfg.games.lobby?.[id]?.minPlayers||2,2,playerMax);
        const max=int(req.body[`${id}MaxPlayers`],cfg.games.lobby?.[id]?.maxPlayers||playerMax,min,playerMax);
        cfg.games.lobby[id]={minPlayers:min,maxPlayers:max};
      }
      {
        const min=int(req.body.mafiaMinPlayers,cfg.games.lobby?.mafia?.minPlayers||4,4,playerMax);
        const max=int(req.body.mafiaMaxPlayers,cfg.games.lobby?.mafia?.maxPlayers||playerMax,min,playerMax);
        cfg.games.lobby.mafia={minPlayers:min,maxPlayers:max};
      }
      cfg.games.outsider={
        reward:int(req.body.outsiderReward,cfg.games.outsider?.reward??300,0,1000000000),
        minPlayers:int(req.body.outsiderMinPlayers,cfg.games.outsider?.minPlayers??3,3,25),
        maxPlayers:int(req.body.outsiderMaxPlayers,cfg.games.outsider?.maxPlayers??20,3,25)
      };
      if(cfg.games.outsider.maxPlayers<cfg.games.outsider.minPlayers)cfg.games.outsider.maxPlayers=cfg.games.outsider.minPlayers;
      cfg.games.xoTournament={
        reward:int(req.body.xoTournamentReward,cfg.games.xoTournament?.reward??0,0,1000000000),
        minPlayers:int(req.body.xoTournamentMinPlayers,cfg.games.xoTournament?.minPlayers??2,2,25),
        maxPlayers:int(req.body.xoTournamentMaxPlayers,cfg.games.xoTournament?.maxPlayers??16,2,25)
      };
      if(cfg.games.xoTournament.maxPlayers<cfg.games.xoTournament.minPlayers)cfg.games.xoTournament.maxPlayers=cfg.games.xoTournament.minPlayers;
    }

    access.restoreLocked(beforeSettings,cfg,site);
    cfg.setupComplete=true;
    // Save only the fields that changed in this request, merged atomically with
    // the latest DB row. This prevents the bot or another dashboard request from
    // overwriting a successful save with an older full config snapshot.
    const saved=store.saveConfigDelta
      ? await store.saveConfigDelta(req.params.guildId,beforeSettings,cfg)
      : await store.saveConfig(req.params.guildId,cfg);

    // Never show ?saved=1 unless the persisted row can be read back immediately.
    // This turns silent/illusory saves into a visible error instead of claiming success.
    const persisted=await store.getConfig(req.params.guildId);
    const verifyKeys={
      overview:['system','features','branding'], welcome:['welcome'], economy:['currency','economy','channels'], members:['moderation','autoRole','roleSecurity'], xp:['levels','channels'],
      store:['store','channels','panelMedia'], games:['games','channels','panelMedia'], city:['bank','channels','panelMedia'], heist:['bank'], gangs:['gangs','channels'], robbery:['robbery','channels'],
      roles:['rolePanel','channels','panelMedia'], name:['nameChange','channels','panelMedia'], tickets:['tickets','channels','panelMedia'], voice:['voiceRooms','channels','economy'], guide:['serverGuide','channels','panelMedia'],
      director:['cityDirector','channels'], suggestions:['suggestions'], rules:['rules','panelMedia'], music:['music'], logs:['logging','moderation','channels'], warnings:['warnings'], permissions:['roleSecurity']
    };
    const keys=settingsSection==='all'?Object.keys(cfg):verifyKeys[settingsSection]||[];
    const stableValue=value=>{
      if(Array.isArray(value))return value.map(stableValue);
      if(value&&typeof value==='object'){const out={};for(const key of Object.keys(value).sort())out[key]=stableValue(value[key]);return out;}
      return value??null;
    };
    const sameValue=(a,b)=>JSON.stringify(stableValue(a))===JSON.stringify(stableValue(b));
    let verified=persisted;
    let mismatch=keys.find(key=>!sameValue(verified?.[key],saved?.[key]));
    // A bot process can save another setting at almost the same moment. Re-apply only
    // this request's delta once against the newest row, then verify again. This avoids
    // both false “saved” messages and lost dashboard changes.
    if(mismatch&&store.saveConfigDelta){
      await new Promise(resolve=>setTimeout(resolve,75));
      await store.saveConfigDelta(req.params.guildId,beforeSettings,cfg);
      verified=await store.getConfig(req.params.guildId);
      mismatch=keys.find(key=>!sameValue(verified?.[key],saved?.[key]));
    }
    if(mismatch)throw new Error(`فشل التحقق من حفظ قسم ${settingsSection} (${mismatch}). لم يتم اعتبار العملية محفوظة.`);

    if(saves('members')){
      // إذا تغيّرت رتبة العقوبة، امسح فقط البتّات التي يديرها ZOMBI من الرتبة القديمة.
      const oldRoleBanId=String(beforeSettings?.moderation?.roleBanRoleId||'');
      const newRoleBanId=String(saved?.moderation?.roleBanRoleId||'');
      if(oldRoleBanId&&oldRoleBanId!==newRoleBanId){
        await syncRoleBanPermissionsViaApi(req.params.guildId,req.bundle,{...saved.moderation,roleBanRoleId:oldRoleBanId,roleBanEnabled:false}).catch(()=>{});
      }
      // طبّق صلاحيات رتبة ban فورًا قدر الإمكان؛ البوت يعيد المحاولة دوريًا أيضًا.
      await syncRoleBanPermissionsViaApi(req.params.guildId,req.bundle,saved.moderation).catch(e=>console.warn('⚠️ role ban dashboard sync:',e?.message||e));
    }

    if(saves('overview','premium')&&has('botNickname')&&featureAllowed(site,saved,'customBotProfile')){
      const forceProfile=String(req.body.forceBotProfile||'')==='1';
      const nickChanged=forceProfile||oldBotProfile.botNickname!==String(saved.branding.botNickname||'');
      if(nickChanged){
        try{
          await botFetch(`/guilds/${req.params.guildId}/members/@me`,{method:'PATCH',body:JSON.stringify({nick:saved.branding.botNickname||null})});
        }catch(e){
          // لا تجعل Discord Missing Access / ترتيب الرتب يلغي حفظ إعدادات الداشبورد.
          // الإعداد محفوظ بالفعل، وسيعيد البوت مزامنة الـNickname عند توفر الصلاحية.
          const d=discordFormDetails(e);
          console.warn(`⚠️ Bot nickname sync deferred for ${req.params.guildId}: ${e.message}${d?` — ${d}`:''}`);
        }
      }
    }

    // عند تغيير اسم العملة، حدّث أمر السلاش الديناميكي فورًا بدل انتظار Restart.
    if(saves('economy') && String(beforeSettings?.currency?.name||'')!==String(saved?.currency?.name||'')){
      const appId=String(process.env.DISCORD_CLIENT_ID||'').trim();
      if(appId){
        try{await botFetch(`/applications/${appId}/guilds/${req.params.guildId}/commands`,{method:'PUT',body:JSON.stringify(publicCommandPayload(saved?.currency?.name||''))});}
        catch(e){console.warn('⚠️ Currency slash alias sync failed:',e?.message||e);}
      }
    }

    redirectDashboard(req,res);
  }catch(e){next(e);}});

  app.post('/dashboard/:guildId/overview/save',requireLogin,requireGuildAccess,checkCsrf,async(req,res,next)=>{try{
    const gid=req.params.guildId;
    const [current,site]=await Promise.all([store.getConfig(gid),store.getGlobalConfig()]);
    const next={
      ...current,
      system:{...(current.system||{})},
      features:{...(current.features||{})},
      branding:{...(current.branding||{})},
      channels:{...(current.channels||{})}
    };
    if(req.body.presenceText!==undefined)next.system.presenceText=String(req.body.presenceText||'ZOM Economy | /help').slice(0,128);
    if(req.body.presenceStatus!==undefined&&['online','idle','dnd','invisible'].includes(String(req.body.presenceStatus)))next.system.presenceStatus=String(req.body.presenceStatus);
    for(const k of CORE_FEATURES){
      if(req.body[`feature_${k}`]!==undefined || Object.prototype.hasOwnProperty.call(req.body,`feature_${k}`)){
        next.features[k]=featureAllowed(site,current,k)?Boolean(req.body[`feature_${k}`]):false;
      }
    }
    if(featureAllowed(site,current,'customBranding')){
      if(req.body.brandColor!==undefined)next.branding.color=String(req.body.brandColor||current.branding?.color||'#E11D48');
      if(req.body.customName!==undefined)next.branding.customName=String(req.body.customName||'').slice(0,80);
      if(req.body.customFooter!==undefined)next.branding.customFooter=String(req.body.customFooter||'').slice(0,160);
    }
    if(featureAllowed(site,current,'customBotProfile')){
      if(req.body.botNickname!==undefined)next.branding.botNickname=String(req.body.botNickname||'').slice(0,32);
      if(req.body.avatarUrl!==undefined)next.branding.avatarUrl=String(req.body.avatarUrl||'').trim();
      if(req.body.bannerUrl!==undefined)next.branding.bannerUrl=String(req.body.bannerUrl||'').trim();
      if(req.body.botBio!==undefined)next.branding.bio=String(req.body.botBio||'').trim().slice(0,190);
      if(req.body.panelLogoUrl!==undefined)next.branding.panelLogoUrl=String(req.body.panelLogoUrl||'').trim();
      if(req.body.panelBannerUrl!==undefined)next.branding.panelBannerUrl=String(req.body.panelBannerUrl||'').trim();
    }
    if(req.body.lineUrl!==undefined)next.branding.lineUrl=String(req.body.lineUrl||'').trim();if(req.body.lineRoleIds!==undefined)next.branding.lineRoleIds=arr(req.body.lineRoleIds).slice(0,50);

    const validText=id=>!id||req.bundle.channels.some(c=>String(c.id)===String(id)&&[0,5].includes(Number(c.type)));
    const validCategory=id=>!id||req.bundle.channels.some(c=>String(c.id)===String(id)&&Number(c.type)===4);
    const validVoice=id=>!id||req.bundle.channels.some(c=>String(c.id)===String(id)&&[2,13].includes(Number(c.type)));
    const channelNames=['logs','logBank','logEconomy','logGangs','logRobbery','logTickets','logStore','logWarnings','logGames','logLevels','logVoice','logMusic','logModeration','logMessages','logMembers','logCommands','logPanels','logRoles','logNameChange','logPremium','logEvent','logSystem','levelUp','zom','gamePanel','ticketPanel','ticketCategory','storePanel','rolePanel','bankPanel','centralBank','gangCategory','gangLogs','voiceCreate','voiceControl','voiceCategory','nameChangePanel','serverGuidePanel','cityDirector'];
    for(const name of channelNames){
      if(req.body[name]===undefined)continue;
      const value=String(req.body[name]||'').trim();
      const ok=name==='ticketCategory'||name==='gangCategory'||name==='voiceCategory'?validCategory(value):name==='voiceCreate'?validVoice(value):validText(value);
      if(!ok)throw new Error(`الروم المحدد في ${name} غير صالح لهذا السيرفر.`);
      next.channels[name]=value;
    }
    const saved=store.saveConfigDelta?await store.saveConfigDelta(gid,current,next):await store.saveConfig(gid,next);
    const verify=await store.getConfig(gid);
    const stable=v=>Array.isArray(v)?v.map(stable):(v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,stable(v[k])])):v??null);
    for(const key of ['system','features','branding','channels']){
      if(JSON.stringify(stable(verify[key]))!==JSON.stringify(stable(saved[key])))throw new Error(`فشل التحقق من حفظ الرئيسية (${key}).`);
    }
    if(featureAllowed(site,saved,'customBotProfile')&&req.body.botNickname!==undefined){
      await botFetch(`/guilds/${gid}/members/@me`,{method:'PATCH',body:JSON.stringify({nick:saved.branding?.botNickname||null})}).catch(()=>{});
    }
    return res.redirect(`/dashboard/${gid}?section=overview&saved=1`);
  }catch(e){next(e);}});

  app.post('/dashboard/:guildId/welcome/save',requireLogin,requireGuildAccess,checkCsrf,async(req,res,next)=>{try{
    const gid=req.params.guildId;
    const validText=id=>!id||req.bundle.channels.some(c=>String(c.id)===String(id)&&[0,5].includes(Number(c.type)));
    const welcomeChannelId=String(req.body.welcomeChannel||'').trim();
    const rulesChannelId=String(req.body.welcomeRulesChannel||'').trim();
    if(!validText(welcomeChannelId))throw new Error('روم الترحيب غير صالح لهذا السيرفر.');
    if(!validText(rulesChannelId))throw new Error('روم القوانين غير صالح لهذا السيرفر.');
    if(Boolean(req.body.welcomeEnabled)&&!welcomeChannelId)throw new Error('اختر روم الترحيب قبل تفعيل النظام.');
    const channels=Array.from({length:3},(_,idx)=>({
      label:String(req.body[`welcomeLabel_${idx}`]||'').trim().slice(0,60),
      emoji:String(req.body[`welcomeEmoji_${idx}`]||'📌').trim().slice(0,16)||'📌',
      channelId:String(req.body[`welcomeRefChannel_${idx}`]||'').trim()
    })).filter(x=>x.channelId);
    for(const item of channels)if(!validText(item.channelId))throw new Error(`روم ${item.label||'القسم'} غير صالح لهذا السيرفر.`);
    const current=await store.getConfig(gid);
    const nextWelcome={
      ...(current.welcome||{}),
      enabled:Boolean(req.body.welcomeEnabled),
      channelId:welcomeChannelId,
      rulesChannelId,
      bannerUrl:String(req.body.welcomeBannerUrl||'').trim(),
      title:String(req.body.welcomeTitle||'').trim().slice(0,120),
      description:String(req.body.welcomeDescription||'').trim().slice(0,400),
      channels
    };
    const saved=await store.patchConfig(gid,{welcome:nextWelcome});
    const verify=await store.getConfig(gid);
    const stable=v=>Array.isArray(v)?v.map(stable):(v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,stable(v[k])])):v??null);
    if(JSON.stringify(stable(verify.welcome))!==JSON.stringify(stable(saved.welcome)))throw new Error('فشل التحقق من حفظ إعدادات الترحيب في Guild Settings.');
    return res.redirect(`/dashboard/${gid}?section=welcome&saved=1&welcomeSaved=1`);
  }catch(e){next(e);}});

  app.post('/dashboard/:guildId/questions',requireLogin,requireGuildAccess,checkCsrf,async(req,res,next)=>{try{const [cfg,site]=await Promise.all([store.getConfig(req.params.guildId),store.getGlobalConfig()]);if(!featureAllowed(site,cfg,'gameQuestions'))return res.status(403).send('تعديل الأسئلة غير متاح في خطتك.');const max=maxFor(req,cfg,site,'questionsPerGame'),next=normalizeGameContent({quizQuestions:parsePairs(req.body.quizText,max,'qa'),trueFalseQuestions:parsePairs(req.body.trueFalseText,max,'qa'),wordQuestions:parsePairs(req.body.wordText,max,'word'),speedWords:parseWords(req.body.speedText,max),dailyQuestions:parsePairs(req.body.dailyText,max,'qa')});await store.saveGameContent(req.params.guildId,next);redirectDashboard(req,res);}catch(e){next(e);}});

  app.post('/dashboard/:guildId/gangs/bank',requireLogin,requireGuildAccess,checkCsrf,async(req,res,next)=>{try{const cfg=await store.getConfig(req.params.guildId),site=await store.getGlobalConfig();if(!featureAllowed(site,cfg,'gangs'))return res.status(403).send('Gangs غير متاحة لهذه الخطة.');const state=await store.data(req.params.guildId,'gangs-public.json',{gangs:{},membership:{}}),g=state.gangs?.[String(req.body.gangId||'')];if(!g)return res.status(404).send('العصابة غير موجودة.');g.bank=Math.max(0,Math.round(Number(req.body.amount)||0));await store.saveData(req.params.guildId,'gangs-public.json',state);await appendHomeAdminOp(req.params.guildId,'home-gang-admin-ops.json',{type:'gang',action:'bank',gangId:g.id,amount:g.bank});redirectDashboard(req,res);}catch(e){next(e);}});
  app.post('/dashboard/:guildId/gangs/reset-mission',requireLogin,requireGuildAccess,checkCsrf,async(req,res,next)=>{try{const cfg=await store.getConfig(req.params.guildId),site=await store.getGlobalConfig();if(!featureAllowed(site,cfg,'gangs'))return res.status(403).send('Gangs غير متاحة لهذه الخطة.');const state=await store.data(req.params.guildId,'gangs-public.json',{gangs:{},membership:{}}),g=state.gangs?.[String(req.body.gangId||'')];if(!g)return res.status(404).send('العصابة غير موجودة.');g.lastMissionAt=0;await store.saveData(req.params.guildId,'gangs-public.json',state);await appendHomeAdminOp(req.params.guildId,'home-gang-admin-ops.json',{type:'gang',action:'reset-mission',gangId:g.id});redirectDashboard(req,res);}catch(e){next(e);}});
  app.post('/dashboard/:guildId/gangs/delete',requireLogin,requireGuildAccess,checkCsrf,async(req,res,next)=>{try{const cfg=await store.getConfig(req.params.guildId),site=await store.getGlobalConfig();if(!featureAllowed(site,cfg,'gangs'))return res.status(403).send('Gangs غير متاحة لهذه الخطة.');const state=await store.data(req.params.guildId,'gangs-public.json',{gangs:{},membership:{}}),id=String(req.body.gangId||''),g=state.gangs?.[id];if(!g)return res.status(404).send('العصابة غير موجودة.');if(g.channelId)await botFetch(`/channels/${g.channelId}`,{method:'DELETE'}).catch(()=>{});if(g.roleId)await botFetch(`/guilds/${req.params.guildId}/roles/${g.roleId}`,{method:'DELETE'}).catch(()=>{});for(const uid of g.members||g.memberIds||[])if(state.membership?.[uid]===id)delete state.membership[uid];delete state.gangs[id];await store.saveData(req.params.guildId,'gangs-public.json',state);await appendHomeAdminOp(req.params.guildId,'home-gang-admin-ops.json',{type:'gang',action:'delete',gangId:id});redirectDashboard(req,res);}catch(e){next(e);}});

  // ============================================================
  // 🎉 EVENT SYSTEM — points / leaderboard / reset / custom commands
  // ============================================================
  app.post('/dashboard/:guildId/event/settings',requireLogin,requireGuildAccess,checkCsrf,async(req,res,next)=>{try{
    const cfg=await store.getConfig(req.params.guildId),current=eventConfig(cfg);
    const validChannelIds=new Set(req.bundle.channels.filter(c=>[0,5].includes(Number(c.type))).map(c=>String(c.id)));
    const submittedChannels=req.body.eventChannelIds!==undefined?arr(req.body.eventChannelIds):arr(req.body.eventChannelId);
    const requestedChannels=[...new Set(submittedChannels.map(String).map(x=>x.trim()).filter(x=>validChannelIds.has(x)))];
    const channelLimit=eventChannelLimit(cfg);
    if(requestedChannels.length>channelLimit)return res.status(400).send(`خطتك تسمح بحد أقصى ${channelLimit} شات للأيفنت.`);
    if(Boolean(req.body.enabled)&&!requestedChannels.length)return res.status(400).send('حدد شات نصي واحد على الأقل لنظام الأيفنت.');
    const roleIds=new Set(req.bundle.roles.map(r=>String(r.id)));
    const staffRoleIds=arr(req.body.staffRoleIds).map(String).filter(x=>roleIds.has(x)&&x!==String(req.params.guildId)).slice(0,50);
    const logEvent=String(req.body.logEvent||'').trim();
    if(logEvent&&!req.bundle.channels.some(c=>String(c.id)===logEvent&&[0,5].includes(Number(c.type))))return res.status(400).send('شات لوق الأيفنت غير صحيح.');
    cfg.event={...current,
      enabled:Boolean(req.body.enabled),
      channelIds:requestedChannels,
      channelId:requestedChannels[0]||'',
      staffRoleIds,
      publicLeaderboard:Boolean(req.body.publicLeaderboard),
      leaderboardLimit:int(req.body.leaderboardLimit,current.leaderboardLimit,3,25),
      pointLabel:String(req.body.pointLabel||'نقطة').trim().slice(0,30)||'نقطة',
      leaderboardCommand:String(req.body.leaderboardCommand||'نقاط').trim().replace(/\s+/g,' ').slice(0,40)||'نقاط',
      resetCommand:String(req.body.resetCommand||'ترسيت').trim().replace(/\s+/g,' ').slice(0,40)||'ترسيت',
      directPointsEnabled:Boolean(req.body.directPointsEnabled),
      eventCommand:String(req.body.eventCommand||'ايفنت').trim().replace(/\s+/g,' ').slice(0,40)||'ايفنت',
      eventPoints:int(req.body.eventPoints,current.eventPoints||10,1,1000000),
      quickCommands:normalizeEventQuickCommands(current.quickCommands)
    };
    cfg.channels=cfg.channels||{};cfg.channels.logEvent=logEvent;
    await store.saveConfig(req.params.guildId,cfg);redirectDashboard(req,res,'event');
  }catch(e){next(e);}});

  app.post('/dashboard/:guildId/event/decision-settings',requireLogin,requireGuildAccess,checkCsrf,async(req,res,next)=>{try{
    const cfg=await store.getConfig(req.params.guildId),current=eventConfig(cfg);
    const roleIds=new Set(req.bundle.roles.map(r=>String(r.id)));
    const decisionStaffRoleIds=arr(req.body.decisionStaffRoleIds).map(String).filter(x=>roleIds.has(x)&&x!==String(req.params.guildId)).slice(0,50);
    const acceptedRoleIds=arr(req.body.acceptedRoleIds).map(String).filter(x=>roleIds.has(x)&&x!==String(req.params.guildId)).slice(0,50);
    cfg.event={...current,
      decisionEnabled:Boolean(req.body.decisionEnabled),
      decisionStaffRoleIds,
      acceptedRoleIds,
      acceptCommand:String(req.body.acceptCommand||'قبول ايفنت').trim().replace(/\s+/g,' ').slice(0,40)||'قبول ايفنت',
      rejectCommand:String(req.body.rejectCommand||'رفض ايفنت').trim().replace(/\s+/g,' ').slice(0,40)||'رفض ايفنت',
      acceptMessage:String(req.body.acceptMessage||'✅ تم قبولك في الإيفنت، ونتمنى أن تكون قد الثقة.').trim().slice(0,1000)||'✅ تم قبولك في الإيفنت، ونتمنى أن تكون قد الثقة.',
      rejectMessage:String(req.body.rejectMessage||'❌ تم رفضك في الإيفنت، نتمنى أن تعمل على تحسين نفسك.').trim().slice(0,1000)||'❌ تم رفضك في الإيفنت، نتمنى أن تعمل على تحسين نفسك.'
    };
    await store.saveConfig(req.params.guildId,cfg);redirectDashboard(req,res,'event');
  }catch(e){next(e);}});

  app.post('/dashboard/:guildId/event/promotion-settings',requireLogin,requireGuildAccess,checkCsrf,async(req,res,next)=>{try{
    const cfg=await store.getConfig(req.params.guildId),current=eventConfig(cfg);
    const roleIds=new Set(req.bundle.roles.map(r=>String(r.id)));
    const promotionCommandChannelId=String(req.body.promotionCommandChannelId||'').trim();
    if(promotionCommandChannelId&&!req.bundle.channels.some(c=>String(c.id)===promotionCommandChannelId&&[0,5].includes(Number(c.type))))return res.status(400).send('شات أمر الترقية غير صحيح.');
    const promotionNotifyChannelId=String(req.body.promotionNotifyChannelId||'').trim();
    if(promotionNotifyChannelId&&!req.bundle.channels.some(c=>String(c.id)===promotionNotifyChannelId&&[0,5].includes(Number(c.type))))return res.status(400).send('شات إشعار الترقية غير صحيح.');
    const promotionNotifyRoleId=String(req.body.promotionNotifyRoleId||'').trim();
    if(promotionNotifyRoleId&&!roleIds.has(promotionNotifyRoleId))return res.status(400).send('رتبة مسؤول الترقية غير صحيحة.');
    const promotionStaffRoleIds=arr(req.body.promotionStaffRoleIds).map(String).filter(x=>roleIds.has(x)&&x!==String(req.params.guildId)).slice(0,50);
    cfg.event={...current,
      promotionEnabled:Boolean(req.body.promotionEnabled),
      promotionCommand:String(req.body.promotionCommand||'ترقية').trim().replace(/\s+/g,' ').slice(0,40)||'ترقية',
      promotionPoints:int(req.body.promotionPoints,current.promotionPoints||10,1,1000000),
      promotionCommandChannelId,
      promotionStaffRoleIds,
      promotionThreshold:int(req.body.promotionThreshold,current.promotionThreshold||200,1,1000000000),
      promotionNotifyChannelId,
      promotionNotifyRoleId
    };
    await store.saveConfig(req.params.guildId,cfg);redirectDashboard(req,res,'event');
  }catch(e){next(e);}});

  app.post('/dashboard/:guildId/event/actions/add',requireLogin,requireGuildAccess,checkCsrf,async(req,res,next)=>{try{
    const cfg=await store.getConfig(req.params.guildId),evt=eventConfig(cfg),list=normalizeEventQuickCommands(evt.quickCommands);
    if(list.length>=30)return res.status(400).send('الحد الأقصى 30 أمر أيفنت.');
    const command=String(req.body.command||'').trim().replace(/\s+/g,' ').slice(0,40);if(!command)return res.status(400).send('اكتب اسم الأمر.');
    if(list.some(x=>x.command.toLowerCase()===command.toLowerCase()))return res.status(400).send('هذا الأمر موجود مسبقًا.');
    const action={id:`event_${Date.now().toString(36)}_${Math.floor(Math.random()*9999)}`,command,label:String(req.body.label||command).trim().slice(0,80)||command,points:int(req.body.points,0,-1000000,1000000),zom:int(req.body.zom,0,0,1000000000),targetMode:['mention','self','either'].includes(req.body.targetMode)?req.body.targetMode:'mention',response:String(req.body.response||'').trim().slice(0,500),enabled:Boolean(req.body.enabled)};
    cfg.event={...evt,quickCommands:[...list,action]};await store.saveConfig(req.params.guildId,cfg);redirectDashboard(req,res,'event');
  }catch(e){next(e);}});

  app.post('/dashboard/:guildId/event/actions/update',requireLogin,requireGuildAccess,checkCsrf,async(req,res,next)=>{try{
    const cfg=await store.getConfig(req.params.guildId),evt=eventConfig(cfg),list=normalizeEventQuickCommands(evt.quickCommands),action=list.find(x=>x.id===String(req.body.actionId||''));
    if(!action)return res.status(404).send('أمر الأيفنت غير موجود.');
    const command=String(req.body.command||'').trim().replace(/\s+/g,' ').slice(0,40);if(!command)return res.status(400).send('اكتب اسم الأمر.');
    if(list.some(x=>x.id!==action.id&&x.command.toLowerCase()===command.toLowerCase()))return res.status(400).send('يوجد أمر آخر بنفس الاسم.');
    Object.assign(action,{command,label:String(req.body.label||command).trim().slice(0,80)||command,points:int(req.body.points,0,-1000000,1000000),zom:int(req.body.zom,0,0,1000000000),targetMode:['mention','self','either'].includes(req.body.targetMode)?req.body.targetMode:'mention',response:String(req.body.response||'').trim().slice(0,500),enabled:Boolean(req.body.enabled)});
    cfg.event={...evt,quickCommands:list};await store.saveConfig(req.params.guildId,cfg);redirectDashboard(req,res,'event');
  }catch(e){next(e);}});

  app.post('/dashboard/:guildId/event/actions/delete',requireLogin,requireGuildAccess,checkCsrf,async(req,res,next)=>{try{
    const cfg=await store.getConfig(req.params.guildId),evt=eventConfig(cfg),actionId=String(req.body.actionId||'');
    cfg.event={...evt,quickCommands:normalizeEventQuickCommands(evt.quickCommands).filter(x=>x.id!==actionId)};await store.saveConfig(req.params.guildId,cfg);redirectDashboard(req,res,'event');
  }catch(e){next(e);}});

  app.post('/dashboard/:guildId/event/panels',requireLogin,requireGuildAccess,checkCsrf,async(req,res,next)=>{try{
    const valid=new Set(req.bundle.channels.filter(c=>[0,5].includes(Number(c.type))).map(c=>String(c.id)));
    const vals={dutyPanelChannelId:String(req.body.dutyPanelChannelId||''),dutyReportChannelId:String(req.body.dutyReportChannelId||''),eventPanelChannelId:String(req.body.eventPanelChannelId||''),eventReviewChannelId:String(req.body.eventReviewChannelId||''),leavePanelChannelId:String(req.body.leavePanelChannelId||''),leaveReviewChannelId:String(req.body.leaveReviewChannelId||'')};
    for(const [k,v] of Object.entries(vals))if(v&&!valid.has(v))throw new Error(`شات غير صالح: ${k}`);
    const data=await getStaff(req.params.guildId);
    data.duty={...(data.duty||{}),panelChannelId:vals.dutyPanelChannelId,reportChannelId:vals.dutyReportChannelId};
    data.event={...(data.event||{}),panelChannelId:vals.eventPanelChannelId,reviewChannelId:vals.eventReviewChannelId};
    data.leave={...(data.leave||{}),panelChannelId:vals.leavePanelChannelId,reviewChannelId:vals.leaveReviewChannelId};
    await saveStaff(req.params.guildId,data);
    const verify=await getStaff(req.params.guildId);
    if(String(verify.duty.panelChannelId||'')!==vals.dutyPanelChannelId||String(verify.event.panelChannelId||'')!==vals.eventPanelChannelId||String(verify.leave.panelChannelId||'')!==vals.leavePanelChannelId)throw new Error('فشل التحقق من حفظ شاتات لوحات الإدارة.');
    redirectDashboard(req,res,'event');
  }catch(e){next(e);}});
  app.post('/dashboard/:guildId/event/member',requireLogin,requireGuildAccess,checkCsrf,async(req,res,next)=>{try{
    const userId=String(req.body.userId||'').trim();if(!/^\d{15,25}$/.test(userId))return res.status(400).send('User ID غير صحيح.');
    const action=['add','remove','set','reset'].includes(String(req.body.action||''))?String(req.body.action):'add';
    const amount=Math.max(0,Math.min(1000000000,Math.round(Number(req.body.amount)||0)));
    const state=eventState(await store.data(req.params.guildId,'event-system.json',{season:1,users:{},history:[]}));
    const before=Number(state.users[userId]?.points||0);let after=before;
    if(action==='add')after=before+amount;else if(action==='remove')after=before-amount;else if(action==='set')after=amount;else after=0;
    const old=state.users[userId]||{points:0,added:0,removed:0,zomAwarded:0};
    state.users[userId]={...old,points:after,added:Number(old.added||0)+(after>before?after-before:0),removed:Number(old.removed||0)+(after<before?before-after:0),updatedAt:Date.now(),lastBy:String(req.user?.id||'dashboard')};
    state.history.unshift({at:Date.now(),actorId:String(req.user?.id||''),targetId:userId,type:`dashboard-${action}`,delta:after-before,zom:0,command:'Dashboard',note:`${action}: ${before} -> ${after}`});state.history=state.history.slice(0,500);
    await store.saveData(req.params.guildId,'event-system.json',state);redirectDashboard(req,res,'event');
  }catch(e){next(e);}});

  app.post('/dashboard/:guildId/event/promotion-member',requireLogin,requireGuildAccess,checkCsrf,async(req,res,next)=>{try{
    const userId=String(req.body.userId||'').trim();if(!/^\d{15,25}$/.test(userId))return res.status(400).send('User ID غير صحيح.');
    const action=['add','remove','set','reset'].includes(String(req.body.action||''))?String(req.body.action):'add';
    const amount=Math.max(0,Math.min(1000000000,Math.round(Number(req.body.amount)||0)));
    const cfg=eventConfig(await store.getConfig(req.params.guildId));
    const raw=await store.data(req.params.guildId,'promotion-system.json',{users:{},history:[]});const state=raw&&typeof raw==='object'?raw:{users:{},history:[]};state.users=state.users&&typeof state.users==='object'?state.users:{};state.history=Array.isArray(state.history)?state.history:[];
    const old=state.users[userId]||{points:0,added:0,removed:0,updatedAt:0,lastBy:'',notified:false};const before=Math.max(0,Number(old.points||0));let after=before;
    if(action==='add')after=before+amount;else if(action==='remove')after=Math.max(0,before-amount);else if(action==='set')after=amount;else after=0;
    state.users[userId]={...old,points:after,added:Number(old.added||0)+(after>before?after-before:0),removed:Number(old.removed||0)+(after<before?before-after:0),updatedAt:Date.now(),lastBy:String(req.user?.id||'dashboard'),notified:after>=cfg.promotionThreshold?action==='reset'?false:Boolean(old.notified):false};
    state.history.unshift({at:Date.now(),actorId:String(req.user?.id||''),targetId:userId,type:`dashboard-promotion-${action}`,delta:after-before,command:'Dashboard',note:`${action}: ${before} -> ${after}`});state.history=state.history.slice(0,500);state.updatedAt=Date.now();
    await store.saveData(req.params.guildId,'promotion-system.json',state);redirectDashboard(req,res,'event');
  }catch(e){next(e);}});

  app.post('/dashboard/:guildId/event/reset',requireLogin,requireGuildAccess,checkCsrf,async(req,res,next)=>{try{
    const state=eventState(await store.data(req.params.guildId,'event-system.json',{season:1,users:{},history:[]})),count=Object.keys(state.users||{}).length;
    state.season=Number(state.season||1)+1;state.users={};state.history.unshift({at:Date.now(),actorId:String(req.user?.id||''),targetId:'',type:'dashboard-reset-all',delta:0,zom:0,command:'Dashboard',note:`Reset ${count} members`});state.history=state.history.slice(0,500);
    await store.saveData(req.params.guildId,'event-system.json',state);redirectDashboard(req,res,'event');
  }catch(e){next(e);}});

  app.post('/dashboard/:guildId/bot-profile',requireLogin,requireGuildAccess,checkCsrf,async(req,res,next)=>{try{
    const [cfg,site]=await Promise.all([store.getConfig(req.params.guildId),store.getGlobalConfig()]);
    if(!featureAllowed(site,cfg,'customBotProfile'))return res.status(403).send(layout('Premium',`<section class="login"><h1>🔒 Premium</h1><p>تخصيص Nickname ولوجو وبنر البوت متاح حسب خطة السيرفر.</p><a class="btn" href="/dashboard/${req.params.guildId}?section=premium">رجوع</a></section>`,req.user));
    const mode=['save','force','reset'].includes(String(req.body.profileMode||''))?String(req.body.profileMode):'save';
    const old={botNickname:String(cfg.branding?.botNickname||''),avatarUrl:String(cfg.branding?.avatarUrl||''),bannerUrl:String(cfg.branding?.bannerUrl||''),bio:String(cfg.branding?.bio||'')};
    const nextProfile=mode==='reset'?{botNickname:'',avatarUrl:'',bannerUrl:'',bio:''}:{botNickname:String(req.body.botNickname||'').trim().slice(0,32),avatarUrl:String(req.body.avatarUrl||'').trim(),bannerUrl:String(req.body.bannerUrl||'').trim(),bio:String(req.body.botBio||'').trim().slice(0,190)};
    const force=mode==='force'||mode==='reset';
    if(force||old.botNickname!==nextProfile.botNickname){try{await botFetch(`/guilds/${req.params.guildId}/members/@me`,{method:'PATCH',body:JSON.stringify({nick:nextProfile.botNickname||null})});}catch(e){{const d=discordFormDetails(e);throw new Error(`Discord رفض تغيير Nickname البوت: ${e.message}${d?` — ${d}`:''}`);}}}
    // Discord لا يوفر Avatar/Banner منفصلًا للبوت لكل Guild عبر member PATCH.
    // نحفظ الروابط كتخصيص خاص بلوحات/Embeds هذا السيرفر فقط، بينما Nickname يتطبق فعليًا داخل السيرفر.
    cfg.branding.botNickname=nextProfile.botNickname;cfg.branding.avatarUrl=nextProfile.avatarUrl;cfg.branding.bannerUrl=nextProfile.bannerUrl;cfg.branding.panelLogoUrl=nextProfile.avatarUrl;cfg.branding.panelBannerUrl=nextProfile.bannerUrl;cfg.branding.bio=nextProfile.bio;await store.saveConfig(req.params.guildId,cfg);
    redirectDashboard(req,res);
  }catch(e){next(e);}});

  app.post('/dashboard/:guildId/redeem',requireLogin,requireGuildAccess,checkCsrf,async(req,res)=>{try{await store.redeemCode(req.params.guildId,req.body.code);redirectDashboard(req,res);}catch(e){res.status(400).send(layout('Premium',`<section class="login"><h1>❌ ${esc(e.message)}</h1><a class="btn" href="/dashboard/${req.params.guildId}">رجوع</a></section>`,req.user));}});
  app.post('/dashboard/:guildId/economy/user',requireLogin,requireGuildAccess,checkCsrf,async(req,res,next)=>{try{
    const [cfg,site]=await Promise.all([store.getConfig(req.params.guildId),store.getGlobalConfig()]);
    if(!featureAllowed(site,cfg,'economyAdmin')) return res.status(403).send('إدارة أرصدة الأعضاء غير متاحة في هذه الخطة.');
    const userId=String(req.body.userId||'').trim();if(!/^\d{15,25}$/.test(userId))return res.status(400).send('User ID غير صحيح.');
    const account=req.body.account==='bank'?'bank':'wallet',action=['set','add','remove'].includes(req.body.action)?req.body.action:'set',amount=Math.max(0,Math.round(Number(req.body.amount)||0));
    await store.updateUser(req.params.guildId,userId,u=>{const key=account==='bank'?'bankBalance':'balance';if(action==='set')u[key]=amount;else if(action==='add')u[key]=Number(u[key]||0)+amount;else u[key]=Math.max(0,Number(u[key]||0)-amount);});
    await appendHomeAdminOp(req.params.guildId,'home-economy-admin-ops.json',{type:'economy',userId,account,action,amount});
    redirectDashboard(req,res);
  }catch(e){next(e);}});

  app.post('/dashboard/:guildId/store/add',requireLogin,requireGuildAccess,checkCsrf,async(req,res,next)=>{try{const [cfg,site]=await Promise.all([store.getConfig(req.params.guildId),store.getGlobalConfig()]);if(!featureAllowed(site,cfg,'store'))return res.status(403).send('Store غير متاح لهذه الخطة.');const limit=maxFor(req,cfg,site,'storeProducts');if(cfg.store.products.length>=limit)return res.status(403).send(`وصلت للحد المسموح (${limit}).`);const role=req.bundle.roles.find(r=>r.id===String(req.body.roleId));if(!role)return res.status(400).send('Role invalid');if(cfg.store.products.some(p=>p.roleId===role.id))return res.status(400).send('هذه الرتبة موجودة في المتجر.');cfg.store.products.push({id:`product_${Date.now()}_${Math.floor(Math.random()*9999)}`,type:'role',roleId:role.id,name:String(req.body.name||role.name).slice(0,80),price:Math.max(1,Math.round(Number(req.body.price)||1)),category:String(req.body.category||'رتب الأعضاء').slice(0,80),emoji:String(req.body.emoji||'🏷️').slice(0,32),description:String(req.body.description||'').slice(0,1000),features:String(req.body.features||'').split(/\r?\n/).map(x=>x.trim()).filter(Boolean).slice(0,8),imageUrl:String(req.body.imageUrl||'').trim(),bannerUrl:String(req.body.bannerUrl||'').trim(),enabled:Boolean(req.body.enabled),sortOrder:int(req.body.sortOrder,10,0,9999),accessMode:['everyone','admins','roles'].includes(req.body.accessMode)?req.body.accessMode:'everyone',allowedRoleIds:arr(req.body.allowedRoleIds).slice(0,25)});const saved=await store.saveConfig(req.params.guildId,cfg);if(saved?.channels?.storePanel)await sendPanel('store',req.params.guildId,req.bundle,{config:saved}).catch(()=>{});redirectDashboard(req,res);}catch(e){next(e);}});
  app.post('/dashboard/:guildId/store/update',requireLogin,requireGuildAccess,checkCsrf,async(req,res,next)=>{try{const cfg=await store.getConfig(req.params.guildId),p=cfg.store.products.find(x=>String(x.id)===String(req.body.productId));if(!p)return res.status(404).send('المنتج غير موجود.');const role=req.bundle.roles.find(r=>r.id===String(req.body.roleId));if(role)p.roleId=role.id;p.name=String(req.body.name||role?.name||p.name).slice(0,80);p.price=Math.max(1,Math.round(Number(req.body.price)||1));p.category=String(req.body.category||'رتب الأعضاء').slice(0,80);p.emoji=String(req.body.emoji||'🏷️').slice(0,32);p.description=String(req.body.description||'').slice(0,1000);p.features=String(req.body.features||'').split(/\r?\n/).map(x=>x.trim()).filter(Boolean).slice(0,8);p.imageUrl=String(req.body.imageUrl||'').trim();p.bannerUrl=String(req.body.bannerUrl||'').trim();p.enabled=Boolean(req.body.enabled);p.sortOrder=int(req.body.sortOrder,p.sortOrder||0,0,9999);p.accessMode=['everyone','admins','roles'].includes(req.body.accessMode)?req.body.accessMode:'everyone';p.allowedRoleIds=arr(req.body.allowedRoleIds).slice(0,25);const saved=await store.saveConfig(req.params.guildId,cfg);if(saved?.channels?.storePanel)await sendPanel('store',req.params.guildId,req.bundle,{config:saved}).catch(()=>{});redirectDashboard(req,res);}catch(e){next(e);}});
  app.post('/dashboard/:guildId/store/delete',requireLogin,requireGuildAccess,checkCsrf,async(req,res,next)=>{try{const cfg=await store.getConfig(req.params.guildId),id=String(req.body.productId||'');cfg.store.products=cfg.store.products.filter(p=>String(p.id)!==id);const saved=await store.saveConfig(req.params.guildId,cfg);if(saved?.channels?.storePanel&&saved?.store?.products?.some(x=>x.enabled!==false))await sendPanel('store',req.params.guildId,req.bundle,{config:saved}).catch(()=>{});redirectDashboard(req,res);}catch(e){next(e);}});

  app.post('/dashboard/:guildId/roles/add',requireLogin,requireGuildAccess,checkCsrf,async(req,res,next)=>{try{const [cfg,site]=await Promise.all([store.getConfig(req.params.guildId),store.getGlobalConfig()]);if(!featureAllowed(site,cfg,'rolePanel'))return res.status(403).send('Self Roles غير متاحة لهذه الخطة.');const limit=maxFor(req,cfg,site,'selfRoles');if(cfg.rolePanel.items.length>=limit)return res.status(403).send(`وصلت للحد المسموح (${limit}).`);const role=req.bundle.roles.find(r=>r.id===String(req.body.roleId));if(!role)return res.status(400).send('Role invalid');if(!cfg.rolePanel.items.some(p=>p.roleId===role.id))cfg.rolePanel.items.push({roleId:role.id,label:String(req.body.label||role.name).slice(0,80),emoji:String(req.body.emoji||'🔔').slice(0,32),style:['Primary','Secondary','Success','Danger'].includes(req.body.style)?req.body.style:'Primary'});await store.saveConfig(req.params.guildId,cfg);redirectDashboard(req,res);}catch(e){next(e);}});
  app.post('/dashboard/:guildId/roles/update',requireLogin,requireGuildAccess,checkCsrf,async(req,res,next)=>{try{const cfg=await store.getConfig(req.params.guildId),item=cfg.rolePanel.items.find(x=>x.roleId===String(req.body.roleId));if(!item)return res.status(404).send('الرتبة غير موجودة.');const newRole=req.bundle.roles.find(r=>r.id===String(req.body.newRoleId));if(newRole)item.roleId=newRole.id;item.label=String(req.body.label||newRole?.name||item.label).slice(0,80);item.emoji=String(req.body.emoji||'🔔').slice(0,32);item.style=['Primary','Secondary','Success','Danger'].includes(req.body.style)?req.body.style:'Primary';await store.saveConfig(req.params.guildId,cfg);redirectDashboard(req,res);}catch(e){next(e);}});
  app.post('/dashboard/:guildId/roles/delete',requireLogin,requireGuildAccess,checkCsrf,async(req,res,next)=>{try{const cfg=await store.getConfig(req.params.guildId);cfg.rolePanel.items=cfg.rolePanel.items.filter(p=>p.roleId!==String(req.body.roleId));await store.saveConfig(req.params.guildId,cfg);redirectDashboard(req,res);}catch(e){next(e);}});

  app.post('/dashboard/:guildId/reaction-roles/settings',requireLogin,requireGuildAccess,checkCsrf,async(req,res,next)=>{try{const cfg=await store.getConfig(req.params.guildId);cfg.reactionRoles={...(cfg.reactionRoles||{}),enabled:Boolean(req.body.enabled),removeOnUnreact:Boolean(req.body.removeOnUnreact),items:Array.isArray(cfg.reactionRoles?.items)?cfg.reactionRoles.items:[]};await store.saveConfig(req.params.guildId,cfg);redirectDashboard(req,res,'reactionroles');}catch(e){next(e);}});

  async function reactionRoleFromBody(req,current={}){
    const channelId=String(req.body.channelId||'').trim(),messageContent=String(req.body.messageContent||'').trim().slice(0,2000),roleId=String(req.body.roleId||'').trim(),emojiId=String(req.body.emojiId||'').trim();
    if(!req.bundle.channels.some(c=>String(c.id)===channelId&&[0,5].includes(Number(c.type))))throw new Error('اختر روم نصي صحيح.');
    if(!messageContent)throw new Error('اكتب نص الرسالة أولًا.');
    const role=req.bundle.roles.find(r=>String(r.id)===roleId&&!r.managed&&String(r.id)!==String(req.params.guildId));if(!role)throw new Error('اختر رتبة صالحة.');
    let emoji=(req.bundle.emojis||[]).find(e=>String(e.id)===emojiId);if(!emoji){const list=await botFetch(`/guilds/${req.params.guildId}/emojis`).catch(()=>[]);emoji=(Array.isArray(list)?list:[]).find(e=>String(e.id)===emojiId);}if(!emoji)throw new Error('اختر إيموجي موجود في هذا السيرفر.');
    let messageId=String(current.messageId||'').trim();
    const payload={content:messageContent,allowed_mentions:{parse:['users','roles','everyone']}};
    if(messageId&&String(current.channelId||'')===channelId){
      const updated=await botFetch(`/channels/${channelId}/messages/${messageId}`,{method:'PATCH',body:JSON.stringify(payload)}).catch(()=>null);
      if(!updated)messageId='';
    }
    if(!messageId){
      const created=await botFetch(`/channels/${channelId}/messages`,{method:'POST',body:JSON.stringify(payload)});
      messageId=String(created?.id||'');
      if(!messageId)throw new Error('تعذر إنشاء رسالة الرياكشن في Discord.');
    }
    return {...current,id:String(current.id||`rr-${Date.now().toString(36)}-${Math.floor(Math.random()*9999)}`),channelId,messageId,messageContent,roleId,emojiId:String(emoji.id),emojiName:String(emoji.name||'emoji').slice(0,100),emojiAnimated:Boolean(emoji.animated),enabled:Boolean(req.body.enabled)};
  }
  async function ensureReactionRoleEmoji(item){const key=encodeURIComponent(`${item.emojiName}:${item.emojiId}`);await botFetch(`/channels/${item.channelId}/messages/${item.messageId}/reactions/${key}/@me`,{method:'PUT'});}
  async function removeReactionRoleEmoji(item){if(!item?.channelId||!item?.messageId||!item?.emojiId)return;const key=encodeURIComponent(`${item.emojiName}:${item.emojiId}`);await botFetch(`/channels/${item.channelId}/messages/${item.messageId}/reactions/${key}/@me`,{method:'DELETE'}).catch(()=>{});}

  app.post('/dashboard/:guildId/reaction-roles/add',requireLogin,requireGuildAccess,checkCsrf,async(req,res,next)=>{try{const cfg=await store.getConfig(req.params.guildId),item=await reactionRoleFromBody(req,{});cfg.reactionRoles=cfg.reactionRoles||{enabled:true,removeOnUnreact:true,items:[]};cfg.reactionRoles.items=Array.isArray(cfg.reactionRoles.items)?cfg.reactionRoles.items:[];if(cfg.reactionRoles.items.some(x=>String(x.messageId)===item.messageId&&String(x.emojiId)===item.emojiId))throw new Error('هذا الإيموجي مربوط بهذه الرسالة أصلًا.');if(cfg.reactionRoles.items.length>=100)throw new Error('وصلت للحد الأقصى لروابط الرياكشن (100).');cfg.reactionRoles.items.push(item);await ensureReactionRoleEmoji(item);await store.saveConfig(req.params.guildId,cfg);redirectDashboard(req,res,'reactionroles');}catch(e){next(e);}});
  app.post('/dashboard/:guildId/reaction-roles/update',requireLogin,requireGuildAccess,checkCsrf,async(req,res,next)=>{try{const cfg=await store.getConfig(req.params.guildId),items=Array.isArray(cfg.reactionRoles?.items)?cfg.reactionRoles.items:[],idx=items.findIndex(x=>String(x.id)===String(req.body.itemId||''));if(idx<0)throw new Error('ربط الرياكشن غير موجود.');const old={...items[idx]},item=await reactionRoleFromBody(req,old);if(items.some((x,i)=>i!==idx&&String(x.messageId)===item.messageId&&String(x.emojiId)===item.emojiId))throw new Error('هذا الإيموجي مربوط بهذه الرسالة أصلًا.');items[idx]=item;cfg.reactionRoles={...(cfg.reactionRoles||{}),items};if(old.channelId!==item.channelId||old.messageId!==item.messageId||old.emojiId!==item.emojiId)await removeReactionRoleEmoji(old);await ensureReactionRoleEmoji(item);await store.saveConfig(req.params.guildId,cfg);redirectDashboard(req,res,'reactionroles');}catch(e){next(e);}});
  app.post('/dashboard/:guildId/reaction-roles/delete',requireLogin,requireGuildAccess,checkCsrf,async(req,res,next)=>{try{const cfg=await store.getConfig(req.params.guildId),items=Array.isArray(cfg.reactionRoles?.items)?cfg.reactionRoles.items:[],idx=items.findIndex(x=>String(x.id)===String(req.body.itemId||''));if(idx<0)throw new Error('ربط الرياكشن غير موجود.');const [old]=items.splice(idx,1);cfg.reactionRoles={...(cfg.reactionRoles||{}),items};await removeReactionRoleEmoji(old);await store.saveConfig(req.params.guildId,cfg);redirectDashboard(req,res,'reactionroles');}catch(e){next(e);}});

  app.post('/dashboard/:guildId/guide/add',requireLogin,requireGuildAccess,checkCsrf,async(req,res,next)=>{try{
    const [cfg,site]=await Promise.all([store.getConfig(req.params.guildId),store.getGlobalConfig()]);
    if(!featureAllowed(site,cfg,'serverGuide'))return res.status(403).send('دليل السيرفر غير متاح لهذه الخطة.');
    const limit=maxFor(req,cfg,site,'serverGuideButtons');if((cfg.serverGuide?.items||[]).length>=limit)return res.status(403).send(`وصلت لحد أزرار دليل السيرفر (${limit}).`);
    const channelId=String(req.body.channelId||'');if(!req.bundle.channels.some(c=>String(c.id)===channelId&&[0,5].includes(c.type)))return res.status(400).send('الروم المحدد غير صالح.');
    let id=slug(req.body.label)||`guide-${Date.now().toString(36)}`;while((cfg.serverGuide.items||[]).some(x=>x.id===id))id=`${id}-${Math.floor(Math.random()*99)}`;
    cfg.serverGuide.items.push({id,label:String(req.body.label||'انتقال').slice(0,80),emoji:String(req.body.emoji||'➡️').slice(0,32),channelId,sortOrder:int(req.body.sortOrder,10,0,9999),enabled:Boolean(req.body.enabled)});
    await store.saveConfig(req.params.guildId,cfg);redirectDashboard(req,res,'guide');
  }catch(e){next(e);}});
  app.post('/dashboard/:guildId/guide/update',requireLogin,requireGuildAccess,checkCsrf,async(req,res,next)=>{try{
    const cfg=await store.getConfig(req.params.guildId),item=(cfg.serverGuide?.items||[]).find(x=>String(x.id)===String(req.body.itemId||''));if(!item)return res.status(404).send('اختصار دليل السيرفر غير موجود.');
    const channelId=String(req.body.channelId||'');if(!req.bundle.channels.some(c=>String(c.id)===channelId&&[0,5].includes(c.type)))return res.status(400).send('الروم المحدد غير صالح.');
    item.label=String(req.body.label||item.label||'انتقال').slice(0,80);item.emoji=String(req.body.emoji||'➡️').slice(0,32);item.channelId=channelId;item.sortOrder=int(req.body.sortOrder,item.sortOrder||0,0,9999);item.enabled=Boolean(req.body.enabled);
    await store.saveConfig(req.params.guildId,cfg);redirectDashboard(req,res,'guide');
  }catch(e){next(e);}});
  app.post('/dashboard/:guildId/guide/delete',requireLogin,requireGuildAccess,checkCsrf,async(req,res,next)=>{try{const cfg=await store.getConfig(req.params.guildId),id=String(req.body.itemId||'');cfg.serverGuide.items=(cfg.serverGuide?.items||[]).filter(x=>String(x.id)!==id);await store.saveConfig(req.params.guildId,cfg);redirectDashboard(req,res,'guide');}catch(e){next(e);}});

  app.post('/dashboard/:guildId/city-director/template/add',requireLogin,requireGuildAccess,checkCsrf,async(req,res,next)=>{try{
    const [cfg,site]=await Promise.all([store.getConfig(req.params.guildId),store.getGlobalConfig()]);if(!featureAllowed(site,cfg,'cityDirector'))return res.status(403).send('City Director غير متاح لهذه الخطة.');
    const limit=maxFor(req,cfg,site,'cityDirectorTemplates');if((cfg.cityDirector?.templates||[]).length>=limit)return res.status(403).send(`وصلت لحد قوالب City Director (${limit}).`);
    let id=slug(req.body.name)||`event-${Date.now().toString(36)}`;while((cfg.cityDirector.templates||[]).some(x=>x.id===id))id=`${id}-${Math.floor(Math.random()*99)}`;
    cfg.cityDirector.templates.push({id,name:String(req.body.name||'حدث المدينة').slice(0,100),emoji:String(req.body.emoji||'🌆').slice(0,32),description:String(req.body.description||'').slice(0,1500),difficulty:['normal','hard','elite','legendary'].includes(String(req.body.difficulty))?String(req.body.difficulty):'normal',goalMultiplier:Math.max(.25,Math.min(5,Number(req.body.goalMultiplier)||1)),enabled:Boolean(req.body.enabled)});
    await store.saveConfig(req.params.guildId,cfg);redirectDashboard(req,res,'director');
  }catch(e){next(e);}});
  app.post('/dashboard/:guildId/city-director/template/update',requireLogin,requireGuildAccess,checkCsrf,async(req,res,next)=>{try{
    const cfg=await store.getConfig(req.params.guildId),item=(cfg.cityDirector?.templates||[]).find(x=>String(x.id)===String(req.body.templateId||''));if(!item)return res.status(404).send('قالب City Director غير موجود.');
    item.name=String(req.body.name||item.name||'حدث المدينة').slice(0,100);item.emoji=String(req.body.emoji||'🌆').slice(0,32);item.description=String(req.body.description||'').slice(0,1500);item.difficulty=['normal','hard','elite','legendary'].includes(String(req.body.difficulty))?String(req.body.difficulty):'normal';item.goalMultiplier=Math.max(.25,Math.min(5,Number(req.body.goalMultiplier)||1));item.enabled=Boolean(req.body.enabled);
    await store.saveConfig(req.params.guildId,cfg);redirectDashboard(req,res,'director');
  }catch(e){next(e);}});
  app.post('/dashboard/:guildId/city-director/template/delete',requireLogin,requireGuildAccess,checkCsrf,async(req,res,next)=>{try{const cfg=await store.getConfig(req.params.guildId),id=String(req.body.templateId||'');cfg.cityDirector.templates=(cfg.cityDirector?.templates||[]).filter(x=>String(x.id)!==id);await store.saveConfig(req.params.guildId,cfg);redirectDashboard(req,res,'director');}catch(e){next(e);}});
  app.post('/dashboard/:guildId/city-director/start',requireLogin,requireGuildAccess,checkCsrf,async(req,res,next)=>{try{
    const [cfg,site]=await Promise.all([store.getConfig(req.params.guildId),store.getGlobalConfig()]);if(!featureAllowed(site,cfg,'cityDirector'))return res.status(403).send('City Director غير متاح لهذه الخطة.');if(cfg.cityDirector?.enabled===false)return res.status(400).send('فعّل City Director واحفظ الإعدادات أولًا.');if(!cfg.channels?.cityDirector)return res.status(400).send('حدد روم City Director أولًا.');
    const wanted=String(req.body.templateId||'');
    if(wanted){
      const customOk=(cfg.cityDirector.templates||[]).some(x=>x.id===wanted&&x.enabled!==false);
      const builtinOk=cfg.cityDirector?.useBuiltinEvents!==false&&builtInEvents().some(x=>x.id===wanted);
      if(!customOk&&!builtinOk)return res.status(400).send('قالب الحدث غير صالح أو غير مفعّل.');
    }
    cfg.cityDirector.pendingAction={id:`op_${Date.now().toString(36)}_${Math.random().toString(36).slice(2,7)}`,action:'start',templateId:wanted,createdAt:Date.now()};await store.saveConfig(req.params.guildId,cfg);redirectDashboard(req,res,'director');
  }catch(e){next(e);}});
  app.post('/dashboard/:guildId/city-director/stop',requireLogin,requireGuildAccess,checkCsrf,async(req,res,next)=>{try{const [cfg,site]=await Promise.all([store.getConfig(req.params.guildId),store.getGlobalConfig()]);if(!featureAllowed(site,cfg,'cityDirector'))return res.status(403).send('City Director غير متاح لهذه الخطة.');cfg.cityDirector.pendingAction={id:`op_${Date.now().toString(36)}_${Math.random().toString(36).slice(2,7)}`,action:'stop',createdAt:Date.now()};await store.saveConfig(req.params.guildId,cfg);redirectDashboard(req,res,'director');}catch(e){next(e);}});

  function ticketQuestionsFromBody(body,prefix){
    return Array.from({length:5},(_,i)=>{
      const label=String(body[`${prefix}_q${i}_label`]||'').trim().slice(0,45);
      if(!label)return null;
      return {id:`q${i+1}`,label,style:String(body[`${prefix}_q${i}_style`]||'paragraph')==='short'?'short':'paragraph',required:Boolean(body[`${prefix}_q${i}_required`]),placeholder:String(body[`${prefix}_q${i}_placeholder`]||'').trim().slice(0,100)};
    }).filter(Boolean);
  }

  app.post('/dashboard/:guildId/tickets/type/add',requireLogin,requireGuildAccess,checkCsrf,async(req,res,next)=>{try{const [cfg,site]=await Promise.all([store.getConfig(req.params.guildId),store.getGlobalConfig()]);if(!featureAllowed(site,cfg,'tickets'))return res.status(403).send('Tickets غير متاحة لهذه الخطة.');const limit=maxFor(req,cfg,site,'ticketTypes');if(cfg.tickets.types.length>=limit)return res.status(403).send(`وصلت لحد أنواع التذاكر (${limit}).`);let id=slug(req.body.label)||`type-${Date.now().toString(36)}`;while(cfg.tickets.types.some(x=>x.id===id))id=`${id}-${Math.floor(Math.random()*99)}`;const cap=maxFor(req,cfg,site,'ticketSupportRoles'),viewRoleIds=arr(req.body.viewRoleIds).slice(0,cap),claimRoleIds=arr(req.body.claimRoleIds).slice(0,cap);cfg.tickets.types.push({id,label:String(req.body.label||'دعم').slice(0,80),name:String(req.body.label||'دعم').slice(0,80),emoji:String(req.body.emoji||'🎫').slice(0,32),description:String(req.body.description||'').slice(0,300),welcomeMessage:String(req.body.welcomeMessage||'اشرح طلبك وسيتم الرد عليك من الإدارة.').slice(0,1200),categoryId:String(req.body.categoryId||''),supportRoleIds:viewRoleIds,viewRoleIds,claimRoleIds,pingRoleIds:arr(req.body.pingRoleIds).slice(0,cap),summonRoleIds:arr(req.body.summonRoleIds).slice(0,cap),adminRoleIds:arr(req.body.adminRoleIds).slice(0,cap),openRoleIds:[],questions:ticketQuestionsFromBody(req.body,'new'),maxOpenPerUser:int(req.body.maxOpenPerUser,1,1,10),enabled:Boolean(req.body.enabled)});const saved=await store.saveConfig(req.params.guildId,cfg);if(saved?.channels?.ticketPanel&&saved?.tickets?.types?.some(x=>x.enabled!==false))await sendPanel('tickets',req.params.guildId,req.bundle,{config:saved}).catch(()=>{});redirectDashboard(req,res);}catch(e){next(e);}});
  app.post('/dashboard/:guildId/tickets/type/update',requireLogin,requireGuildAccess,checkCsrf,async(req,res,next)=>{try{const [cfg,site]=await Promise.all([store.getConfig(req.params.guildId),store.getGlobalConfig()]),t=cfg.tickets.types.find(x=>x.id===String(req.body.typeId));if(!t)return res.status(404).send('نوع التذكرة غير موجود.');const cap=maxFor(req,cfg,site,'ticketSupportRoles');t.label=String(req.body.label||t.label).slice(0,80);t.name=t.label;t.emoji=String(req.body.emoji||'🎫').slice(0,32);t.description=String(req.body.description||'').slice(0,300);t.welcomeMessage=String(req.body.welcomeMessage||'').slice(0,1200);t.categoryId=String(req.body.categoryId||'');t.viewRoleIds=arr(req.body.viewRoleIds).slice(0,cap);t.supportRoleIds=[...t.viewRoleIds];t.claimRoleIds=arr(req.body.claimRoleIds).slice(0,cap);t.pingRoleIds=arr(req.body.pingRoleIds).slice(0,cap);t.summonRoleIds=arr(req.body.summonRoleIds).slice(0,cap);t.adminRoleIds=arr(req.body.adminRoleIds).slice(0,cap);t.openRoleIds=[];t.questions=ticketQuestionsFromBody(req.body,'edit');t.maxOpenPerUser=int(req.body.maxOpenPerUser,t.maxOpenPerUser||1,1,10);t.enabled=Boolean(req.body.enabled);const saved=await store.saveConfig(req.params.guildId,cfg);if(saved?.channels?.ticketPanel&&saved?.tickets?.types?.some(x=>x.enabled!==false))await sendPanel('tickets',req.params.guildId,req.bundle,{config:saved}).catch(()=>{});redirectDashboard(req,res);}catch(e){next(e);}});
  app.post('/dashboard/:guildId/tickets/type/delete',requireLogin,requireGuildAccess,checkCsrf,async(req,res,next)=>{try{const cfg=await store.getConfig(req.params.guildId);cfg.tickets.types=cfg.tickets.types.filter(x=>x.id!==String(req.body.typeId));const saved=await store.saveConfig(req.params.guildId,cfg);if(saved?.channels?.ticketPanel&&saved?.tickets?.types?.some(x=>x.enabled!==false))await sendPanel('tickets',req.params.guildId,req.bundle,{config:saved}).catch(()=>{});redirectDashboard(req,res);}catch(e){next(e);}});

  app.post('/dashboard/:guildId/killer/add',requireLogin,requireGuildAccess,checkCsrf,async(req,res,next)=>{try{const [cfg,site]=await Promise.all([store.getConfig(req.params.guildId),store.getGlobalConfig()]);if(!featureAllowed(site,cfg,'gameQuestions'))return res.status(403).send('Killer Editor غير متاح في خطتك.');const list=await store.data(req.params.guildId,'killer-cases.json',[]),limit=maxFor(req,cfg,site,'killerCases');if(list.length>=limit)return res.status(403).send(`وصلت لحد القضايا (${limit}).`);const suspects=String(req.body.suspects||'').split(/\r?\n/).map(x=>x.trim()).filter(Boolean).slice(0,5),clues=String(req.body.clues||'').split(/\r?\n/).map(x=>x.trim()).filter(Boolean).slice(0,10),hints=String(req.body.hints||'').split(/\r?\n/).map(x=>x.trim()).filter(Boolean).slice(0,3),killer=String(req.body.killer||'').trim();if(suspects.length<2||!suspects.includes(killer)||!clues.length||hints.length!==3)return res.status(400).send('القضية تحتاج 2-5 مشتبهين، القاتل واحد منهم، دليل واحد على الأقل و3 تلميحات بالضبط.');list.push({id:`case_${Date.now()}_${Math.floor(Math.random()*9999)}`,enabled:Boolean(req.body.enabled),title:String(req.body.title||'قضية').slice(0,120),story:String(req.body.story||'').slice(0,2000),suspects,clues,hints,killer,answer:String(req.body.answer||'').slice(0,2000),updatedAt:Date.now()});await store.saveData(req.params.guildId,'killer-cases.json',list);redirectDashboard(req,res);}catch(e){next(e);}});
  app.post('/dashboard/:guildId/killer/update',requireLogin,requireGuildAccess,checkCsrf,async(req,res,next)=>{try{const list=await store.data(req.params.guildId,'killer-cases.json',[]),c=list.find(x=>String(x.id)===String(req.body.caseId));if(!c)return res.status(404).send('القضية غير موجودة.');const suspects=String(req.body.suspects||'').split(/\r?\n/).map(x=>x.trim()).filter(Boolean).slice(0,5),clues=String(req.body.clues||'').split(/\r?\n/).map(x=>x.trim()).filter(Boolean).slice(0,10),hints=String(req.body.hints||'').split(/\r?\n/).map(x=>x.trim()).filter(Boolean).slice(0,3),killer=String(req.body.killer||'').trim();if(suspects.length<2||!suspects.includes(killer)||!clues.length||hints.length!==3)return res.status(400).send('القضية تحتاج 2-5 مشتبهين، القاتل واحد منهم، دليل واحد على الأقل و3 تلميحات بالضبط.');Object.assign(c,{enabled:Boolean(req.body.enabled),title:String(req.body.title||'قضية').slice(0,120),story:String(req.body.story||'').slice(0,2000),suspects,clues,hints,killer,answer:String(req.body.answer||'').slice(0,2000),updatedAt:Date.now()});await store.saveData(req.params.guildId,'killer-cases.json',list);redirectDashboard(req,res);}catch(e){next(e);}});
  app.post('/dashboard/:guildId/killer/delete',requireLogin,requireGuildAccess,checkCsrf,async(req,res,next)=>{try{let list=await store.data(req.params.guildId,'killer-cases.json',[]);list=list.filter(x=>String(x.id)!==String(req.body.caseId));await store.saveData(req.params.guildId,'killer-cases.json',list);redirectDashboard(req,res);}catch(e){next(e);}});

  app.post('/dashboard/:guildId/gang-missions/add',requireLogin,requireGuildAccess,checkCsrf,async(req,res,next)=>{try{const [cfg,site]=await Promise.all([store.getConfig(req.params.guildId),store.getGlobalConfig()]);if(!featureAllowed(site,cfg,'gangMissions'))return res.status(403).send('مهمات العصابات غير متاحة.');const list=await store.data(req.params.guildId,'gang-missions.json',[]),limit=maxFor(req,cfg,site,'gangMissionTemplates');if(list.length>=limit)return res.status(403).send(`وصلت لحد المهمات (${limit}).`);const steps=String(req.body.steps||'').split(/\r?\n/).map(x=>x.trim()).filter(Boolean).slice(0,5);if(!steps.length)return res.status(400).send('أضف مرحلة واحدة على الأقل.');list.push({id:`gm_${Date.now()}_${Math.floor(Math.random()*9999)}`,enabled:Boolean(req.body.enabled),name:String(req.body.name||'مهمة').slice(0,100),description:String(req.body.description||'').slice(0,600),difficulty:['hard','elite','legendary'].includes(req.body.difficulty)?req.body.difficulty:'hard',minParticipants:int(req.body.minParticipants,2,2,maxFor(req,cfg,site,'gangMembers')),steps,updatedAt:Date.now()});await store.saveData(req.params.guildId,'gang-missions.json',list);redirectDashboard(req,res);}catch(e){next(e);}});
  app.post('/dashboard/:guildId/gang-missions/update',requireLogin,requireGuildAccess,checkCsrf,async(req,res,next)=>{try{const [cfg,site]=await Promise.all([store.getConfig(req.params.guildId),store.getGlobalConfig()]),list=await store.data(req.params.guildId,'gang-missions.json',[]),m=list.find(x=>String(x.id)===String(req.body.missionId));if(!m)return res.status(404).send('المهمة غير موجودة.');const steps=String(req.body.steps||'').split(/\r?\n/).map(x=>x.trim()).filter(Boolean).slice(0,5);if(!steps.length)return res.status(400).send('أضف مرحلة واحدة على الأقل.');Object.assign(m,{enabled:Boolean(req.body.enabled),name:String(req.body.name||'مهمة').slice(0,100),description:String(req.body.description||'').slice(0,600),difficulty:['hard','elite','legendary'].includes(req.body.difficulty)?req.body.difficulty:'hard',minParticipants:int(req.body.minParticipants,2,2,maxFor(req,cfg,site,'gangMembers')),steps,updatedAt:Date.now()});await store.saveData(req.params.guildId,'gang-missions.json',list);redirectDashboard(req,res);}catch(e){next(e);}});
  app.post('/dashboard/:guildId/gang-missions/delete',requireLogin,requireGuildAccess,checkCsrf,async(req,res,next)=>{try{let list=await store.data(req.params.guildId,'gang-missions.json',[]);list=list.filter(x=>String(x.id)!==String(req.body.missionId));await store.saveData(req.params.guildId,'gang-missions.json',list);redirectDashboard(req,res);}catch(e){next(e);}});

  app.post('/dashboard/:guildId/restore-legacy',requireLogin,requireOwner,requireGuildAccess,checkCsrf,async(req,res,next)=>{try{const homeId=String(process.env.HOME_GUILD_ID||legacyPreset?.guildId||'');if(String(req.params.guildId)!==homeId)return res.status(403).send('الاسترجاع متاح لسيرفر ZOMBI الأصلي فقط.');const current=await store.getConfig(homeId),keep={plan:current.plan,premiumUntil:current.premiumUntil,createdAt:current.createdAt},cfg={...legacyPreset.config,...keep,legacyPresetVersion:'v8.8',legacyPresetImportedAt:Date.now()};await store.saveConfig(homeId,cfg);for(const [name,value] of Object.entries(legacyPreset.data||{}))await store.saveData(homeId,name,value);res.redirect(`/dashboard/${homeId}`);}catch(e){next(e);}});

  // ===============================
  // 📜 Rules Center CRUD + instant panel refresh
  // ===============================
  app.post('/dashboard/:guildId/rules/settings',requireLogin,requireGuildAccess,checkCsrf,async(req,res,next)=>{try{
    const cfg=await store.getConfig(req.params.guildId);
    cfg.rules={...(cfg.rules||{}),
      enabled:Boolean(req.body.enabled),
      channelId:String(req.body.channelId||''),
      title:String(req.body.title||'📜 ZOMBI • قوانين السيرفر').slice(0,256),
      description:String(req.body.description||'').slice(0,2000),
      footer:String(req.body.footer||'ZOMBI • RULES CENTER').slice(0,160),
      color:/^#[0-9a-f]{6}$/i.test(String(req.body.color||''))?String(req.body.color):'#E11D48',
      logoUrl:String(req.body.logoUrl||'').trim(),
      bannerUrl:String(req.body.bannerUrl||'').trim()
    };
    const saved=await store.saveConfig(req.params.guildId,cfg);
    if(saved.rules?.channelId && (saved.rules?.types||[]).some(x=>x.enabled!==false)) await sendPanel('rules',req.params.guildId,req.bundle,{config:saved}).catch(()=>{});
    redirectDashboard(req,res,'rules');
  }catch(e){next(e);}});

  app.post('/dashboard/:guildId/rules/add',requireLogin,requireGuildAccess,checkCsrf,async(req,res,next)=>{try{
    const cfg=await store.getConfig(req.params.guildId);cfg.rules=cfg.rules||{};cfg.rules.types=Array.isArray(cfg.rules.types)?cfg.rules.types:[];
    if(cfg.rules.types.length>=25)throw new Error('الحد الأقصى 25 قسم قوانين.');
    let id=slug(req.body.label)||`rules-${Date.now().toString(36)}`;while(cfg.rules.types.some(x=>String(x.id)===id))id=`${id}-${Math.floor(Math.random()*99)}`;
    cfg.rules.types.push({id,label:String(req.body.label||'قوانين').slice(0,90),emoji:String(req.body.emoji||'📜').slice(0,32),description:String(req.body.description||'').slice(0,100),content:String(req.body.content||'').slice(0,12000),enabled:Boolean(req.body.enabled),sortOrder:int(req.body.sortOrder,10,0,9999)});
    const saved=await store.saveConfig(req.params.guildId,cfg);if(saved.rules?.channelId)await sendPanel('rules',req.params.guildId,req.bundle,{config:saved}).catch(()=>{});redirectDashboard(req,res,'rules');
  }catch(e){next(e);}});

  app.post('/dashboard/:guildId/rules/update',requireLogin,requireGuildAccess,checkCsrf,async(req,res,next)=>{try{
    const cfg=await store.getConfig(req.params.guildId),id=String(req.body.ruleId||''),item=(cfg.rules?.types||[]).find(x=>String(x.id)===id);if(!item)throw new Error('قسم القوانين غير موجود.');
    item.label=String(req.body.label||item.label||'قوانين').slice(0,90);item.emoji=String(req.body.emoji||'📜').slice(0,32);item.description=String(req.body.description||'').slice(0,100);item.content=String(req.body.content||'').slice(0,12000);item.enabled=Boolean(req.body.enabled);item.sortOrder=int(req.body.sortOrder,item.sortOrder||10,0,9999);
    const saved=await store.saveConfig(req.params.guildId,cfg);if(saved.rules?.channelId)await sendPanel('rules',req.params.guildId,req.bundle,{config:saved}).catch(()=>{});redirectDashboard(req,res,'rules');
  }catch(e){next(e);}});

  app.post('/dashboard/:guildId/rules/delete',requireLogin,requireGuildAccess,checkCsrf,async(req,res,next)=>{try{
    const cfg=await store.getConfig(req.params.guildId),id=String(req.body.ruleId||'');cfg.rules=cfg.rules||{};cfg.rules.types=(cfg.rules.types||[]).filter(x=>String(x.id)!==id);
    const saved=await store.saveConfig(req.params.guildId,cfg);if(saved.rules?.channelId && (saved.rules?.types||[]).some(x=>x.enabled!==false))await sendPanel('rules',req.params.guildId,req.bundle,{config:saved}).catch(()=>{});redirectDashboard(req,res,'rules');
  }catch(e){next(e);}});

  app.post('/dashboard/:guildId/send/all',requireLogin,requireGuildAccess,checkCsrf,async(req,res)=>{
    const results=[];
    for(const which of ['bank','games','tickets','store','roles','name','guide','rules','voice']){
      try{await sendPanel(which,req.params.guildId,req.bundle);results.push(`✅ ${which}`);}catch(error){results.push(`➖ ${which}: ${String(error?.message||error).slice(0,100)}`);}
    }
    // Staff panels use the same guild-scoped staff-systems.json used by the bot.
    try{
      const staff=await store.data(req.params.guildId,'staff-systems.json',{}),brand=String(req.bundle.guild.name||(await store.getConfig(req.params.guildId))?.branding?.customName||'Server').slice(0,80);
      const defs=[
        ['duty','🟢 لوحة دوام الإدارة','ابدأ أو أنهِ دوامك أو اعرض إحصائياتك.',[{type:2,style:3,custom_id:'zstaff:duty:start',label:'بدء الدوام',emoji:{name:'🟢'}},{type:2,style:4,custom_id:'zstaff:duty:end',label:'إنهاء الدوام',emoji:{name:'🔴'}},{type:2,style:2,custom_id:'zstaff:duty:break',label:'استراحة',emoji:{name:'☕'}},{type:2,style:1,custom_id:'zstaff:duty:resume',label:'عودة',emoji:{name:'▶️'}},{type:2,style:2,custom_id:'zstaff:duty:stats',label:'إحصائياتي',emoji:{name:'📊'}}]],
        ['event','🎉 طلب فعالية','اضغط الزر لإرسال طلب فعالية.',[{type:2,style:1,custom_id:'zstaff:event:open',label:'طلب فعالية',emoji:{name:'🎉'}}]],
        ['leave','🏖️ طلب إجازة الإدارة','اضغط الزر لإرسال طلب إجازة.',[{type:2,style:1,custom_id:'zstaff:leave:open',label:'طلب إجازة',emoji:{name:'🏖️'}}]],
        ['eventLeave','🏖️ طلب إجازة الإيفنت','اضغط الزر لإرسال طلب إجازة إيفنت.',[{type:2,style:1,custom_id:'zstaff:eventleave:open',label:'طلب إجازة إيفنت',emoji:{name:'🎪'}}]]
      ];let count=0;
      for(const [key,title,description,buttons] of defs){const c=staff[key]||{};if(c.enabled===false||!c.panelChannelId)continue;const payload={embeds:[{color:0x7c3aed,title,description,footer:{text:`${brand} • STAFF CENTER`},...(c.bannerUrl?{image:{url:c.bannerUrl}}:{}),...(c.thumbnailUrl?{thumbnail:{url:c.thumbnailUrl}}:{})}],components:[{type:1,components:buttons}],allowed_mentions:{parse:[]}};let msg=null;if(c.panelMessageId){try{msg=await botFetch(`/channels/${c.panelChannelId}/messages/${c.panelMessageId}`,{method:'PATCH',body:JSON.stringify(payload)});}catch{}}if(!msg)msg=await botFetch(`/channels/${c.panelChannelId}/messages`,{method:'POST',body:JSON.stringify(payload)});c.panelMessageId=String(msg?.id||c.panelMessageId||'');staff[key]=c;count++;}
      await store.saveData(req.params.guildId,'staff-systems.json',staff);results.push(count?`✅ staff: ${count}`:'➖ staff: لا توجد لوحات محفوظة');
    }catch(error){results.push(`➖ staff: ${String(error?.message||error).slice(0,100)}`);}
    // Application panels are also guild-scoped and are included in Update All.
    try{
      const apps=normalizeApplicationsConfig(await store.data(req.params.guildId,'applications-config.json',{enabled:true,types:[]})),brand=String(req.bundle.guild.name||(await store.getConfig(req.params.guildId))?.branding?.customName||'Server').slice(0,80);let count=0;
      for(const type of apps.types){if(type.enabled===false||!type.panelChannelId)continue;const payload={embeds:[{color:0x5865F2,title:`${type.emoji} ${type.title}`,description:type.description||'اضغط الزر بالأسفل لفتح نموذج التقديم.',footer:{text:`${brand} • APPLICATIONS`},...(type.bannerUrl?{image:{url:type.bannerUrl}}:{}),...(type.thumbnailUrl?{thumbnail:{url:type.thumbnailUrl}}:{})}],components:[{type:1,components:[{type:2,style:1,custom_id:`pub:application:open:${type.id}`,label:type.buttonLabel.slice(0,80),emoji:{name:type.emoji||'📝'}}]}],allowed_mentions:{parse:[]}};let msg=null;if(type.panelMessageId){try{msg=await botFetch(`/channels/${type.panelChannelId}/messages/${type.panelMessageId}`,{method:'PATCH',body:JSON.stringify(payload)});}catch{}}if(!msg)msg=await botFetch(`/channels/${type.panelChannelId}/messages`,{method:'POST',body:JSON.stringify(payload)});type.panelMessageId=String(msg?.id||type.panelMessageId||'');count++;}
      await store.saveData(req.params.guildId,'applications-config.json',apps);results.push(count?`✅ applications: ${count}`:'➖ applications: لا توجد لوحات محفوظة');
    }catch(error){results.push(`➖ applications: ${String(error?.message||error).slice(0,100)}`);}
    res.send(layout('Panels Updated',`<section class="login"><h1>📨 تحديث لوحات ${esc(req.bundle.guild.name)}</h1><pre style="white-space:pre-wrap;text-align:right">${esc(results.join('\n'))}</pre><a class="btn primary" href="/dashboard/${req.params.guildId}">رجوع للداشبورد</a></section>`,req.user));
  });

  for(const which of ['bank','games','tickets','store','roles','name','guide','rules','voice'])app.post(`/dashboard/:guildId/send/${which}`,requireLogin,requireGuildAccess,checkCsrf,async(req,res)=>{try{await sendPanel(which,req.params.guildId,req.bundle);redirectDashboard(req,res);}catch(e){res.status(400).send(layout('Error',`<section class="login"><h1>❌ ${esc(e.message)}</h1><a class="btn" href="/dashboard/${req.params.guildId}">رجوع</a></section>`,req.user));}});

  app.get('/premium',async(req,res,next)=>{try{res.send(layout('Premium وPremium+',pricing(publicSiteConfig(await store.getGlobalConfig())),req.user));}catch(e){next(e);}});

  app.get('/owner',requireLogin,requireOwner,async(req,res,next)=>{try{
    const token=csrf(req),ids=await store.allGuildIds(),site=await store.getGlobalConfig(),codes=(await store.getCodes()).slice(-40).reverse(),paymentItems=await payments.list({limit:100});
    const zain=resolvedZainCash(site),pendingPayments=paymentItems.filter(x=>x.status==='pending').length;
    const presence=await getBotPresenceSnapshot(),userGuildMap=new Map((req.user?.guilds||[]).map(g=>[String(g.id),g]));
    const apiGuilds=presence.api?.guilds instanceof Map?presence.api.guilds:new Map();
    const entries=await Promise.all(ids.slice(0,250).map(async id=>{
      const sid=String(id),knownInstalled=presence.ids.has(sid),fallbackGuild=userGuildMap.get(sid)||null;
      const g=apiGuilds.get(sid)||(knownInstalled&&fallbackGuild?fallbackGuild:(knownInstalled?{id:sid,name:`Server ${sid}`,icon:null,approximate_member_count:0}:null));
      const cfg=await store.getConfig(sid);return{id:sid,g,cfg,plan:planNameForConfig(cfg)};
    }));
    const premiumCount=entries.filter(x=>x.plan==='premium').length,plusCount=entries.filter(x=>x.plan==='premium_plus').length,freeCount=entries.filter(x=>x.plan==='free').length;
    const availableCodes=codes.filter(c=>!c.usedAt).length;
    const rows=entries.map(({id,g,cfg,plan})=>`<tr><td><div class="owner-server-name"><span class="owner-server-icon">${g?.icon?`<img src="https://cdn.discordapp.com/icons/${id}/${g.icon}.png" alt="">`:'Z'}</span><span><b>${esc(g?.name||'Unknown')}</b><small>${id}</small></span></div></td><td>${Number(g?.approximate_member_count||0).toLocaleString()}</td><td><span class="owner-plan-chip owner-plan-${plan}">${planBadge(cfg)}</span></td><td><div class="owner-actions"><a class="mini-link" href="/dashboard/${id}">فتح الداشبورد</a><form class="mini owner-plan-form" method="post" action="/owner/premium"><input type="hidden" name="_csrf" value="${token}"><input type="hidden" name="guildId" value="${id}"><select name="plan" aria-label="خطة الاشتراك"><option value="premium" ${cfg.plan!=='premium_plus'?'selected':''}>Premium</option><option value="premium_plus" ${cfg.plan==='premium_plus'?'selected':''}>Premium+</option></select><button name="days" value="30">+30 يوم</button><button name="days" value="90">+90 يوم</button><button name="days" value="365">+سنة</button><button class="danger" name="days" value="0">إلغاء</button></form>${g?`<form class="mini owner-leave-form" method="post" action="/owner/guilds/${id}/leave" onsubmit="return confirm('⚠️ سيتم إخراج ZOMBI من سيرفر ${esc(g.name||id)} مباشرة. هل أنت متأكد؟')"><input type="hidden" name="_csrf" value="${token}"><button class="danger owner-leave-btn" type="submit">🚪 حذف السيرفر</button></form>`:'<span class="owner-missing-guild">البوت غير موجود</span>'}</div></td></tr>`).join('');

    const featureRows=FEATURE_DEFS.map(f=>{
      const subscriberOnly=f.key==='customBotProfile';
      return `<tr class="${subscriberOnly?'subscriber-only-row':''}"><td><div class="owner-feature-label"><span>${f.emoji}</span><div><b>${esc(f.label)}</b>${subscriberOnly?'<small>للمشتركين فقط — لا يمكن تفعيله على Free</small>':''}</div></div></td><td><input type="checkbox" name="free_feature_${f.key}" ${!subscriberOnly&&site.plans.free.features[f.key]?'checked':''} ${subscriberOnly?'disabled':''}>${subscriberOnly?'<span class="owner-lock-tag">🔒 مشترك فقط</span>':''}</td><td><input type="checkbox" name="premium_feature_${f.key}" ${site.plans.premium.features[f.key]?'checked':''}></td><td><input type="checkbox" name="premium_plus_feature_${f.key}" ${site.plans.premium_plus.features[f.key]?'checked':''}></td></tr>`;
    }).join('');

    const gameRows=GAME_DEFS.map(g=>g.publicSupported?`<tr><td>${g.emoji} ${esc(g.label)}</td><td><input type="checkbox" name="free_game_${g.id}" ${site.plans.free.games[g.id]?'checked':''}></td><td><input type="checkbox" name="premium_game_${g.id}" ${site.plans.premium.games[g.id]?'checked':''}></td><td><input type="checkbox" name="premium_plus_game_${g.id}" ${site.plans.premium_plus.games[g.id]?'checked':''}></td></tr>`:`<tr class="locked"><td>${g.emoji} ${esc(g.label)}<small>للسيرفر الأساسي فقط</small></td><td>—</td><td>—</td><td>—</td></tr>`).join('');
    const heistGameRows=HEIST_GAME_DEFS.map(g=>`<tr><td>${g.emoji} ${esc(g.label)}</td><td><input type="checkbox" name="free_heist_${g.id}" ${site.plans.free.heistGames?.[g.id]?'checked':''}></td><td><input type="checkbox" name="premium_heist_${g.id}" ${site.plans.premium.heistGames?.[g.id]?'checked':''}></td><td><input type="checkbox" name="premium_plus_heist_${g.id}" ${site.plans.premium_plus.heistGames?.[g.id]?'checked':''}></td></tr>`).join('');
    const limitRows=LIMIT_DEFS.map(d=>`<tr><td><b>${esc(d.label)}</b><small>${d.min.toLocaleString()} – ${d.max.toLocaleString()}</small></td><td><input type="number" name="free_limit_${d.key}" value="${site.plans.free.limits[d.key]}" min="${d.min}" max="${d.max}"></td><td><input type="number" name="premium_limit_${d.key}" value="${site.plans.premium.limits[d.key]}" min="${d.min}" max="${d.max}"></td><td><input type="number" name="premium_plus_limit_${d.key}" value="${site.plans.premium_plus.limits[d.key]}" min="${d.min}" max="${d.max}"></td></tr>`).join('');

    const codeCards=codes.map(c=>`<div class="owner-code-card ${c.usedAt?'used':''}"><code>${esc(c.code)}</code><span>${PLAN_LABELS[c.plan||'premium']} • ${c.days} يوم</span><b>${c.usedAt?'مستخدم':'جاهز للتفعيل'}</b></div>`).join('')||'<p>لا يوجد أكواد.</p>';
    const paymentRows=paymentItems.map(x=>`<tr><td><code>${esc(x.id)}</code><small>${esc(paymentDate(x.createdAt))}</small></td><td><b>${esc(x.username||x.userId)}</b><small>${esc(x.userId)}</small></td><td><b>${esc(x.guildName||x.guildId)}</b><small>${esc(x.guildId)}</small></td><td>${esc(PLAN_LABELS[x.plan]||x.plan)}<small>${Number(x.amount).toFixed(3).replace(/\.000$/,'')} JOD • ${x.days} يوم</small></td><td><span dir="ltr">${esc(x.payerPhone)}</span>${x.transactionRef?`<small>Ref: ${esc(x.transactionRef)}</small>`:'<small>بدون رقم عملية</small>'}</td><td><a class="mini-link" target="_blank" rel="noopener" href="/owner/payments/${encodeURIComponent(x.id)}/proof">🧾 الإثبات</a></td><td><span class="z-payment-status z-status-${esc(x.status)}">${paymentStatusLabel(x.status)}</span>${x.reviewNote?`<small>${esc(x.reviewNote)}</small>`:''}</td><td>${x.status==='pending'?`<div class="owner-payment-actions"><form method="post" action="/owner/payments/${encodeURIComponent(x.id)}/approve"><input type="hidden" name="_csrf" value="${token}"><button class="btn success">✅ قبول وتفعيل</button></form><form method="post" action="/owner/payments/${encodeURIComponent(x.id)}/reject"><input type="hidden" name="_csrf" value="${token}"><input name="note" maxlength="300" placeholder="سبب الرفض (اختياري)"><button class="btn danger">❌ رفض</button></form></div>`:'—'}</td></tr>`).join('');

    res.send(layout('Owner',`<div class="owner-console">
      <section class="owner-hero">
        <div><span class="badge">ZOMBI CONTROL CENTER</span><h1>👑 لوحة المالك</h1><p>إدارة الاشتراكات والأسعار والمميزات والحدود من مكان واحد. إعدادات أي سيرفر تبقى ملتزمة بخطته حتى عند فتحها من حساب Owner.</p></div>
        <div class="owner-hero-mark">Z</div>
      </section>

      <section class="owner-stat-grid">
        <article><span>🌐</span><div><small>كل السيرفرات</small><strong>${ids.length.toLocaleString()}</strong></div></article>
        <article><span>🆓</span><div><small>Free</small><strong>${freeCount.toLocaleString()}</strong></div></article>
        <article><span>💎</span><div><small>Premium</small><strong>${premiumCount.toLocaleString()}</strong></div></article>
        <article><span>👑</span><div><small>Premium+</small><strong>${plusCount.toLocaleString()}</strong></div></article>
        <article><span>🎟️</span><div><small>أكواد متاحة</small><strong>${availableCodes.toLocaleString()}</strong></div></article>
        <article><span>💳</span><div><small>دفعات بانتظارك</small><strong>${pendingPayments.toLocaleString()}</strong></div></article>
      </section>

      <section class="panel owner-section owner-site-settings">
        <div class="owner-section-head"><div><span class="owner-section-icon">🌐</span><div><h2>إعدادات الموقع والاشتراك</h2><p>الأسعار وروابط الشراء ورسالة الترويج التي تظهر للمستخدمين.</p></div></div><span class="owner-section-pill">GLOBAL</span></div>
        <form class="form-grid owner-form-grid" method="post" action="/owner/site"><input type="hidden" name="_csrf" value="${token}">
          <label>سعر Premium<input name="premiumPrice" value="${esc(site.premiumPrice)}" placeholder="مثال: 3 JD / شهر"></label>
          <label>سعر Premium+<input name="premiumPlusPrice" value="${esc(site.premiumPlusPrice)}" placeholder="مثال: 6 JD / شهر"></label>
          <label class="owner-toggle"><input type="checkbox" name="zainCashEnabled" ${site.zainCash?.enabled?'checked':''}><span>تفعيل الدفع اليدوي عبر Zain Cash</span></label>
          <label>رقم محفظة Zain Cash<input name="zainWalletNumber" dir="ltr" value="${esc(site.zainCash?.walletNumber||'')}" placeholder="07XXXXXXXX"></label>
          <label>اسم صاحب المحفظة<input name="zainWalletName" value="${esc(site.zainCash?.walletName||'')}"></label>
          <label>مبلغ Premium بالدينار<input type="number" step="0.001" min="0.1" name="zainPremiumAmount" value="${Number(site.zainCash?.premiumAmount??4.99)}"></label>
          <label>مبلغ Premium+ بالدينار<input type="number" step="0.001" min="0.1" name="zainPremiumPlusAmount" value="${Number(site.zainCash?.premiumPlusAmount??7.99)}"></label>
          <label>مدة Premium بالأيام<input type="number" min="1" max="3650" name="zainPremiumDays" value="${Number(site.zainCash?.premiumDays??30)}"></label>
          <label>مدة Premium+ بالأيام<input type="number" min="1" max="3650" name="zainPremiumPlusDays" value="${Number(site.zainCash?.premiumPlusDays??30)}"></label>
          <label class="wide">تعليمات التحويل<textarea name="zainInstructions">${esc(site.zainCash?.instructions||'')}</textarea></label>
          <div class="wide hint">إذا وضعت ZAIN_CASH_WALLET أو ZAIN_CASH_NAME في Environment على Render فالقيمة هناك تتغلب على القيمة المحفوظة هنا.</div>
          <label>رابط شراء Premium<input type="url" name="purchaseUrl" value="${esc(site.purchaseUrl)}"></label>
          <label>رابط شراء Premium+<input type="url" name="premiumPlusPurchaseUrl" value="${esc(site.premiumPlusPurchaseUrl)}"></label>
          <label>رابط الدعم<input type="url" name="supportUrl" value="${esc(site.supportUrl||'')}"></label>
          <label class="owner-toggle"><input type="checkbox" name="premiumPromoEnabled" ${site.premiumPromo?.enabled!==false?'checked':''}><span>إظهار ترويج Premium لغير المشتركين</span></label>
          <label>نسبة ظهور الترويج %<input type="number" name="premiumPromoChance" value="${Number(site.premiumPromo?.chancePercent??40)}" min="0" max="100"></label>
          <label>Cooldown الترويج بالدقائق<input type="number" name="premiumPromoCooldown" value="${Number(site.premiumPromo?.cooldownMinutes??10)}" min="1" max="1440"></label>
          <label class="wide">نص ترويج Premium<textarea name="premiumPromoText">${esc(site.premiumPromo?.text||'💎 اشترك في ZOMBI Premium وافتح مميزات وألعاب أكثر من Dashboard.')}</textarea></label>
          <label class="wide">إعلان Dashboard<textarea name="announcement">${esc(site.announcement)}</textarea></label>
          <div class="wide owner-save-row"><button class="btn primary">💾 حفظ إعدادات الموقع</button></div>
        </form>
      </section>

      <section class="panel owner-section">
        <div class="owner-section-head"><div><span class="owner-section-icon">🧩</span><div><h2>مصفوفة الخطط</h2><p>حدد بالضبط ما يحصل عليه Free وPremium وPremium+. هوية البوت تبقى للمشتركين فقط.</p></div></div><span class="owner-section-pill">LIVE POLICY</span></div>
        <form method="post" action="/owner/plans"><input type="hidden" name="_csrf" value="${token}">
          <div class="owner-plan-banner"><div><b>🆓 Free</b><span>أساسيات وحدود منخفضة</span></div><div><b>💎 Premium</b><span>مميزات وتخصيص أكبر</span></div><div><b>👑 Premium+</b><span>أعلى حدود ومزايا</span></div></div>
          <h3>المميزات</h3><div class="table-wrap"><table class="plan-table owner-plan-table"><thead><tr><th>الميزة</th><th>Free</th><th>Premium</th><th>Premium+</th></tr></thead><tbody>${featureRows}</tbody></table></div>
          <h3>الألعاب العادية</h3><div class="table-wrap"><table class="plan-table owner-plan-table"><thead><tr><th>اللعبة</th><th>Free</th><th>Premium</th><th>Premium+</th></tr></thead><tbody>${gameRows}</tbody></table></div>
          <h3>🎯 ألعاب النهب</h3><div class="table-wrap"><table class="plan-table owner-plan-table"><thead><tr><th>لعبة النهب</th><th>Free</th><th>Premium</th><th>Premium+</th></tr></thead><tbody>${heistGameRows}</tbody></table></div>
          <h3>الحدود</h3><p class="hint">أي سيرفر يحاول تجاوز الحد المحدد لخطته يتم رفض الحفظ وتظهر له رسالة ترقية الاشتراك.</p><div class="table-wrap"><table class="plan-table owner-plan-table owner-limits-table"><thead><tr><th>الحد</th><th>Free</th><th>Premium</th><th>Premium+</th></tr></thead><tbody>${limitRows}</tbody></table></div>
          <div class="owner-save-row"><button class="btn primary">💾 حفظ الخطط الثلاث وتطبيقها</button></div>
        </form>
      </section>

      <div class="owner-two">
        <section class="panel owner-section">
          <div class="owner-section-head"><div><span class="owner-section-icon">🎟️</span><div><h2>أكواد الاشتراك</h2><p>أنشئ أكواد Premium أو Premium+ بمدة تحددها.</p></div></div></div>
          <form class="inline-form code-form owner-code-create" method="post" action="/owner/codes"><input type="hidden" name="_csrf" value="${token}"><select name="plan"><option value="premium">Premium</option><option value="premium_plus">Premium+</option></select><input type="number" name="days" value="30" min="1" max="3650"><button class="btn primary">+ إنشاء كود</button></form>
          <div class="codes owner-codes">${codeCards}</div>
        </section>
        <section class="panel owner-section owner-rules-card">
          <div class="owner-section-head"><div><span class="owner-section-icon">🔐</span><div><h2>قواعد الحماية</h2><p>قواعد ثابتة لا تتجاوزها Dashboard السيرفر.</p></div></div></div>
          <ul><li>تغيير Nickname وصورة/Banner لوحات البوت: <b>للمشتركين فقط</b>.</li><li>تعديل هوية البوت: <b>مالك السيرفر فقط</b>.</li><li>حساب Owner لا يتجاوز اشتراك السيرفر داخل Dashboard.</li><li>القيم فوق Limits لا تُحفظ؛ تظهر رسالة ترقية.</li></ul>
        </section>
      </div>

      <section class="panel owner-section owner-payments">
        <div class="owner-section-head"><div><span class="owner-section-icon">💳</span><div><h2>طلبات الدفع عبر Zain Cash</h2><p>راجع الإثبات ثم اقبل الطلب لتفعيل الاشتراك تلقائيًا، أو ارفضه مع ملاحظة.</p></div></div><span class="owner-section-pill">${pendingPayments} PENDING</span></div>
        <div class="table-wrap"><table><thead><tr><th>الطلب</th><th>المستخدم</th><th>السيرفر</th><th>الخطة</th><th>المحوّل</th><th>الإثبات</th><th>الحالة</th><th>القرار</th></tr></thead><tbody>${paymentRows||'<tr><td colspan="8">لا توجد طلبات دفع بعد.</td></tr>'}</tbody></table></div>
      </section>

      <section class="panel owner-section owner-servers">
        <div class="owner-section-head"><div><span class="owner-section-icon">🖥️</span><div><h2>السيرفرات والاشتراكات</h2><p>فعّل أو مدد أو ألغِ الاشتراك مباشرة لكل سيرفر.</p></div></div><span class="owner-section-pill">${entries.length} SERVER</span></div>
        <div class="table-wrap"><table><thead><tr><th>السيرفر</th><th>الأعضاء</th><th>الخطة</th><th>تحكم</th></tr></thead><tbody>${rows}</tbody></table></div>
      </section>
    </div>`,req.user));
  }catch(e){next(e);}});

  app.get('/owner/payments/:id/proof',requireLogin,requireOwner,async(req,res,next)=>{try{
    const item=await payments.get(req.params.id,true);if(!item)return res.sendStatus(404);const m=String(item.proofData||'').match(/^data:(image\/(?:png|jpeg|webp));base64,(.+)$/i);if(!m)return res.sendStatus(404);const buf=Buffer.from(m[2],'base64');res.set('Content-Type',m[1].toLowerCase());res.set('Cache-Control','private, no-store, max-age=0');res.set('X-Content-Type-Options','nosniff');res.send(buf);
  }catch(e){next(e);}});

  app.post('/owner/payments/:id/approve',requireLogin,requireOwner,checkCsrf,async(req,res,next)=>{let item=null;try{
    item=await payments.claim(req.params.id,req.user.id);if(!item)throw new Error('هذا الطلب تمت مراجعته مسبقًا أو تتم معالجته الآن.');
    const current=planNameForConfig(await store.getConfig(item.guildId));if(current==='premium_plus'&&item.plan==='premium')throw new Error('السيرفر أصبح Premium+ قبل مراجعة هذا الطلب. لا يمكن تنزيل الخطة تلقائيًا إلى Premium.');
    await store.setPremium(item.guildId,item.days,item.plan);await payments.finalize(item.id,'approved',req.user.id,String(req.body.note||'تم التحقق من التحويل وتفعيل الاشتراك.'));
    res.redirect('/owner');
  }catch(e){if(item?.id)await payments.release(item.id).catch(()=>{});next(e);}});

  app.post('/owner/payments/:id/reject',requireLogin,requireOwner,checkCsrf,async(req,res,next)=>{let item=null;try{
    item=await payments.claim(req.params.id,req.user.id);if(!item)throw new Error('هذا الطلب تمت مراجعته مسبقًا أو تتم معالجته الآن.');await payments.finalize(item.id,'rejected',req.user.id,String(req.body.note||'تم رفض إثبات الدفع.').slice(0,1000));res.redirect('/owner');
  }catch(e){if(item?.id)await payments.release(item.id).catch(()=>{});next(e);}});

  app.post('/owner/plans',requireLogin,requireOwner,checkCsrf,async(req,res)=>{const plans=Object.fromEntries(PLAN_IDS.map(p=>[p,{features:{},games:{},heistGames:{},limits:{}}]));const current=await store.getGlobalConfig();for(const p of PLAN_IDS){for(const f of FEATURE_DEFS)plans[p].features[f.key]=(p==='free'&&f.key==='customBotProfile')?false:Boolean(req.body[`${p}_feature_${f.key}`]);for(const g of GAME_DEFS)plans[p].games[g.id]=g.publicSupported?Boolean(req.body[`${p}_game_${g.id}`]):Boolean(current.plans?.[p]?.games?.[g.id]);for(const g of HEIST_GAME_DEFS)plans[p].heistGames[g.id]=Boolean(req.body[`${p}_heist_${g.id}`]);for(const d of LIMIT_DEFS)plans[p].limits[d.key]=int(req.body[`${p}_limit_${d.key}`],d.min,d.min,d.max);}await store.saveGlobalConfig({plans:normalizePlans(plans)});res.redirect('/owner');});
  app.post('/owner/guilds/:guildId/leave',requireLogin,requireOwner,checkCsrf,async(req,res,next)=>{try{const guildId=String(req.params.guildId||'').trim();if(!/^\d{15,25}$/.test(guildId))throw new Error('Guild ID غير صالح.');const guild=await getBotGuild(guildId);if(!guild)throw new Error('البوت غير موجود في هذا السيرفر.');await botFetch(`/users/@me/guilds/${guildId}`,{method:'DELETE'});res.redirect('/owner?left=1');}catch(e){next(e);}});
  app.post('/owner/premium',requireLogin,requireOwner,checkCsrf,async(req,res)=>{const days=Number(req.body.days||0);if(days>0)await store.setPremium(req.body.guildId,days,req.body.plan||'premium');else await store.removePremium(req.body.guildId);res.redirect('/owner');});
  app.post('/owner/codes',requireLogin,requireOwner,checkCsrf,async(req,res)=>{await store.createCode(Number(req.body.days||30),req.body.plan||'premium');res.redirect('/owner');});
  app.post('/owner/site',requireLogin,requireOwner,checkCsrf,async(req,res)=>{await store.saveGlobalConfig({premiumPrice:req.body.premiumPrice,premiumPlusPrice:req.body.premiumPlusPrice,premiumPlusPurchaseUrl:req.body.premiumPlusPurchaseUrl,purchaseUrl:req.body.purchaseUrl,supportUrl:req.body.supportUrl,announcement:req.body.announcement,zainCash:{enabled:Boolean(req.body.zainCashEnabled),walletNumber:String(req.body.zainWalletNumber||'').trim(),walletName:String(req.body.zainWalletName||'').trim(),premiumAmount:Number(req.body.zainPremiumAmount||4.99),premiumPlusAmount:Number(req.body.zainPremiumPlusAmount||7.99),premiumDays:int(req.body.zainPremiumDays,30,1,3650),premiumPlusDays:int(req.body.zainPremiumPlusDays,30,1,3650),instructions:req.body.zainInstructions},premiumPromo:{enabled:Boolean(req.body.premiumPromoEnabled),chancePercent:int(req.body.premiumPromoChance,40,0,100),cooldownMinutes:int(req.body.premiumPromoCooldown,10,1,1440),text:req.body.premiumPromoText}});res.redirect('/owner');});


  function applicationQuestionsFromBody(body,prefix){const out=[];for(let i=0;i<5;i++){const label=String(body[`${prefix}_q${i}_label`]||'').trim().slice(0,45);if(!label)continue;out.push(normalizeApplicationQuestion({id:`q${i+1}`,label,style:body[`${prefix}_q${i}_style`]==='short'?'short':'paragraph',required:String(body[`${prefix}_q${i}_required`]||'1')!=='0',placeholder:String(body[`${prefix}_q${i}_placeholder`]||'').trim().slice(0,100)},i));}return out;}
  function applicationTypeFromBody(req,current={},prefix='edit'){const validChannels=new Set(req.bundle.channels.filter(c=>[0,5].includes(Number(c.type))).map(c=>String(c.id))),validRoles=new Set(req.bundle.roles.map(r=>String(r.id)));const panelChannelId=String(req.body.panelChannelId||'').trim(),reviewChannelId=String(req.body.reviewChannelId||'').trim();if(!validChannels.has(panelChannelId)||!validChannels.has(reviewChannelId))throw new Error('حدد شات لوحة وشات استقبال صحيحين.');const reviewerRoleIds=arr(req.body.reviewerRoleIds).map(String).filter(id=>validRoles.has(id)&&id!==String(req.params.guildId)).slice(0,50),acceptedRoleId=String(req.body.acceptedRoleId||'').trim();return normalizeApplicationType({...current,title:String(req.body.title||'').trim().slice(0,80),emoji:String(req.body.emoji||'📝').trim().slice(0,16),buttonLabel:String(req.body.buttonLabel||'فتح التقديم').trim().slice(0,80),description:String(req.body.description||'').trim().slice(0,1000),panelChannelId,reviewChannelId,reviewerRoleIds,acceptedRoleId:validRoles.has(acceptedRoleId)?acceptedRoleId:'',cooldownHours:int(req.body.cooldownHours,0,0,8760),acceptMessage:String(req.body.acceptMessage||'').trim().slice(0,1000),rejectMessage:String(req.body.rejectMessage||'').trim().slice(0,1000),bannerUrl:String(req.body.bannerUrl||'').trim().slice(0,1000),thumbnailUrl:String(req.body.thumbnailUrl||'').trim().slice(0,1000),enabled:Boolean(req.body.enabled),questions:applicationQuestionsFromBody(req.body,prefix)},0);}

  async function getStaff(gid){return normalizeStaffManagement(await store.data(gid,'staff-systems.json',{}));}
  async function saveStaff(gid,data){return store.saveData(gid,'staff-systems.json',normalizeStaffManagement(data));}
  function staffSectionFromBody(req,current,kind){const validChannels=new Set(req.bundle.channels.filter(c=>[0,5].includes(Number(c.type))).map(c=>String(c.id))),validRoles=new Set(req.bundle.roles.map(r=>String(r.id)));if(kind==='insights'){const commandChannelId=String(req.body.commandChannelId||'').trim(),promotionChannelId=String(req.body.promotionChannelId||'').trim(),promotionTargetRoleId=String(req.body.promotionTargetRoleId||'').trim();for(const id of [commandChannelId,promotionChannelId])if(id&&!validChannels.has(id))throw new Error('شات غير صالح.');if(promotionTargetRoleId&&(!validRoles.has(promotionTargetRoleId)||promotionTargetRoleId===String(req.params.guildId)))throw new Error('رتبة الترقية غير صالحة.');if(req.body.promotionEnabled&&!promotionChannelId)throw new Error('حدد شات الترقيات.');const picked=k=>arr(req.body[k]).map(String).filter(x=>validRoles.has(x)&&x!==String(req.params.guildId)).slice(0,50);return {...current,enabled:Boolean(req.body.enabled),command:String(req.body.command||'احصائيات ادارة').trim().replace(/\s+/g,' ').slice(0,40),commandChannelId,staffRoleIds:picked('staffRoleIds'),viewerRoleIds:picked('viewerRoleIds'),promotionRoleIds:picked('promotionRoleIds'),promotionChannelId,promotionTargetRoleId,promotionEnabled:Boolean(req.body.promotionEnabled),pointsPerHour:int(req.body.pointsPerHour,5,0,1000),ticketPoints:int(req.body.ticketPoints,10,0,1000),ratingPoints:int(req.body.ratingPoints,2,0,1000),threshold:int(req.body.threshold,200,1,1000000),ratingEnabled:Boolean(req.body.ratingEnabled),transcriptEnabled:Boolean(req.body.transcriptEnabled)};}if(kind==='adminDecision'){const commandChannelId=String(req.body.commandChannelId||'').trim();if(!validChannels.has(commandChannelId))throw new Error('حدد شات أوامر الإدارة بشكل صحيح.');const acceptCommand=String(req.body.acceptCommand||'مقبول ادارة').trim().replace(/\s+/g,' ').slice(0,40),rejectCommand=String(req.body.rejectCommand||'رفض ادارة').trim().replace(/\s+/g,' ').slice(0,40);if(!acceptCommand||!rejectCommand||acceptCommand===rejectCommand)throw new Error('حدد أمر قبول وأمر رفض مختلفين.');return {...current,enabled:Boolean(req.body.enabled),commandChannelId,reviewerRoleIds:arr(req.body.roleIds).map(String).filter(x=>validRoles.has(x)&&x!==String(req.params.guildId)).slice(0,50),acceptedRoleIds:arr(req.body.acceptedRoleIds).map(String).filter(x=>validRoles.has(x)&&x!==String(req.params.guildId)).slice(0,50),acceptCommand,rejectCommand,acceptMessage:String(req.body.acceptMessage||current.acceptMessage||'').slice(0,1000),rejectMessage:String(req.body.rejectMessage||current.rejectMessage||'').slice(0,1000),bannerUrl:String(req.body.bannerUrl||'').trim().slice(0,1000),thumbnailUrl:String(req.body.thumbnailUrl||'').trim().slice(0,1000)};}const panelChannelId=String(req.body.panelChannelId||'').trim(),targetChannelId=String(req.body.targetChannelId||'').trim();if(!validChannels.has(panelChannelId)||!validChannels.has(targetChannelId))throw new Error('حدد شات اللوحة وشات الاستقبال/التقارير بشكل صحيح.');const roleIds=arr(req.body.roleIds).map(String).filter(x=>validRoles.has(x)&&x!==String(req.params.guildId)).slice(0,50),extraRoleId=String(req.body.extraRoleId||'').trim();if(extraRoleId&&!validRoles.has(extraRoleId))throw new Error('الرتبة الإضافية غير صالحة.');if(kind==='duty')return {...current,enabled:Boolean(req.body.enabled),panelChannelId,reportChannelId:targetChannelId,allowedRoleIds:roleIds,onDutyRoleId:extraRoleId,idleMinutes:int(req.body.idleMinutes,45,5,1440),autoStopIdle:Boolean(req.body.autoStopIdle),bannerUrl:String(req.body.bannerUrl||'').trim().slice(0,1000),thumbnailUrl:String(req.body.thumbnailUrl||'').trim().slice(0,1000)};return {...current,enabled:Boolean(req.body.enabled),panelChannelId,reviewChannelId:targetChannelId,reviewerRoleIds:roleIds,...(kind==='event'?{acceptedRoleIds:arr(req.body.acceptedRoleIds).map(String).filter(x=>validRoles.has(x)&&x!==String(req.params.guildId)).slice(0,50)}:{}),...(['leave','eventLeave'].includes(kind)?{leaveRoleId:extraRoleId,expiryNotify:Boolean(req.body.expiryNotify),expiryMessage:String(req.body.expiryMessage||'🏖️ انتهت إجازتك في {server}، يمكنك العودة إلى الدوام.').slice(0,1000)}:{}),acceptMessage:String(req.body.acceptMessage||current.acceptMessage||'').slice(0,1000),rejectMessage:String(req.body.rejectMessage||current.rejectMessage||'').slice(0,1000),bannerUrl:String(req.body.bannerUrl||'').trim().slice(0,1000),thumbnailUrl:String(req.body.thumbnailUrl||'').trim().slice(0,1000)};}
  app.get('/dashboard/:guildId/staff-statistics',requireLogin,requireGuildAccess,async(req,res,next)=>{try{
    const gid=req.params.guildId,cfg=(await getStaff(gid)).insights;
    if(!cfg.enabled)return res.status(403).json({error:'ملفات الإدارة غير مفعلة.'});
    if(!isGuildOwner(req)&&!isOwner(req.user)&&cfg.viewerRoleIds.length){const viewer=await botFetch(`/guilds/${gid}/members/${req.user.id}`);if(!cfg.viewerRoleIds.some(id=>(viewer.roles||[]).includes(id)))return res.status(403).json({error:'ليس لديك رتبة مشاهدة ملفات الإدارة.'});}
    if(!cfg.staffRoleIds.length)return res.json({rows:[],total:0,note:'حدد رتب الإدارة في قسم إعدادات الملفات والتقييم أولًا.'});
    const [d,s]=await Promise.all([store.data(gid,'staff-management.json',{}),store.data(gid,'staff-insights.json',{})]);
    const selected=String(req.query.userId||'').replace(/[<@!>\s]/g,'');
    if(selected&&!/^\d{15,25}$/.test(selected))return res.status(400).json({error:'أدخل ID صحيحًا أو منشن الإداري.'});
    const period=['week','month'].includes(req.query.period)?req.query.period:'all',page=int(req.query.page,1,1,100000);
    const ids=selected?[selected]:[...new Set([...Object.keys(d.activeShifts||{}),...(d.shiftHistory||[]).map(x=>x.userId),...Object.values(s.tickets||{}).map(x=>x.claimedBy),...Object.values(d.requests||{}).map(x=>x.userId),...Object.values(s.promotions||{}).map(x=>x.userId)].filter(id=>/^\d{15,25}$/.test(String(id))))].sort();
    const batch=ids.slice((page-1)*20,page*20),rows=[];let unavailable=0;
    for(let i=0;i<batch.length;i+=4){const results=await Promise.all(batch.slice(i,i+4).map(async id=>{try{const member=await botFetch(`/guilds/${gid}/members/${id}`);if(!cfg.staffRoleIds.some(r=>(member.roles||[]).includes(r)))return null;return {...require('./staffStatistics').profile(cfg,s,d,String(id),period),name:member.nick||member.user?.global_name||member.user?.username||String(id)};}catch(e){if(e.status!==404&&e.statusCode!==404)unavailable++;return null;}}));rows.push(...results.filter(Boolean));}
    res.json({rows,total:ids.length,page,pages:Math.max(1,Math.ceil(ids.length/20)),note:unavailable?'تعذر التحقق من بعض الأعضاء. حاول التحديث.':selected&&!rows.length?'الإداري غير موجود أو ليس لديه إحدى رتب الملفات المحددة.':!ids.length?'لا توجد سجلات محفوظة بعد. تأكد أن البوت والداشبورد يستخدمان نفس مخزن البيانات.':''});
  }catch(e){next(e);}});
  app.post('/dashboard/:guildId/staff-management/save',requireLogin,requireGuildAccess,checkCsrf,async(req,res,next)=>{try{const kind=String(req.body.kind||'');if(!['duty','event','leave','eventLeave','adminDecision','insights'].includes(kind))throw new Error('قسم غير صالح.');const data=await getStaff(req.params.guildId);data[kind]=staffSectionFromBody(req,data[kind],kind);const expected=normalizeStaffManagement(data);await saveStaff(req.params.guildId,expected);const verified=await getStaff(req.params.guildId);if(JSON.stringify(verified[kind])!==JSON.stringify(expected[kind]))throw new Error('فشل التحقق من حفظ إعدادات إدارة الطاقم. تأكد من DATABASE_URL ثم أعد المحاولة.');const sectionByKind={duty:'staff-duty',event:'staff-event',leave:'staff-leave',eventLeave:'staff-event-leave',adminDecision:'staff-admin',insights:'staff-insights'};redirectDashboard(req,res,sectionByKind[kind]||'staff-duty');}catch(e){next(e);}});
  app.post('/dashboard/:guildId/staff-management/send',requireLogin,requireGuildAccess,checkCsrf,async(req,res,next)=>{try{
    const kind=String(req.body.kind||'');
    if(!['duty','event','leave','eventLeave'].includes(kind))throw new Error('قسم غير صالح.');
    const data=await getStaff(req.params.guildId);
    data[kind]=staffSectionFromBody(req,data[kind],kind);
    const x=data[kind];
    let payload;
    if(kind==='duty'){
      const e={color:0x7c3aed,title:'🕐 دوام الإدارة',description:'ابدأ دوامك من الأزرار بالأسفل. يقوم ZOMBI بتسجيل الكتابة والتواجد الصوتي وآخر نشاط أثناء الدوام.',footer:{text:'ZOMBI • STAFF DUTY'}};
      if(x.bannerUrl)e.image={url:x.bannerUrl};if(x.thumbnailUrl)e.thumbnail={url:x.thumbnailUrl};
      payload=makeDashboardPanelV2({embeds:[e],components:[{type:1,components:[{type:2,style:3,custom_id:'zstaff:duty:start',label:'بدء الدوام',emoji:{name:'🟢'}},{type:2,style:4,custom_id:'zstaff:duty:end',label:'إنهاء الدوام',emoji:{name:'🔴'}},{type:2,style:2,custom_id:'zstaff:duty:break',label:'استراحة',emoji:{name:'☕'}},{type:2,style:2,custom_id:'zstaff:duty:resume',label:'رجوع',emoji:{name:'▶️'}},{type:2,style:1,custom_id:'zstaff:duty:stats',label:'إحصائياتي',emoji:{name:'📊'}}]}]},'ZOMBI • STAFF DUTY','ZOMBI-STAFF-DUTY');
    }else if(kind==='event'){
      const e={color:0x5865F2,title:'🎉 طلب فعالية',description:'لديك فكرة فعالية؟ اضغط الزر بالأسفل واملأ النموذج. سيتم إرسال الطلب مباشرة إلى الإدارة للمراجعة.',footer:{text:'ZOMBI • EVENT REQUEST'}};
      if(x.bannerUrl)e.image={url:x.bannerUrl};if(x.thumbnailUrl)e.thumbnail={url:x.thumbnailUrl};
      payload=makeDashboardPanelV2({embeds:[e],components:[{type:1,components:[{type:2,style:1,custom_id:'zstaff:event:open',label:'طلب فعالية',emoji:{name:'🎉'}}]}]},'ZOMBI • EVENT REQUEST','ZOMBI-EVENT-REQUEST');
    }else{
      const e={color:0x7c3aed,title:'🏖️ طلب إجازة',description:'لتقديم إجازة إدارية اضغط الزر بالأسفل وحدد بداية الإجازة ونهايتها والسبب.',footer:{text:'ZOMBI • LEAVE REQUEST'}};
      if(x.bannerUrl)e.image={url:x.bannerUrl};if(x.thumbnailUrl)e.thumbnail={url:x.thumbnailUrl};
      payload=makeDashboardPanelV2({embeds:[e],components:[{type:1,components:[{type:2,style:1,custom_id:kind==='eventLeave'?'zstaff:eventleave:open':'zstaff:leave:open',label:'طلب إجازة',emoji:{name:'🏖️'}}]}]},'ZOMBI • LEAVE REQUEST','ZOMBI-LEAVE-REQUEST');
    }
    const msg=await sendPanelMessage(x.panelChannelId,x.panelMessageId,payload);
    x.panelMessageId=String(msg?.id||x.panelMessageId||'');
    await saveStaff(req.params.guildId,data);
    const sectionByKind={duty:'staff-duty',event:'staff-event',leave:'staff-leave',eventLeave:'staff-event-leave'};redirectDashboard(req,res,sectionByKind[kind]||'staff-duty');
  }catch(e){next(e);}});
  async function getApplications(gid){return normalizeApplicationsConfig(await store.data(gid,'applications-config.json',{enabled:true,types:[]}));}
  async function saveApplications(gid,data){return store.saveData(gid,'applications-config.json',normalizeApplicationsConfig(data));}
  app.post('/dashboard/:guildId/applications/add',requireLogin,requireGuildAccess,checkCsrf,async(req,res,next)=>{try{const data=await getApplications(req.params.guildId);if(data.types.length>=25)throw new Error('الحد الأقصى 25 نوع تقديم.');const base=applicationTypeFromBody(req,{},'new');base.id=`app_${Date.now().toString(36)}_${Math.random().toString(36).slice(2,7)}`;data.types.push(base);await saveApplications(req.params.guildId,data);redirectDashboard(req,res,'applications');}catch(e){next(e);}});
  app.post('/dashboard/:guildId/applications/update',requireLogin,requireGuildAccess,checkCsrf,async(req,res,next)=>{try{const data=await getApplications(req.params.guildId),id=String(req.body.typeId||''),idx=data.types.findIndex(x=>x.id===id);if(idx<0)throw new Error('نوع التقديم غير موجود.');data.types[idx]=applicationTypeFromBody(req,data.types[idx],'edit');data.types[idx].id=id;await saveApplications(req.params.guildId,data);redirectDashboard(req,res,'applications');}catch(e){next(e);}});
  app.post('/dashboard/:guildId/applications/delete',requireLogin,requireGuildAccess,checkCsrf,async(req,res,next)=>{try{const data=await getApplications(req.params.guildId),id=String(req.body.typeId||'');data.types=data.types.filter(x=>x.id!==id);await saveApplications(req.params.guildId,data);redirectDashboard(req,res,'applications');}catch(e){next(e);}});
  app.post('/dashboard/:guildId/applications/send',requireLogin,requireGuildAccess,checkCsrf,async(req,res,next)=>{try{const data=await getApplications(req.params.guildId),id=String(req.body.typeId||''),idx=data.types.findIndex(x=>x.id===id);if(idx<0)throw new Error('نوع التقديم غير موجود.');const type=applicationTypeFromBody(req,data.types[idx],'edit');type.id=id;const appEmbed={color:0x5865F2,title:`${type.emoji} ${type.title}`.slice(0,256),description:type.description||'اضغط الزر بالأسفل لفتح نموذج التقديم.',footer:{text:`${String((await store.getConfig(req.params.guildId))?.branding?.customName||req.bundle.guild.name||'Server').slice(0,80)} • APPLICATIONS`}};if(type.bannerUrl)appEmbed.image={url:type.bannerUrl};if(type.thumbnailUrl)appEmbed.thumbnail={url:type.thumbnailUrl};const payload={embeds:[appEmbed],components:[{type:1,components:[{type:2,style:1,custom_id:`pub:application:open:${type.id}`,label:type.buttonLabel.slice(0,80),emoji:{name:type.emoji||'📝'}}]}]};let msg=null;if(type.panelMessageId){try{msg=await botFetch(`/channels/${type.panelChannelId}/messages/${type.panelMessageId}`,{method:'PATCH',body:JSON.stringify(payload)});}catch{}}if(!msg)msg=await botFetch(`/channels/${type.panelChannelId}/messages`,{method:'POST',body:JSON.stringify(payload)});type.panelMessageId=String(msg?.id||type.panelMessageId||'');data.types[idx]=type;await saveApplications(req.params.guildId,data);redirectDashboard(req,res,'applications');}catch(e){next(e);}});

  app.get('/health',async(_req,res)=>{const hb=await getRecentBotHeartbeat().catch(()=>null);res.json({ok:true,database:await store.health(),uptime:process.uptime(),discordProxy:Boolean(oauthProxyUrl()),botHeartbeat:hb?{ready:hb.ready!==false,guildCount:hb.guildCount||0,ageMs:Date.now()-Number(hb.at||0)}:null});});
  app.use((err,req,res,_next)=>{
    console.error(err);const status=Number(err?.status||0);
    if(status===429){const seconds=Math.max(1,Math.ceil(Number(err?.retryAfter||30)));res.set('Retry-After',String(seconds));return res.status(429).send(layout('Discord Rate Limit',`<section class="login"><h1>⏳ Discord مشغول مؤقتًا</h1><p>الداشبورد أوقف تكرار الطلبات تلقائيًا. انتظر تقريبًا ${seconds} ثانية ثم أعد فتح الصفحة مرة واحدة.</p><a class="btn primary" href="${esc(req.originalUrl||'/dashboard')}">إعادة المحاولة</a><a class="btn" href="/dashboard">السيرفرات</a></section>`,req.user));}
    if(status===401)return res.status(503).send(layout('Discord Authorization',`<section class="login"><h1>🔑 فشل توثيق Discord</h1><p>تأكد من BOT_TOKEN وبيانات Discord OAuth. إذا كان OAUTH_PROXY_URL مفعّلًا فالنسخة الجديدة تدعم المفتاح اليدوي أو التوثيق المشتق تلقائيًا من DISCORD_CLIENT_SECRET.</p><a class="btn primary" href="/dashboard">رجوع</a></section>`,req.user));
    res.status(500).send(layout('Error',`<section class="login"><h1>❌ حدث خطأ</h1><p>${esc(err.message)}</p></section>`,req.user));
  });
  const port=Number(process.env.PORT||3000),host=process.env.HOST||'0.0.0.0';app.listen(port,host,()=>console.log(`🌐 ZOMBI Website: ${baseUrl()} (${host}:${port})`));
}
module.exports={start,layout,landing,decorateDashboard,upgradeResponse};
if(require.main===module)start().catch(e=>{console.error('❌ Website startup failed:',e);process.exit(1);});
