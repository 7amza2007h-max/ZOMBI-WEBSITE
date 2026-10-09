'use strict';

// Templates are data-only. Permissions use Discord permission names and are
// converted to bitfields by the executor; no destructive operations are used.
const role = (name, color, permissions = []) => ({ name, color, permissions });
const text = (name, allow = [], deny = [], roleAccess = null) => ({ name, type: 0, allow, deny, ...(roleAccess ? { roleAccess } : {}) });
const voice = (name, allow = [], deny = [], roleAccess = null) => ({ name, type: 2, allow, deny, ...(roleAccess ? { roleAccess } : {}) });
const cat = (name, channels, roleAccess = {}) => ({ name, channels, roleAccess });
const staff = ['Owner','Co Owner','Management','Admin','Moderator'];
const adminView = ['Owner','Co Owner','Management','Admin'];
const memberRead = ['Member','Friends','Customer','Gamer','Student','Participant','Employee','VIP'];
const commonRoles = [role('Owner','#e74c3c',[]),role('Admin','#e67e22',['ManageChannels','ManageMessages','KickMembers','BanMembers','ViewAuditLog']),role('Moderator','#3498db',['ManageMessages','KickMembers']),role('VIP','#9b59b6'),role('Member','#95a5a6'),role('Bots','#5865f2')];

const templates = [
 {id:'friends',name:'سيرفر أصدقاء',category:'بسيطة',plan:'free',icon:'🎮',description:'سيرفر خفيف للأصدقاء مع قنوات عامة وألعاب وفويسات.',features:['رتب بسيطة','فويسات للألعاب','قنوات اقتراحات'],roles:[role('Owner','#e74c3c',[]),role('Admin','#e67e22',['ManageChannels','ManageMessages']),role('Friends','#3498db'),role('VIP','#9b59b6'),role('Bots','#5865f2')],categories:[cat('📌・المعلومات',[text('القوانين',[],['SendMessages']),text('الإعلانات',[],['SendMessages'])]),cat('💬・المجتمع',[text('العام',['ViewChannel','SendMessages']),text('الصور-والمقاطع',['ViewChannel','SendMessages']),text('الميمز',['ViewChannel','SendMessages']),text('الاقتراحات',['ViewChannel','SendMessages'])]),cat('🎮・الألعاب',[text('الألعاب',['ViewChannel','SendMessages']),voice('فويس عام'),voice('فويس ألعاب 1'),voice('فويس ألعاب 2'),voice('فويس خاص'),voice('فويس AFK')]),cat('🔒・الإدارة',[text('شات الإدارة',[],['ViewChannel']),text('سجلات الإدارة',[],['ViewChannel'])],{Owner:['ViewChannel'],Admin:['ViewChannel']})]},
 {id:'simple',name:'سيرفر بسيط جدًا',category:'بسيطة',plan:'free',icon:'✨',description:'هيكل أساسي جدًا مناسب للبدء السريع.',features:['قنوات أساسية','رتب قليلة','إدارة خاصة'],roles:[role('Owner','#e74c3c',[]),role('Admin','#e67e22',['ManageChannels','ManageMessages']),role('Member','#3498db'),role('Bots','#5865f2')],categories:[cat('📌・البداية',[text('القوانين',[],['SendMessages']),text('الإعلانات',[],['SendMessages'])]),cat('💬・الشات',[text('العام'),text('الصور'),voice('فويس عام'),voice('فويس 2')]),cat('🔒・الإدارة',[text('شات الإدارة',[],['ViewChannel'])],{Owner:['ViewChannel'],Admin:['ViewChannel']})]},
 {id:'community-small',name:'مجتمع صغير',category:'بسيطة',plan:'free',icon:'🏡',description:'مجتمع صغير مع اقتراحات ومساعدة وفويسات.',features:['مجتمع','اقتراحات','مساعدة'],roles:[role('Owner','#e74c3c',[]),role('Moderator','#3498db',['ManageMessages']),role('Member','#95a5a6'),role('Bots','#5865f2')],categories:[cat('📌・المعلومات',[text('القوانين',[],['SendMessages']),text('الإعلانات',[],['SendMessages'])]),cat('🌍・المجتمع',[text('العام'),text('الصور-والمقاطع'),text('الاقتراحات'),text('المساعدة'),voice('فويس عام'),voice('فويس 2')]),cat('🔒・الفريق',[text('شات الفريق',[],['ViewChannel'])],{Owner:['ViewChannel'],Moderator:['ViewChannel']})]},
 {id:'fivem-general',name:'FiveM عام وRoleplay',category:'FiveM وRoleplay',plan:'premium_plus',icon:'🚔',description:'هيكل RP متكامل مع أقسام الشرطة والإسعاف والعصابات والإدارة.',features:['رتب وظائف','قنوات خاصة حسب الرتبة','دعم وتقارير'],roles:[role('Owner','#e74c3c',[]),role('Co Owner','#c0392b',['ManageChannels']),role('Management','#8e44ad',['ManageChannels','ManageMessages','ViewAuditLog']),role('Admin','#e67e22',['ManageChannels','ManageMessages','KickMembers']),role('Moderator','#3498db',['ManageMessages','KickMembers']),role('Police','#2980b9'),role('EMS','#2ecc71'),role('Gang','#8e44ad'),role('VIP','#f1c40f'),role('Member','#95a5a6'),role('Bots','#5865f2')],categories:[cat('📌・معلومات السيرفر',[text('القوانين',[],['SendMessages']),text('الإعلانات',[],['SendMessages']),text('الأخبار'),text('التحديثات')]),cat('💬・المجتمع',[text('العام'),text('الشاتات'),text('الصور-والمقاطع'),voice('انتظار'),voice('فويس عام 1'),voice('فويس عام 2')]),cat('🎮・FiveM',[text('معلومات الدخول'),text('مشاكل اللعبة'),text('تقديمات الوظائف')]),cat('🚔・الشرطة',[text('إعلانات الشرطة',[],['ViewChannel']),text('نقاشات الشرطة',[],['ViewChannel']),text('تقارير الشرطة',[],['ViewChannel']),voice('فويس الشرطة',[],['ViewChannel'])],{Owner:['ViewChannel'],'Co Owner':['ViewChannel'],Management:['ViewChannel'],Admin:['ViewChannel'],Police:['ViewChannel']}),cat('🚑・الإسعاف',[text('إعلانات الإسعاف',[],['ViewChannel']),text('تقارير الإسعاف',[],['ViewChannel']),voice('فويس الإسعاف',[],['ViewChannel'])],{Owner:['ViewChannel'],'Co Owner':['ViewChannel'],Management:['ViewChannel'],Admin:['ViewChannel'],EMS:['ViewChannel']}),cat('🔫・العصابات',[text('إعلانات العصابات',[],['ViewChannel']),text('تنسيق العصابات',[],['ViewChannel']),voice('فويس العصابات',[],['ViewChannel'])],{Owner:['ViewChannel'],'Co Owner':['ViewChannel'],Management:['ViewChannel'],Admin:['ViewChannel'],Gang:['ViewChannel']}),cat('🎫・الدعم',[text('فتح-تذكرة'),text('الشكاوى'),text('المساعدة')]),cat('🔒・الإدارة',[text('شات الإدارة',[],['ViewChannel']),text('سجلات الإدارة',[],['ViewChannel']),voice('فويس الإدارة',[],['ViewChannel']),voice('اجتماعات خاصة',[],['ViewChannel'])],{Owner:['ViewChannel'],'Co Owner':['ViewChannel'],Management:['ViewChannel'],Admin:['ViewChannel'],Moderator:['ViewChannel']})]},
 {id:'fivem-friends',name:'FiveM للأصدقاء',category:'FiveM وRoleplay',plan:'premium',icon:'🚗',description:'قنوات FiveM خاصة بمجموعة أصدقاء صغيرة.',features:['معلومات دخول','تجارب لعب','فويسات'],roles:[role('Owner','#e74c3c',[]),role('Admin','#e67e22',['ManageChannels','ManageMessages']),role('Driver','#3498db'),role('Friends','#2ecc71'),role('Bots','#5865f2')],categories:[cat('📌・المعلومات',[text('القوانين',[],['SendMessages']),text('معلومات-الدخول')]),cat('🚗・FiveM',[text('العام'),text('الاقتراحات'),text('مشاكل-اللعبة'),voice('فويس عام'),voice('فويس قيادة')]),cat('🔒・الإدارة',[text('شات الإدارة',[],['ViewChannel'])],{Owner:['ViewChannel'],Admin:['ViewChannel']})]},
 {id:'gaming',name:'مجتمع ألعاب متكامل',category:'الألعاب',plan:'premium',icon:'🕹️',description:'مجتمع ألعاب عام مع البحث عن لاعبين وأقسام الألعاب والفعاليات.',features:['Minecraft وRoblox وValorant وFortnite','فعاليات','فويسات جماعية'],roles:[role('Owner','#e74c3c',[]),role('Admin','#e67e22',['ManageChannels','ManageMessages','KickMembers']),role('Moderator','#3498db',['ManageMessages']),role('Event Manager','#16a085',['ManageEvents','ManageMessages']),role('VIP','#9b59b6'),role('Gamer','#2ecc71'),role('Member','#95a5a6'),role('Bots','#5865f2')],categories:[cat('📌・المعلومات',[text('القوانين',[],['SendMessages']),text('الإعلانات',[],['SendMessages'])]),cat('💬・المجتمع',[text('العام'),text('البحث-عن-لاعبين'),text('المقاطع'),text('الاقتراحات')]),cat('🎮・الألعاب',[text('Minecraft'),text('Roblox'),text('Valorant'),text('Fortnite'),voice('ألعاب 1'),voice('ألعاب 2'),voice('ألعاب 3')]),cat('🏆・الفعاليات',[text('الفعاليات'),text('النتائج'),voice('فويس فعاليات')]),cat('🔒・الإدارة',[text('شات الإدارة',[],['ViewChannel']),voice('فويس الإدارة',[],['ViewChannel'])],{Owner:['ViewChannel'],Admin:['ViewChannel'],Moderator:['ViewChannel']})]},
 {id:'minecraft',name:'Minecraft',category:'الألعاب',plan:'premium',icon:'⛏️',description:'سيرفر مجتمع Minecraft للتحديثات والسيرفرات والبناء والبحث عن لاعبين.',features:['أقسام لعب','دعم تقني','فويسات'],roles:[role('Owner','#e74c3c',[]),role('Admin','#e67e22',['ManageChannels','ManageMessages']),role('Builder','#2ecc71'),role('VIP','#9b59b6'),role('Player','#3498db'),role('Bots','#5865f2')],categories:[cat('📌・المعلومات',[text('القوانين',[],['SendMessages']),text('الإعلانات',[],['SendMessages']),text('معلومات-السيرفر')]),cat('⛏️・Minecraft',[text('العام'),text('البناء'),text('المودات'),text('المشاكل-التقنية'),text('البحث-عن-لاعبين'),voice('Survival'),voice('Creative'),voice('مجموعة لعب')]),cat('🔒・الإدارة',[text('شات الإدارة',[],['ViewChannel'])],{Owner:['ViewChannel'],Admin:['ViewChannel']})]},
 {id:'store',name:'متجر إلكتروني وخدمات رقمية',category:'المتاجر والأعمال',plan:'premium_plus',icon:'🛒',description:'قنوات المنتجات والطلبات والتقييمات والدعم مع أقسام خاصة للموظفين.',features:['عملاء وموظفون','طلبات وتقييمات','قنوات داخلية'],roles:[role('Owner','#e74c3c',[]),role('Manager','#8e44ad',['ManageChannels','ManageMessages','ViewAuditLog']),role('Admin','#e67e22',['ManageChannels','ManageMessages']),role('Support','#3498db',['ManageMessages']),role('Customer','#95a5a6'),role('VIP','#f1c40f'),role('Bots','#5865f2')],categories:[cat('📌・المعلومات',[text('القوانين',[],['SendMessages']),text('الإعلانات',[],['SendMessages']),text('الأسعار'),text('المنتجات')]),cat('🛍️・الطلبات',[text('الطلبات'),text('التقييمات'),text('الدعم-الفني'),text('الشكاوى')]),cat('🎧・الدعم',[text('طلب-مساعدة'),voice('انتظار الدعم'),voice('دعم فني')]),cat('🔒・الموظفون',[text('شات الإدارة',[],['ViewChannel']),text('سجلات الطلبات',[],['ViewChannel']),voice('اجتماعات الموظفين',[],['ViewChannel']),voice('الإدارة',[],['ViewChannel'])],{Owner:['ViewChannel'],Manager:['ViewChannel'],Admin:['ViewChannel'],Support:['ViewChannel']})]},
 {id:'support',name:'سيرفر دعم فني',category:'المتاجر والأعمال',plan:'premium',icon:'🎫',description:'بوابة دعم وشكاوى ومتابعة الحالات مع فريق دعم خاص.',features:['طلبات مساعدة','شكاوى','إدارة خاصة'],roles:[role('Owner','#e74c3c',[]),role('Manager','#8e44ad',['ManageChannels','ManageMessages']),role('Support','#3498db',['ManageMessages']),role('Customer','#95a5a6'),role('Bots','#5865f2')],categories:[cat('📌・ابدأ هنا',[text('القوانين',[],['SendMessages']),text('الإعلانات',[],['SendMessages']),text('كيفية-الحصول-على-الدعم')]),cat('🎫・مركز الدعم',[text('فتح-طلب'),text('الأسئلة-الشائعة'),text('الشكاوى'),text('حالة-الطلبات'),voice('انتظار الدعم'),voice('دعم فني')]),cat('🔒・الفريق',[text('شات الفريق',[],['ViewChannel']),text('سجل الحالات',[],['ViewChannel'])],{Owner:['ViewChannel'],Manager:['ViewChannel'],Support:['ViewChannel']})]},
 {id:'events',name:'فعاليات وبطولات',category:'الفعاليات',plan:'premium',icon:'🏆',description:'تسجيل المشاركين وتنظيم البطولات وإعلان النتائج.',features:['تسجيل','تنظيم وحكام','نتائج'],roles:[role('Owner','#e74c3c',[]),role('Organizer','#8e44ad',['ManageChannels','ManageMessages','ManageEvents']),role('Judge','#e67e22',['ManageMessages']),role('Participant','#3498db'),role('VIP','#f1c40f'),role('Bots','#5865f2')],categories:[cat('📌・المعلومات',[text('القوانين',[],['SendMessages']),text('الإعلانات',[],['SendMessages']),text('جدول-الفعاليات')]),cat('📝・التسجيل',[text('التسجيل'),text('الفرق'),text('الأسئلة')]),cat('🏆・البطولات',[text('البطولات'),text('النتائج'),text('الفائزون'),voice('انتظار المشاركين'),voice('ساحة البطولة')]),cat('🔒・المنظمون',[text('شات المنظمين',[],['ViewChannel']),text('تقارير الحكام',[],['ViewChannel']),voice('اجتماع الحكام',[],['ViewChannel'])],{Owner:['ViewChannel'],Organizer:['ViewChannel'],Judge:['ViewChannel']})]},
 {id:'education',name:'تعليم ودورات',category:'التعليم',plan:'premium',icon:'📚',description:'منصة تعليمية مصغرة للدورات والطلاب والأسئلة والدراسة الجماعية.',features:['دروس','أسئلة','قنوات طلاب خاصة'],roles:[role('Owner','#e74c3c',[]),role('Teacher','#2980b9',['ManageMessages']),role('Assistant','#16a085',['ManageMessages']),role('Student','#3498db'),role('VIP Student','#9b59b6'),role('Bots','#5865f2')],categories:[cat('📌・المعلومات',[text('القوانين',[],['SendMessages']),text('الإعلانات',[],['SendMessages']),text('جدول-الدروس')]),cat('📚・التعلم',[text('الدورات'),text('المصادر'),text('الأسئلة'),text('البرمجة-والشروحات')]),cat('👥・الدراسة',[text('نقاش الطلاب'),voice('دراسة جماعية'),voice('مراجعة'),voice('شرح مباشر')]),cat('🔒・المدرسون',[text('غرفة المدرسين',[],['ViewChannel']),text('تقارير الطلاب',[],['ViewChannel']),voice('اجتماع المدرسين',[],['ViewChannel'])],{Owner:['ViewChannel'],Teacher:['ViewChannel'],Assistant:['ViewChannel']})]},
 {id:'team',name:'فريق عمل وإدارة',category:'الإدارة',plan:'premium_plus',icon:'🧑‍💼',description:'تنظيم فريق العمل والاجتماعات والمهام والتقارير مع مساحة خاصة للإدارة.',features:['قنوات مشاريع','مهام وتقارير','اجتماعات خاصة'],roles:[role('Owner','#e74c3c',[]),role('Director','#8e44ad',['ManageChannels','ManageMessages','ViewAuditLog']),role('Manager','#e67e22',['ManageChannels','ManageMessages']),role('Employee','#3498db'),role('Contractor','#95a5a6'),role('Bots','#5865f2')],categories:[cat('📌・الشركة',[text('القوانين',[],['SendMessages']),text('الإعلانات',[],['SendMessages']),text('دليل-الفريق')]),cat('💼・العمل',[text('العام'),text('المهام'),text('المشاريع'),text('التقارير'),text('الموارد')]),cat('🎙️・الاجتماعات',[text('جدول-الاجتماعات'),voice('اجتماع عام'),voice('اجتماع مشروع')]),cat('🔒・الإدارة',[text('إدارة الفريق',[],['ViewChannel']),text('تقارير الإدارة',[],['ViewChannel']),voice('اجتماع الإدارة',[],['ViewChannel'])],{Owner:['ViewChannel'],Director:['ViewChannel'],Manager:['ViewChannel']})]},
 {id:'arabic-community',name:'مجتمع عربي عام',category:'المجتمعات',plan:'free',icon:'🌐',description:'مجتمع عربي متوازن للقوانين والنقاشات والصور والاقتراحات.',features:['قنوات مجتمع','مساعدة','إدارة خاصة'],roles:[role('Owner','#e74c3c',[]),role('Admin','#e67e22',['ManageChannels','ManageMessages']),role('Moderator','#3498db',['ManageMessages']),role('VIP','#9b59b6'),role('Member','#95a5a6'),role('Bots','#5865f2')],categories:[cat('📌・المعلومات',[text('القوانين',[],['SendMessages']),text('الإعلانات',[],['SendMessages']),text('الأخبار')]),cat('🌍・المجتمع',[text('العام'),text('النقاشات'),text('الصور-والمقاطع'),text('الاقتراحات'),text('المساعدة'),voice('فويس عام'),voice('فويس نقاش')]),cat('🔒・الإدارة',[text('شات الإدارة',[],['ViewChannel']),text('سجلات الإدارة',[],['ViewChannel'])],{Owner:['ViewChannel'],Admin:['ViewChannel'],Moderator:['ViewChannel']})]}
];


// Expanded specialist templates (kept data-only so they remain editable).
const specialistTemplates = [
 {id:'police-security',name:'الشرطة والأمن',category:'Roleplay',plan:'premium_plus',icon:'🚓',description:'قيادة وعمليات ودوريات وتدريب وقضايا سرية.',roles:[['Police Commissioner','#8e44ad',['ManageChannels']],['Deputy Commissioner','#9b59b6',[]],['Chief of Police','#c0392b',[]],['Captain','#d35400',[]],['Lieutenant','#e67e22',[]],['Sergeant','#2980b9',[]],['Senior Officer','#3498db',[]],['Officer','#2ecc71',[]],['Recruit','#95a5a6',[]],['Internal Affairs','#34495e',[]],['Detective','#16a085',[]],['Training Officer','#1abc9c',[]],['Dispatcher','#f1c40f',[]],['Civilian','#7f8c8d',[]],['Suspended','#555555',[]],['Muted','#555555',[]],['Bots','#5865f2',[]]], cats:[['معلومات القسم','welcome rules announcements department-news duty-requirements rank-structure'],['العمليات','operations patrol-planning active-incidents incident-reports wanted-list evidence-room case-files dispatch-updates'],['التدريب','academy-information training-schedule training-materials exam-results promotion-requests'],['شؤون الأفراد','leave-requests shift-reports performance-reviews internal-affairs'],['التقديمات والدعم','applications appeals support-tickets'],['القيادة السرية','command-staff officer-evaluations disciplinary-records confidential-cases staff-logs'],['الفويسات','Dispatch Patrol-1 Patrol-2 Training-Room Command-Meeting Interview-Room AFK']]},
 {id:'hospital-ems',name:'الإسعاف والمستشفى',category:'Roleplay',plan:'premium_plus',icon:'🚑',description:'طاقم طبي ومناوبات وتدريب وتقارير محمية.',roles:[['Medical Director','#8e44ad',[]],['Deputy Director','#9b59b6',[]],['Chief Physician','#c0392b',[]],['Physician','#e74c3c',[]],['Surgeon','#d35400',[]],['Emergency Doctor','#e67e22',[]],['Paramedic','#2980b9',[]],['Nurse','#16a085',[]],['Trainee','#95a5a6',[]],['Dispatcher','#f1c40f',[]],['Medical Trainer','#1abc9c',[]],['Member','#7f8c8d',[]],['Muted','#555555',[]],['Bots','#5865f2',[]]], cats:[['معلومات المستشفى','welcome rules announcements medical-guidelines duty-schedule hospital-news'],['الطاقم الطبي','medical-chat emergency-cases patient-reports ambulance-dispatch medical-equipment shift-handover'],['التدريب','training medical-courses exams certifications training-results'],['التقديمات','medical-applications interviews promotion-requests leave-requests'],['الإدارة السرية','management-chat confidential-reports staff-evaluations disciplinary-actions medical-logs'],['الدعم','help-desk complaints appeals'],['الفويسات','Emergency-Dispatch Medical-Team-1 Medical-Team-2 Training-Room Interviews Management-Meeting']]},
 {id:'gangs-wars',name:'العصابات والحروب',category:'Roleplay',plan:'premium',icon:'⚔️',description:'تجنيد وخطط وحروب وتحالفات مع قنوات قيادة خاصة.',roles:[['Gang Director','#8e44ad',[]],['Gang Leader','#c0392b',[]],['Deputy Leader','#e74c3c',[]],['War Commander','#d35400',[]],['Recruiter','#e67e22',[]],['Senior Member','#2980b9',[]],['Member','#3498db',[]],['Recruit','#95a5a6',[]],['Diplomat','#16a085',[]],['Ally','#2ecc71',[]],['Guest','#7f8c8d',[]],['Muted','#555555',[]],['Bots','#5865f2',[]]], cats:[['البداية','welcome rules announcements gang-information recruitment'],['العصابة','gang-chat gang-media gang-plans member-roster training achievements'],['الحروب','war-announcements war-planning battle-reports alliances diplomacy event-results'],['القيادة السرية','leadership-chat recruitment-review disciplinary-reports internal-logs'],['الفويسات','General Squad-1 Squad-2 War-Room Leadership Diplomacy']]},
 {id:'roblox',name:'Roblox',category:'الألعاب',plan:'premium',icon:'🧱',description:'مجتمع Roblox والتطوير والتداول والفعاليات.',roles:[['Community Manager','#8e44ad',[]],['Game Developer','#2980b9',[]],['Builder','#16a085',[]],['Tester','#1abc9c',[]],['Event Host','#d35400',[]],['Content Creator','#e67e22',[]],['VIP','#f1c40f',[]],['Verified Player','#3498db',[]],['Member','#95a5a6',[]],['New Member','#7f8c8d',[]],['Muted','#555555',[]],['Bots','#5865f2',[]]], cats:[['البداية','welcome rules announcements roblox-profile game-updates'],['الألعاب','general-roblox brookhaven blox-fruits adopt-me arsenal tower-defense other-games trade-chat looking-for-players'],['صناعة الألعاب','game-development building scripting bug-reports testing developer-showcase'],['الفعاليات','events event-registration winners'],['الدعم والإدارة','support scam-reports appeals staff-chat moderation-logs'],['الفويسات','Lobby Roblox-1 Roblox-2 Trading Developers Events Staff-Room']]},
 {id:'valorant-competitive',name:'Valorant والتنافس',category:'الألعاب',plan:'premium',icon:'🎯',description:'فرق تنافسية وتدريب وبطولات ونتائج.',roles:[['Competitive Director','#8e44ad',[]],['Tournament Manager','#c0392b',[]],['Team Captain','#d35400',[]],['Coach','#2980b9',[]],['Analyst','#16a085',[]],['Player','#3498db',[]],['Substitute','#95a5a6',[]],['Recruit','#7f8c8d',[]],['VIP','#f1c40f',[]],['Member','#bdc3c7',[]],['Muted','#555555',[]],['Bots','#5865f2',[]]], cats:[['البداية','welcome rules announcements valorant-news rank-verification'],['اللاعبون','general looking-for-team ranked-queue agent-discussion maps-and-strategies clips patch-notes'],['الفرق','team-recruitment team-rosters scrim-schedule match-planning team-results'],['البطولات','tournament-announcements registration brackets match-results disputes'],['الإدارة','staff-chat team-review tournament-staff player-reports moderation-logs'],['الفويسات','Lobby Ranked-Duo Ranked-Squad Team-Alpha Team-Bravo Tournament-Room Coaching Staff-Room']]},
 {id:'digital-services',name:'الخدمات الرقمية',category:'المتاجر والأعمال',plan:'premium',icon:'💻',description:'بيع الخدمات والطلبات والدعم مع فصل بيانات العملاء عن الفريق.',roles:[['Business Manager','#8e44ad',[]],['Technical Manager','#2980b9',[]],['Sales Manager','#c0392b',[]],['Support Lead','#16a085',[]],['Support Agent','#3498db',[]],['Developer','#1abc9c',[]],['Designer','#e67e22',[]],['Sales Agent','#d35400',[]],['Verified Buyer','#2ecc71',[]],['VIP Buyer','#f1c40f',[]],['Buyer','#95a5a6',[]],['Visitor','#7f8c8d',[]],['Muted','#555555',[]],['Bots','#5865f2',[]]], cats:[['المتجر','welcome rules announcements service-list pricing how-to-buy payment-methods delivery-policy'],['الخدمات','digital-products design-services development-services subscriptions custom-orders offers portfolio customer-reviews'],['الطلبات والدعم','new-request order-status delivery-support refund-policy complaints open-ticket'],['الفريق الخاص','sales-team technical-team design-team work-queue staff-announcements staff-logs'],['الفويسات','Sales-Consultation Technical-Support Design-Meeting Team-Meeting']]},
 {id:'design-store',name:'متجر التصاميم',category:'المتاجر والأعمال',plan:'premium',icon:'🎨',description:'طلبات تصاميم ومراجعة جودة وإدارة فريق المصممين.',roles:[['Creative Director','#8e44ad',[]],['Store Manager','#c0392b',[]],['Senior Designer','#2980b9',[]],['Designer','#3498db',[]],['Animator','#16a085',[]],['Video Editor','#1abc9c',[]],['Sales Team','#d35400',[]],['Support Team','#e67e22',[]],['Verified Customer','#2ecc71',[]],['VIP Customer','#f1c40f',[]],['Customer','#95a5a6',[]],['Muted','#555555',[]],['Bots','#5865f2',[]]], cats:[['المتجر','welcome rules announcements design-catalog logo-designs banners profile-icons animated-designs video-editing custom-designs pricing offers'],['الطلبات','order-instructions submit-design-request order-progress completed-work customer-reviews complaints support-tickets'],['المصممون','designer-chat creative-discussion design-references work-queue quality-review'],['الإدارة الخاصة','staff-chat orders-management customer-cases staff-logs'],['الفويسات','Customer-Consultation Design-Review Designers-Room Management-Room']]}
];
for (const spec of specialistTemplates) {
 const roles = [role('Owner','#e74c3c',[]), role('Co Owner','#c0392b',['ManageChannels']), ...spec.roles.map(([n,c,p])=>role(n,c,p)), role('Bots','#5865f2',[])];
 const cats = spec.cats.map(([label, names])=>{
   const isPrivate = /سرية|خاص|القيادة|الإدارة/.test(label);
   const channels = names.split(/\s+/).map(n=> /^(AFK|Lobby|Dispatch|Patrol-|Squad-|Team-|Medical-Team|Emergency-|Training-Room|Command-|Interview|General$|Staff-Room|War-Room|Leadership$|Diplomacy$|Roblox-|Trading$|Developers$|Events$|Ranked-|Tournament-Room|Coaching$|Sales-Consultation|Technical-Support|Design-Meeting|Team-Meeting|Customer-Consultation|Design-Review|Designers-Room|Management-Room)/i.test(n) ? voice(n) : text(n));
   if (isPrivate) return cat(label, channels, Object.fromEntries(['Owner','Co Owner',...spec.roles.filter(([n])=>/Manager|Director|Chief|Leader|Commissioner|Captain|Command|Support Lead|Creative|Store Manager|Staff|Admin/i.test(n)).map(([n])=>n)].map(n=>[n,['ViewChannel']])));
   return cat(label, channels);
 });
 templates.push({id:spec.id,name:spec.name,category:spec.category,plan:spec.plan,icon:spec.icon,description:spec.description,features:['رتب متخصصة','قنوات نصية وفويسات','أقسام خاصة بصلاحيات'],roles,categories:cats});
}


// Role catalog: selectable presets only. These roles are NOT all created for every template.
// Permission presets follow least privilege; sensitive permissions require explicit owner configuration.
const roleCatalog = [
 {group:'الإدارة',roles:[['Owner','#e74c3c',[]],['Co Owner','#c0392b',['ManageChannels']],['Management','#8e44ad',['ViewAuditLog']],['Server Manager','#7f8c8d',['ManageChannels']],['Head Admin','#d35400',['ManageMessages','KickMembers']],['Admin','#e67e22',['ManageMessages','KickMembers']],['Moderator','#3498db',['ManageMessages']],['Senior Moderator','#2980b9',['ManageMessages']],['Helper','#1abc9c',[]],['Staff','#95a5a6',[]]]},
 {group:'التكتات والدعم',roles:[['Ticket Manager','#16a085',[]],['Ticket Team','#1abc9c',[]],['Support Manager','#27ae60',[]],['Support Agent','#2ecc71',[]],['Customer Support','#3498db',[]],['Complaint Handler','#e67e22',[]],['Technical Support','#2980b9',[]]]},
 {group:'العقوبات والحماية',roles:[['Muted','#555555',[]],['Timeout','#7f8c8d',[]],['Warned','#c0392b',[]],['Quarantined','#8e44ad',[]],['Security Team','#2c3e50',[]],['Log Viewer','#95a5a6',[]],['Appeals Reviewer','#d35400',[]]]},
 {group:'التقديمات والموارد البشرية',roles:[['Application Reviewer','#f39c12',[]],['Recruitment Team','#e67e22',[]],['HR Manager','#8e44ad',[]],['Interviewer','#2980b9',[]],['Accepted Applicant','#2ecc71',[]],['Rejected Applicant','#7f8c8d',[]],['Trial Staff','#16a085',[]]]},
 {group:'الفعاليات والمجتمع',roles:[['Event Manager','#16a085',[]],['Event Host','#27ae60',[]],['Participant','#3498db',[]],['Winner','#f1c40f',[]],['Content Creator','#e84393',[]],['Partner','#9b59b6',[]],['Verified','#2ecc71',[]],['Member','#95a5a6',[]],['VIP','#9b59b6',[]],['Booster','#ff73fa',[]]]},
 {group:'الاقتصاد والمستويات',roles:[['Economy Manager','#f1c40f',[]],['Rich','#f39c12',[]],['Level 10','#2ecc71',[]],['Level 25','#16a085',[]],['Level 50','#2980b9',[]],['Level 100','#8e44ad',[]]]},
 {group:'FiveM وRoleplay',roles:[['Police Chief','#2c3e50',[]],['Police Commander','#34495e',[]],['Police Officer','#2980b9',[]],['Detective','#3498db',[]],['EMS Chief','#27ae60',[]],['Paramedic','#2ecc71',[]],['Firefighter','#e67e22',[]],['Gang Leader','#8e44ad',[]],['Gang Member','#9b59b6',[]],['Mechanic','#d35400',[]],['Civilian','#95a5a6',[]],['Whitelisted','#1abc9c',[]]]},
 {group:'الألعاب',roles:[['Gamer','#2ecc71',[]],['Minecraft Player','#27ae60',[]],['Builder','#16a085',[]],['Roblox Player','#e84393',[]],['Valorant Player','#c0392b',[]],['Fortnite Player','#3498db',[]],['Team Captain','#f39c12',[]],['Coach','#2980b9',[]]]},
 {group:'المتجر والمحتوى',roles:[['Store Manager','#8e44ad',[]],['Sales Team','#d35400',[]],['Customer','#95a5a6',[]],['Verified Customer','#2ecc71',[]],['Designer','#3498db',[]],['Senior Designer','#2980b9',[]],['Video Editor','#1abc9c',[]],['Streamer','#e84393',[]],['YouTuber','#c0392b',[]],['Artist','#9b59b6',[]]]},
 {group:'الشركة والبرمجة والتعليم',roles:[['CEO','#2c3e50',[]],['Executive','#34495e',[]],['Employee','#3498db',[]],['Department Manager','#8e44ad',[]],['Developer','#2980b9',[]],['Senior Developer','#16a085',[]],['Frontend Developer','#3498db',[]],['Backend Developer','#2c3e50',[]],['Designer','#9b59b6',[]],['Teacher','#e67e22',[]],['Student','#2ecc71',[]],['Course Instructor','#16a085',[]]]},
 {group:'رتب عامة',roles:[['Friends','#3498db',[]],['Guest','#bdc3c7',[]],['New Member','#95a5a6',[]],['Bot','#5865f2',[]],['Bots','#5865f2',[]]]}
].map(group=>({...group,roles:group.roles.map(([name,color,permissions])=>({name,color,permissions}))}));

// Expanded shared systems. Each template receives only relevant shared modules;
// private categories use role overwrites rather than relying on channel names.
const toText = names => names.trim().split(/\s+/).map(n => text(n));
const toVoice = names => names.trim().split(/\s+/).map(n => voice(n));
const hasRole = (t,n) => t.roles.some(r=>r.name.toLowerCase()===n.toLowerCase());
const ensureRole = (t,n,color='#7f8c8d',permissions=[]) => { if(!hasRole(t,n)) t.roles.push(role(n,color,permissions)); };
const staffNames = ['Owner','Co Owner','Management','Admin','Moderator','Manager','Server Manager','Head Admin','Support Manager','Support','Support Agent','Ticket Team','Application Reviewer','Event Manager','Partnership Manager','Log Viewer','Bots'];
const privateAccess = t => Object.fromEntries(staffNames.filter(n=>hasRole(t,n)).map(n=>[n,['ViewChannel']]));
const addCat = (t,name,channels,priv=false) => { if(!t.categories.some(c=>c.name===name)) t.categories.push(cat(name,channels,priv?privateAccess(t):{})); };
for (const t of templates) {
  const key = `${t.id} ${t.name} ${t.category}`.toLowerCase();
  const isTiny = /^(friends|simple)$/.test(t.id);
  const roleplay = /fivem|roleplay|police|ems|gang|city/.test(key);
  const gaming = /gaming|game|minecraft|roblox|valorant|fortnite|competitive|esports/.test(key);
  const store = /store|shop|digital|sales|design-store|services/.test(key);
  const education = /education|study|school|course|learning|تعليم|دراسة/.test(key);
  const work = /work|company|business|programming|developer|team|corporate/.test(key);
  const event = /event|tournament|competition|مسابق|فعالي/.test(key);
  const community = /community|community-small|large|مجتمع/.test(key);
  const support = /support|ticket|store|shop|digital/.test(key);

  // Preserve template-specific roles; only add roles that are relevant to this template.
  if (!isTiny) ensureRole(t,'Co Owner','#c0392b',[]);
  if (!isTiny) ensureRole(t,'Management','#8e44ad',[]);
  if (!isTiny && !roleplay && !store && !education && !work) ensureRole(t,'Senior Moderator','#2980b9',[]);
  if (support) { ensureRole(t,'Support Manager','#27ae60',[]); ensureRole(t,'Support Agent','#16a085',[]); ensureRole(t,'Ticket Team','#1abc9c',[]); }
  if (event || gaming) { ensureRole(t,'Event Manager','#16a085',[]); ensureRole(t,'Event Host','#27ae60',[]); }
  if (store) { ensureRole(t,'Store Manager','#8e44ad',[]); ensureRole(t,'Customer','#95a5a6',[]); }
  if (education) { ensureRole(t,'Teacher','#e67e22',[]); ensureRole(t,'Student','#2ecc71',[]); }
  if (!isTiny) ensureRole(t,'Log Viewer','#95a5a6',[]);
  if (!hasRole(t,'Bots')) ensureRole(t,'Bots','#5865f2',[]);

  const leaders = ['Owner','Co Owner','Management','Manager','Server Manager','Head Admin','Admin','Director','Department Director','Department Manager','Event Director','Event Manager','Store Manager','Support Manager','Head Support','Police Chief','EMS Chief','Gang Leader','CEO','Executive','HR Manager'];
  const access = names => Object.fromEntries(names.filter(n=>hasRole(t,n)).map(n=>[n,['ViewChannel']]));
  const privateLeads = access(leaders);
  const privateStaff = access([...leaders,'Moderator','Senior Moderator','Support Agent','Ticket Team','Organizer','Event Host','Teacher']);
  const addIfMissing = (name, channels, roleAccess={}) => { if(!t.categories.some(c=>c.name===name)) t.categories.push(cat(name,channels,roleAccess)); };
  const tx = names => names.map(n=>text(n));
  const vx = names => names.map(n=>voice(n));

  if (!isTiny) addIfMissing('👑・Owner',[
    ...tx(['owner-chat','owner-decisions','owner-reports','owner-logs']), voice('Owner Voice')
  ],access(['Owner']));
  if (!isTiny) addIfMissing('🏛️・الإدارة العليا',[
    ...tx(['management-chat','management-plans','management-reports','management-announcements']), voice('Management Voice')
  ],privateLeads);
  if (!isTiny) addIfMissing('🛡️・المشرفون',[
    ...tx(['supervisor-chat','supervisor-tasks','supervisor-reports','supervisor-complaints']), voice('Supervisor Voice')
  ],access(['Owner','Co Owner','Management','Admin','Moderator','Senior Moderator']));
  if (!isTiny) addIfMissing('🔨・الإدارة التنفيذية',[
    ...tx(['admin-chat','admin-tasks','admin-reports','admin-announcements']), voice('Admin Voice')
  ],access(['Owner','Co Owner','Management','Admin']));

  if (support) addIfMissing('🎫・الدعم والتذاكر',[
    ...tx(['ticket-panel','support-chat','support-tasks','support-reports','ticket-logs','ticket-transcripts']), voice('Support Voice')
  ],privateStaff);
  if (event || gaming || community || roleplay) addIfMissing('🎉・الفعاليات',[
    ...tx(['event-chat','event-announcements','event-schedule','event-registration','event-results','event-ideas','event-submissions','event-participants']),
    ...tx(['event-staff-chat','event-management']), ...vx(['Event Main','Event Participants','Event Room 1','Event Room 2','Event Staff','Event Management'])
  ],privateStaff);

  if (!isTiny) {
    const logNames = ['logs-members','logs-messages','logs-roles','logs-channels','logs-moderation','logs-voice','logs-bot'];
    if (support) logNames.push('logs-tickets');
    if (event || gaming || community || roleplay) logNames.push('logs-events');
    addIfMissing('📋・اللوقات والسجلات',tx(logNames),access(['Owner','Co Owner','Management','Admin','Log Viewer']));
  }

  if (roleplay) {
    ensureRole(t,'Police Chief','#2c3e50',[]); ensureRole(t,'Police Officer','#2980b9',[]);
    ensureRole(t,'EMS Chief','#27ae60',[]); ensureRole(t,'Paramedic','#2ecc71',[]);
    ensureRole(t,'Gang Leader','#8e44ad',[]); ensureRole(t,'Gang Member','#9b59b6',[]);
    addIfMissing('🚔・الشرطة', [...tx(['police-announcements','police-operations','police-reports','police-evidence','police-training','police-leadership']),...vx(['Police Operations','Police Patrol','Police Leadership'])],access(['Owner','Co Owner','Management','Police Chief','Police Officer']));
    addIfMissing('🚑・الإسعاف', [...tx(['ems-announcements','ems-calls','ems-reports','ems-training','ems-leadership']),...vx(['EMS Dispatch','EMS Team','EMS Leadership'])],access(['Owner','Co Owner','Management','EMS Chief','Paramedic']));
    addIfMissing('🔫・العصابات والعائلات', [...tx(['gang-announcements','gang-chat','gang-plans','gang-reports','gang-leadership']),...vx(['Gang Meeting','Gang Operations','Gang Leadership'])],access(['Owner','Co Owner','Management','Gang Leader','Gang Member']));
    addIfMissing('🏛️・الحكومة والقضاء', [...tx(['government-announcements','government-decisions','court-cases','legal-reports','government-leadership']),...vx(['Government Meeting','Court Room'])],privateLeads);
    addIfMissing('📝・التقديمات والمقابلات',[...tx(['applications-panel','applications-review','interview-schedule','applications-results']),...vx(['Interview Room'])],privateStaff);
    addIfMissing('🏙️・إدارة المدينة',[...tx(['city-management','city-plans','city-reports','city-complaints']),...vx(['City Management Voice'])],privateLeads);
    addIfMissing('🚨・الشكاوى والدعم',[...tx(['city-complaints','player-reports','support-chat','appeals']),...vx(['Support Voice'])],privateStaff);
  }
  if (gaming) addIfMissing('🏆・الألعاب والبطولات',[...tx(['game-chat','looking-for-players','team-recruitment','tournament-announcements','tournament-registration','tournament-results','team-management']),...vx(['Gaming Lobby','Team Alpha','Team Bravo','Tournament Room'])],privateStaff);
  if (store) addIfMissing('🛍️・المنتجات والطلبات',[...tx(['products','offers','order-status','sales-team-chat','customer-service','refund-requests','inventory','finance-reports']),...vx(['Customer Service','Staff Meeting'])],access(['Owner','Co Owner','Management','Store Manager','Manager','Support Manager','Support Agent']));
  if (education) addIfMissing('📚・التعليم والدراسة',[...tx(['subjects','teacher-chat','student-questions','lessons','revision','study-groups','academic-reports','academic-leadership']),...vx(['Study Room 1','Study Room 2','Lesson Room','Teacher Meeting'])],privateStaff);
  if (work) addIfMissing('💼・فريق العمل',[...tx(['project-management','team-tasks','work-reports','department-chat','hr-private','meeting-agenda','management-decisions']),...vx(['Work Meeting','Project Room','Leadership Meeting'])],privateStaff);

  // Temporary voice is only a channel scaffold in this dashboard; no runtime handler is implied.
  if (!isTiny) {
    const tempVoices = roleplay ? ['➕・Create Room','Police Temporary','EMS Temporary','Gang Temporary','Interview Temporary']
      : gaming ? ['➕・Create Room','Gaming Temporary','Team Temporary','Tournament Temporary']
      : store ? ['➕・Create Room','Customer Service Temporary','Staff Meeting Temporary']
      : education ? ['➕・Create Room','Study Temporary','Lesson Temporary']
      : work ? ['➕・Create Room','Work Temporary','Meeting Temporary']
      : event ? ['➕・Create Room','Event Participants Temporary','Event Staff Temporary']
      : ['➕・Create Room','General Temporary','Private Temporary'];
    addIfMissing('🔊・Temporary Rooms',vx(tempVoices),{});
  }

  // Define per-channel access, not only category-wide access. Every private channel
  // gets explicit role allow-lists; public announcement/log channels get least privilege.
  const roleNames = new Set(t.roles.map(r=>r.name));
  const namesPresent = names => Object.fromEntries(names.filter(n=>roleNames.has(n)).map(n=>[n,['ViewChannel']]));
  const ownerOnly = namesPresent(['Owner']);
  const leadership = namesPresent(['Owner','Co Owner','Management','Server Manager','Director','Department Director','CEO','Executive']);
  const managementAndAdmins = namesPresent(['Owner','Co Owner','Management','Server Manager','Head Admin','Admin']);
  const moderators = namesPresent(['Owner','Co Owner','Management','Head Admin','Admin','Moderator','Senior Moderator']);
  for (const category of t.categories) {
    const catName = category.name.toLowerCase();
    for (const ch of category.channels) {
      const n = ch.name.toLowerCase();
      // Keep the category private by default, then narrow sensitive channels further.
      if (/owner/.test(catName) || /^owner-/.test(n) || n === 'owner voice') ch.roleAccess = (n==='owner-logs') ? namesPresent(['Owner','Bots']) : ownerOnly;
      else if (/logs|سجلات|اللوقات/.test(catName) || /^logs-|ticket-logs|ticket-transcripts/.test(n)) {
        ch.roleAccess = namesPresent(['Owner','Co Owner','Management','Log Viewer','Bots']);
        ch.allow = ch.type === 2 ? [] : [];
        ch.deny = [...new Set([...(ch.deny||[]),'SendMessages','AddReactions','AttachFiles','CreatePublicThreads','CreatePrivateThreads'])];
      } else if (/event-management|event-leaders|event-staff-chat|event management|event staff/i.test(n)) {
        ch.roleAccess = namesPresent(['Owner','Co Owner','Management','Event Director','Event Manager','Head Organizer','Organizer','Event Staff','Event Host']);
      } else if (/leadership|leaders|-command|^hr-private|finance-reports|academic-leadership|management-decisions|government-decisions|court-cases|legal-reports/.test(n)) {
        ch.roleAccess = leadership;
      } else if (/supervisor|مشرف/.test(catName)) {
        ch.roleAccess = moderators;
      } else if (/الإدارة التنفيذية|admin/.test(catName)) {
        ch.roleAccess = managementAndAdmins;
      } else if (/الإدارة العليا|management/.test(catName)) {
        ch.roleAccess = leadership;
      } else if (/owner|management|leadership|private|staff|موظف|الفريق|support|الدعم|الشرطة|الإسعاف|العصابات|الحكومة|القضاء|المقابلات|إدارة المدينة|المشاريع|فريق العمل|التعليم والدراسة|المتجر|الطلبات/.test(catName)) {
        ch.roleAccess = category.roleAccess && Object.keys(category.roleAccess).length ? category.roleAccess : privateAccess(t);
      } else if (/announcements|الإعلانات|النتائج|الأخبار|التحديثات|products|offers|المنتجات|الأسعار/.test(n)) {
        ch.roleAccess = {};
        ch.publicReadOnly = true;
        ch.writeRoles = ['Owner','Co Owner','Management','Admin','Moderator','Event Manager','Event Host','Store Manager','Manager','Teacher','Organizer'].filter(r=>roleNames.has(r));
        ch.deny = [...new Set([...(ch.deny||[]),'SendMessages'])];
        ch.allow = [...new Set([...(ch.allow||[]),'ViewChannel','ReadMessageHistory'])];
      } else if (/registration|التسجيل|suggest|اقتراح|student-questions|واجب|submission|تسليم/.test(n)) {
        ch.roleAccess = null; // Public/participant access; category policy remains the default.
      }
      // Avoid accidental Administrator grants in generated templates.
      ch.roleAccess = ch.roleAccess && Object.fromEntries(Object.entries(ch.roleAccess).filter(([r])=>roleNames.has(r)));
    }
  }

  t.roleCatalog = roleCatalog.map(g=>({...g,roles:g.roles.map(r=>({...r}))}));
  t.version = 4;
  t.modules = { moderation:true, logs:'channel-structure-only-unless-connected', applications:'channel-structure-only', suggestions:'channel-structure-only', tickets:support?'channel-structure-only':false, events:(event||gaming||community||roleplay)?'channel-structure-only':false, temporaryVoice:'runtime-handler-with-persistent-owner-state', economy:false };
}
const byId = new Map(templates.map(t => [t.id, t]));
function cloneTemplate(id) { const t = byId.get(String(id)); return t ? JSON.parse(JSON.stringify(t)) : null; }
module.exports = { templates, cloneTemplate, roleCatalog };
