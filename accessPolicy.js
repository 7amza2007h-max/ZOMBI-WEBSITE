'use strict';
const policy=require('./planPolicy');
function requirements(name){
 if(name.startsWith('_'))return [];
 if(name.startsWith('feature_'))return [name.slice(8)];
 if(name==='currencyName'||name==='currencyEmoji')return ['customCurrency'];
 if(['brandColor','customName','customFooter','storeAccentColor','storeFooter','rolePanelFooter'].includes(name))return ['customBranding'];
 if(['botNickname','avatarUrl','bannerUrl','botBio','panelLogoUrl','panelBannerUrl','storeThumbnailUrl','storeBannerUrl','storeDetailBannerUrl','nameChangeBannerUrl'].includes(name))return ['customBotProfile'];
 if(name.startsWith('heist_game_'))return ['bank','heist:'+name.slice(11)];
 if(name.startsWith('game_enabled_'))return ['games','game:'+name.slice(13)];
 const game=name.match(/^game_(rounds|time|reward)_(.+)$/);if(game)return ['games','gameSettings','game:'+game[2]];
 if(/^(roulette|chairs|mafia)/.test(name))return ['games','gameSettings','game:'+name.match(/^(roulette|chairs|mafia)/)[1]];
 if(name==='wheelRewards')return ['games','gameSettings','game:wheel'];
 if(/^gang(Mission|MinMission|MaxMission|Puzzle|Chat|Relay)/.test(name))return ['gangs','gangMissions'];
 if(/^gang/.test(name))return ['gangs'];
 if(/^(robbery|centralBank)/.test(name))return ['bankRobbery'];
 if(/^(bank|heist|cashProtection|company)/.test(name))return ['bank'];
 if(/^(voiceEvery|voiceReward|voiceChannel)/.test(name))return ['voiceRewards'];
 if(/^voice/.test(name))return ['voiceRooms'];
 if(/^(ticket|supportRole)/.test(name))return ['tickets'];
 if(/^store/.test(name))return ['store'];
 if(/^rolePanel/.test(name))return ['rolePanel'];
 if(/^(xp|baseXp|level)/.test(name))return ['levels'];
 if(/^(mod|warning)/.test(name)||name==='logs')return ['moderation'];
 if(/^(daily|message|transfer)/.test(name))return ['economy'];
 if(name==='gamePanel'||name==='gameStartRoleIds')return ['games'];
 return [];
}
function allows(site,cfg,key){return key.startsWith('game:')?policy.gameAllowed(site,cfg,key.slice(5)):key.startsWith('heist:')?policy.heistGameAllowed(site,cfg,key.slice(6)):policy.featureAllowed(site,cfg,key);}
function missing(site,cfg,keys){return keys.filter(k=>!allows(site,cfg,k));}
function availablePlans(site,keys){return ['premium','premium_plus'].filter(plan=>keys.every(k=>allows(site,{plan,premiumUntil:Date.now()+86400000},k)));}
function routeRequirements(path){
 if(/\/(store|roles|tickets)\//.test(path))return [{store:'store',roles:'rolePanel',tickets:'tickets'}[path.match(/\/(store|roles|tickets)\//)[1]]];
 if(/\/(questions|killer)(\/|$)/.test(path))return ['gameQuestions'];
 if(path.includes('/gang-missions/'))return ['gangs','gangMissions'];
 if(path.includes('/gangs/'))return ['gangs'];
 if(path.endsWith('/bot-profile'))return ['customBotProfile'];
 if(path.endsWith('/economy/user'))return ['economyAdmin'];
 const send=path.match(/\/send\/(bank|games|tickets|store|roles)$/);if(send)return [send[1]==='roles'?'rolePanel':send[1]];
 return [];
}
function restoreLocked(before,after,site){
 const restore=(feature,section)=>{if(!policy.featureAllowed(site,before,feature))after[section]=structuredClone(before[section]);};
 for(const [f,s] of Object.entries({bank:'bank',economy:'economy',levels:'levels',gangs:'gangs',bankRobbery:'robbery',voiceRooms:'voiceRooms',moderation:'moderation',tickets:'tickets',store:'store',rolePanel:'rolePanel',games:'games'}))restore(f,s);
 restore('customCurrency','currency');restore('moderation','warnings');
 const copy=(feature,obj,keys)=>{if(!policy.featureAllowed(site,before,feature))for(const k of keys)after[obj][k]=before[obj][k];};
 copy('customBranding','branding',['color','customName','customFooter']);
 copy('customBotProfile','branding',['botNickname','avatarUrl','bannerUrl','bio','panelLogoUrl','panelBannerUrl']);
 copy('customBotProfile','store',['thumbnailUrl','bannerUrl','detailBannerUrl']);copy('customBotProfile','nameChange',['bannerUrl']);
 copy('customBranding','store',['accentColor','footer']);copy('customBranding','rolePanel',['footer']);
 copy('voiceRewards','economy',['voiceEveryMinutes','voiceReward','voiceChannelIds']);
 copy('gangMissions','gangs',Object.keys(before.gangs).filter(k=>/mission|puzzle|chat|relay/i.test(k)));
 for(const k of Object.keys(after.channels))if(missing(site,before,requirements(k)).length)after.channels[k]=before.channels[k];
 if(policy.featureAllowed(site,before,'games')){
  if(!policy.featureAllowed(site,before,'gameSettings')){const enabled=after.games.enabled,startRoleIds=after.games.startRoleIds;after.games=structuredClone(before.games);after.games.enabled=enabled;after.games.startRoleIds=startRoleIds;}
  for(const g of policy.GAME_DEFS)if(!policy.gameAllowed(site,before,g.id)){after.games.enabled[g.id]=before.games.enabled[g.id];after.games.quickGameSettings[g.id]=before.games.quickGameSettings[g.id];if(['roulette','chairs','mafia'].includes(g.id)){if(before.games.lobby?.[g.id])after.games.lobby[g.id]=before.games.lobby[g.id];for(const k of Object.keys(before.games))if(k.startsWith(g.id))after.games[k]=structuredClone(before.games[k]);}}
 }
 for(const f of policy.FEATURE_DEFS)if(!policy.featureAllowed(site,before,f.key))after.features[f.key]=before.features[f.key];
 return after;
}
module.exports={requirements,allows,missing,availablePlans,routeRequirements,restoreLocked};
