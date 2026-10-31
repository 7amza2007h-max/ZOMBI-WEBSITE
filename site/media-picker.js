(function(){
  'use strict';
  function init(){
    document.querySelectorAll('.zombi-media-picker').forEach(function(wrap){
      const field=wrap.previousElementSibling;
      if(!field||!/(image|banner|thumbnail|logo|avatar|background|lineurl|panelmedia|cover|iconurl)/i.test((field.name||field.id||'')))return;
      if(wrap.dataset.previewReady)return;wrap.dataset.previewReady='1';
      const preview=document.createElement('img');preview.alt='معاينة الصورة المختارة';preview.loading='lazy';preview.decoding='async';
      preview.style.cssText='display:none;max-width:220px;max-height:120px;object-fit:contain;border:1px solid #394150;border-radius:8px;padding:4px;background:#111827';
      const clear=document.createElement('button');clear.type='button';clear.className='btn';clear.textContent='إزالة الصورة من الإعداد';clear.style.cssText='display:none';
      wrap.appendChild(preview);wrap.appendChild(clear);
      function update(){const value=String(field.value||'').trim();if(!value){preview.removeAttribute('src');preview.style.display='none';clear.style.display='none';return;}preview.src=value;preview.style.display='block';clear.style.display='inline-flex';}
      preview.addEventListener('error',function(){preview.style.display='none';});
      field.addEventListener('input',update);field.addEventListener('change',update);
      clear.addEventListener('click',function(){field.value='';field.dispatchEvent(new Event('input',{bubbles:true}));field.dispatchEvent(new Event('change',{bubbles:true}));});
      update();
    });
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
