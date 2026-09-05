require('dotenv').config();
const express = require('express');
const session = require('express-session');
const crypto = require('crypto');
const path = require('path');
const store = require('./sharedStore');

const API = 'https://discord.com/api/v10';
const OAUTH_TOKEN_URL = 'https://discord.com/api/oauth2/token';
const MANAGE_GUILD = 0x20n;
const ADMINISTRATOR = 0x8n;

function esc(v=''){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));}
function baseUrl(){return String(process.env.PUBLIC_BASE_URL||'http://localhost:3000').replace(/\/$/,'');}
function ownerIds(){return new Set(String(process.env.OWNER_IDS||'').split(',').map(x=>x.trim()).filter(x=>/^\d{15,25}$/.test(x)));}
function isOwner(user){return Boolean(user?.id&&ownerIds().has(String(user.id)));}
function canManage(g){try{const p=BigInt(String(g?.permissions||'0'));return Boolean(g?.owner)||(p&MANAGE_GUILD)===MANAGE_GUILD||(p&ADMINISTRATOR)===ADMINISTRATOR;}catch{return false;}}
function csrf(req){if(!req.session.csrf)req.session.csrf=crypto.randomBytes(24).toString('hex');return req.session.csrf;}
function checkCsrf(req,res,next){if(String(req.body?._csrf||req.get('x-csrf-token')||'')!==String(req.session?.csrf||''))return res.status(403).send('CSRF validation failed');next();}
function requireLogin(req,res,next){if(req.user)return next();req.session.returnTo=req.originalUrl;res.redirect('/auth/discord');}
function requireOwner(req,res,next){if(req.user&&isOwner(req.user))return next();res.status(403).send('Owner only');}
function userGuild(req,gid){return (req.user?.guilds||[]).find(g=>String(g.id)===String(gid));}
function color(cfg){const n=parseInt(String(cfg?.branding?.color||'#7c3aed').replace('#',''),16);return Number.isFinite(n)?n:0x7c3aed;}

async function botFetch(route, options={}){
  const token=String(process.env.BOT_TOKEN||process.env.TOKEN||'').trim();
  if(!token) throw new Error('BOT_TOKEN غير موجود في إعدادات الموقع.');
  const res=await fetch(API+route,{...options,headers:{Authorization:`Bot ${token}`,'Content-Type':'application/json',...(options.headers||{})}});
  if(res.status===204)return null;
  const text=await res.text();let data=null;try{data=text?JSON.parse(text):null;}catch{data=text;}
  if(!res.ok){const e=new Error(data?.message||`Discord API ${res.status}`);e.status=res.status;e.discord=data;throw e;}
  return data;
}
async function getBotGuild(id){try{return await botFetch(`/guilds/${id}?with_counts=true`);}catch(e){if(e.status===404)return null;throw e;}}
async function getGuildBundle(id){const [guild,channels,roles]=await Promise.all([getBotGuild(id),botFetch(`/guilds/${id}/channels`).catch(()=>[]),botFetch(`/guilds/${id}/roles`).catch(()=>[])]);if(!guild)return null;return {guild,channels,roles};}
async function requireGuildAccess(req,res,next){try{const ug=userGuild(req,req.params.guildId);if(!ug||!canManage(ug))return res.status(403).send('ليس لديك صلاحية Manage Server على هذا السيرفر.');const bundle=await getGuildBundle(req.params.guildId);if(!bundle)return res.status(404).send('البوت غير موجود في هذا السيرفر.');req.discordGuild=ug;req.bundle=bundle;next();}catch(e){next(e);}}

function layout(title,body,user=null){return `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)} • ZOMBI</title><link rel="stylesheet" href="/site/site.css"></head><body><header class="top"><a class="brand" href="/"><img src="/assets/zombi-logo.png"><span>ZOMBI</span></a><nav><a href="/premium">Premium</a>${user?`<a href="/dashboard">Dashboard</a>${isOwner(user)?'<a href="/owner">Owner</a>':''}<a class="pill" href="/logout">خروج</a>`:'<a class="pill" href="/auth/discord">تسجيل دخول</a>'}</nav></header><main>${body}</main><footer>© ${new Date().getFullYear()} ZOMBI • Discord Bot</footer></body></html>`;}
function inviteUrl(gid=''){const id=String(process.env.DISCORD_CLIENT_ID||'');return `https://discord.com/oauth2/authorize?client_id=${encodeURIComponent(id)}&permissions=1099780189206&integration_type=0&scope=bot+applications.commands${gid?`&guild_id=${gid}&disable_guild_select=true`:''}`;}
async function landing(){const ids=await store.allGuildIds().catch(()=>[]);return `<section class="hero"><div><span class="badge">PUBLIC DISCORD BOT</span><h1>خلّي سيرفرك أقوى مع <b>ZOMBI</b></h1><p>اقتصاد، ألعاب، تذاكر، متجر رتب، Self Roles، مستويات، إدارة وDashboard من موقع واحد.</p><div class="actions"><a class="btn primary" href="${inviteUrl()}">➕ إضافة إلى Discord</a><a class="btn" href="/dashboard">⚙️ فتح Dashboard</a></div><div class="stats"><div><strong>${ids.length}</strong><span>سيرفر مسجل</span></div><div><strong>24/7</strong><span>Bot Online</span></div><div><strong>Free + Premium</strong><span>خطط</span></div></div></div><div class="hero-card"><img src="/assets/zombi-logo.png"><h3>ZOMBI CONTROL CENTER</h3><p>كل سيرفر له إعداداته وبياناته بشكل مستقل.</p></div></section><section class="features"><h2>كل الأدوات في مكان واحد</h2><div class="grid">${[['💰','Economy','رصيد، يومية، تحويل، Leaderboard'],['🎮','Games','ألعاب سريعة مع جوائز قابلة للتخصيص'],['🎫','Tickets','لوحة تذاكر وقنوات خاصة للدعم'],['🛒','Store','بيع رتب مقابل عملة السيرفر'],['🔔','Self Roles','لوحات رتب وإشعارات'],['🏆','Levels','XP ومستويات تلقائية'],['🛡️','Moderation','Clear / Kick / Ban / Lock'],['💎','Premium','تخصيصات وحدود أعلى']].map(x=>`<article><i>${x[0]}</i><h3>${x[1]}</h3><p>${x[2]}</p></article>`).join('')}</div></section>`;}
function iconUrl(g){return g?.icon?`https://cdn.discordapp.com/icons/${g.id}/${g.icon}.png?size=128`:'';}
function textChannels(channels,value){const allowed=new Set([0,5]);return `<option value="">— غير محدد —</option>`+channels.filter(c=>allowed.has(c.type)).sort((a,b)=>(a.position||0)-(b.position||0)).map(c=>`<option value="${c.id}" ${c.id===value?'selected':''}># ${esc(c.name)}</option>`).join('');}
function categories(channels,value){return `<option value="">— غير محدد —</option>`+channels.filter(c=>c.type===4).sort((a,b)=>(a.position||0)-(b.position||0)).map(c=>`<option value="${c.id}" ${c.id===value?'selected':''}>📁 ${esc(c.name)}</option>`).join('');}
function roleOptions(roles,guildId,selected=[]){const set=new Set(selected||[]);return roles.filter(r=>r.id!==guildId&&!r.managed).sort((a,b)=>(b.position||0)-(a.position||0)).map(r=>`<option value="${r.id}" ${set.has(r.id)?'selected':''}>${esc(r.name)}</option>`).join('');}
async function guildPage(req){const {guild,channels,roles}=req.bundle,cfg=await store.getConfig(guild.id),premium=store.isPremium(cfg),token=csrf(req),site=await store.getGlobalConfig();const products=cfg.store.products||[],items=cfg.rolePanel.items||[];return `<section class="dash-head"><div><a href="/dashboard">← السيرفرات</a><h1>${esc(guild.name)}</h1><p><code>${guild.id}</code> • ${premium?'💎 Premium':'🆓 Free'}</p></div>${iconUrl(guild)?`<img class="guild-icon" src="${iconUrl(guild)}">`:''}</section><div class="tabs-note">أي تعديل هنا ينحفظ مباشرة لهذا السيرفر فقط.</div>${site.announcement?`<div class="warn">📢 ${esc(site.announcement)}</div>`:''}
<form class="panel" method="post" action="/dashboard/${guild.id}/settings"><input type="hidden" name="_csrf" value="${token}"><h2>⚙️ الإعدادات العامة</h2><div class="form-grid"><label>اسم العملة<input name="currencyName" value="${esc(cfg.currency.name)}" ${premium?'':'readonly'}></label><label>Emoji العملة<input name="currencyEmoji" value="${esc(cfg.currency.emoji)}"></label><label>لون Embed<input name="brandColor" value="${esc(cfg.branding.color)}" ${premium?'':'readonly'}></label><label>اسم مخصص<input name="customName" value="${esc(cfg.branding.customName)}" ${premium?'':'readonly'}></label><label>روم Logs<select name="logs">${textChannels(channels,cfg.channels.logs)}</select></label><label>روم Level Up<select name="levelUp">${textChannels(channels,cfg.channels.levelUp)}</select></label><label>روم Ticket Panel<select name="ticketPanel">${textChannels(channels,cfg.channels.ticketPanel)}</select></label><label>Category التذاكر<select name="ticketCategory">${categories(channels,cfg.channels.ticketCategory)}</select></label><label>روم Store Panel<select name="storePanel">${textChannels(channels,cfg.channels.storePanel)}</select></label><label>روم Role Panel<select name="rolePanel">${textChannels(channels,cfg.channels.rolePanel)}</select></label></div>
<h3>الأنظمة</h3><div class="checks">${Object.entries({economy:'Economy',bank:'Bank',games:'Games',tickets:'Tickets',store:'Store',rolePanel:'Self Roles',levels:'Levels',voiceRewards:'Voice Rewards',moderation:'Moderation',gangs:'Gangs (Premium)'}).map(([k,n])=>`<label><input type="checkbox" name="feature_${k}" ${cfg.features[k]?'checked':''}> ${n}</label>`).join('')}</div>
<h3>💰 Economy</h3><div class="form-grid"><label>Daily Reward<input type="number" name="dailyAmount" value="${cfg.economy.dailyAmount}"></label><label>Daily Cooldown Hours<input type="number" name="dailyCooldownHours" value="${cfg.economy.dailyCooldownHours}"></label><label>كل كم رسالة مكافأة<input type="number" name="messageEvery" value="${cfg.economy.messageEvery}"></label><label>مكافأة الرسائل<input type="number" name="messageReward" value="${cfg.economy.messageReward}"></label><label>كل كم دقيقة Voice Reward<input type="number" name="voiceEveryMinutes" value="${cfg.economy.voiceEveryMinutes}"></label><label>Voice Reward<input type="number" name="voiceReward" value="${cfg.economy.voiceReward}"></label></div>
<h3>🎮 Games</h3><div class="form-grid"><label>عدد الجولات<input type="number" name="rounds" value="${cfg.games.rounds}"></label><label>وقت الجولة<input type="number" name="roundTimeSeconds" value="${cfg.games.roundTimeSeconds}"></label><label>جائزة الفائز<input type="number" name="winnerReward" value="${cfg.games.winnerReward}"></label></div>
<h3>🎫 Tickets</h3><div class="form-grid"><label>عنوان اللوحة<input name="ticketTitle" value="${esc(cfg.tickets.title)}"></label><label>زر الفتح<input name="ticketButtonLabel" value="${esc(cfg.tickets.buttonLabel)}"></label><label class="wide">الوصف<textarea name="ticketDescription">${esc(cfg.tickets.description)}</textarea></label><label class="wide">رتب الدعم<select multiple name="supportRoleIds">${roleOptions(roles,guild.id,cfg.tickets.supportRoleIds)}</select></label></div><button class="btn primary" type="submit">💾 حفظ الإعدادات</button></form>
<div class="two"><section class="panel"><h2>🎫 لوحة التذاكر</h2><form method="post" action="/dashboard/${guild.id}/send/tickets"><input type="hidden" name="_csrf" value="${token}"><button class="btn" type="submit">إرسال / تحديث</button></form></section><section class="panel"><h2>💎 Premium</h2><p>${premium?`مفعّل حتى <b>${new Date(cfg.premiumUntil).toLocaleDateString('ar-JO')}</b>`:'الخطة الحالية مجانية.'}</p><form method="post" action="/dashboard/${guild.id}/redeem"><input type="hidden" name="_csrf" value="${token}"><input name="code" placeholder="ZOMBI-XXXXXXXXXXXX"><button class="btn" type="submit">تفعيل كود</button></form></section></div>
<section class="panel"><h2>🛒 متجر الرتب <small>${products.length}/${premium?25:3}</small></h2><form class="inline-form" method="post" action="/dashboard/${guild.id}/store/add"><input type="hidden" name="_csrf" value="${token}"><select name="roleId" required><option value="">اختر رتبة</option>${roleOptions(roles,guild.id)}</select><input type="number" name="price" min="1" placeholder="السعر" required><input name="emoji" value="🏷️"><button class="btn">إضافة</button></form><div class="items">${products.map(p=>`<form method="post" action="/dashboard/${guild.id}/store/delete"><input type="hidden" name="_csrf" value="${token}"><input type="hidden" name="roleId" value="${p.roleId}"><span>${esc(p.emoji||'🏷️')} ${esc(p.name)} — ${Number(p.price).toLocaleString()} ${esc(cfg.currency.name)}</span><button class="danger">حذف</button></form>`).join('')||'<p>لا توجد منتجات.</p>'}</div><form method="post" action="/dashboard/${guild.id}/send/store"><input type="hidden" name="_csrf" value="${token}"><button class="btn">إرسال / تحديث لوحة المتجر</button></form></section>
<section class="panel"><h2>🔔 Self Roles <small>${items.length}/${premium?20:3}</small></h2><form class="inline-form" method="post" action="/dashboard/${guild.id}/roles/add"><input type="hidden" name="_csrf" value="${token}"><select name="roleId" required><option value="">اختر رتبة</option>${roleOptions(roles,guild.id)}</select><input name="label" placeholder="اسم الزر"><input name="emoji" value="🔔"><button class="btn">إضافة</button></form><div class="items">${items.map(p=>`<form method="post" action="/dashboard/${guild.id}/roles/delete"><input type="hidden" name="_csrf" value="${token}"><input type="hidden" name="roleId" value="${p.roleId}"><span>${esc(p.emoji||'🔔')} ${esc(p.label)}</span><button class="danger">حذف</button></form>`).join('')||'<p>لا توجد رتب.</p>'}</div><form method="post" action="/dashboard/${guild.id}/send/roles"><input type="hidden" name="_csrf" value="${token}"><button class="btn">إرسال / تحديث لوحة الرتب</button></form></section>`;}

async function sendOrUpdate(channelId,messageId,payload){if(!channelId)throw new Error('حدد الروم أولًا.');if(messageId){try{return await botFetch(`/channels/${channelId}/messages/${messageId}`,{method:'PATCH',body:JSON.stringify(payload)});}catch{}}return botFetch(`/channels/${channelId}/messages`,{method:'POST',body:JSON.stringify(payload)});}
async function sendPanel(which,guildId,bundle){const cfg=await store.getConfig(guildId);if(which==='tickets'){const payload={embeds:[{color:color(cfg),title:cfg.tickets.title,description:cfg.tickets.description,footer:{text:store.isPremium(cfg)?(cfg.branding.customFooter||cfg.branding.footer):'Powered by ZOMBI'}}],components:[{type:1,components:[{type:2,style:1,custom_id:'pub:ticket:open',label:cfg.tickets.buttonLabel||'فتح تذكرة',emoji:cfg.tickets.buttonEmoji?{name:cfg.tickets.buttonEmoji}:undefined}]}]};const m=await sendOrUpdate(cfg.channels.ticketPanel,cfg.tickets.panelMessageId,payload);cfg.tickets.panelMessageId=m.id;await store.saveConfig(guildId,cfg);return;}
if(which==='store'){if(!(cfg.store.products||[]).length)throw new Error('أضف منتجات أولًا.');const roleMap=new Map(bundle.roles.map(r=>[r.id,r]));const payload={embeds:[{color:color(cfg),title:cfg.store.title,description:cfg.store.description}],components:[{type:1,components:[{type:3,custom_id:'pub:store:buy',placeholder:'اختر رتبة للشراء',options:cfg.store.products.slice(0,25).map(p=>({label:String(p.name||roleMap.get(p.roleId)?.name||'Role').slice(0,100),description:`${Number(p.price).toLocaleString()} ${cfg.currency.name}`.slice(0,100),value:p.roleId,...(p.emoji?{emoji:{name:p.emoji}}:{})}))}]}]};const m=await sendOrUpdate(cfg.channels.storePanel,cfg.store.panelMessageId,payload);cfg.store.panelMessageId=m.id;await store.saveConfig(guildId,cfg);return;}
if(which==='roles'){if(!(cfg.rolePanel.items||[]).length)throw new Error('أضف رتب Self Roles أولًا.');const roleMap=new Map(bundle.roles.map(r=>[r.id,r]));const rows=[];for(let i=0;i<cfg.rolePanel.items.length;i+=5)rows.push({type:1,components:cfg.rolePanel.items.slice(i,i+5).map(x=>({type:2,style:2,custom_id:`pub:role:${x.roleId}`,label:String(x.label||roleMap.get(x.roleId)?.name||'Role').slice(0,80),...(x.emoji?{emoji:{name:x.emoji}}:{})}))});const payload={embeds:[{color:color(cfg),title:cfg.rolePanel.title,description:cfg.rolePanel.description}],components:rows.slice(0,4)};const m=await sendOrUpdate(cfg.channels.rolePanel,cfg.rolePanel.panelMessageId,payload);cfg.rolePanel.panelMessageId=m.id;await store.saveConfig(guildId,cfg);}}

async function start(){
  const required=['DISCORD_CLIENT_ID','DISCORD_CLIENT_SECRET','PUBLIC_BASE_URL','SESSION_SECRET','BOT_TOKEN','DATABASE_URL'];
  const missing=required.filter(k=>!String(process.env[k]||'').trim());if(missing.length)console.warn('⚠️ Missing env:',missing.join(', '));
  await store.ensureDb();
  const app=express();app.set('trust proxy',1);app.use(express.urlencoded({extended:true}));app.use(express.json());app.use('/site', express.static(__dirname)); app.use('/assets', express.static(__dirname));
  let sessionStore;
  if(String(process.env.DATABASE_URL||'').trim()){
    const {Pool}=require('pg');
    const ssl=String(process.env.DATABASE_SSL||'').toLowerCase()==='false'?false:{rejectUnauthorized:false};
    const sessionPool=new Pool({connectionString:process.env.DATABASE_URL,ssl,max:5});
    class PgSessionStore extends session.Store {
      get(sid,cb){sessionPool.query('SELECT sess,expire_at FROM zombi_web_sessions WHERE sid=$1',[sid]).then(r=>{const row=r.rows[0];if(!row||Number(row.expire_at||0)<Date.now())return cb(null,null);cb(null,row.sess);}).catch(cb);}
      set(sid,sess,cb){const exp=sess?.cookie?.expires?new Date(sess.cookie.expires).getTime():Date.now()+7*86400000;sessionPool.query(`INSERT INTO zombi_web_sessions(sid,sess,expire_at) VALUES($1,$2,$3) ON CONFLICT(sid) DO UPDATE SET sess=EXCLUDED.sess,expire_at=EXCLUDED.expire_at`,[sid,sess,exp]).then(()=>cb&&cb()).catch(e=>cb&&cb(e));}
      destroy(sid,cb){sessionPool.query('DELETE FROM zombi_web_sessions WHERE sid=$1',[sid]).then(()=>cb&&cb()).catch(e=>cb&&cb(e));}
    }
    sessionStore=new PgSessionStore();
  }
  app.use(session({store:sessionStore,secret:process.env.SESSION_SECRET||crypto.randomBytes(32).toString('hex'),resave:false,saveUninitialized:false,cookie:{httpOnly:true,sameSite:'lax',secure:baseUrl().startsWith('https://'),maxAge:7*86400000}}));
  app.use((req,_res,next)=>{req.user=req.session.user||null;next();});
  app.get('/',async(req,res,next)=>{try{res.send(layout('Home',await landing(),req.user));}catch(e){next(e);}});
  app.get('/auth/discord',(req,res)=>{const state=crypto.randomBytes(24).toString('hex');req.session.oauthState=state;const redirect=process.env.DISCORD_CALLBACK_URL||`${baseUrl()}/auth/discord/callback`;const q=new URLSearchParams({client_id:process.env.DISCORD_CLIENT_ID||'',response_type:'code',redirect_uri:redirect,scope:'identify guilds',state});res.redirect(`https://discord.com/oauth2/authorize?${q}`);});
  app.get('/auth/discord/callback',async(req,res,next)=>{try{
    if(req.query.error){
      throw new Error(`Discord OAuth: ${String(req.query.error_description||req.query.error)}`);
    }
    if(!req.query.code||!req.query.state||String(req.query.state)!==String(req.session.oauthState||'')){
      return res.status(400).send(layout('OAuth Error','<section class="login"><h1>❌ فشل تسجيل الدخول</h1><p>جلسة تسجيل الدخول انتهت أو غير صالحة. جرّب تسجيل الدخول مرة ثانية.</p><a class="btn" href="/auth/discord">تسجيل الدخول</a></section>',req.user));
    }
    delete req.session.oauthState;
    const redirect=process.env.DISCORD_CALLBACK_URL||`${baseUrl()}/auth/discord/callback`;

    async function readJsonResponse(response,label){
      const raw=await response.text();
      let data=null;
      try{data=raw?JSON.parse(raw):{};}
      catch{
        const preview=raw.replace(/\s+/g,' ').slice(0,180);
        throw new Error(`${label} رجّع رد غير متوقع (${response.status}): ${preview}`);
      }
      if(!response.ok){
        const err=new Error(data?.error||data?.error_description||data?.message||`${label} failed (${response.status})`);
        err.status=response.status;
        err.data=data;
        err.retryAfter=Number(data?.retry_after||response.headers.get('retry-after')||0);
        throw err;
      }
      return data;
    }

    async function loginViaProxy(code){
      const proxyUrl=String(process.env.OAUTH_PROXY_URL||'').trim();
      const proxySecret=String(process.env.OAUTH_PROXY_SECRET||'').trim();
      if(!proxyUrl)return null;
      if(!proxySecret)throw new Error('OAUTH_PROXY_SECRET غير موجود في إعدادات Render.');

      const response=await fetch(proxyUrl,{
        method:'POST',
        headers:{
          'Authorization':`Bearer ${proxySecret}`,
          'Content-Type':'application/json',
          'Accept':'application/json'
        },
        body:JSON.stringify({code:String(code),redirect_uri:redirect})
      });
      const data=await readJsonResponse(response,'ZOMBI OAuth Proxy');
      if(!data?.ok||!data?.user)throw new Error(data?.error||'OAuth Proxy لم يرجع بيانات المستخدم.');
      return {user:data.user,guilds:Array.isArray(data.guilds)?data.guilds:[]};
    }

    async function loginDirect(code){
      const clientId=String(process.env.DISCORD_CLIENT_ID||'').trim();
      const clientSecret=String(process.env.DISCORD_CLIENT_SECRET||'').trim();
      const auth=Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
      const body=new URLSearchParams({grant_type:'authorization_code',code:String(code),redirect_uri:redirect});
      const tr=await fetch(OAUTH_TOKEN_URL,{
        method:'POST',
        headers:{'Authorization':`Basic ${auth}`,'Content-Type':'application/x-www-form-urlencoded','Accept':'application/json'},
        body
      });
      const td=await readJsonResponse(tr,'Discord OAuth token');
      if(!td?.access_token)throw new Error('Discord لم يرجع access token.');
      const headers={Authorization:`Bearer ${td.access_token}`,'Accept':'application/json'};
      const [ur,gr]=await Promise.all([fetch(`${API}/users/@me`,{headers}),fetch(`${API}/users/@me/guilds`,{headers})]);
      return {user:await readJsonResponse(ur,'Discord user profile'),guilds:await readJsonResponse(gr,'Discord guild list')};
    }

    const authResult=(await loginViaProxy(req.query.code))||await loginDirect(req.query.code);
    const user=authResult.user;
    const guilds=authResult.guilds;
    req.session.user={id:user.id,username:user.username,displayName:user.global_name||user.username,avatar:user.avatar,guilds:Array.isArray(guilds)?guilds:[]};
    const to=req.session.returnTo||'/dashboard';delete req.session.returnTo;res.redirect(to);
  }catch(e){
    if(Number(e?.status)===429){
      const seconds=Math.max(1,Math.ceil(Number(e?.retryAfter||30)));
      return res.status(429).send(layout('OAuth Rate Limit',`<section class="login"><h1>⏳ Discord حدّد تسجيل الدخول مؤقتًا</h1><p>انتظر تقريبًا ${seconds} ثانية ثم جرّب مرة ثانية.</p><a class="btn" href="/">رجوع</a></section>`,req.user));
    }
    next(e);
  }});
  app.get('/login',(req,res)=>res.redirect('/auth/discord'));app.get('/logout',(req,res)=>req.session.destroy(()=>res.redirect('/')));
  app.get('/dashboard',requireLogin,async(req,res,next)=>{try{const manageable=(req.user.guilds||[]).filter(canManage);const statuses=await Promise.all(manageable.slice(0,50).map(async g=>({g,installed:Boolean(await getBotGuild(g.id).catch(()=>null))})));const installed=statuses.filter(x=>x.installed),missing=statuses.filter(x=>!x.installed);const cards=(await Promise.all(installed.map(async({g})=>{const cfg=await store.getConfig(g.id);return `<a class="server" href="/dashboard/${g.id}"><div class="server-icon">${g.icon?`<img src="https://cdn.discordapp.com/icons/${g.id}/${g.icon}.png">`:'🤖'}</div><div><b>${esc(g.name)}</b><span>${store.isPremium(cfg)?'💎 Premium':'🆓 Free'}</span></div><em>إدارة ←</em></a>`;}))).join('');const add=missing.map(({g})=>`<a class="server muted" href="${inviteUrl(g.id)}"><div class="server-icon">➕</div><div><b>${esc(g.name)}</b><span>البوت غير مضاف</span></div><em>إضافة</em></a>`).join('');res.send(layout('Dashboard',`<section class="dash-head"><div><h1>سيرفراتك</h1><p>تظهر فقط السيرفرات التي لديك فيها Manage Server.</p></div></section><div class="servers">${cards||'<p>لا يوجد سيرفرات مضافة تستطيع إدارتها.</p>'}</div>${add?`<h2>إضافة ZOMBI لسيرفر آخر</h2><div class="servers">${add}</div>`:''}`,req.user));}catch(e){next(e);}});
  app.get('/dashboard/:guildId',requireLogin,requireGuildAccess,async(req,res,next)=>{try{res.send(layout(req.bundle.guild.name,await guildPage(req),req.user));}catch(e){next(e);}});
  app.post('/dashboard/:guildId/settings',requireLogin,requireGuildAccess,checkCsrf,async(req,res,next)=>{try{const old=await store.getConfig(req.params.guildId),premium=store.isPremium(old),arr=v=>Array.isArray(v)?v:(v?[v]:[]);await store.patchConfig(req.params.guildId,{setupComplete:true,features:{economy:!!req.body.feature_economy,bank:!!req.body.feature_bank,games:!!req.body.feature_games,tickets:!!req.body.feature_tickets,store:!!req.body.feature_store,rolePanel:!!req.body.feature_rolePanel,levels:!!req.body.feature_levels,voiceRewards:!!req.body.feature_voiceRewards,moderation:!!req.body.feature_moderation,gangs:premium&&!!req.body.feature_gangs},currency:{name:premium?req.body.currencyName:old.currency.name,emoji:req.body.currencyEmoji||old.currency.emoji},branding:{color:premium?(req.body.brandColor||old.branding.color):old.branding.color,customName:premium?(req.body.customName||''):old.branding.customName},channels:{logs:req.body.logs,levelUp:req.body.levelUp,ticketPanel:req.body.ticketPanel,ticketCategory:req.body.ticketCategory,storePanel:req.body.storePanel,rolePanel:req.body.rolePanel},economy:{dailyAmount:req.body.dailyAmount,dailyCooldownHours:req.body.dailyCooldownHours,messageEvery:req.body.messageEvery,messageReward:req.body.messageReward,voiceEveryMinutes:req.body.voiceEveryMinutes,voiceReward:req.body.voiceReward},games:{rounds:req.body.rounds,roundTimeSeconds:req.body.roundTimeSeconds,winnerReward:req.body.winnerReward},tickets:{title:req.body.ticketTitle,description:req.body.ticketDescription,buttonLabel:req.body.ticketButtonLabel,supportRoleIds:arr(req.body.supportRoleIds)}});res.redirect(`/dashboard/${req.params.guildId}`);}catch(e){next(e);}});
  app.post('/dashboard/:guildId/redeem',requireLogin,requireGuildAccess,checkCsrf,async(req,res)=>{try{await store.redeemCode(req.params.guildId,req.body.code);res.redirect(`/dashboard/${req.params.guildId}`);}catch(e){res.status(400).send(layout('Premium',`<section class="login"><h1>❌ ${esc(e.message)}</h1><a class="btn" href="/dashboard/${req.params.guildId}">رجوع</a></section>`,req.user));}});
  app.post('/dashboard/:guildId/store/add',requireLogin,requireGuildAccess,checkCsrf,async(req,res)=>{const cfg=await store.getConfig(req.params.guildId),limit=store.isPremium(cfg)?25:3;if(cfg.store.products.length>=limit)return res.status(403).send('وصلت للحد المسموح.');const role=req.bundle.roles.find(r=>r.id===String(req.body.roleId));if(!role)return res.status(400).send('Role invalid');if(!cfg.store.products.some(p=>p.roleId===role.id))cfg.store.products.push({roleId:role.id,name:role.name,price:Math.max(1,Number(req.body.price||1)),emoji:String(req.body.emoji||'🏷️').slice(0,32)});await store.saveConfig(req.params.guildId,cfg);res.redirect(`/dashboard/${req.params.guildId}`);});
  app.post('/dashboard/:guildId/store/delete',requireLogin,requireGuildAccess,checkCsrf,async(req,res)=>{const cfg=await store.getConfig(req.params.guildId);cfg.store.products=cfg.store.products.filter(p=>p.roleId!==String(req.body.roleId));await store.saveConfig(req.params.guildId,cfg);res.redirect(`/dashboard/${req.params.guildId}`);});
  app.post('/dashboard/:guildId/roles/add',requireLogin,requireGuildAccess,checkCsrf,async(req,res)=>{const cfg=await store.getConfig(req.params.guildId),limit=store.isPremium(cfg)?20:3;if(cfg.rolePanel.items.length>=limit)return res.status(403).send('وصلت للحد المسموح.');const role=req.bundle.roles.find(r=>r.id===String(req.body.roleId));if(!role)return res.status(400).send('Role invalid');if(!cfg.rolePanel.items.some(p=>p.roleId===role.id))cfg.rolePanel.items.push({roleId:role.id,label:String(req.body.label||role.name).slice(0,80),emoji:String(req.body.emoji||'🔔').slice(0,32)});await store.saveConfig(req.params.guildId,cfg);res.redirect(`/dashboard/${req.params.guildId}`);});
  app.post('/dashboard/:guildId/roles/delete',requireLogin,requireGuildAccess,checkCsrf,async(req,res)=>{const cfg=await store.getConfig(req.params.guildId);cfg.rolePanel.items=cfg.rolePanel.items.filter(p=>p.roleId!==String(req.body.roleId));await store.saveConfig(req.params.guildId,cfg);res.redirect(`/dashboard/${req.params.guildId}`);});
  for(const which of ['tickets','store','roles'])app.post(`/dashboard/:guildId/send/${which}`,requireLogin,requireGuildAccess,checkCsrf,async(req,res)=>{try{await sendPanel(which,req.params.guildId,req.bundle);res.redirect(`/dashboard/${req.params.guildId}`);}catch(e){res.status(400).send(layout('Error',`<section class="login"><h1>❌ ${esc(e.message)}</h1><a class="btn" href="/dashboard/${req.params.guildId}">رجوع</a></section>`,req.user));}});
  app.get('/premium',async(req,res,next)=>{try{const site=await store.getGlobalConfig(),buy=site.purchaseUrl||process.env.PREMIUM_PURCHASE_URL||'';res.send(layout('Premium',`<section class="pricing"><span class="badge">ZOMBI PREMIUM</span><h1>خطط بسيطة وقابلة للتطوير</h1><div class="price-grid"><article><h2>Free</h2><strong>0</strong><p>Economy + Bank + Games + Tickets + Moderation + Levels + Voice Rewards<br>3 منتجات متجر<br>3 Self Roles</p><a class="btn" href="/dashboard">ابدأ مجانًا</a></article><article class="hot"><span>الأفضل</span><h2>Premium</h2><strong>${esc(site.premiumPrice||'💎')}</strong><p>تخصيص العملة والهوية<br>25 منتج متجر<br>20 Self Roles<br>Gang System + خزنة + نواب</p>${buy?`<a class="btn primary" href="${esc(buy)}">اشترك الآن</a>`:'<p class="hint">التفعيل حاليًا بكود Premium من مالك البوت.</p>'}</article></div></section>`,req.user));}catch(e){next(e);}});
  app.get('/owner',requireLogin,requireOwner,async(req,res,next)=>{try{const token=csrf(req),ids=await store.allGuildIds(),site=await store.getGlobalConfig(),codes=(await store.getCodes()).slice(-15).reverse();const rows=(await Promise.all(ids.slice(0,200).map(async id=>{const [g,cfg]=await Promise.all([getBotGuild(id).catch(()=>null),store.getConfig(id)]);return `<tr><td>${esc(g?.name||'Unknown')}<small>${id}</small></td><td>${Number(g?.approximate_member_count||0).toLocaleString()}</td><td>${store.isPremium(cfg)?'💎 Premium':'Free'}</td><td><form class="mini" method="post" action="/owner/premium"><input type="hidden" name="_csrf" value="${token}"><input type="hidden" name="guildId" value="${id}"><button name="days" value="30">+30d</button><button name="days" value="90">+90d</button><button name="days" value="365">+1y</button><button class="danger" name="days" value="0">Remove</button></form></td></tr>`;}))).join('');res.send(layout('Owner',`<section class="dash-head"><div><h1>👑 Owner Panel</h1><p>${ids.length} سيرفر مسجل</p></div></section><section class="panel"><h2>🌐 إعدادات الموقع</h2><form class="form-grid" method="post" action="/owner/site"><input type="hidden" name="_csrf" value="${token}"><label>سعر Premium<input name="premiumPrice" value="${esc(site.premiumPrice)}"></label><label>رابط الشراء<input name="purchaseUrl" value="${esc(site.purchaseUrl)}"></label><label class="wide">إعلان Dashboard<textarea name="announcement">${esc(site.announcement)}</textarea></label><button class="btn primary">حفظ</button></form></section><section class="panel"><h2>Premium Codes</h2><form class="inline-form" method="post" action="/owner/codes"><input type="hidden" name="_csrf" value="${token}"><input type="number" name="days" value="30" min="1" max="3650"><button class="btn">إنشاء كود</button></form><div class="codes">${codes.map(c=>`<div><code>${esc(c.code)}</code><span>${c.days} يوم • ${c.usedAt?'مستخدم':'متاح'}</span></div>`).join('')||'لا يوجد أكواد.'}</div></section><section class="panel table-wrap"><h2>السيرفرات</h2><table><thead><tr><th>السيرفر</th><th>الأعضاء</th><th>الخطة</th><th>تحكم</th></tr></thead><tbody>${rows}</tbody></table></section>`,req.user));}catch(e){next(e);}});
  app.post('/owner/premium',requireLogin,requireOwner,checkCsrf,async(req,res)=>{const days=Number(req.body.days||0);if(days>0)await store.setPremium(req.body.guildId,days);else await store.removePremium(req.body.guildId);res.redirect('/owner');});
  app.post('/owner/codes',requireLogin,requireOwner,checkCsrf,async(req,res)=>{await store.createCode(Number(req.body.days||30));res.redirect('/owner');});
  app.post('/owner/site',requireLogin,requireOwner,checkCsrf,async(req,res)=>{await store.saveGlobalConfig({premiumPrice:req.body.premiumPrice,purchaseUrl:req.body.purchaseUrl,announcement:req.body.announcement});res.redirect('/owner');});
  app.get('/health',async(_req,res)=>res.json({ok:true,database:await store.health(),uptime:process.uptime()}));
  app.use((err,req,res,next)=>{console.error(err);res.status(500).send(layout('Error',`<section class="login"><h1>❌ حدث خطأ</h1><p>${esc(err.message)}</p></section>`,req.user));});
  const port=Number(process.env.PORT||3000),host=process.env.HOST||'0.0.0.0';app.listen(port,host,()=>console.log(`🌐 ZOMBI Website: ${baseUrl()} (${host}:${port})`));
}
start().catch(e=>{console.error('❌ Website startup failed:',e);process.exit(1);});
