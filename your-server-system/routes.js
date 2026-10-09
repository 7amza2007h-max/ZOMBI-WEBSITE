'use strict';
const { templates, cloneTemplate } = require('./templates');
const PERMISSIONS = {
 CreateInstantInvite:1n<<0n, KickMembers:1n<<1n, BanMembers:1n<<2n, Administrator:1n<<3n,
 ManageChannels:1n<<4n, ManageGuild:1n<<5n, AddReactions:1n<<6n, ViewAuditLog:1n<<7n,
 PrioritySpeaker:1n<<8n, Stream:1n<<9n, ViewChannel:1n<<10n, SendMessages:1n<<11n,
 SendTTSMessages:1n<<12n, ManageMessages:1n<<13n, EmbedLinks:1n<<14n, AttachFiles:1n<<15n,
 ReadMessageHistory:1n<<16n, MentionEveryone:1n<<17n, UseExternalEmojis:1n<<18n, Connect:1n<<20n,
 Speak:1n<<21n, MuteMembers:1n<<22n, DeafenMembers:1n<<23n, MoveMembers:1n<<24n,
 UseVAD:1n<<25n, ChangeNickname:1n<<26n, ManageNicknames:1n<<27n, ManageRoles:1n<<28n,
 ManageWebhooks:1n<<29n, UseApplicationCommands:1n<<31n, RequestToSpeak:1n<<32n,
 ManageEvents:1n<<33n, ManageThreads:1n<<34n, CreatePublicThreads:1n<<35n,
 CreatePrivateThreads:1n<<36n, UseExternalStickers:1n<<37n, SendMessagesInThreads:1n<<38n,
 UseEmbeddedActivities:1n<<39n, ModerateMembers:1n<<40n, UseSoundboard:1n<<42n,
 CreateGuildExpressions:1n<<43n, CreateEvents:1n<<44n, UseExternalSounds:1n<<45n,
 SendVoiceMessages:1n<<46n, SetVoiceChannelStatus:1n<<48n, SendPolls:1n<<49n,
 UseExternalApps:1n<<50n, PinMessages:1n<<51n, BypassSlowmode:1n<<52n
};
const validId = v => /^\d{15,25}$/.test(String(v || ''));
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const permBits = arr => (arr || []).reduce((n, k) => n | (PERMISSIONS[k] || 0n), 0n).toString();
const wait = ms => new Promise(r => setTimeout(r, ms));
const activeRuns = new Set();

function mount(app, deps) {
 const {store, requireLogin, requireOwner, requireGuildAccess, checkCsrf, csrf, layout, botFetch, planNameForConfig, isOwner} = deps;
 const SETTINGS = 'your-server-settings.json';
 const HISTORY = 'your-server-history.json';
 const MANIFEST = 'your-server-manifest.json';
 async function getManifest(gid){ return store.data(gid, MANIFEST, {activeTemplateId:null, templates:{}}); }
 async function saveManifest(gid, data){ await store.saveData(gid, MANIFEST, data); }
 async function settings(){ return store.data('site', SETTINGS, {templates:{}}); }
 async function effectiveTemplate(id){
   const t=cloneTemplate(id); if(!t) return null;
   const s=await settings(), o=s.templates?.[id]||{};
   return {...t, plan:['free','premium','premium_plus'].includes(o.plan)?o.plan:t.plan, enabled:o.enabled!==false, visible:o.visible!==false};
 }
 async function addHistory(gid, entry){
   const data=await store.data(gid,HISTORY,{items:[]});
   data.items.unshift(entry); data.items=data.items.slice(0,50); await store.saveData(gid,HISTORY,data);
 }
 function page(title, body, user){ return layout(title, `<style>
 .ys-wrap{max-width:1200px;margin:20px auto;padding:0 16px;color:#e7edf8}.ys-hero,.ys-card,.ys-panel{background:#0c121d;border:1px solid #263247;border-radius:16px;padding:20px;margin-bottom:16px}.ys-hero{background:linear-gradient(120deg,#25121b,#111827 65%);border-color:#522338}.ys-hero h1{margin:0 0 8px}.ys-muted{color:#9eabc0}.ys-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:14px}.ys-card h3{margin:7px 0}.ys-icon{font-size:30px}.ys-badge{display:inline-block;border:1px solid #39465d;border-radius:30px;padding:4px 9px;font-size:12px;margin:3px}.ys-btn{border:1px solid #3c4b63;border-radius:9px;padding:9px 13px;color:#f5f7fb;background:#172235;cursor:pointer;text-decoration:none;display:inline-block}.ys-btn.primary{background:#a51e39;border-color:#c52b4b}.ys-btn:disabled{opacity:.5}.ys-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:12px}.ys-columns{display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:12px}.ys-list{padding-inline-start:22px}.ys-list li{margin:4px 0}.ys-danger{color:#fca5a5}.ys-success{color:#86efac}.ys-table{width:100%;border-collapse:collapse}.ys-table th,.ys-table td{padding:9px;border-bottom:1px solid #263247;text-align:right}.ys-table select{background:#111827;color:#eee;border:1px solid #475569;padding:7px;border-radius:7px}@media(max-width:600px){.ys-hero,.ys-card,.ys-panel{padding:14px}}
 </style>${body}`,user); }
 app.get('/your-server', requireLogin, async(req,res,next)=>{
  try {
   const manageable=(req.user?.guilds||[]).filter(g=>{try{const p=BigInt(String(g.permissions||'0'));return Boolean(g.owner)||(p&0x8n)!==0n||(p&0x20n)!==0n;}catch{return false;}}).slice(0,100);
   const cards=manageable.map(g=>`<article class="ys-card"><div class="ys-icon">${g.icon?`<img style="width:44px;height:44px;border-radius:50%" src="https://cdn.discordapp.com/icons/${esc(g.id)}/${esc(g.icon)}.png?size=96" alt="">`:'🛡️'}</div><h3>${esc(g.name)}</h3><p class="ys-muted">اختَر هذا السيرفر لعرض القوالب المتاحة وإنشاء الرتب والقنوات والفويسات.</p><div class="ys-actions"><a class="ys-btn primary" href="/dashboard/${esc(g.id)}/your-server">نظّم سيرفرك</a><a class="ys-btn" href="/dashboard/${esc(g.id)}">لوحة الإدارة</a></div></article>`).join('');
   res.send(page('نظّم سيرفرك',`<main class="ys-wrap"><section class="ys-hero"><h1>🧰 نظّم سيرفرك</h1><p class="ys-muted">اختَر سيرفر Discord الذي تريد تجهيزه. القوالب تتضمن رتبًا وقنوات كتابية وفويسات وأقسامًا للإدارة وVIP والتذاكر والفعاليات حسب القالب.</p><span class="ys-badge">اختر السيرفر أولًا</span></section><section class="ys-grid">${cards||'<section class="ys-panel">لم نعثر على سيرفرات لديك صلاحية إدارتها. سجّل الدخول بالحساب الصحيح وتأكد من صلاحيات Discord.</section>'}</section><p class="ys-muted">إذا لم يظهر السيرفر، تأكد أنك تملك Manage Server أو Administrator وأنك سجّلت الدخول إلى الموقع عبر Discord.</p></main>`,req.user));
  }catch(e){next(e);}
 });

 app.get('/dashboard/:guildId/your-server', requireLogin, requireGuildAccess, async(req,res,next)=>{
  try {
   const cfg=await store.getConfig(req.params.guildId), plan=planNameForConfig(cfg), s=await settings();
   const items=templates.filter(t=>(s.templates?.[t.id]?.visible!==false)&&(s.templates?.[t.id]?.enabled!==false)).map(t=>({...t,plan:['free','premium','premium_plus'].includes(s.templates?.[t.id]?.plan)?s.templates[t.id].plan:t.plan}));
   const history=await store.data(req.params.guildId,HISTORY,{items:[]});
   const cards=items.map(t=>`<article class="ys-card"><div class="ys-icon">${esc(t.icon)}</div><h3>${esc(t.name)}</h3><p class="ys-muted">${esc(t.description)}</p><span class="ys-badge">${esc(t.category)}</span><span class="ys-badge">${t.plan==='free'?'Free':t.plan==='premium'?'Premium':'Premium+'}</span><p>${t.features.map(x=>`<span class="ys-badge">${esc(x)}</span>`).join('')}</p><div class="ys-actions"><a class="ys-btn" href="/dashboard/${esc(req.params.guildId)}/your-server/${encodeURIComponent(t.id)}">معاينة القالب</a></div></article>`).join('');
   const rows=(history.items||[]).slice(0,15).map(x=>`<tr><td>${esc(x.templateName||x.templateId)}</td><td>${esc(x.status)}</td><td>${esc(x.createdAt?new Date(x.createdAt).toLocaleString('ar-JO'):'—')}</td><td>${esc(x.summary||'')}</td></tr>`).join('');
   res.send(page('نظام سيرفرك',`<main class="ys-wrap"><section class="ys-hero"><h1>🧰 نظام سيرفرك | Your Server System</h1><p class="ys-muted">جهّز هيكل سيرفر Discord بقوالب جاهزة. لا يتم حذف أي قناة أو رتبة موجودة.</p><span class="ys-badge">السيرفر: ${esc(req.bundle.guild.name)}</span><span class="ys-badge">خطتك الحالية: ${plan==='premium_plus'?'Premium+':plan==='premium'?'Premium':'Free'}</span></section><section class="ys-grid">${cards}</section><section class="ys-panel"><h2>سجل عمليات الإنشاء</h2><div style="overflow:auto"><table class="ys-table"><thead><tr><th>القالب</th><th>الحالة</th><th>التاريخ</th><th>النتيجة</th></tr></thead><tbody>${rows||'<tr><td colspan="4">لا توجد عمليات بعد.</td></tr>'}</tbody></table></div></section></main>`,req.user));
  } catch(e){next(e);}
 });
 app.get('/dashboard/:guildId/your-server/:templateId', requireLogin, requireGuildAccess, async(req,res,next)=>{
  try{
   const t=await effectiveTemplate(req.params.templateId); if(!t||!t.visible||!t.enabled)return res.status(404).send('القالب غير متاح.');
   const plan=planNameForConfig(await store.getConfig(req.params.guildId)); const rank={free:0,premium:1,premium_plus:2}; const canUse=(rank[plan]||0)>=(rank[t.plan]||0);
   const roleHtml=t.roles.map(r=>`<li><b style="color:${esc(r.color)}">${esc(r.name)}</b> — ${r.permissions.length?r.permissions.map(esc).join(', '):'صلاحيات عادية'}</li>`).join('');
   const catalogHtml=(t.roleCatalog||[]).map(g=>`<section class="ys-card"><h3>${esc(g.group)}</h3><ul class="ys-list">${g.roles.map(r=>`<li><b style="color:${esc(r.color)}">${esc(r.name)}</b> — ${r.permissions.length?r.permissions.map(esc).join(', '):'بدون صلاحيات إدارية'}</li>`).join('')}</ul></section>`).join('');
   const cats=t.categories.map(c=>`<section class="ys-card"><h3>${esc(c.name)}</h3><ul class="ys-list">${c.channels.map(ch=>`<li>${ch.type===2?'🔊':'#'} ${esc(ch.name)} ${ch.type===2?'(فويس)':'(كتابي)'}</li>`).join('')}</ul>${Object.keys(c.roleAccess||{}).length?`<p class="ys-muted">الوصول الخاص: ${Object.entries(c.roleAccess).map(([r,p])=>`${esc(r)}: ${p.map(esc).join(', ')}`).join(' • ')}</p>`:'<p class="ys-muted">قسم عام للأعضاء.</p>'}</section>`).join('');
   res.send(page(t.name,`<main class="ys-wrap"><section class="ys-hero"><a class="ys-btn" href="/dashboard/${esc(req.params.guildId)}/your-server">← جميع القوالب</a><h1>${esc(t.icon)} ${esc(t.name)}</h1><p class="ys-muted">${esc(t.description)}</p><span class="ys-badge">الخطة المطلوبة: ${t.plan==='free'?'Free':t.plan==='premium'?'Premium':'Premium+'}</span>${!canUse?'<p class="ys-danger">خطتك الحالية لا تسمح بتطبيق هذا القالب.</p>':''}<p class="ys-muted">عند تبديل القالب، سيحذف النظام العناصر التي أنشأها بنفسه للقالب السابق فقط. العناصر اليدوية لا تُحذف.</p><div class="ys-actions"><button class="ys-btn primary" ${canUse?'':'disabled'} onclick="document.getElementById('ys-confirm').showModal()">إنشاء سيرفري</button></div></section><section class="ys-panel"><h2>الرتب التي سينشئها القالب</h2><ul class="ys-list">${roleHtml}</ul><p class="ys-muted">مكتبة الرتب التالية خيارات مرجعية للتخصيص، ولا تُنشأ تلقائيًا كلها.</p></section><section class="ys-panel"><h2>مكتبة الرتب حسب المجال</h2><section class="ys-columns">${catalogHtml}</section></section><section class="ys-columns">${cats}</section><dialog id="ys-confirm" style="max-width:480px;background:#0c121d;color:#eee;border:1px solid #475569;border-radius:14px;padding:24px"><h2>تأكيد تطبيق القالب</h2><p>سيتم إنشاء العناصر الناقصة في ${esc(req.bundle.guild.name)}. إذا كان هناك قالب سابق مسجل، فستُحذف قنواته وتصنيفاته ورتبه التي أنشأها النظام فقط. قد تفقد الرتب القديمة تعييناتها على الأعضاء.</p><form method="post" action="/dashboard/${esc(req.params.guildId)}/your-server/${encodeURIComponent(t.id)}/apply"><input type="hidden" name="_csrf" value="${esc(csrf(req))}"><button class="ys-btn primary" type="submit">أؤكد الإنشاء</button><button class="ys-btn" type="button" onclick="document.getElementById('ys-confirm').close()">إلغاء</button></form></dialog></main>`,req.user));
  }catch(e){next(e);}
 });
 app.post('/dashboard/:guildId/your-server/:templateId/apply', requireLogin, requireGuildAccess, checkCsrf, async(req,res,next)=>{
  const gid=String(req.params.guildId), id=String(req.params.templateId); const runKey=gid; if(activeRuns.has(runKey))return res.status(409).send('هناك عملية إنشاء جارية لهذا القالب على هذا السيرفر.'); activeRuns.add(runKey); let entry={id:require('crypto').randomUUID(),templateId:id,status:'running',createdAt:Date.now(),created:[],reused:[],skipped:[],errors:[],manifest:{roles:[],channels:[]}};
  try{
   const t=await effectiveTemplate(id); if(!t||!t.enabled||!t.visible)throw new Error('القالب غير متاح.');
   const cfg=await store.getConfig(gid), plan=planNameForConfig(cfg), rank={free:0,premium:1,premium_plus:2};
   if((rank[plan]||0)<(rank[t.plan]||0))throw new Error(`هذا القالب يتطلب خطة ${t.plan==='premium_plus'?'Premium+':'Premium'} فعّالة.`);
   // requireGuildAccess verified OAuth Manage Server; verify current Discord permissions too.
   const ug=(req.user?.guilds||[]).find(g=>String(g.id)===gid); if(!ug||!(ug.owner||((BigInt(String(ug.permissions||'0'))&0x28n)!==0n)))throw new Error('لا تملك صلاحية إدارة هذا السيرفر.');
   const botUser=await botFetch('/users/@me');
   if(!validId(botUser?.id))throw new Error('تعذر تحديد هوية البوت من Discord.');
   const botMember=await botFetch(`/guilds/${gid}/members/${botUser.id}`);
   const botRoles=await botFetch(`/guilds/${gid}/roles`);
   const botRoleIds=new Set((botMember.roles||[]).map(String));
   const topBotRole=(botRoles||[]).filter(r=>botRoleIds.has(String(r.id))).sort((a,b)=>b.position-a.position)[0];
   if(!topBotRole)throw new Error('تعذر تحديد رتبة البوت في السيرفر.');
   const everyoneRole=(botRoles||[]).find(r=>String(r.id)===gid);
   const botPerms=(botRoles||[]).filter(r=>String(r.id)===gid||botRoleIds.has(String(r.id))).reduce((bits,r)=>bits|BigInt(String(r.permissions||'0')),0n);
   const hasAdmin=(botPerms&(1n<<3n))!==0n;
   const has=(key)=>hasAdmin||(botPerms&(PERMISSIONS[key]||0n))!==0n;
   if(!has('ManageChannels')||!has('ManageRoles'))throw new Error('يحتاج البوت إلى Manage Channels وManage Roles لإنشاء القالب.');
   // Remove the previously managed template BEFORE creating the new one. This avoids
   // accidentally reusing same-named channels from the old template and then deleting them.
   const manifest=await getManifest(gid);
   const previous=manifest.templates?.[manifest.activeTemplateId];
   if(previous && manifest.activeTemplateId!==id){
    const liveChannels=await botFetch(`/guilds/${gid}/channels`);
    const liveRoles=await botFetch(`/guilds/${gid}/roles`);
    const channelIds=new Set((liveChannels||[]).map(x=>String(x.id)));
    const roleIdsLive=new Set((liveRoles||[]).map(x=>String(x.id)));
    // Channels/categories first, then roles. Delete by recorded ID only, never by name.
    for(const old of [...(previous.channels||[])].reverse()){
     if(!validId(old.id)||!channelIds.has(String(old.id)))continue;
     try{await botFetch(`/channels/${old.id}`,{method:'DELETE'});entry.deleted=(entry.deleted||[]).concat(`قناة/تصنيف قديم: ${old.name}`);await wait(180);}
     catch(e){entry.errors.push(`تعذر حذف العنصر القديم ${old.name}: ${e.message}`);}
    }
    for(const old of [...(previous.roles||[])].reverse()){
     if(!validId(old.id)||!roleIdsLive.has(String(old.id)))continue;
     try{await botFetch(`/guilds/${gid}/roles/${old.id}`,{method:'DELETE'});entry.deleted=(entry.deleted||[]).concat(`رتبة قديمة: ${old.name}`);await wait(180);}
     catch(e){entry.errors.push(`تعذر حذف الرتبة القديمة ${old.name}: ${e.message}`);}
    }
    if(entry.errors.length)throw new Error('لم يكتمل حذف القالب السابق؛ أوقفنا التبديل لتجنب إنشاء قالب فوق إعدادات غير مكتملة. راجع الأخطاء في سجل العملية.');
   }
   const [existingRoles,existingChannels]=await Promise.all([botFetch(`/guilds/${gid}/roles`),botFetch(`/guilds/${gid}/channels`)]);
   const roleMap=new Map((existingRoles||[]).map(r=>[r.name,r]));
   const roleIds={};
   // Create/reuse roles. Existing roles are never modified. Role hierarchy is respected.
   for(const r of t.roles){
    const old=roleMap.get(r.name); if(old){roleIds[r.name]=old.id;entry.reused.push(`رتبة: ${r.name}`);continue;}
    try{
     const body={name:r.name,color:parseInt(String(r.color||'#99aab5').replace('#',''),16)||0,permissions:permBits(r.permissions),mentionable:false,hoist:['Owner','Co Owner','Management','Admin','Moderator','Manager','Teacher','Organizer'].includes(r.name)};
     const made=await botFetch(`/guilds/${gid}/roles`,{method:'POST',body:JSON.stringify(body)}); roleIds[r.name]=made.id;roleMap.set(r.name,made);entry.created.push(`رتبة: ${r.name}`);entry.manifest.roles.push({id:String(made.id),name:r.name});await wait(180);
    }catch(e){entry.errors.push(`تعذر إنشاء الرتبة ${r.name}: ${e.message}`);}
   }
   // Place only newly-created template roles below the bot's highest role, preserving all existing roles.
   const allAfter=await botFetch(`/guilds/${gid}/roles`).catch(()=>existingRoles||[]);
   const positionChanges=[];
   for(let i=0;i<t.roles.length;i++){
    const r=t.roles[i],rid=roleIds[r.name],actual=(allAfter||[]).find(x=>String(x.id)===String(rid));
    if(!actual||entry.reused.includes(`رتبة: ${r.name}`)||actual.position>=Number(topBotRole.position||0))continue;
    const target=Math.max(1,Number(topBotRole.position||1)-i-1);
    positionChanges.push({id:String(rid),position:target});
   }
   if(positionChanges.length){try{await botFetch(`/guilds/${gid}/roles`,{method:'PATCH',body:JSON.stringify(positionChanges)});}catch(e){entry.errors.push(`تعذر ترتيب الرتب الجديدة: ${e.message}`);}}
   const everyoneId=gid;
   const makeOverwrites=(c)=>{
    const allowed=new Map(), denied=new Map();
    const allow=(id,keys)=>allowed.set(String(id),(allowed.get(String(id))||0n)|keys.reduce((n,k)=>n|(PERMISSIONS[k]||0n),0n));
    const deny=(id,keys)=>denied.set(String(id),(denied.get(String(id))||0n)|keys.reduce((n,k)=>n|(PERMISSIONS[k]||0n),0n));
    const privateSection=Object.keys(c.roleAccess||{}).length>0;
    if(privateSection){deny(everyoneId,['ViewChannel']);for(const [roleName,perms] of Object.entries(c.roleAccess)){const rid=roleIds[roleName]||roleMap.get(roleName)?.id;if(rid){const channelPerms=c.type===4?perms:(c.type===2?['ViewChannel','Connect','Speak'] : ['ViewChannel','ReadMessageHistory','SendMessages']);allow(rid,[...new Set([...perms,...channelPerms])]);}}}
    else allow(everyoneId,['ViewChannel','ReadMessageHistory',...(c.type===2?['Connect']:['SendMessages','AddReactions','AttachFiles','EmbedLinks'])]);
    for(const [id,bits] of denied){const a=allowed.get(id)||0n;allowed.set(id,a&~bits);}
    return [...new Set([...allowed.keys(),...denied.keys()])].map(id=>({id,type:id===everyoneId?0:0,allow:(allowed.get(id)||0n).toString(),deny:(denied.get(id)||0n).toString()}));
   };
   const channelsNow=await botFetch(`/guilds/${gid}/channels`); const channelMap=new Map((channelsNow||[]).map(c=>[`${c.type}:${c.name}:${c.parent_id||''}`,c]));
   for(const category of t.categories){
    let categoryId=''; const existingCat=(channelsNow||[]).find(c=>c.type===4&&c.name===category.name);
    if(existingCat){categoryId=existingCat.id;entry.reused.push(`تصنيف: ${category.name}`);}else{
     try{const pseudo={type:4,roleAccess:category.roleAccess||{}};const made=await botFetch(`/guilds/${gid}/channels`,{method:'POST',body:JSON.stringify({name:category.name,type:4,permission_overwrites:makeOverwrites(pseudo)})});categoryId=made.id;entry.created.push(`تصنيف: ${category.name}`);entry.manifest.channels.push({id:String(made.id),name:category.name,type:4});await wait(180);}catch(e){entry.errors.push(`تعذر إنشاء التصنيف ${category.name}: ${e.message}`);continue;}
    }
    for(const ch of category.channels){
     const found=(channelsNow||[]).find(c=>c.type===ch.type&&c.name===ch.name&&String(c.parent_id||'')===String(categoryId));
     if(found){entry.reused.push(`قناة: ${category.name}/${ch.name}`);continue;}
     try{
      const privateSection=Object.keys(category.roleAccess||{}).length>0;
      const access={...category, type:ch.type, roleAccess:category.roleAccess||{}};
      const overrides=makeOverwrites(access);
      // For a public section, the category-level defaults apply. Per-channel deny/allow rules are supported too.
      if(ch.deny?.length){const ow=overrides.find(x=>x.id===everyoneId)||{id:everyoneId,type:0,allow:'0',deny:'0'};ow.deny=(BigInt(ow.deny)|ch.deny.reduce((n,k)=>n|(PERMISSIONS[k]||0n),0n)).toString();if(!overrides.includes(ow))overrides.push(ow);}
      if(ch.allow?.length){const ow=overrides.find(x=>x.id===everyoneId)||{id:everyoneId,type:0,allow:'0',deny:'0'};ow.allow=(BigInt(ow.allow)|ch.allow.reduce((n,k)=>n|(PERMISSIONS[k]||0n),0n)).toString();if(!overrides.includes(ow))overrides.push(ow);}
      const body={name:ch.name,type:ch.type,parent_id:categoryId,permission_overwrites:overrides};
      const madeChannel=await botFetch(`/guilds/${gid}/channels`,{method:'POST',body:JSON.stringify(body)});entry.created.push(`قناة: ${category.name}/${ch.name}`);entry.manifest.channels.push({id:String(madeChannel.id),name:ch.name,type:ch.type});await wait(180);
     }catch(e){entry.errors.push(`تعذر إنشاء القناة ${category.name}/${ch.name}: ${e.message}`);}
    }
   }
   // Persist only resources created by this system. Reused/manual resources are never owned or deleted.
   if(!entry.errors.length){
    manifest.templates=manifest.templates||{};
    if(manifest.activeTemplateId===id && manifest.templates[id]){
     const prior=manifest.templates[id];
     entry.manifest.roles=[...(prior.roles||[]),...entry.manifest.roles].filter((x,i,a)=>a.findIndex(y=>y.id===x.id)===i);
     entry.manifest.channels=[...(prior.channels||[]),...entry.manifest.channels].filter((x,i,a)=>a.findIndex(y=>y.id===x.id)===i);
    }
    manifest.templates[id]=entry.manifest;
    manifest.activeTemplateId=id;
    await saveManifest(gid,manifest);
   }
   entry.status=entry.errors.length?'partial':'success';entry.summary=`تم إنشاء ${entry.created.length} عنصر، وإعادة استخدام ${entry.reused.length}، وحذف ${entry.deleted?.length||0} من عناصر القالب السابق، وأخفق ${entry.errors.length}.`;
   await addHistory(gid,entry); activeRuns.delete(runKey);
   res.send(page('نتيجة إنشاء القالب',`<main class="ys-wrap"><section class="ys-hero"><h1>${entry.status==='success'?'✅':'⚠️'} نتيجة إنشاء ${esc(t.name)}</h1><p>${esc(entry.summary)}</p><p class="ys-muted">تم حذف العناصر المسجلة بمعرّفاتها فقط؛ العناصر اليدوية غير المسجلة تُترك كما هي.</p><a class="ys-btn primary" href="/dashboard/${esc(gid)}/your-server">العودة للقوالب</a></section><section class="ys-panel"><h2>تم إنشاؤه (${entry.created.length})</h2><ul class="ys-list">${entry.created.map(x=>`<li>${esc(x)}</li>`).join('')||'<li>لا يوجد</li>'}</ul><h2>تمت إعادة استخدامه (${entry.reused.length})</h2><ul class="ys-list">${entry.reused.map(x=>`<li>${esc(x)}</li>`).join('')||'<li>لا يوجد</li>'}</ul><h2>تم حذفها (${entry.deleted?.length||0})</h2><ul class="ys-list">${(entry.deleted||[]).map(x=>`<li>${esc(x)}</li>`).join('')||'<li>لا يوجد</li>'}</ul><h2 class="ys-danger">الأخطاء (${entry.errors.length})</h2><ul class="ys-list">${entry.errors.map(x=>`<li>${esc(x)}</li>`).join('')||'<li>لا يوجد</li>'}</ul></section></main>`,req.user));
  }catch(e){entry.status='failed';entry.summary=e.message;entry.errors.push(e.message);await addHistory(gid,entry).catch(()=>{});activeRuns.delete(runKey);res.status(400).send(page('تعذر إنشاء القالب',`<main class="ys-wrap"><section class="ys-hero"><h1>❌ تعذر إنشاء القالب</h1><p>${esc(e.message)}</p><a class="ys-btn" href="/dashboard/${esc(gid)}/your-server">رجوع</a></section></main>`,req.user));}
 });
 // Owner-only template plan and visibility control, stored using existing guild-data storage.
 app.get('/owner/your-server', requireLogin, requireOwner, async(req,res,next)=>{
  try{const s=await settings();const rows=templates.map(t=>{const o=s.templates?.[t.id]||{};const p=o.plan||t.plan;const fid=`ys-form-${t.id}`;return `<tr><td>${esc(t.icon)} ${esc(t.name)}</td><td><select form="${fid}" name="plan"><option value="free" ${p==='free'?'selected':''}>Free</option><option value="premium" ${p==='premium'?'selected':''}>Premium</option><option value="premium_plus" ${p==='premium_plus'?'selected':''}>Premium+</option></select></td><td><label><input form="${fid}" type="checkbox" name="enabled" value="1" ${o.enabled===false?'':'checked'}> مفعّل</label></td><td><label><input form="${fid}" type="checkbox" name="visible" value="1" ${o.visible===false?'':'checked'}> ظاهر</label></td><td><form id="${fid}" method="post" action="/owner/your-server/settings"><input type="hidden" name="_csrf" value="${esc(csrf(req))}"><input type="hidden" name="templateId" value="${esc(t.id)}"><button class="ys-btn primary" type="submit">حفظ</button></form></td></tr>`}).join('');
   res.send(page('إدارة قوالب نظام سيرفرك',`<main class="ys-wrap"><section class="ys-hero"><h1>⚙️ إدارة قوالب نظام سيرفرك</h1><p class="ys-muted">هذه الصفحة متاحة لمالك البوت فقط. الخطط تُتحقق في الواجهة الخلفية عند التطبيق.</p></section><section class="ys-panel"><div style="overflow:auto"><table class="ys-table"><thead><tr><th>القالب</th><th>الخطة</th><th>التفعيل</th><th>الظهور</th><th>حفظ</th></tr></thead><tbody>${rows}</tbody></table></div></section></main>`,req.user));
  }catch(e){next(e);}
 });
 app.post('/owner/your-server/settings', requireLogin, requireOwner, checkCsrf, async(req,res,next)=>{
  try{const id=String(req.body.templateId||''),plan=String(req.body.plan||'');if(!templates.some(t=>t.id===id)||!['free','premium','premium_plus'].includes(plan))return res.status(400).send('بيانات القالب غير صالحة.');const s=await settings();s.templates=s.templates||{};s.templates[id]={plan,enabled:req.body.enabled==='1',visible:req.body.visible==='1'};await store.saveData('site',SETTINGS,s);res.redirect('/owner/your-server');}catch(e){next(e);}
 });
}
module.exports = { mount };
