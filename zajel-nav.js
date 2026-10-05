// ZOMBI-ZAJEL-NAV-20261005
(()=>{
 const add=()=>{const m=location.pathname.match(/^\/dashboard\/(\d{15,25})\/?$/);if(!m||document.getElementById('zajel-dashboard-link'))return;
 const a=document.createElement('a');a.id='zajel-dashboard-link';a.href='/dashboard/'+m[1]+'/zajel';a.textContent='📨 زاجل';a.className='btn';
 const target=document.querySelector('.z-dashboard-sidebar nav')||document.querySelector('main');if(target)target.appendChild(a);};
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',add,{once:true});else add();
})();
