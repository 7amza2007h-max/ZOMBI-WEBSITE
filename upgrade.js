(() => {
 'use strict';
 const context=document.getElementById('z-plan-context');if(!context)return;
 const data=JSON.parse(context.textContent),labels={premium:'Premium',premium_plus:'Premium+'};
 const dialog=document.createElement('dialog');dialog.className='z-upgrade-dialog';
 dialog.setAttribute('aria-labelledby','z-upgrade-title');dialog.setAttribute('aria-describedby','z-upgrade-message');
 dialog.innerHTML='<button type="button" class="z-modal-close" aria-label="إغلاق">×</button><div class="z-upgrade-symbol" aria-hidden="true">💎</div><span class="badge">ZOMBI MEMBERSHIP</span><h2 id="z-upgrade-title">افتح مميزات أكثر لسيرفرك</h2><p id="z-upgrade-message"></p><div class="z-upgrade-options"></div><a href="/premium" class="btn primary">مقارنة الخطط والاشتراك</a><button type="button" class="btn z-modal-later">لاحقًا</button>';
 document.body.appendChild(dialog);
 const close=()=>dialog.close();dialog.querySelector('.z-modal-close').onclick=close;dialog.querySelector('.z-modal-later').onclick=close;
 dialog.addEventListener('click',e=>{if(e.target===dialog){const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)close();}});
 function show(options,message){
  const plans=(options||'').split(',').filter(p=>labels[p]);
  dialog.querySelector('#z-upgrade-message').textContent=message||(plans.length?`خطة سيرفرك الحالية ${data.current}. هذه الميزة متاحة مع ${plans.map(p=>labels[p]).join(' أو ')}.`:'هذه الميزة غير متاحة حاليًا. راجع الخطط أو تواصل مع مالك البوت.');
  const box=dialog.querySelector('.z-upgrade-options');box.replaceChildren();
  plans.forEach(p=>{const card=document.createElement('div'),title=document.createElement('b'),price=document.createElement('span');title.textContent=labels[p];price.textContent=data.prices[p]||'السعر يحدده المالك';card.append(title,price);box.appendChild(card);});
  if(!dialog.open)dialog.showModal();
 }
 // A real button above the disabled field handles mouse, touch and keyboard.
 document.querySelectorAll('[data-plan-locked="true"]').forEach(field=>{
  if(field.type==='hidden')return;
  const wrapper=document.createElement('span');wrapper.className='z-locked-control';field.before(wrapper);wrapper.appendChild(field);
  const trigger=document.createElement('button');trigger.type='button';trigger.className='z-lock-trigger';trigger.textContent='🔒';
  trigger.setAttribute('aria-label','ميزة مقفلة — عرض خيارات الاشتراك');trigger.onclick=()=>show(field.dataset.planOptions);wrapper.appendChild(trigger);
 });
 document.querySelectorAll('form[data-plan-locked-form]').forEach(form=>{
  form.querySelectorAll('input:not([type="hidden"]),select,textarea').forEach(f=>f.disabled=true);
  form.querySelectorAll('button[type="submit"],button:not([type])').forEach(b=>{b.disabled=false;b.textContent='🔒 عرض خيارات الاشتراك';});
  form.addEventListener('submit',e=>{e.preventDefault();show(form.dataset.planLockedForm);});
 });
 // Show server-side denials in the same dialog, including a plan expiring after page load.
 document.querySelectorAll('form[method="post" i]').forEach(form=>{
  form.addEventListener('submit',async e=>{
   if(e.defaultPrevented)return;
   if(!form.checkValidity())return;
   e.preventDefault();
   const body=new URLSearchParams(new FormData(form));if(e.submitter?.name)body.set(e.submitter.name,e.submitter.value);
   const buttons=[...form.querySelectorAll('button')],previous=buttons.map(b=>b.disabled);buttons.forEach(b=>b.disabled=true);
   try{
    const res=await fetch(form.action,{method:'POST',headers:{Accept:'application/json'},body});
    if(res.status===403&&res.headers.get('content-type')?.includes('application/json')){form.dispatchEvent(new Event('z-save-failed'));const denied=await res.json();show((denied.plans||[]).join(','),denied.message);return;}
    if(res.redirected){window.location.assign(res.url);return;}
    if(!res.ok){form.dispatchEvent(new Event('z-save-failed'));const status=document.createElement('p');status.className='warn';status.setAttribute('role','alert');status.textContent='تعذر حفظ التغييرات. راجع المدخلات وصلاحياتك وحاول مجددًا.';form.querySelector('.z-save-error')?.remove();status.classList.add('z-save-error');form.appendChild(status);return;}
    // Some legacy routes return an HTML success page.
    const html=await res.text();document.open();document.write(html);document.close();
   }catch{form.dispatchEvent(new Event('z-save-failed'));show('','تعذر الاتصال. تغييراتك ما زالت في الصفحة؛ حاول الحفظ مجددًا.');}
   finally{buttons.forEach((b,i)=>b.disabled=previous[i]);}
  });
 });
})();
