'use strict';
const S=require('./zajelShared');
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function mount(app,{store,requireLogin,requireGuildAccess,checkCsrf,csrf,layout,botFetch}){
 const get=async gid=>S.normalize(await store.data(gid,S.CONFIG_KEY,{}));
 const route='/dashboard/:guildId/zajel';
 app.get(route,requireLogin,requireGuildAccess,async(req,res,next)=>{try{
  const gid=String(req.params.guildId),cfg=await get(gid),bundle=req.bundle;
  const channels=(bundle.channels||[]).filter(c=>[0,5].includes(Number(c.type)));
  const roles=(bundle.roles||[]).filter(r=>String(r.id)!==gid);
  const urlInput=(name,label)=>`<label>${label}<input type="url" name="${name}" value="${esc(cfg[name])}" maxlength="1000" placeholder="https://..."></label>`;
  const html=`<section class="zajel-settings" dir="rtl"><style>.zajel-settings{max-width:1000px;margin:30px auto;padding:24px}.zajel-settings h1{font-size:30px}.zajel-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:18px}.zajel-settings label{display:block;margin:12px 0}.zajel-settings input:not([type=checkbox]),.zajel-settings select{display:block;width:100%;box-sizing:border-box;padding:12px;margin-top:8px;color:inherit;background:#19202c;border:1px solid #596273;border-radius:8px}.zajel-roles{max-height:270px;overflow:auto;border:1px solid #596273;border-radius:8px;padding:14px}.zajel-actions{display:flex;gap:12px;flex-wrap:wrap;margin-top:22px}.zajel-settings button,.zajel-settings a.btn{padding:12px 20px;border-radius:8px}.zajel-note{padding:14px;background:#202938;border-radius:8px;line-height:1.8}</style>
  <a href="/dashboard/${gid}">← الرجوع لإعدادات السيرفر</a><h1>📨 نظام زاجل</h1><p>رسائل مجهولة مع اختيار المستلم والتحكم بمن يستطيع عرض المحتوى.</p>
  ${req.query.saved==='1'?'<p class="zajel-note">✅ تم حفظ إعدادات زاجل.</p>':''}${req.query.sent==='1'?'<p class="zajel-note">✅ تم حفظ الإعدادات ونشر / تحديث لوحة زاجل.</p>':''}
  ${bundle._degraded?'<p class="zajel-note">تعذّر تحميل الرومات والرتب مؤقتًا. أعد تحميل الصفحة قبل الحفظ.</p>':''}
  <form method="post" action="/dashboard/${gid}/zajel/save"><input type="hidden" name="_csrf" value="${esc(csrf(req))}">
  <label><input type="checkbox" name="enabled" ${cfg.enabled?'checked':''}> تفعيل إرسال رسائل زاجل</label>
  <div class="zajel-grid"><label>روم لوحة زاجل واستقبال الرسائل<select name="channelId" required><option value="">اختر الروم</option>${channels.map(c=>`<option value="${esc(c.id)}" ${String(c.id)===cfg.channelId?'selected':''}># ${esc(c.name)}</option>`).join('')}</select></label><label>لون الرسالة<input type="color" name="color" value="${cfg.color}"></label><label>الفاصل بين رسائل الشخص بالثواني (0 بدون انتظار)<input type="number" min="0" max="3600" name="cooldownSeconds" value="${cfg.cooldownSeconds}"></label></div>
  <h2>رتب عرض الرسائل</h2><p>المستلم يستطيع عرض رسالته دائمًا. الرتب المختارة تستطيع عرض كل رسائل زاجل في هذا السيرفر. صلاحية Administrator وحدها لا تفتح الرسالة.</p>
  <div class="zajel-roles">${roles.map(r=>`<label><input type="checkbox" name="viewerRoleIds" value="${esc(r.id)}" ${cfg.viewerRoleIds.includes(String(r.id))?'checked':''}> ${esc(r.name)}</label>`).join('')||'لا توجد رتب متاحة.'}</div>
  <h2>صور اللوحة الرئيسية</h2><div class="zajel-grid">${urlInput('panelBannerUrl','البنر الكبير للوحة زاجل')}${urlInput('panelThumbnailUrl','الصورة الصغيرة للوحة زاجل')}</div>
  <h2>صور إشعار الرسالة المجهولة</h2><div class="zajel-grid">${urlInput('messageBannerUrl','البنر الكبير للرسائل')}${urlInput('messageThumbnailUrl','الصورة الصغيرة للرسائل')}</div>
  <p class="zajel-note">تظهر الرسالة العامة مع منشن للمستلم وزري «عرض الرسالة» و«زاجل». المحتوى يظهر للمصرح له فقط. تغيير الصور يطبق على الإشعارات الجديدة؛ استخدم نشر / تحديث لتحديث اللوحة الرئيسية.</p>
  <div class="zajel-actions"><button class="btn primary" name="action" value="save" ${bundle._degraded?'disabled':''}>💾 حفظ الإعدادات</button><button class="btn" name="action" value="publish" ${bundle._degraded?'disabled':''}>📨 حفظ ونشر / تحديث اللوحة</button></div></form></section>`;
  res.send(layout('زاجل',html,req.user));
 }catch(e){next(e);}});
 app.post(route+'/save',requireLogin,requireGuildAccess,checkCsrf,async(req,res,next)=>{try{
  if(req.bundle._degraded)return res.status(503).send('أعد تحميل الرومات والرتب ثم حاول مجددًا.');
  const gid=String(req.params.guildId),old=await get(gid),b=req.body||{};
  const channelId=String(b.channelId||'');
  if(!req.bundle.channels.some(c=>String(c.id)===channelId&&[0,5].includes(Number(c.type))))return res.status(400).send('اختر رومًا نصيًا صحيحًا من هذا السيرفر.');
  const roleIds=Array.isArray(b.viewerRoleIds)?b.viewerRoleIds:b.viewerRoleIds?[b.viewerRoleIds]:[];
  const validRoles=new Set(req.bundle.roles.map(r=>String(r.id)).filter(id=>id!==gid));
  if(roleIds.some(id=>!validRoles.has(String(id))))return res.status(400).send('إحدى الرتب المختارة غير صالحة.');
  for(const k of ['panelBannerUrl','panelThumbnailUrl','messageBannerUrl','messageThumbnailUrl'])if(String(b[k]||'').trim()&&!S.url(b[k]))return res.status(400).send('رابط الصورة غير صالح. استخدم رابط HTTP أو HTTPS مباشر للصورة.');
  const cfg=S.normalize({...old,enabled:b.enabled==='on',channelId,viewerRoleIds:roleIds,color:b.color,cooldownSeconds:b.cooldownSeconds,panelBannerUrl:b.panelBannerUrl,panelThumbnailUrl:b.panelThumbnailUrl,messageBannerUrl:b.messageBannerUrl,messageThumbnailUrl:b.messageThumbnailUrl});
  await store.saveData(gid,S.CONFIG_KEY,cfg);
  if(b.action==='publish'){
   if(!cfg.enabled)return res.status(400).send('تم حفظ الإعدادات. فعّل زاجل قبل نشر اللوحة.');
   const payload=S.panel(cfg);let posted;
   if(cfg.panelMessageId&&cfg.panelChannelId===cfg.channelId){
    try{posted=await botFetch(`/channels/${cfg.channelId}/messages/${cfg.panelMessageId}`,{method:'PATCH',body:JSON.stringify(payload)});}
    catch(e){if(Number(e.status)!==404&&Number(e.code)!==10008)throw e;}
   }
   if(!posted)posted=await botFetch(`/channels/${cfg.channelId}/messages`,{method:'POST',body:JSON.stringify(payload)});
   cfg.panelMessageId=String(posted.id);cfg.panelChannelId=cfg.channelId;
   await store.saveData(gid,S.CONFIG_KEY,cfg);
   return res.redirect(`/dashboard/${gid}/zajel?sent=1`);
  }
  res.redirect(`/dashboard/${gid}/zajel?saved=1`);
 }catch(e){next(e);}});
}
module.exports={mount};
