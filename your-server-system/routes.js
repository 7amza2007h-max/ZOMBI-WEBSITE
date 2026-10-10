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
function defaultCategoryOrder(category,index){const n=String(category?._baseName||category?.name||'').toLowerCase();if(/owner/.test(n))return 0;if(/الإدارة العليا|management/.test(n))return 1;if(/المشرف|supervisor/.test(n))return 2;if(/الإدارة التنفيذية|admin/.test(n))return 3;if(/فعاليات|event/.test(n))return 4;if(/الدعم|support|ticket/.test(n))return 5;if(/اللوقات|سجلات|logs/.test(n))return 6;if(/temporary rooms|الرومات المؤقتة/.test(n))return 7;return 100+index;}

function mount(app, deps) {
 const {store, requireLogin, requireOwner, requireGuildAccess, checkCsrf, csrf, layout, botFetch, planNameForConfig, isOwner} = deps;
 const SETTINGS = 'your-server-settings.json';
 const HISTORY = 'your-server-history.json';
 const MANIFEST = 'your-server-managed.json';
 const CUSTOM = 'your-server-template-customization.json';
 async function getManifest(gid){ return store.data(gid, MANIFEST, {templateId:null, templateName:null, roles:[], channels:[]}); }
 async function saveManifest(gid, data){ return store.saveData(gid, MANIFEST, data); }
 async function deletePreviousManaged(gid, manifest, entry){
   // Only delete IDs recorded in this system's manifest. Delete child channels before categories,
   // then roles. Never delete by name or touch user-created resources.
   const channels=(manifest.channels||[]).map(x=>({...x,id:String(x.id)}));
   const orderedChannels=[...channels.filter(x=>Number(x.type)!==4).reverse(),...channels.filter(x=>Number(x.type)===4).reverse()];
   for(const item of orderedChannels){
     try{ await botFetch(`/channels/${item.id}`,{method:'DELETE'}); entry.deleted.push(`${Number(item.type)===4?'تصنيف':'قناة'}: ${item.name||item.id}`); await wait(160); }
     catch(e){ if(!/404|Unknown Channel/i.test(String(e.message))) throw new Error(`تعذر حذف عنصر القالب السابق (${item.id}): ${e.message}`); }
   }
   for(const item of [...(manifest.roles||[])].reverse()){
     try{ await botFetch(`/guilds/${gid}/roles/${item.id}`,{method:'DELETE'}); entry.deleted.push(`رتبة: ${item.name||item.id}`); await wait(160); }
     catch(e){ if(!/404|Unknown Role/i.test(String(e.message))) throw new Error(`تعذر حذف رتبة القالب السابق (${item.id}): ${e.message}`); }
   }
 }
 async function settings(){ return store.data('site', SETTINGS, {templates:{}}); }
 async function effectiveTemplate(id, gid=null){
   const t=cloneTemplate(id); if(!t) return null;
   const sd=await settings(), o=sd.templates?.[id]||{};
   if(gid){
     const saved=await store.data(String(gid),CUSTOM,{templates:{}}), custom=saved.templates?.[id];
     if(custom){
       t.tempSettings=custom.tempSettings||{defaultLimit:0,roomPrefix:'غرفة'};
       // Role customization is keyed by the original template role name so changing order
       // never breaks the saved mapping between roles and channel permissions.
       const roleRename=new Map();
       for(let ri=0;ri<t.roles.length;ri++){
         const r=t.roles[ri], rc=custom.roles?.[r.name]||{}; r._baseName=r.name;
         const nextName=typeof rc.name==='string'&&rc.name.trim()?rc.name.trim().slice(0,100):r.name;
         roleRename.set(r.name,nextName); r.name=nextName;
         if(typeof rc.color==='string'&&/^#[0-9a-fA-F]{6}$/.test(rc.color))r.color=rc.color;
         r._order=Number.isFinite(Number(rc.order))?Math.max(0,Math.min(999,Number(rc.order))):ri;
       }
       const remapAccess=access=>access&&Object.fromEntries(Object.entries(access).map(([name,perms])=>[roleRename.get(name)||name,perms]));
       for(let ci=0;ci<t.categories.length;ci++){
         const cat=t.categories[ci],cc=custom.categories?.[ci]||{}; cat._baseIndex=ci; cat._baseName=cat.name;
         cat._order=Number.isFinite(Number(cc.order))?Math.max(0,Math.min(999,Number(cc.order))):defaultCategoryOrder(cat,ci);
         if(typeof cc.name==='string'&&cc.name.trim())cat.name=cc.name.trim().slice(0,90);
         if(cc.enabled===false&&!/owner/i.test(String(cat._baseName||cat.name)))cat._disabled=true;
         cat.roleAccess=remapAccess(cat.roleAccess);
         for(let hi=0;hi<cat.channels.length;hi++){
           const ch=cat.channels[hi],hc=cc.channels?.[hi]||{}; ch._baseIndex=hi; ch._baseName=ch.name;
           if(hc.enabled===false&&!(/owner/i.test(String(cat._baseName||cat.name))||/^owner-|^owner voice$/i.test(String(ch._baseName||ch.name))))ch._disabled=true;
           if(typeof hc.name==='string'&&hc.name.trim()&&(!String(ch._baseName||'').startsWith('➕・Create Room')||hc.name.includes('Create Room')))ch.name=hc.name.trim().slice(0,100);
           ch.roleAccess=remapAccess(ch.roleAccess);
           if(Array.isArray(ch.writeRoles))ch.writeRoles=ch.writeRoles.map(n=>roleRename.get(n)||n);
           if(typeof hc.accessRoles==='string'){
             const raw=hc.accessRoles.trim();
             if(raw.toUpperCase()==='PUBLIC'){const protectedChannel=/owner/i.test(String(cat._baseName||cat.name))||/^owner-|^logs-|^ticket-logs$|^ticket-transcripts$/i.test(String(ch._baseName||ch.name));if(protectedChannel){ch.roleAccess=remapAccess(ch.roleAccess||cat.roleAccess||{});ch.public=false;}else{ch.roleAccess={};ch.public=true;}delete ch.customRolePermissions;}
             else if(raw){
               const safe=new Set(['ViewChannel','ReadMessageHistory','SendMessages','AddReactions','AttachFiles','EmbedLinks','Connect','Speak','ManageMessages','MoveMembers','MuteMembers','UseVAD']);
               if(raw.includes('=')){ch.roleAccess=Object.fromEntries(raw.split(';').map(x=>x.trim()).filter(Boolean).map(part=>{const ix=part.indexOf('=');const rawRoleName=part.slice(0,ix).trim();const roleName=roleRename.get(rawRoleName)||rawRoleName;const perms=part.slice(ix+1).split('+').map(x=>x.trim()).filter(x=>safe.has(x));return [roleName,perms];}).filter(([n,perms])=>n&&perms.length));ch.customRolePermissions=true;}
               else{ch.roleAccess=Object.fromEntries(raw.split(',').map(x=>x.trim()).filter(Boolean).map(n=>[roleRename.get(n)||n,['ViewChannel']]));delete ch.customRolePermissions;}
               ch.public=false;
             }else{delete ch.roleAccess;delete ch.customRolePermissions;ch.public=false;}
           }
         }
       }
     } else { t.tempSettings={defaultLimit:0,roomPrefix:'غرفة'}; t.categories.forEach((c,i)=>{c._baseIndex=i;c._baseName=c.name;c._order=defaultCategoryOrder(c,i);c.channels.forEach((ch,hi)=>{ch._baseIndex=hi;ch._baseName=ch.name;});}); t.roles.forEach((r,i)=>{r._baseName=r.name;r._order=i;}); }
   } else { t.tempSettings={defaultLimit:0,roomPrefix:'غرفة'}; t.categories.forEach((c,i)=>{c._baseIndex=i;c._baseName=c.name;c._order=defaultCategoryOrder(c,i);c.channels.forEach((ch,hi)=>{ch._baseIndex=hi;ch._baseName=ch.name;});}); t.roles.forEach((r,i)=>{r._baseName=r.name;r._order=i;}); }
   return {...t,plan:['free','premium','premium_plus'].includes(o.plan)?o.plan:t.plan,enabled:o.enabled!==false,visible:o.visible!==false};
 }
 async function addHistory(gid, entry){
   const data=await store.data(gid,HISTORY,{items:[]});
   data.items.unshift(entry); data.items=data.items.slice(0,50); await store.saveData(gid,HISTORY,data);
 }
 function page(title, body, user){ return layout(title, `<style>
 .ys-wrap{max-width:1200px;margin:20px auto;padding:0 16px;color:#e7edf8}.ys-hero,.ys-card,.ys-panel{background:#0c121d;border:1px solid #263247;border-radius:16px;padding:20px;margin-bottom:16px}.ys-hero{background:linear-gradient(120deg,#25121b,#111827 65%);border-color:#522338}.ys-hero h1{margin:0 0 8px}.ys-muted{color:#9eabc0}.ys-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:14px}.ys-card h3{margin:7px 0}.ys-icon{font-size:30px}.ys-badge{display:inline-block;border:1px solid #39465d;border-radius:30px;padding:4px 9px;font-size:12px;margin:3px}.ys-btn{border:1px solid #3c4b63;border-radius:9px;padding:9px 13px;color:#f5f7fb;background:#172235;cursor:pointer;text-decoration:none;display:inline-block}.ys-btn.primary{background:#a51e39;border-color:#c52b4b}.ys-btn:disabled{opacity:.5}.ys-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:12px}.ys-columns{display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:12px}.ys-list{padding-inline-start:22px}.ys-list li{margin:4px 0}.ys-danger{color:#fca5a5}.ys-success{color:#86efac}.ys-table{width:100%;border-collapse:collapse}.ys-table th,.ys-table td{padding:9px;border-bottom:1px solid #263247;text-align:right}.ys-table select{background:#111827;color:#eee;border:1px solid #475569;padding:7px;border-radius:7px}@media(max-width:600px){.ys-hero,.ys-card,.ys-panel{padding:14px}}
 </style>${body}`,user); }
 app.get('/dashboard/:guildId/your-server', requireLogin, requireGuildAccess, async(req,res,next)=>{
  try {
   const cfg=await store.getConfig(req.params.guildId), plan=planNameForConfig(cfg), s=await settings();
   const items=templates.filter(t=>(s.templates?.[t.id]?.visible!==false)&&(s.templates?.[t.id]?.enabled!==false)).map(t=>({...t,plan:['free','premium','premium_plus'].includes(s.templates?.[t.id]?.plan)?s.templates[t.id].plan:t.plan}));
   const history=await store.data(req.params.guildId,HISTORY,{items:[]});
   const cards=items.map(t=>`<article class="ys-card"><div class="ys-icon">${esc(t.icon)}</div><h3>${esc(t.name)}</h3><p class="ys-muted">${esc(t.description)}</p><span class="ys-badge">${esc(t.category)}</span><span class="ys-badge">${t.plan==='free'?'Free':t.plan==='premium'?'Premium':'Premium+'}</span><p>${t.features.map(x=>`<span class="ys-badge">${esc(x)}</span>`).join('')}</p><div class="ys-actions"><a class="ys-btn" href="/dashboard/${esc(req.params.guildId)}/your-server/${encodeURIComponent(t.id)}">معاينة القالب</a></div></article>`).join('');
   const rows=(history.items||[]).slice(0,15).map(x=>`<tr><td>${esc(x.templateName||x.templateId)}</td><td>${esc(x.status)}</td><td>${esc(x.createdAt?new Date(x.createdAt).toLocaleString('ar-JO'):'—')}</td><td>${esc(x.summary||'')}</td></tr>`).join('');
   res.send(page('نظام سيرفرك',`<main class="ys-wrap"><section class="ys-hero"><h1>🧰 نظام سيرفرك | Your Server System</h1><p class="ys-muted">جهّز هيكل سيرفر Discord بقوالب جاهزة، مع تأكيد صريح قبل استبدال العناصر التي يديرها قالب سابق.</p><span class="ys-badge">السيرفر: ${esc(req.bundle.guild.name)}</span><span class="ys-badge">خطتك الحالية: ${plan==='premium_plus'?'Premium+':plan==='premium'?'Premium':'Free'}</span></section><section class="ys-grid">${cards}</section><section class="ys-panel"><h2>سجل عمليات الإنشاء</h2><div style="overflow:auto"><table class="ys-table"><thead><tr><th>القالب</th><th>الحالة</th><th>التاريخ</th><th>النتيجة</th></tr></thead><tbody>${rows||'<tr><td colspan="4">لا توجد عمليات بعد.</td></tr>'}</tbody></table></div></section></main>`,req.user));
  } catch(e){next(e);}
 });
 app.get('/dashboard/:guildId/your-server/:templateId', requireLogin, requireGuildAccess, async(req,res,next)=>{
  try{
   const t=await effectiveTemplate(req.params.templateId,req.params.guildId); if(!t||!t.visible||!t.enabled)return res.status(404).send('القالب غير متاح.');
   const plan=planNameForConfig(await store.getConfig(req.params.guildId)); const rank={free:0,premium:1,premium_plus:2}; const canUse=(rank[plan]||0)>=(rank[t.plan]||0);
   const roleHtml=[...t.roles].sort((a,b)=>(a._order??0)-(b._order??0)).map(r=>`<li><b style="color:${esc(r.color)}">${esc(r.name)}</b> — ${r.permissions.length?r.permissions.map(esc).join(', '):'صلاحيات عادية'}</li>`).join('');
   const cats=[...t.categories].sort((a,b)=>(a._order??a._baseIndex??0)-(b._order??b._baseIndex??0)).filter(c=>!c._disabled).map(c=>`<section class="ys-card"><h3>${esc(c.name)}</h3><ul class="ys-list">${c.channels.filter(ch=>!ch._disabled).map(ch=>{const access=ch.roleAccess===null?{}:(ch.roleAccess||c.roleAccess||{});const roles=ch.publicReadOnly?(ch.writeRoles||[]):Object.keys(access);const perms=ch.type===2?'ViewChannel, Connect, Speak':'ViewChannel, ReadMessageHistory, SendMessages';return `<li>${ch.type===2?'🔊':'#'} <b>${esc(ch.name)}</b> ${ch.type===2?'(فويس)':'(كتابي)'}<div class="ys-muted">${ch.publicReadOnly?`المشاهدة: الجميع · الكتابة: ${roles.length?roles.map(esc).join('، '):'لا توجد رتبة محددة'}`:(roles.length?`الرتب: ${roles.map(esc).join('، ')}`:'عام حسب صلاحيات القسم')} · الصلاحيات الأساسية: ${perms}${ch.deny?.length?` · ممنوع: ${ch.deny.map(esc).join('، ')}`:''}</div></li>`}).join('')}</ul>${Object.keys(c.roleAccess||{}).length?`<p class="ys-muted">الوصول الافتراضي للقسم: ${Object.entries(c.roleAccess).map(([r,p])=>`${esc(r)}: ${p.map(esc).join(', ')}`).join(' • ')}</p>`:'<p class="ys-muted">قسم عام ما لم تحدد القناة صلاحيات مستقلة.</p>'}</section>`).join('');
   res.send(page(t.name,`<main class="ys-wrap"><section class="ys-hero"><a class="ys-btn" href="/dashboard/${esc(req.params.guildId)}/your-server">← جميع القوالب</a><h1>${esc(t.icon)} ${esc(t.name)}</h1><p class="ys-muted">${esc(t.description)}</p><span class="ys-badge">الخطة المطلوبة: ${t.plan==='free'?'Free':t.plan==='premium'?'Premium':'Premium+'}</span>${!canUse?'<p class="ys-danger">خطتك الحالية لا تسمح بتطبيق هذا القالب.</p>':''}<p class="ys-muted">المعاينة لا تعدّل أي شيء. سيُعاد استخدام العناصر المطابقة، ولن تُحذف القنوات أو الرتب الموجودة. عند إعادة تطبيق قالب سابق، قد يُصلح النظام صلاحية مالك السيرفر فقط في القنوات الخاصة التي أنشأها هذا النظام.</p><div class="ys-actions"><a class="ys-btn" href="/dashboard/${esc(req.params.guildId)}/your-server/${encodeURIComponent(t.id)}/configure">⚙️ تخصيص الأقسام والقنوات والصلاحيات</a><button class="ys-btn primary" ${canUse?'':'disabled'} onclick="document.getElementById('ys-confirm').showModal()">إنشاء سيرفري</button></div></section><section class="ys-panel"><h2>الرتب</h2><ul class="ys-list">${roleHtml}</ul></section><section class="ys-columns">${cats}</section><dialog id="ys-confirm" style="max-width:480px;background:#0c121d;color:#eee;border:1px solid #475569;border-radius:14px;padding:24px"><h2>تأكيد إنشاء الهيكل</h2><p>ستظهر مراجعة منفصلة قبل التطبيق. عند الاستبدال، لا تُحذف إلا العناصر المسجلة بمعرّفاتها ضمن القالب السابق، وتُحدّث صلاحيات القنوات المطابقة بعد التأكيد.</p><form method="post" action="/dashboard/${esc(req.params.guildId)}/your-server/${encodeURIComponent(t.id)}/apply"><input type="hidden" name="_csrf" value="${esc(csrf(req))}"><button class="ys-btn primary" type="submit">أؤكد الإنشاء</button><button class="ys-btn" type="button" onclick="document.getElementById('ys-confirm').close()">إلغاء</button></form></dialog></main>`,req.user));
  }catch(e){next(e);}
 });
 app.get('/dashboard/:guildId/your-server/:templateId/configure', requireLogin, requireGuildAccess, async(req,res,next)=>{
  try{
   const gid=String(req.params.guildId),id=String(req.params.templateId),t=await effectiveTemplate(id,gid);if(!t||!t.enabled||!t.visible)return res.status(404).send('القالب غير متاح.');
   const saved=await store.data(gid,CUSTOM,{templates:{}}),cfg=saved.templates?.[id]||{};
   const roleRows=[...t.roles].sort((a,b)=>(a._order??0)-(b._order??0)).map((r,ri)=>{const base=r._baseName||r.name,rc=cfg.roles?.[base]||{};return `<tr><td><b style="color:${esc(r.color)}">${esc(base)}</b></td><td><input name="roleName[${esc(base)}]" value="${esc(rc.name||r.name)}" maxlength="100" style="width:100%;padding:7px;background:#111827;color:#eee;border:1px solid #475569;border-radius:7px"></td><td><input type="color" name="roleColor[${esc(base)}]" value="${esc(rc.color||r.color||'#99aab5')}"></td><td><input type="number" min="0" max="999" name="roleOrder[${esc(base)}]" value="${esc(rc.order??r._order??ri)}" style="width:75px;padding:7px;background:#111827;color:#eee;border:1px solid #475569;border-radius:7px"></td><td>${r.permissions.length?r.permissions.map(esc).join(', '):'صلاحيات عادية'}</td></tr>`;}).join('');
   const sections=[...t.categories].sort((a,b)=>(a._order??0)-(b._order??0)).map((c,ci)=>{const bi=c._baseIndex??ci,cc=cfg.categories?.[bi]||{};const channels=c.channels.map((ch,hi)=>{const hc=cc.channels?.[hi]||{},access=hc.accessRoles!==undefined?hc.accessRoles:(ch.publicReadOnly?`PUBLIC`:ch.roleAccess===null?'PUBLIC':Object.keys(ch.roleAccess||c.roleAccess||{}).join(', ')),protectedOwnerChannel=/owner/i.test(String(c._baseName||c.name))||/^owner-|^owner voice$/i.test(String(ch._baseName||ch.name));return `<li><label><input type="checkbox" name="channelEnabled[${bi}][${hi}]" value="1" ${protectedOwnerChannel||hc.enabled!==false?'checked':''} ${protectedOwnerChannel?'disabled':''}> <b>${ch.type===2?'🔊':'#'} ${esc(ch.name)}</b>${protectedOwnerChannel?' (أساسي)':''}</label>${protectedOwnerChannel?`<input type="hidden" name="channelEnabled[${bi}][${hi}]" value="1">`:''}<div class="ys-muted">${ch.type===2?'قناة صوتية':'قناة كتابية'} · ${ch.roleAccess&&Object.keys(ch.roleAccess).length?'خاصة حسب الرتب':'عامة أو حسب إعدادات القسم'}</div><label>اسم القناة <input style="width:100%;padding:7px;background:#111827;color:#eee;border:1px solid #475569;border-radius:7px" name="channelName[${bi}][${hi}]" value="${esc(hc.name||ch.name)}" maxlength="100" ${String(ch._baseName||'').startsWith('➕・Create Room')?'readonly title="اسم قناة إنشاء الغرفة ثابت حتى يعمل النظام تلقائيًا"':''}></label><label>الرتب والصلاحيات: Owner=ViewChannel+ReadMessageHistory;Admin=ViewChannel+SendMessages؛ PUBLIC لقناة عامة <input style="width:100%;padding:7px;background:#111827;color:#eee;border:1px solid #475569;border-radius:7px" name="accessRoles[${bi}][${hi}]" value="${esc(access)}" maxlength="500"></label></li>`;}).join('');
    const protectedCategory=/owner/i.test(String(c._baseName||c.name));return `<section class="ys-card"><label><input type="checkbox" name="catEnabled[${bi}]" value="1" ${protectedCategory||cc.enabled!==false?'checked':''} ${protectedCategory?'disabled':''}> تفعيل القسم ${protectedCategory?'(أساسي لا يمكن تعطيله)':''}</label>${protectedCategory?`<input type="hidden" name="catEnabled[${bi}]" value="1">`:''}<label style="display:block;margin-top:8px">اسم القسم <input style="width:100%;padding:8px;background:#111827;color:#eee;border:1px solid #475569;border-radius:7px" name="catName[${bi}]" value="${esc(cc.name||c.name)}" maxlength="90"></label><label style="display:block;margin-top:8px">ترتيب القسم (الأصغر يظهر أولًا) <input type="number" min="0" max="999" name="catOrder[${bi}]" value="${esc(cc.order??c._order??bi)}" style="width:100px;padding:7px;background:#111827;color:#eee;border:1px solid #475569;border-radius:7px"></label><h3>${esc(c.name)}</h3><ul class="ys-list">${channels}</ul></section>`;}).join('');
   res.send(page('تخصيص القالب',`<main class="ys-wrap"><section class="ys-hero"><a class="ys-btn" href="/dashboard/${esc(gid)}/your-server/${encodeURIComponent(id)}">← رجوع للمعاينة</a><h1>⚙️ تخصيص ${esc(t.name)}</h1><p class="ys-muted">الإعدادات محفوظة لهذا السيرفر فقط. تستطيع تغيير أسماء الرتب وألوانها وترتيبها، وترتيب الأقسام، وتفعيل أو تعطيل كل قسم أو قناة. الرتب لا تحصل على Administrator تلقائيًا. الصلاحيات المسموحة هنا محدودة لتجنب منح صلاحيات حساسة.</p></section><form method="post" action="/dashboard/${esc(gid)}/your-server/${encodeURIComponent(id)}/configure"><input type="hidden" name="_csrf" value="${esc(csrf(req))}"><section class="ys-panel"><h2>🎭 الرتب والألوان والترتيب</h2><div style="overflow:auto"><table class="ys-table"><thead><tr><th>الرتبة الأصلية</th><th>الاسم الجديد</th><th>اللون</th><th>الترتيب</th><th>الصلاحيات</th></tr></thead><tbody>${roleRows}</tbody></table></div></section><section class="ys-panel"><h2>🔊 إعدادات الرومات المؤقتة</h2><p class="ys-muted">تُحفظ هذه الإعدادات لهذا السيرفر فقط وتُطبّق عند إنشاء قسم Temporary Rooms. الحد 0 يعني بلا حد. أنواع الغرف الخاصة (الشرطة، الإسعاف، العصابات، المقابلات، الموظفين، المعلمين، القيادة) تبقى مقيدة برتبها.</p><label>الحد الافتراضي للأعضاء <input type="number" min="0" max="99" name="tempDefaultLimit" value="${esc(cfg.tempSettings?.defaultLimit??t.tempSettings?.defaultLimit??0)}" style="width:120px;padding:7px;background:#111827;color:#eee;border:1px solid #475569;border-radius:7px"></label><label style="display:block;margin-top:8px">بادئة اسم الغرفة العامة <input name="tempPrefix" maxlength="20" value="${esc(cfg.tempSettings?.roomPrefix??t.tempSettings?.roomPrefix??'غرفة')}" style="width:100%;padding:7px;background:#111827;color:#eee;border:1px solid #475569;border-radius:7px"></label></section><section class="ys-panel"><h2>📋 الأقسام والقنوات</h2><p class="ys-muted">ألغِ تحديد القنوات غير المطلوبة. إلغاء قسم كامل يمنع إنشاء كل قنواته. لتعطيل نظام الرومات المؤقتة، ألغِ تفعيل قسم Temporary Rooms. قسم Owner يبقى مفعّلًا دائمًا، وقنوات المالك والسجلات لا يمكن جعلها عامة من هذا النموذج.</p></section>${sections}<button class="ys-btn primary" type="submit">حفظ التخصيص</button></form></main>`,req.user));
  }catch(e){next(e);}
 });
 app.post('/dashboard/:guildId/your-server/:templateId/configure', requireLogin, requireGuildAccess, checkCsrf, async(req,res,next)=>{
  try{
   const gid=String(req.params.guildId),id=String(req.params.templateId),t=cloneTemplate(id);if(!t)return res.status(404).send('القالب غير موجود.');
   const saved=await store.data(gid,CUSTOM,{templates:{}}),config={categories:[],roles:{},tempSettings:{}};
   const defaultLimit=Number(req.body.tempDefaultLimit);config.tempSettings.defaultLimit=Number.isInteger(defaultLimit)?Math.max(0,Math.min(99,defaultLimit)):0;config.tempSettings.roomPrefix=String(req.body.tempPrefix||'غرفة').replace(/[\r\n]/g,' ').trim().slice(0,20)||'غرفة';
   for(let ri=0;ri<t.roles.length;ri++){
    const role=t.roles[ri],base=role.name,rawName=String(req.body.roleName?.[base]||base).trim().slice(0,100),color=String(req.body.roleColor?.[base]||role.color||'#99aab5'),order=Number(req.body.roleOrder?.[base]);
    config.roles[base]={name:rawName||base,color:/^#[0-9a-fA-F]{6}$/.test(color)?color:(role.color||'#99aab5'),order:Number.isFinite(order)?Math.max(0,Math.min(999,order)):ri};
   }
   const newNames=Object.values(config.roles).map(r=>r.name.toLowerCase());if(new Set(newNames).size!==newNames.length)return res.status(400).send('أسماء الرتب الجديدة يجب أن تكون مختلفة.');
   for(let ci=0;ci<t.categories.length;ci++){const cat=t.categories[ci],c={enabled:req.body.catEnabled?.[ci]==='1',name:String(req.body.catName?.[ci]||cat.name).trim().slice(0,90),order:Number(req.body.catOrder?.[ci]),channels:[]};c.order=Number.isFinite(c.order)?Math.max(0,Math.min(999,c.order)):ci;for(let hi=0;hi<cat.channels.length;hi++){const ch=cat.channels[hi];c.channels.push({enabled:req.body.channelEnabled?.[ci]?.[hi]==='1',name:String(req.body.channelName?.[ci]?.[hi]||ch.name).trim().slice(0,100),accessRoles:String(req.body.accessRoles?.[ci]?.[hi]??'').trim().slice(0,500)});}config.categories.push(c);}
   saved.templates=saved.templates||{};saved.templates[id]=config;await store.saveData(gid,CUSTOM,saved);res.redirect(`/dashboard/${encodeURIComponent(gid)}/your-server/${encodeURIComponent(id)}`);
  }catch(e){next(e);}
 });
 app.post('/dashboard/:guildId/your-server/:templateId/apply', requireLogin, requireGuildAccess, checkCsrf, async(req,res,next)=>{
  const gid=String(req.params.guildId), id=String(req.params.templateId);
  try{
   const previewTemplate=await effectiveTemplate(id,gid); if(!previewTemplate||!previewTemplate.enabled||!previewTemplate.visible)throw new Error('القالب غير متاح.');
   const previewCfg=await store.getConfig(gid), previewPlan=planNameForConfig(previewCfg), previewRank={free:0,premium:1,premium_plus:2};
   if((previewRank[previewPlan]||0)<(previewRank[previewTemplate.plan]||0))throw new Error(`هذا القالب يتطلب خطة ${previewTemplate.plan==='premium_plus'?'Premium+':'Premium'} فعّالة.`);
   const ugPreview=(req.user?.guilds||[]).find(g=>String(g.id)===gid); if(!ugPreview||!(ugPreview.owner||((BigInt(String(ugPreview.permissions||'0'))&0x28n)!==0n)))throw new Error('لا تملك صلاحية إدارة هذا السيرفر.');
   const prior=await getManifest(gid); const switching=!!prior?.templateId&&String(prior.templateId)!==id;
   if(req.body?.confirm!=='1'){
    const oldChannels=(prior.channels||[]).length, oldRoles=(prior.roles||[]).length;
    const warning=switching?`<p class="ys-danger"><b>سيتم حذف القالب المُدار السابق (${esc(prior.templateName||prior.templateId)}):</b> ${oldChannels} قناة/تصنيف و${oldRoles} رتبة مسجلة ضمن القالب السابق.</p><p>لن يحذف النظام أي قناة أو رتبة غير مسجلة في ملف إدارة القوالب، ولن يحذف الرتب أو القنوات اليدوية لمجرد تشابه الاسم.</p>`:`<p>لا يوجد قالب سابق مختلف مسجل للحذف. سيتم إنشاء القالب وإعادة استخدام العناصر المطابقة، مع تحديث صلاحيات القنوات المطابقة.</p>`;
    return res.send(page('تأكيد استبدال القالب',`<main class="ys-wrap"><section class="ys-hero"><h1>⚠️ تأكيد ${switching?'استبدال القالب':'تطبيق القالب'}</h1><p>القالب الجديد: <b>${esc(previewTemplate.name)}</b></p>${warning}<h3>الرتب التي سيطلبها القالب الجديد (${previewTemplate.roles.length})</h3><ul class="ys-list">${previewTemplate.roles.map(r=>`<li>${esc(r.name)} — ${r.permissions.length?esc(r.permissions.join(', ')):'صلاحيات عادية بدون Administrator'}</li>`).join('')}</ul><h3>عدد القنوات والفئات الجديدة</h3><p>${previewTemplate.categories.reduce((n,c)=>n+(!c._disabled?1+c.channels.filter(ch=>!ch._disabled).length:0),0)}</p><form method="post" action="/dashboard/${esc(gid)}/your-server/${encodeURIComponent(id)}/apply"><input type="hidden" name="_csrf" value="${esc(csrf(req))}"><input type="hidden" name="confirm" value="1"><button class="ys-btn primary" type="submit">أؤكد ${switching?'حذف القالب القديم وإضافة الجديد':'تطبيق القالب'}</button> <a class="ys-btn" href="/dashboard/${esc(gid)}/your-server/${encodeURIComponent(id)}">إلغاء</a></form></section></main>`,req.user));
   }
  }catch(e){return res.status(400).send(page('تعذر تأكيد القالب',`<main class="ys-wrap"><section class="ys-hero"><h1>❌ تعذر متابعة العملية</h1><p>${esc(e.message)}</p><a class="ys-btn" href="/dashboard/${esc(gid)}/your-server">رجوع</a></section></main>`,req.user));}
  const runKey=`${gid}:${id}`; if(activeRuns.has(runKey))return res.status(409).send('هناك عملية إنشاء جارية لهذا القالب على هذا السيرفر.'); activeRuns.add(runKey); let entry={id:require('crypto').randomUUID(),templateId:id,status:'running',createdAt:Date.now(),created:[],reused:[],deleted:[],skipped:[],errors:[]};
  try{
   const t=await effectiveTemplate(id,gid); if(!t||!t.enabled||!t.visible)throw new Error('القالب غير متاح.');
   const cfg=await store.getConfig(gid), plan=planNameForConfig(cfg), rank={free:0,premium:1,premium_plus:2};
   if((rank[plan]||0)<(rank[t.plan]||0))throw new Error(`هذا القالب يتطلب خطة ${t.plan==='premium_plus'?'Premium+':'Premium'} فعّالة.`);
   // requireGuildAccess verified OAuth Manage Server; verify current Discord permissions too.
   const ug=(req.user?.guilds||[]).find(g=>String(g.id)===gid); if(!ug||!(ug.owner||((BigInt(String(ug.permissions||'0'))&0x28n)!==0n)))throw new Error('لا تملك صلاحية إدارة هذا السيرفر.');
   const botUser=await botFetch('/users/@me');
   if(!validId(botUser?.id))throw new Error('تعذر تحديد هوية البوت من Discord.');
   const discordGuild=await botFetch(`/guilds/${gid}`).catch(()=>null);
   const serverOwnerUserId=validId(discordGuild?.owner_id)?String(discordGuild.owner_id):(ug.owner&&validId(req.user?.id)?String(req.user.id):null);
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
   let oldManifest=await getManifest(gid);
   // A different template is destructive only after the user has explicitly confirmed above.
   // Delete resources by their recorded IDs only, then reset the manifest before building the new template.
   if(oldManifest?.templateId && String(oldManifest.templateId)!==id){
     await deletePreviousManaged(gid,oldManifest,entry);
     await saveManifest(gid,{templateId:null,templateName:null,roles:[],channels:[],updatedAt:Date.now()});
     oldManifest=null;
   }
   const [existingRoles,existingChannels]=await Promise.all([botFetch(`/guilds/${gid}/roles`),botFetch(`/guilds/${gid}/channels`)]);
   const owned={roles:[],channels:[]};
   const roleMap=new Map((existingRoles||[]).map(r=>[r.name,r]));
   const managedRoleIds=new Set((oldManifest?.roles||[]).map(r=>String(r.id)));
   for(const r of t.roles){const existing=roleMap.get(r.name);const managed=oldManifest?.templateId===id&&(oldManifest.roles||[]).some(x=>String(x.id)===String(existing?.id)&&(x.templateRoleKey===(r._baseName||r.name)||x.name===r.name));if(existing&&r._baseName&&r.name!==r._baseName&&!managed)throw new Error(`اسم الرتبة المخصص "${r.name}" مستخدم مسبقًا في السيرفر. اختر اسمًا آخر حتى لا تتداخل صلاحيات القوالب.`);}
   const roleIds={};
   const roleCreationOrder=[...t.roles].sort((a,b)=>(a._order??0)-(b._order??0));
   // Reuse existing roles without changes. Only roles recorded as created by this same template
   // may have their customized name/color updated on later applications.
   for(const r of roleCreationOrder){
    const managedPrior=oldManifest?.templateId===id?(oldManifest.roles||[]).find(x=>x.templateRoleKey===(r._baseName||r.name)||(!x.templateRoleKey&&x.name===(r._baseName||r.name))):null;
    const priorRole=managedPrior?(existingRoles||[]).find(x=>String(x.id)===String(managedPrior.id)):null;
    if(managedPrior&&priorRole){
     const collision=roleMap.get(r.name);
     if(collision&&String(collision.id)!==String(priorRole.id))throw new Error(`اسم الرتبة المخصص "${r.name}" مستخدم مسبقًا في السيرفر. اختر اسمًا آخر حتى لا تتداخل الصلاحيات.`);
     let managedRole=priorRole;
     const color=parseInt(String(r.color||'#99aab5').replace('#',''),16)||0;
     if(managedRole.name!==r.name||Number(managedRole.color||0)!==color){
      try{managedRole=await botFetch(`/guilds/${gid}/roles/${managedRole.id}`,{method:'PATCH',body:JSON.stringify({name:r.name,color})});roleMap.delete(priorRole.name);roleMap.set(r.name,managedRole);entry.created.push(`تحديث رتبة قالب سابقة: ${r.name}`);}
      catch(e){entry.errors.push(`تعذر تحديث اسم/لون الرتبة المدارة ${r.name}: ${e.message}`);roleMap.set(r.name,managedRole);}
     }
     roleIds[r.name]=managedRole.id;roleMap.set(r.name,managedRole);owned.roles.push({id:String(managedRole.id),name:r.name,templateRoleKey:r._baseName||r.name});entry.reused.push(`رتبة: ${r.name}`);continue;
    }
    const old=roleMap.get(r.name); if(old){roleIds[r.name]=old.id;entry.reused.push(`رتبة: ${r.name}`);continue;}
    try{
     const body={name:r.name,color:parseInt(String(r.color||'#99aab5').replace('#',''),16)||0,permissions:permBits(r.permissions),mentionable:false,hoist:['Owner','Co Owner','Management','Admin','Moderator','Manager','Teacher','Organizer'].includes(r.name)};
     const made=await botFetch(`/guilds/${gid}/roles`,{method:'POST',body:JSON.stringify(body)}); roleIds[r.name]=made.id;roleMap.set(r.name,made);owned.roles.push({id:String(made.id),name:r.name,templateRoleKey:r._baseName||r.name});entry.created.push(`رتبة: ${r.name}`);await wait(180);
    }catch(e){entry.errors.push(`تعذر إنشاء الرتبة ${r.name}: ${e.message}`);}
   }
   // Place only newly-created template roles below the bot's highest role, preserving all existing roles.
   const allAfter=await botFetch(`/guilds/${gid}/roles`).catch(()=>existingRoles||[]);
   const positionChanges=[];
   for(let i=0;i<roleCreationOrder.length;i++){
    const r=roleCreationOrder[i],rid=roleIds[r.name],actual=(allAfter||[]).find(x=>String(x.id)===String(rid));
    if(!actual||entry.reused.includes(`رتبة: ${r.name}`)||actual.position>=Number(topBotRole.position||0))continue;
    const target=Math.max(1,Number(topBotRole.position||1)-i-1);
    positionChanges.push({id:String(rid),position:target});
   }
   if(positionChanges.length){try{await botFetch(`/guilds/${gid}/roles`,{method:'PATCH',body:JSON.stringify(positionChanges)});}catch(e){entry.errors.push(`تعذر ترتيب الرتب الجديدة: ${e.message}`);}}
   const everyoneId=gid;
   if(!serverOwnerUserId)entry.errors.push('تعذر تحديد معرّف مالك السيرفر من Discord؛ قد تحتاج القنوات الخاصة إلى ضبط صلاحية المالك يدويًا.');
   const missingRoleWarnings=new Set();
   const managedChannelIds=new Set((oldManifest?.channels||[]).map(x=>String(x.id)));
   async function ensureOwnerOverwrite(channelId,readOnly=false){
     if(!serverOwnerUserId||!managedChannelIds.has(String(channelId)))return;
     const ownerOverwriteBits=permBits(readOnly?['ViewChannel','ReadMessageHistory']:['ViewChannel','ReadMessageHistory','SendMessages','Connect','Speak']);
     try{await botFetch(`/channels/${channelId}/permissions/${serverOwnerUserId}`,{method:'PUT',body:JSON.stringify({type:1,allow:ownerOverwriteBits,deny:'0'})});}
     catch(e){entry.errors.push(`تعذر إصلاح صلاحية مالك السيرفر للقناة ${channelId}: ${e.message}`);}
   }
   const makeOverwrites=(c)=>{
    const allowed=new Map(), denied=new Map();
    const allow=(id,keys)=>allowed.set(String(id),(allowed.get(String(id))||0n)|keys.reduce((n,k)=>n|(PERMISSIONS[k]||0n),0n));
    const deny=(id,keys)=>denied.set(String(id),(denied.get(String(id))||0n)|keys.reduce((n,k)=>n|(PERMISSIONS[k]||0n),0n));
    const privateSection=Object.keys(c.roleAccess||{}).length>0;
    const policyName=String(c._baseName||c.name||'');
    if(privateSection && !c.publicReadOnly){deny(everyoneId,['ViewChannel']);for(const [roleName,perms] of Object.entries(c.roleAccess)){
const rid=roleIds[roleName]||roleMap.get(roleName)?.id;if(!rid){const warning=`رتبة الوصول المطلوبة غير موجودة: ${roleName}`;if(!missingRoleWarnings.has(warning)){missingRoleWarnings.add(warning);entry.errors.push(warning);}}if(rid){const channelPerms=c.type===4||c.customRolePermissions?[]:(c.type===2?['ViewChannel','Connect','Speak'] : (c.readOnly?['ViewChannel','ReadMessageHistory']:['ViewChannel','ReadMessageHistory','SendMessages']));allow(rid,[...new Set([...perms,...channelPerms])]);if(c.readOnly&&c.deny?.length)deny(rid,c.deny);}}}
    else allow(everyoneId,['ViewChannel','ReadMessageHistory',...(c.type===2?['Connect']:c.publicReadOnly?[]:['SendMessages','AddReactions','AttachFiles','EmbedLinks'])]);
    if(privateSection && serverOwnerUserId) allow(serverOwnerUserId,/logs|سجلات|اللوقات|ticket-logs|ticket-transcripts/i.test(policyName)?['ViewChannel','ReadMessageHistory']:['ViewChannel','ReadMessageHistory','SendMessages','Connect','Speak']);
    // The bot must be able to operate in template-created channels, including private ones.
    // This member overwrite is limited to this channel and does not grant Administrator.
    if(validId(botUser.id)) allow(String(botUser.id),['ViewChannel','ReadMessageHistory','SendMessages','EmbedLinks','AttachFiles','Connect','Speak','UseApplicationCommands']);
    if(c.publicReadOnly){deny(everyoneId,['SendMessages']);for(const roleName of (c.writeRoles||[])){const rid=roleIds[roleName]||roleMap.get(roleName)?.id;if(rid)allow(rid,['ViewChannel','ReadMessageHistory','SendMessages']);}}
    for(const [id,bits] of denied){const a=allowed.get(id)||0n;allowed.set(id,a&~bits);}
    return [...new Set([...allowed.keys(),...denied.keys()])].map(id=>({id,type:(id===String(botUser.id)||id===serverOwnerUserId)?1:0,allow:(allowed.get(id)||0n).toString(),deny:(denied.get(id)||0n).toString()}));
   };
   const channelsNow=await botFetch(`/guilds/${gid}/channels`); const channelMap=new Map((channelsNow||[]).map(c=>[`${c.type}:${c.name}:${c.parent_id||''}`,c]));
   let ticketPanelChannelId=null;
   const templateLogChannels={};
   const rememberLogChannel=(ch,id)=>{if(ch?._baseName==='owner-logs')templateLogChannels.owner=String(id);else if(ch?._baseName==='ticket-transcripts')templateLogChannels.transcripts=String(id);else if(ch?._baseName&&/^logs-(members|messages|roles|channels|moderation|voice|tickets|events|bot)$/.test(ch._baseName))templateLogChannels[ch._baseName.slice(5)]=String(id);};
   t.categories.sort((a,b)=>(a._order??a._baseIndex??0)-(b._order??b._baseIndex??0));
   for(const category of t.categories){
    if(category._disabled)continue;
    let categoryId=''; const existingCat=(channelsNow||[]).find(c=>c.type===4&&c.name===category.name);
    if(existingCat){categoryId=existingCat.id;entry.reused.push(`تصنيف: ${category.name}`);
     try{const pseudo={type:4,name:category.name,_baseName:category._baseName,roleAccess:category.roleAccess||{}};await botFetch(`/channels/${categoryId}`,{method:'PATCH',body:JSON.stringify({permission_overwrites:makeOverwrites(pseudo)})});entry.created.push(`تحديث صلاحيات القسم: ${category.name}`);}
     catch(e){entry.errors.push(`تعذر تحديث صلاحيات القسم ${category.name}: ${e.message}`);}
     if(Object.keys(category.roleAccess||{}).length)await ensureOwnerOverwrite(categoryId,/logs|سجلات|اللوقات/i.test(String(category._baseName||category.name)));}else{
     try{const pseudo={type:4,name:category.name,roleAccess:category.roleAccess||{}};const made=await botFetch(`/guilds/${gid}/channels`,{method:'POST',body:JSON.stringify({name:category.name,type:4,permission_overwrites:makeOverwrites(pseudo)})});categoryId=made.id;owned.channels.push({id:String(made.id),name:category.name,type:4});entry.created.push(`تصنيف: ${category.name}`);await wait(180);}catch(e){entry.errors.push(`تعذر إنشاء التصنيف ${category.name}: ${e.message}`);continue;}
    }
    for(const ch of category.channels){
     if(ch._disabled)continue;
     const found=(channelsNow||[]).find(c=>c.type===ch.type&&c.name===ch.name&&String(c.parent_id||'')===String(categoryId));
     const explicitlyPublic=ch.public===true; const access={...category, ...ch, type:ch.type, roleAccess:explicitlyPublic?{}:(ch.roleAccess||category.roleAccess||{}), readOnly:!!ch.readOnly, publicReadOnly:!!ch.publicReadOnly, writeRoles:ch.writeRoles||[]};
     const overrides=makeOverwrites(access);
     if(found){
      entry.reused.push(`قناة: ${category.name}/${ch.name}`);if(ch._baseName==='ticket-panel')ticketPanelChannelId=String(found.id);rememberLogChannel(ch,found.id);
      try{await botFetch(`/channels/${found.id}`,{method:'PATCH',body:JSON.stringify({permission_overwrites:overrides})});entry.created.push(`تحديث صلاحيات: ${category.name}/${ch.name}`);}
      catch(e){entry.errors.push(`تعذر تحديث صلاحيات القناة المطابقة ${category.name}/${ch.name}: ${e.message}`);}
      if(Object.keys(access.roleAccess||{}).length)await ensureOwnerOverwrite(found.id,Boolean(ch.readOnly)||/logs|سجلات|اللوقات|ticket-logs|ticket-transcripts/i.test(String(ch._baseName||ch.name)));continue;
     }
     try{
      // For a public section, the category-level defaults apply. Per-channel deny/allow rules are supported too.
      if(ch.deny?.length){const ow=overrides.find(x=>x.id===everyoneId)||{id:everyoneId,type:0,allow:'0',deny:'0'};ow.deny=(BigInt(ow.deny)|ch.deny.reduce((n,k)=>n|(PERMISSIONS[k]||0n),0n)).toString();if(!overrides.includes(ow))overrides.push(ow);}
      if(ch.allow?.length){const ow=overrides.find(x=>x.id===everyoneId)||{id:everyoneId,type:0,allow:'0',deny:'0'};ow.allow=(BigInt(ow.allow)|ch.allow.reduce((n,k)=>n|(PERMISSIONS[k]||0n),0n)).toString();if(!overrides.includes(ow))overrides.push(ow);}
      const body={name:ch.name,type:ch.type,parent_id:categoryId,permission_overwrites:overrides};
      if(ch.userLimit!==undefined&&ch.type===2)body.user_limit=Math.max(0,Math.min(99,Number(ch.userLimit)||0));
      const madeChannel=await botFetch(`/guilds/${gid}/channels`,{method:'POST',body:JSON.stringify(body)});owned.channels.push({id:String(madeChannel.id),name:ch.name,type:ch.type,parent_id:String(categoryId)});entry.created.push(`قناة: ${category.name}/${ch.name}`);if(ch._baseName==='ticket-panel')ticketPanelChannelId=String(madeChannel.id);rememberLogChannel(ch,madeChannel.id);await wait(180);
     }catch(e){entry.errors.push(`تعذر إنشاء القناة ${category.name}/${ch.name}: ${e.message}`);}
    }
   }
   const tempCategory=t.categories.find(c=>c._baseName==='🔊・Temporary Rooms');
   if(tempCategory&&!tempCategory._disabled&&tempCategory.channels.some(ch=>!ch._disabled&&String(ch._baseName||'').startsWith('➕・Create Room'))){
     const tempSettings=t.tempSettings||{defaultLimit:0,roomPrefix:'غرفة'};
     await store.saveData(gid,'temporary-voice-settings.json',{defaultLimit:Math.max(0,Math.min(99,Number(tempSettings.defaultLimit)||0)),roomPrefix:String(tempSettings.roomPrefix||'غرفة').replace(/[\r\n]/g,' ').trim().slice(0,20)||'غرفة',templateId:id,updatedAt:Date.now()});
   }
   await store.saveData(gid,'your-server-log-channels.json',templateLogChannels);
   // Connect the generated ticket panel to the existing ticket system only when no valid
   // panel is already configured, preserving any prior dashboard configuration.
   if(ticketPanelChannelId){
     cfg.channels=cfg.channels||{};
     const configuredPanel=String(cfg.channels.ticketPanel||'');
     const configuredPanelExists=validId(configuredPanel)&&(channelsNow||[]).some(c=>String(c.id)===configuredPanel&&(c.type===0||c.type===5));
     if(!configuredPanelExists){
       cfg.channels.ticketPanel=ticketPanelChannelId;
       const ticketTypes=(cfg.tickets?.types||[]).filter(x=>x&&x.enabled!==false).slice(0,25);
       if(ticketTypes.length){
         try{
           const components=[];
           for(let i=0;i<ticketTypes.length;i+=5){components.push({type:1,components:ticketTypes.slice(i,i+5).map(type=>({type:2,style:1,label:String(type.label||type.name||'فتح تذكرة').slice(0,80),custom_id:`pub:ticket:open:${String(type.id||'general').slice(0,60)}`}))});}
           const rawColor=String(cfg.branding?.color||'#8b5cf6').replace('#','');const panelColor=/^[0-9a-fA-F]{6}$/.test(rawColor)?parseInt(rawColor,16):0x8b5cf6;
           const msg=await botFetch(`/channels/${ticketPanelChannelId}/messages`,{method:'POST',body:JSON.stringify({embeds:[{title:String(cfg.tickets?.title||'🎫 مركز التذاكر').slice(0,256),description:String(cfg.tickets?.description||'اختر نوع التذكرة المناسب من الأزرار أدناه.').slice(0,4000),color:panelColor,footer:{text:'ZOMBI • TICKETS'}}],components})});
           cfg.tickets=cfg.tickets||{};cfg.tickets.panelMessageId=String(msg.id);entry.created.push('لوحة تذاكر مرتبطة بنظام التذاكر الحالي');
         }catch(e){delete cfg.channels.ticketPanel;entry.errors.push(`تم إنشاء روم لوحة التذاكر لكن تعذر نشر الأزرار: ${e.message}`);}
       }else entry.skipped.push('لم تُنشر أزرار التذاكر لأن إعدادات السيرفر لا تحتوي على أنواع تذاكر مفعّلة.');
       await store.saveConfig(gid,cfg).catch(e=>entry.errors.push(`تعذر حفظ إعدادات لوحة التذاكر: ${e.message}`));
     }else entry.skipped.push('تم الحفاظ على قناة لوحة التذاكر المحددة مسبقًا في إعدادات السيرفر.');
   }
   entry.status=entry.errors.length?'partial':'success';
   if(entry.status!=='failed' && (owned.channels.length||owned.roles.length)){
    const previous=oldManifest||{roles:[],channels:[]};
    const mergeById=(a,b)=>[...new Map([...(a||[]),...(b||[])].map(x=>[String(x.id),x])).values()];
    await saveManifest(gid,{templateId:id,templateName:t.name,roles:mergeById(previous.roles,owned.roles),channels:mergeById(previous.channels,owned.channels),updatedAt:Date.now(),preservedPreviousTemplates:true});
   }
   entry.summary=`إنشاء ${entry.created.length} عنصر، إعادة استخدام ${entry.reused.length}، تجاوز ${entry.skipped.length}، وأخفق ${entry.errors.length}. تم حذف العناصر القديمة المسجلة فقط بعد تأكيد صريح.`;
   await addHistory(gid,entry); activeRuns.delete(runKey);
   res.send(page('نتيجة إنشاء القالب',`<main class="ys-wrap"><section class="ys-hero"><h1>${entry.status==='success'?'✅':'⚠️'} نتيجة إنشاء ${esc(t.name)}</h1><p>${esc(entry.summary)}</p><p class="ys-muted">تم حذف العناصر المسجلة من القالب السابق فقط بعد التأكيد، مع الحفاظ على العناصر غير المسجلة.</p><h2>العناصر القديمة المحذوفة (${entry.deleted.length})</h2><ul class="ys-list">${entry.deleted.map(x=>`<li>${esc(x)}</li>`).join('')||'<li>لا توجد عناصر مسجلة من قالب سابق.</li>'}</ul><a class="ys-btn primary" href="/dashboard/${esc(gid)}/your-server">العودة للقوالب</a></section><section class="ys-panel"><h2>تم إنشاؤه (${entry.created.length})</h2><ul class="ys-list">${entry.created.map(x=>`<li>${esc(x)}</li>`).join('')||'<li>لا يوجد</li>'}</ul><h2>تمت إعادة استخدامه (${entry.reused.length})</h2><ul class="ys-list">${entry.reused.map(x=>`<li>${esc(x)}</li>`).join('')||'<li>لا يوجد</li>'}</ul><h2>تم التجاوز (${entry.skipped.length})</h2><ul class="ys-list">${entry.skipped.map(x=>`<li>${esc(x)}</li>`).join('')||'<li>لا يوجد</li>'}</ul><h2 class="ys-danger">الأخطاء (${entry.errors.length})</h2><ul class="ys-list">${entry.errors.map(x=>`<li>${esc(x)}</li>`).join('')||'<li>لا يوجد</li>'}</ul></section></main>`,req.user));
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
