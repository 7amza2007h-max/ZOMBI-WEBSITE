'use strict';
function duration(sh,now=Date.now()){return Math.max(0,Number(sh.endedAt||now)-Number(sh.startedAt||now)-Number(sh.breakMs||0)-(sh.breakStartedAt?now-Number(sh.breakStartedAt):0));}
function profile(cfg,s,d,userId,period='all',now=Date.now()){
 const since=period==='week'?now-7*86400000:period==='month'?now-30*86400000:0;
 const all=[...(d.shiftHistory||[])];if(d.activeShifts?.[userId])all.push(d.activeShifts[userId]);
 const shifts=all.filter(x=>String(x.userId)===String(userId)&&(x.endedAt||now)>=since);
 let dutyMs=0,messages=0,voiceMs=0;for(const sh of shifts){const total=duration(sh,now);const overlap=Math.max(0,(sh.endedAt||now)-Math.max(sh.startedAt,since));const fraction=Math.min(1,overlap/Math.max(1,(sh.endedAt||now)-sh.startedAt));dutyMs+=total*fraction;messages+=Number(sh.messageCount||0);voiceMs+=Number(sh.voiceMs||0)+(sh.voiceJoinedAt?Math.max(0,now-sh.voiceJoinedAt):0);}
 const tickets=Object.values(s.tickets||{}).filter(t=>t.claimedBy===userId&&t.closedAt>=since),ratings=tickets.filter(t=>Number(t.rating)>0);
 const avg=ratings.length?ratings.reduce((n,t)=>n+t.rating,0)/ratings.length:0;
 const points=Math.floor(dutyMs/3600000)*cfg.pointsPerHour+tickets.length*cfg.ticketPoints+ratings.reduce((n,t)=>n+Number(t.rating)*cfg.ratingPoints,0);
 const leaves=Object.values(d.requests||{}).filter(r=>r.type==='leave'&&r.userId===userId&&r.status==='accepted'&&Number(r.endAt)+86399999>=since);
 const waits=tickets.filter(t=>t.claimedAt&&(t.openedAt||t.createdAt));const avgClaimMs=waits.length?waits.reduce((n,t)=>n+Math.max(0,t.claimedAt-(t.openedAt||t.createdAt)),0)/waits.length:null;const promotions=Object.values(s.promotions||{}).filter(r=>r.userId===userId);
 return {avgClaimMs,promotionsPending:promotions.filter(r=>r.status==='pending').length,promotionsAccepted:promotions.filter(r=>r.status==='accepted').length,userId,period,shifts:shifts.length,dutyMs,messages,voiceMs,tickets:tickets.length,ratings:ratings.length,avg,points,leaves:leaves.length,onDuty:!!d.activeShifts?.[userId],threshold:cfg.threshold};
}
module.exports={profile};
