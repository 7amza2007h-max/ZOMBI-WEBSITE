'use strict';
const {PLAN_IDS,PLAN_LABELS,FEATURE_DEFS,GAME_DEFS,HEIST_GAME_DEFS,LIMIT_DEFS}=require('./planPolicy');
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function pricing(site){
 const zainReady=Boolean(site.zainCash?.enabled&&site.zainCash?.walletNumber);
 const cards=PLAN_IDS.map(p=>{const plus=p==='premium_plus',free=p==='free',zainAmount=plus?site.zainCash?.premiumPlusAmount:site.zainCash?.premiumAmount,zainDays=plus?site.zainCash?.premiumPlusDays:site.zainCash?.premiumDays,price=free?'مجاني':zainReady?`${Number(zainAmount).toFixed(3).replace(/\.000$/,'')} JOD / ${Number(zainDays)||30} يوم`:plus?site.premiumPlusPrice:site.premiumPrice,buy=plus?site.premiumPlusPurchaseUrl:site.purchaseUrl,checkout=!free&&zainReady?`/checkout?plan=${encodeURIComponent(p)}`:'';
 const feats=FEATURE_DEFS.filter(f=>site.plans[p].features[f.key]).slice(0,6);
 const href=free?'/dashboard':checkout||buy||site.supportUrl||'/dashboard';
 const label=free?'ابدأ مجانًا':checkout?'الدفع عبر Zain Cash':buy?'اشترك الآن':site.supportUrl?'تواصل للاشتراك':'تفعيل كود الاشتراك';
 return `<article class="z-plan ${plus?'z-plan-plus':p==='premium'?'z-plan-premium':''}"><span class="badge">${free?'البداية':plus?'حدود أوسع':'مميزات أكثر'}</span><h3 dir="ltr">${PLAN_LABELS[p]}</h3><strong class="z-price">${esc(price||'السعر يحدده المالك')}</strong><ul>${feats.map(f=>`<li>✓ ${esc(f.label)}</li>`).join('')}<li>${GAME_DEFS.filter(g=>site.plans[p].features.games&&site.plans[p].games[g.id]).length} ألعاب • ${HEIST_GAME_DEFS.filter(g=>site.plans[p].features.bank&&site.plans[p].heistGames[g.id]).length} تحديات نهب</li></ul><a class="btn ${free?'':'primary'}" href="${esc(href)}">${label}</a></article>`;}).join('');
 const rows=FEATURE_DEFS.map(f=>`<tr><th scope="row">${esc(f.label)}</th>${PLAN_IDS.map(p=>`<td>${site.plans[p].features[f.key]?'✓ متاح':'—'}</td>`).join('')}</tr>`).join('');
 const gameRows=(defs,section,parent)=>defs.map(g=>`<tr><th scope="row">${esc(g.label)}</th>${PLAN_IDS.map(p=>`<td>${site.plans[p].features[parent]&&site.plans[p][section][g.id]?'✓ متاح':'—'}</td>`).join('')}</tr>`).join('');
 const limits=LIMIT_DEFS.map(d=>`<tr><th scope="row">${esc(d.label)}</th>${PLAN_IDS.map(p=>`<td>${site.plans[p].limits[d.key]}</td>`).join('')}</tr>`).join('');
 return `<section class="pricing z-pricing" id="plans"><span class="badge">ZOMBI MEMBERSHIP</span><h2>اختَر خطة سيرفرك</h2><p>Free وPremium وPremium+ — قارن المميزات والحدود المتاحة لكل خطة.</p><div class="z-plan-grid">${cards}</div><details class="z-comparison"><summary>عرض المقارنة الكاملة للمميزات والألعاب والحدود</summary><div class="table-wrap"><table><thead><tr><th>الميزة</th>${PLAN_IDS.map(p=>`<th>${PLAN_LABELS[p]}</th>`).join('')}</tr></thead><tbody>${rows}${gameRows(GAME_DEFS,'games','games')}${gameRows(HEIST_GAME_DEFS,'heistGames','bank')}${limits}</tbody></table></div></details></section>`;
}
module.exports={pricing};
