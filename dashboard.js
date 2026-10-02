'use strict';

(() => {
  const match = location.pathname.match(/^\/dashboard\/(\d{15,25})\/?$/);
  if (!match) return;

  const guildId = match[1];
  const main = document.querySelector('main');
  if (!main) return;

  document.body.classList.add('zombi-dashboard');

  const pageDefs = {
    permissions: {label:'الرتب والصلاحيات',icon:'🛡️',desc:'تحكم عربي كامل بصلاحيات الرتب والقنوات وحماية الروابط والوسائط.'},
    warnings: {label:'التحذيرات',icon:'⚠️',desc:'روم التحذيرات، IDs الرتب وإضافة مستويات التحذير؛ الإتاحة حسب خطة السيرفر.'},
    logs: {label:'سجل السيرفر',icon:'📋',desc:'اختيار روم Log وتحديد الأحداث التي تُسجّل.'},
    overview: { label: 'الرئيسية', icon: '⌂', desc: 'نظرة عامة وإعدادات ZOMBI الأساسية لهذا السيرفر.' },
    welcome: { label: 'الترحيب', icon: '👋', desc: 'صورة الترحيب، روم الترحيب، روم القوانين وروابط الأقسام للعضو الجديد.' },
    economy: { label: 'الاقتصاد', icon: '◈', desc: 'العملة، المكافآت، التحويلات وإدارة اقتصاد السيرفر.' },
    members: { label: 'الأعضاء', icon: '♟', desc: 'أرصدة الأعضاء، Timeout بالرتب، وban 💥 مع التحكم بالشاتات.' },
    xp: { label: 'XP والبروفايل', icon: '🏆', desc: 'Chat XP وVoice XP والمواسم ورتب المستويات وإعدادات #p و#top.' },
    store: { label: 'المتجر', icon: '◆', desc: 'متجر الرتب، الأسعار، المميزات وشكل لوحة المتجر.' },
    games: { label: 'الألعاب', icon: '◉', desc: 'تشغيل الألعاب، الجولات، الوقت، الجوائز والروليت.' },
    'game-content': { label: 'محتوى الألعاب', icon: '▤', desc: 'الأسئلة والكلمات والمحتوى الذي تستخدمه الألعاب.' },
    killer: { label: 'من القاتل', icon: '⌕', desc: 'إنشاء وتعديل قضايا من القاتل من الداشبورد.' },
    city: { label: 'البنك', icon: '▰', desc: 'لوحة البنك، الوظائف، الشركات والقروض.' },
    heist: { label: 'النهب والحماية', icon: '🎯', desc: 'تحديات النهب، السجن، الكفالة وحماية الكاش.' },
    gangs: { label: 'العصابات والمهمات', icon: '🏴', desc: 'العصابات، الأعضاء، الخزنة وقوالب المهمات.' },
    robbery: { label: 'البنك المركزي', icon: '🚨', desc: 'فتح السرقة، المشاركون، التجهيزات والجوائز.' },
    director: { label: 'City Director', icon: '🌆', desc: 'أحداث مدينة حية، تشغيل تلقائي، جوائز وقوالب أحداث قابلة للتعديل.' },
    rules: { label: 'القوانين', icon: '📜', desc: 'لوحة قوانين تفاعلية؛ كل نوع يعرض قوانينه برسالة خاصة للعضو فقط.' },
    suggestions: { label: 'الاقتراحات', icon: '💡', desc: 'عدة شاتات للاقتراحات، نوع مستقل لكل شات، Modal وتصويت ولوحات ZOMBI.' },
    event: { label: 'الإيفنت', icon: '🎉', desc: 'نقاط الإيفنت ونقاط الترقية المستقلة، الشاتات والرتب وحد الترقية.' },
    roles: { label: 'الرتب', icon: '🔔', desc: 'Self Roles + رتبة تلقائية للعضو الجديد عند دخوله السيرفر.' },
    name: { label: 'تغيير الاسم', icon: '✏️', desc: 'لوحة تغيير الاسم ونافذة إدخال الاسم داخل السيرفر.' },
    tickets: { label: 'التذاكر', icon: '▣', desc: 'لوحة التذاكر، أنواعها، الرتب والصلاحيات.' },
    applications: { label: 'التقديمات', icon: '📝', desc: 'إنشاء نماذج تقديم متعددة، تحديد الشاتات والأسئلة ورتب المراجعة.' },
    'staff-stats': {label:'إحصائيات الإدارة',icon:'📊',desc:'الدوام والتكتات والتقييم والنقاط لكل إداري.'},
    'staff-insights': {label:'إعدادات الملفات والتقييم',icon:'🏆',desc:'رتب الملفات والمشاهدة والنقاط والترقيات وتقييم التكتات.'},
    'staff-admin': {label:'قبول ورفض الإدارة',icon:'✅',desc:'أوامر قبول ورفض المتقدمين للإدارة والشات والرتب.'},
    'staff-event-leave': {label:'إجازات الإيفنت',icon:'🏖️',desc:'لوحة إجازات الإيفنت ومراجعتها وإشعار انتهائها.'},
    'staff-duty': { label: 'دوام الإدارة', icon: '🕐', desc: 'لوحة دوام الإدارة وتقارير النشاط والوجود.' },
    'staff-event': { label: 'طلب فعالية', icon: '🎉', desc: 'لوحة طلب فعالية وشات مراجعة مستقل ورتب قبول/رفض.' },
    'staff-leave': { label: 'طلب إجازة', icon: '🏖️', desc: 'لوحة طلب إجازة وشات مراجعة مستقل ورتب قبول/رفض.' },
    guide: { label: 'دليل السيرفر', icon: '🧭', desc: 'لوحة اختصارات تنقل الأعضاء مباشرة إلى الرومات التي تختارها.' },
    music: { label: 'الموسيقى', icon: '🎵', desc: 'تشغيل YouTube والتحكم بالصوت والطابور من شات أي فويس، حتى الرومات المؤقتة.' },
    voice: { label: 'الرومات الصوتية', icon: '◐', desc: 'الرومات المؤقتة ومكافآت الفويس وقنوات التحكم.' },
    premium: { label: 'الاشتراك والتخصيص', icon: '💎', desc: 'الاشتراك والحدود وتخصيص صورة البوت والبنر والـNickname لكل سيرفر.' }
  };

  const groups = [
    ['التحكم', ['overview', 'economy', 'members', 'xp', 'store']],
    ['الألعاب والمدينة', ['games', 'game-content', 'killer', 'city', 'heist', 'gangs', 'robbery', 'director', 'suggestions', 'event']],
    ['الأنظمة', ['permissions', 'warnings', 'logs', 'welcome', 'rules', 'guide', 'roles', 'name', 'tickets', 'applications', 'music', 'voice']],
    ['إدارة الطاقم', ['staff-stats', 'staff-insights', 'staff-duty', 'staff-admin', 'staff-event', 'staff-leave', 'staff-event-leave']],
    ['الاشتراك', ['premium']]
  ];

  const currentFromUrl = () => {
    let s = new URLSearchParams(location.search).get('section') || 'overview';
    if(s==='staff-management')s='staff-duty';
    return pageDefs[s] ? s : 'overview';
  };

  const originalChildren = [...main.childNodes];
  const content = document.createElement('div');
  content.className = 'z-dashboard-content';
  originalChildren.forEach(node => content.appendChild(node));

  const sidebar = document.createElement('aside');
  sidebar.className = 'z-dashboard-sidebar';
  sidebar.innerHTML = `
    <div class="z-side-brand">
      <div class="z-side-logo">Z</div>
      <div><strong>ZOMBI</strong><small>COMMAND CENTER</small></div>
    </div>
    <div class="z-side-status"><span></span> متصل بالبوت</div>
    <nav class="z-side-nav"></nav>
    <a class="z-side-back" href="/dashboard">← اختيار سيرفر آخر</a>`;

  const nav = sidebar.querySelector('.z-side-nav');
  groups.forEach(([title, ids]) => {
    const group = document.createElement('div');
    group.className = 'z-nav-group';
    const h = document.createElement('div');
    h.className = 'z-nav-title';
    h.textContent = title;
    group.appendChild(h);
    ids.forEach(id => {
      const def = pageDefs[id];
      const a = document.createElement('a');
      a.href = `/dashboard/${guildId}?section=${id}`;
      a.dataset.section = id;
      a.innerHTML = `<span class="z-nav-icon">${def.icon}</span><b>${def.label}</b>`;
      a.addEventListener('click', ev => {
        ev.preventDefault();
        history.pushState({}, '', a.href);
        render(id);
        window.scrollTo({ top: 0, behavior: 'instant' });
      });
      group.appendChild(a);
    });
    nav.appendChild(group);
  });

  main.className = 'z-dashboard-shell';
  main.append(content, sidebar);

  // HARD SECTION ROUTER: keeps every dashboard section isolated even if a later
  // optional UI enhancement throws. This is intentionally installed early.
  const inferStandalonePage = (el) => {
    if (!el) return 'overview';
    if (el.dataset?.zPage) return el.dataset.zPage;
    if (el.classList?.contains('rules-system-panel')) return 'rules';
    if (el.classList?.contains('city-director-panel')) return 'director';
    if (el.classList?.contains('event-system-panel')) return 'event';
    if (el.classList?.contains('command-sync') || el.classList?.contains('legacy-panel')) return 'overview';
    const title = String(el.querySelector?.(':scope > h2, :scope > h3')?.textContent || '');
    const pairs = [
      ['إحصائيات الإدارة','staff-stats'],['إعدادات الملفات','staff-insights'],['دوام الإدارة','staff-duty'],['قبول ورفض','staff-admin'],
      ['طلب فعالية','staff-event'],['إجازات الإيفنت','staff-event-leave'],['طلب إجازة','staff-leave'],['نظام التقديمات','applications'],
      ['محتوى الألعاب','game-content'],['من القاتل','killer'],['أنواع التذاكر','tickets'],['متجر الرتب','store'],['Self Roles','roles'],
      ['إدارة أرصدة','members'],['قوالب مهمات العصابات','gangs'],['العصابات الحالية','gangs'],['قوالب City Director','director'],
      ['ZOMBI Rules Center','rules'],['Premium','premium'],['حدود الخطة','premium'],['تخصيص بروفايل البوت','premium']
    ];
    for (const [text,page] of pairs) if (title.includes(text)) return page;
    return 'overview';
  };

  const hardRenderSection = (requested) => {
    let section = pageDefs[requested] ? requested : 'overview';
    try {
      nav.querySelectorAll('a[data-section]').forEach(a => {
        const active = a.dataset.section === section;
        a.classList.toggle('active', active);
        if (active) a.setAttribute('aria-current','page'); else a.removeAttribute('aria-current');
      });
      const h1 = pageHeader?.querySelector('h1');
      const p = pageHeader?.querySelector('p');
      if (h1) h1.textContent = pageDefs[section].label;
      if (p) p.textContent = pageDefs[section].desc;

      const form = content.querySelector(`form[action="/dashboard/${guildId}/settings"]`);
      const groups = form ? [...form.querySelectorAll(':scope > .z-settings-page')] : [];
      const activeGroup = groups.find(g => g.dataset.settingsPage === section);
      if (form) form.classList.toggle('z-section-hidden', !activeGroup);
      groups.forEach(g => g.classList.toggle('z-section-hidden', g !== activeGroup));
      if (form && activeGroup) {
        const saveBar = form.querySelector(':scope > .z-save-bar');
        if (saveBar) saveBar.classList.toggle('z-section-hidden', section === 'permissions');
      }

      [...content.querySelectorAll(':scope > section.panel, :scope > .z-page-extra')].forEach(el => {
        if (el === form) return;
        const page = inferStandalonePage(el);
        el.dataset.zPage = page;
        el.classList.toggle('z-section-hidden', page !== section);
      });

      // Some standalone panels can be nested one level deeper by older builds.
      [...content.querySelectorAll('[data-z-page]')].forEach(el => {
        if (el === form || el.closest('.z-settings-page')) return;
        el.classList.toggle('z-section-hidden', el.dataset.zPage !== section);
      });
    } catch (error) {
      console.error('ZOMBI hard section router:', error);
    }
  };
  window.__zombiRenderSection = hardRenderSection;
  document.addEventListener('click', event => {
    const a = event.target.closest?.('.z-side-nav a[data-section]');
    if (!a) return;
    event.preventDefault();
    const section = a.dataset.section || 'overview';
    history.pushState({}, '', `/dashboard/${guildId}?section=${encodeURIComponent(section)}`);
    hardRenderSection(section);
    window.scrollTo({top:0,behavior:'auto'});
  }, true);
  window.addEventListener('popstate', () => hardRenderSection(currentFromUrl()));
  setTimeout(() => hardRenderSection(currentFromUrl()), 0);
  setTimeout(() => hardRenderSection(currentFromUrl()), 250);

  const oldHead = content.querySelector('.dash-head');
  const guildNameText = oldHead?.querySelector('h1')?.textContent?.trim() || 'ZOMBI Server';
  const escapeNode=document.createElement('span');escapeNode.textContent=guildNameText;const guildName=escapeNode.innerHTML;
  const guildMeta = oldHead?.querySelector('p')?.innerHTML || '';
  const guildIcon = oldHead?.querySelector('.guild-icon')?.getAttribute('src') || '';
  if (oldHead) oldHead.classList.add('z-hidden-source');

  const pageHeader = document.createElement('section');
  pageHeader.className = 'z-page-heading';
  pageHeader.innerHTML = `
    <div>
      <div class="z-page-kicker">${guildName}${guildMeta ? ` <span>•</span> ${guildMeta}` : ''}</div>
      <h1></h1>
      <p></p>
    </div>
    ${guildIcon ? `<img src="${guildIcon}" alt="">` : ''}`;
  content.prepend(pageHeader);

  // Keep announcement and the "this server only" note on overview.
  [...content.children].forEach(el => {
    if (el.classList?.contains('tabs-note') || el.classList?.contains('warn')) {
      if (!el.closest('form')) el.dataset.zPage = 'overview';
    }
  });

  const warningLevels=content.querySelector('#warning-levels');
  const renumberWarnings=()=>warningLevels?.querySelectorAll('.warning-level-row').forEach((row,n)=>{row.querySelector('label').firstChild.textContent=`التحذير ${n+1} — ID الرتبة`;});
  content.querySelector('#warning-add-level')?.addEventListener('click',()=>{
    const row=document.createElement('div');row.className='form-grid warning-level-row';
    const label=document.createElement('label');label.append(document.createTextNode(''));
    const input=document.createElement('input');input.name='warningRoleIds';input.inputMode='numeric';input.pattern='[0-9]{15,25}';input.placeholder='ID الرتبة';label.append(input);
    const remove=document.createElement('button');remove.type='button';remove.className='btn warning-remove-level';remove.textContent='حذف المستوى';row.append(label,remove);warningLevels.append(row);renumberWarnings();
  });
  warningLevels?.addEventListener('click',event=>{const button=event.target.closest('.warning-remove-level');if(!button||button.disabled)return;button.closest('.warning-level-row').remove();renumberWarnings();});

  const settingsForm = content.querySelector(`form[action="/dashboard/${guildId}/settings"]`);
  const settingsGroups = new Map();
  const ensureSettingsGroup = page => {
    if (!settingsGroups.has(page)) {
      const wrap = document.createElement('div');
      wrap.className = 'z-settings-page';
      wrap.dataset.settingsPage = page;
      settingsGroups.set(page, wrap);
    }
    return settingsGroups.get(page);
  };

  const headingPage = text => {
    text = String(text || '');
    if (text.includes('إدارة الرتب والصلاحيات المتقدمة')) return 'permissions';
    if (text.includes('⚠️ التحذيرات')) return 'warnings';
    if (text.includes('سجل السيرفر Log') || text.includes('مركز لوقات ZOMBI') || text.includes('لوقات ZOMBI')) return 'logs';
    if (text.includes('تحديد كل الرومات')) return 'overview';
    if (text.includes('نظام الترحيب')) return 'welcome';
    if (text.includes('تشغيل وإيقاف')) return 'overview';
    if (text.includes('دليل السيرفر التفاعلي')) return 'guide';
    if (text.includes('ZOMBI City Director')) return 'director';
    if (text.includes('ZOMBI Suggestions Center')) return 'suggestions';
    if (text.includes('ZOMBI Rules Center')) return 'rules';
    if (text.includes('Economy')) return 'economy';
    if (text.includes('Bank')) return 'city';
    if (text.includes('Levels')) return 'xp';
    if (text.includes('العصابات')) return 'gangs';
    if (text.includes('سرقة البنك')) return 'robbery';
    if (text.includes('نظام الموسيقى')) return 'music';
    if (text.includes('الرومات الصوتية')) return 'voice';
    if (text.includes('Moderation')) return 'members';
    if (text.includes('عجلة الحظ')) return 'games';
    if (text.includes('🎮 الألعاب')) return 'games';
    if (text.includes('تجميع الحروف')) return 'games';
    if (text.includes('تغيير الاسم')) return 'name';
    if (text.includes('التذاكر')) return 'tickets';
    if (text.includes('نظام التقديمات')) return 'applications';
    if (text.includes('متجر الرتب')) return 'store';
    if (text.includes('Self Roles')) return 'roles';
    if (text.includes('الرتبة التلقائية')) return 'roles';
    if (text.includes('تخصيص كل لوحة')) return 'premium';
    return 'overview';
  };

  if (settingsForm) {
    settingsForm.classList.add('z-settings-hub');
    const csrf = settingsForm.querySelector(':scope > input[name="_csrf"]');
    const actionBar = settingsForm.querySelector(':scope > .card-actions');
    const nodes = [...settingsForm.children].filter(el => el !== csrf && el !== actionBar);
    let page = 'overview';
    for (const node of nodes) {
      if (node.tagName === 'H3') page = headingPage(node.textContent);
      // Standalone system panels inside the legacy settings form must switch
      // the active dashboard page themselves. Without this, Rules Center can
      // be appended to the section that appeared before it and the Rules page
      // shows only the cloned Send/Update action bar.
      if (node.classList?.contains('rules-system-panel')) page = 'rules';
      else if (node.classList?.contains('city-director-panel')) page = 'director';
      else if (node.classList?.contains('event-system-panel')) page = 'event';
      ensureSettingsGroup(page).appendChild(node);
    }
    settingsGroups.forEach((w, pageId) => {
      // The advanced permissions page has its own sticky save/apply button.
      // Do not add a second generic settings submit there because it cannot
      // serialize the JavaScript-managed Discord permission state.
      if (pageId !== 'permissions') {
        const localBar = document.createElement('div');
        localBar.className = 'z-local-save-bar';
        const localSave = document.createElement('button');
        localSave.type = 'submit';
        localSave.className = 'btn primary z-local-save';
        localSave.dataset.page = pageId;
        localSave.name = '_saveSection';
        localSave.value = pageId;
        localSave.textContent = `💾 حفظ ${pageDefs[pageId]?.label || 'القسم'}`;
        localBar.appendChild(localSave);
        w.appendChild(localBar);
      }
      settingsForm.appendChild(w);
    });
    if (actionBar) {
      const bar = document.createElement('div');
      bar.className = 'z-save-bar';
      while (actionBar.firstChild) bar.appendChild(actionBar.firstChild);
      actionBar.remove();
      settingsForm.appendChild(bar);
    }

    // Welcome and Overview stay inside the main settings form so section navigation
    // can continue to show/hide them normally. Their save buttons use formAction
    // to post to the dedicated routes without moving the section out of the hub.
  }

  // Move channel selectors to the pages where they belong while keeping them inside the same settings form.
  const moveControl = (name, targetPage, title = 'الروم الخاص بالقسم') => {
    if (!settingsForm) return;
    const field = settingsForm.querySelector(`[name="${CSS.escape(name)}"]`);
    const label = field?.closest('label');
    if (!label) return;
    const target = ensureSettingsGroup(targetPage);
    let box = target.querySelector(`.z-section-channels[data-channel-page="${targetPage}"]`);
    if (!box) {
      box = document.createElement('div');
      box.className = 'z-section-channels';
      box.dataset.channelPage = targetPage;
      box.innerHTML = `<h4>${title}</h4><div class="form-grid"></div>`;
      const firstGrid = target.querySelector('.form-grid, .checks, .table-wrap');
      if (firstGrid) target.insertBefore(box, firstGrid);
      else target.appendChild(box);
    }
    box.querySelector('.form-grid').appendChild(label);
  };

  moveControl('logs', 'logs', 'روم سجل السيرفر');
  moveControl('gamePanel', 'games', 'قناة لوحة الألعاب');
  moveControl('ticketPanel', 'tickets', 'قنوات التذاكر');
  moveControl('ticketCategory', 'tickets', 'قنوات التذاكر');
  moveControl('storePanel', 'store', 'قناة لوحة المتجر');
  moveControl('rolePanel', 'roles', 'القناة التي تُرسل فيها لوحة رتب الإشعارات');
  moveControl('levelUp', 'xp', 'قناة إشعارات المستويات');
  moveControl('bankPanel', 'city', 'قنوات ZOMBI City');
  moveControl('centralBank', 'robbery', 'قنوات ZOMBI City');
  moveControl('gangCategory', 'gangs', 'قنوات ZOMBI City');
  moveControl('gangLogs', 'gangs', 'قنوات ZOMBI City');
  moveControl('voiceCreate', 'voice', 'إعداد قنوات الرومات الصوتية');
  moveControl('voiceControl', 'voice', 'إعداد قنوات الرومات الصوتية');
  moveControl('voiceCategory', 'voice', 'إعداد قنوات الرومات الصوتية');
  moveControl('voiceChannelIds', 'voice', 'إعداد قنوات الرومات الصوتية');
  moveControl('nameChangePanel', 'name', 'قناة لوحة تغيير الاسم');
  moveControl('serverGuidePanel', 'guide', 'قناة لوحة دليل السيرفر');
  moveControl('cityDirector', 'director', 'قناة أحداث City Director');
  moveControl('messageChannelIds', 'economy', 'قنوات مكافآت الرسائل');
  moveControl('currencyName', 'economy', 'العملة');
  moveControl('currencyEmoji', 'economy', 'العملة');

  // Keep identity/branding controls together under Premium instead of mixing them
  // with Overview. This also makes the section-scoped save deterministic.
  moveControl('brandColor', 'premium', 'هوية وتصميم هذا السيرفر');
  moveControl('customName', 'premium', 'هوية وتصميم هذا السيرفر');
  moveControl('customFooter', 'premium', 'هوية وتصميم هذا السيرفر');
  moveControl('botNickname', 'premium', 'هوية وتصميم هذا السيرفر');
  moveControl('avatarUrl', 'premium', 'هوية وتصميم هذا السيرفر');
  moveControl('bannerUrl', 'premium', 'هوية وتصميم هذا السيرفر');
  moveControl('botBio', 'premium', 'هوية وتصميم هذا السيرفر');
  moveControl('panelLogoUrl', 'premium', 'هوية وتصميم هذا السيرفر');
  moveControl('panelBannerUrl', 'premium', 'هوية وتصميم هذا السيرفر');
  moveControl('lineUrl', 'premium', 'هوية وتصميم هذا السيرفر');

  // Overview remains inside the settings hub; its save button uses formAction.


  // سرقة البنك: اختيار الرتبة يظهر فقط عند استخدام منشن رتبة.
  if (settingsForm) {
    const robberyMentionMode = settingsForm.querySelector('[name="robberyMentionMode"]');
    const robberyMentionRole = settingsForm.querySelector('[name="robberyMentionRoleId"]');
    const robberyMentionRoleLabel = robberyMentionRole?.closest('[data-robbery-mention-role]') || robberyMentionRole?.closest('label');
    const syncRobberyMentionRole = () => {
      const roleMode = robberyMentionMode?.value === 'role';
      if (robberyMentionRoleLabel) robberyMentionRoleLabel.style.display = roleMode ? '' : 'none';
      if (robberyMentionRole) robberyMentionRole.disabled = !roleMode;
    };
    robberyMentionMode?.addEventListener('change', syncRobberyMentionRole);
    syncRobberyMentionRole();
  }

  // Convert all plan-dependent numeric caps into explicit subscription caps.
  // Native HTML max validation can otherwise block a submit before our
  // Premium dialog has a chance to explain what happened.
  if (settingsForm) {
    const planLimitedFields = {
      dailyAmount: 'Daily Reward',
      messageReward: 'مكافأة الرسائل',
      voiceReward: 'Voice Reward',
      bankMaxTransaction: 'أقصى عملية بالبنك',
      gangMaxMembers: 'أقصى أعضاء العصابة',
      gangMaxDeputies: 'أقصى نواب العصابة',
      robberyMinParticipants: 'عدد المشاركين بسرقة البنك',
      musicDefaultVolume: 'مستوى صوت الموسيقى'
    };
    Object.entries(planLimitedFields).forEach(([name, label]) => {
      const field = settingsForm.querySelector(`[name="${name}"]`);
      if (!field) return;
      const max = field.getAttribute('max');
      if (max !== null && max !== '') field.dataset.planMax = max;
      field.dataset.limitLabel = label;
      field.removeAttribute('max');
    });
  }

  if(settingsForm){
    const heistGroup=ensureSettingsGroup('heist');
    heistGroup.innerHTML='<h3>🎯 النهب والحماية والكفالة</h3><div class="form-grid z-heist-fields"></div>';
    settingsForm.querySelectorAll('[name]').forEach(field=>{if(/^(heist|cashProtection)/.test(field.name)){const label=field.closest('label');if(label)heistGroup.querySelector('.z-heist-fields').appendChild(label);}});
    const bar=document.createElement('div');bar.className='z-local-save-bar';bar.innerHTML='<button type="submit" name="_saveSection" value="heist" class="btn primary z-local-save" data-page="heist">💾 حفظ النهب والحماية</button>';heistGroup.appendChild(bar);settingsForm.appendChild(heistGroup);
  }

  // Mark major dashboard cards so only their section is visible.
  const pageByPanelTitle = title => {
    title = String(title || '');
    if (title.includes('محتوى الألعاب')) return 'game-content';
    if (title.includes('من القاتل')) return 'killer';
    if (title.includes('قوالب مهمات العصابات') || title.includes('العصابات الحالية')) return 'gangs';
    if (title.includes('أنواع التذاكر')) return 'tickets';
    if (title.includes('نظام التقديمات')) return 'applications';
    if (title.includes('دوام الإدارة')) return 'staff-duty';
    if (title.includes('طلب فعالية')) return 'staff-event';
    if (title.includes('طلب إجازة')) return 'staff-leave';
    if (title.includes('أزرار دليل السيرفر')) return 'guide';
    if (title.includes('ZOMBI Rules Center')) return 'rules';
    if (title.includes('قوالب City Director')) return 'director';
    if (title.includes('متجر الرتب')) return 'store';
    if (title.includes('Self Roles')) return 'roles';
    if (title.includes('إدارة أرصدة')) return 'members';
    if (title.includes('Premium') || title.includes('حدود الخطة') || title.includes('تخصيص بروفايل البوت')) return 'premium';
    return null;
  };

  const staffPanel=content.querySelector('.staff-management-panel');
  if(staffPanel){
    const kinds={insights:'staff-insights',duty:'staff-duty',adminDecision:'staff-admin',event:'staff-event',leave:'staff-leave',eventLeave:'staff-event-leave'};
    [...staffPanel.querySelectorAll('form')].forEach(form=>{const page=kinds[form.querySelector('[name="kind"]')?.value];if(!page)return;const panel=document.createElement('section');panel.className='panel';panel.dataset.zPage=page;const heading=document.createElement('h2');heading.textContent=pageDefs[page].label;panel.append(heading,form);staffPanel.before(panel);});
    staffPanel.remove();
  }
  [...content.querySelectorAll(':scope > section.panel')].forEach(panel => {
    if (panel === settingsForm || panel.dataset.zPage) return;
    const title = panel.querySelector(':scope > h2')?.textContent || '';
    if (panel.classList.contains('legacy-panel')) panel.dataset.zPage = 'overview';
    else if (panel.classList.contains('command-sync')) panel.dataset.zPage = 'overview';
    else {
      const page = pageByPanelTitle(title);
      panel.dataset.zPage = page || 'overview';
    }
  });

  const statsForm=content.querySelector('#staff-stats-filter'),statsResult=content.querySelector('#staff-stats-result');
  let statsRequest=0;
  async function loadStaffStats(page=1){
    if(!statsForm)return;const request=++statsRequest;statsResult.textContent='جاري تحميل الإحصائيات…';
    try{const params=new URLSearchParams(new FormData(statsForm));params.set('page',page);const response=await fetch(`/dashboard/${guildId}/staff-statistics?${params}`,{credentials:'same-origin'});if(!response.ok){let error;try{error=await response.json();}catch{}throw new Error(error?.error||'تعذر تحميل الإحصائيات. تأكد من تسجيل الدخول ومخزن البيانات.');}const data=await response.json();if(request!==statsRequest)return;statsResult.replaceChildren();
      if(data.note){const p=document.createElement('p');p.textContent=data.note;statsResult.append(p);}
      const wrap=document.createElement('div');wrap.className='staff-stats-scroll';const table=document.createElement('table');table.className='staff-stats-table';const head=table.createTHead().insertRow();['الإداري','الحالة','ساعات الدوام','الشفتات','الرسائل','ساعات الفويس','التكتات','تقييم الدعم','الإجازات','النقاط','الترقيات المقبولة / المعلقة'].forEach(text=>{const th=document.createElement('th');th.textContent=text;head.append(th);});const body=table.createTBody();
      for(const row of data.rows){const tr=body.insertRow();[`${row.name} (${row.userId})`,row.onDuty?'على الدوام':'خارج الدوام',(row.dutyMs/3600000).toFixed(2),row.shifts,row.messages,(row.voiceMs/3600000).toFixed(2),row.tickets,row.ratings?`${row.avg.toFixed(2)}/5 (${row.ratings})`:'لا تقييم',row.leaves,`${row.points} / ${row.threshold}`,`${row.promotionsAccepted} / ${row.promotionsPending}`].forEach(value=>{tr.insertCell().textContent=String(value);});}wrap.append(table);statsResult.append(wrap);
      if(!data.rows.length&&!data.note){const p=document.createElement('p');p.textContent='لا توجد ملفات مطابقة في هذه الصفحة. يمكنك البحث بمعرف الإداري.';statsResult.append(p);}
      if(data.pages>1){const bar=document.createElement('div');bar.className='card-actions';const label=document.createElement('span');label.textContent=`صفحة ${data.page} من ${data.pages}`;bar.append(label);for(const [text,next] of [['السابق',data.page-1],['التالي',data.page+1]]){const button=document.createElement('button');button.type='button';button.className='btn';button.textContent=text;button.disabled=next<1||next>data.pages;button.onclick=()=>loadStaffStats(next);bar.append(button);}statsResult.append(bar);}
    }catch(error){if(request===statsRequest)statsResult.textContent=error.message;}
  }
  statsForm?.addEventListener('submit',event=>{event.preventDefault();loadStaffStats();});
  nav.querySelector('[data-section="staff-stats"]')?.addEventListener('click',()=>loadStaffStats());
  window.addEventListener('popstate',()=>{if(currentFromUrl()==='staff-stats')loadStaffStats();});
  if(currentFromUrl()==='staff-stats')loadStaffStats();
  // Premium cards are wrapped in .two.
  [...content.querySelectorAll(':scope > .two')].forEach(two => {
    if ([...two.querySelectorAll('h2')].some(h => /Premium|حدود الخطة/.test(h.textContent))) two.dataset.zPage = 'premium';
  });

  const commandPanel = content.querySelector('.command-sync');
  const actionFor = suffix => commandPanel?.querySelector(`form[action$="${suffix}"]`);
  const actionTargets = {
    city: actionFor('/send/bank'),
    games: actionFor('/send/games'),
    tickets: actionFor('/send/tickets'),
    store: actionFor('/send/store'),
    roles: actionFor('/send/roles'),
    guide: actionFor('/send/guide'),
    rules: actionFor('/send/rules')
  };

  const extraByPage = new Map();
  const ensureExtra = page => {
    if (!extraByPage.has(page)) {
      const d = document.createElement('section');
      d.className = 'z-page-extra';
      d.dataset.zPage = page;
      extraByPage.set(page, d);
      const anchor = settingsForm || content.children[1];
      if (anchor?.parentNode) anchor.parentNode.insertBefore(d, anchor.nextSibling);
      else content.appendChild(d);
    }
    return extraByPage.get(page);
  };

  // HARD FIX: Rules Center is rendered as a standalone panel by server.js.
  // Force it into the Rules page extra container so it cannot be lost/hidden
  // by legacy settings grouping or DOM order changes.
  const rulesPanel = content.querySelector('.rules-system-panel');
  if (rulesPanel) {
    rulesPanel.dataset.zPage = 'rules';
    ensureExtra('rules').appendChild(rulesPanel);
  }

  Object.entries(actionTargets).forEach(([page, form]) => {
    if (!form) return;
    const clone = form.cloneNode(true);
    clone.classList.add('z-panel-send-form');
    const btn = clone.querySelector('button');
    if (btn) btn.textContent = page === 'guide' ? '🧭 إرسال / تحديث دليل السيرفر' : page === 'roles' ? 'إعادة إرسال / تحديث اللوحة' : page === 'city' ? '🏦 إرسال / تحديث لوحة البنك' : btn.textContent;
    const bar = document.createElement('div');
    bar.className = 'z-section-actionbar';
    bar.appendChild(clone);
    ensureExtra(page).appendChild(bar);
  });

  // Name Change now has its own send/update route.
  if (settingsForm) {
    const csrfValue = settingsForm.querySelector('input[name="_csrf"]')?.value || '';
    const form = document.createElement('form');
    form.method = 'post';
    form.action = `/dashboard/${guildId}/send/name`;
    form.className = 'z-panel-send-form';
    form.innerHTML = `<input type="hidden" name="_csrf" value="${csrfValue}"><button class="btn">✏️ إرسال / تحديث لوحة تغيير الاسم</button>`;
    const bar = document.createElement('div');
    bar.className = 'z-section-actionbar';
    bar.appendChild(form);
    ensureExtra('name').appendChild(bar);
  }

  // Notification roles live preview, inspired by the agreed design.
  const rolesExtra = ensureExtra('roles');
  const previewWrap = document.createElement('div');
  previewWrap.className = 'z-role-layout';
  previewWrap.innerHTML = `
    <section class="z-role-preview-card">
      <div class="z-preview-brand"><span>ZOMBI</span><b>Z</b></div>
      <div class="z-discord-preview">
        <small>ZOMBI</small>
        <h3 data-preview-title></h3>
        <p data-preview-description></p>
        <div data-preview-roles class="z-preview-role-list"></div>
        <footer data-preview-footer></footer>
      </div>
    </section>`;
  rolesExtra.prepend(previewWrap);

  const updateRolePreview = () => {
    const title = settingsForm?.querySelector('[name="rolePanelTitle"]')?.value || '🔔 رتب الإشعارات';
    const desc = settingsForm?.querySelector('[name="rolePanelDescription"]')?.value || 'اختر الرتب التي تريدها.';
    const footer = settingsForm?.querySelector('[name="rolePanelFooter"]')?.value || 'ZOMBI • ROLE CENTER';
    previewWrap.querySelector('[data-preview-title]').textContent = title;
    previewWrap.querySelector('[data-preview-description]').textContent = desc;
    previewWrap.querySelector('[data-preview-footer]').textContent = footer;
    const list = previewWrap.querySelector('[data-preview-roles]');
    list.innerHTML = '';
    const roleForms = [...content.querySelectorAll(`form[action="/dashboard/${guildId}/roles/update"]`)].slice(0, 8);
    roleForms.forEach(form => {
      const option = form.querySelector('select[name="newRoleId"] option:checked');
      const label = form.querySelector('input[name="label"]')?.value || option?.textContent || 'رتبة';
      const emoji = form.querySelector('input[name="emoji"]')?.value || '🔔';
      const chip = document.createElement('span');
      chip.textContent = `${emoji} ${label}`;
      list.appendChild(chip);
    });
    if (!list.children.length) list.innerHTML = '<em>أضف رتبة من الأسفل لتظهر هنا</em>';
  };
  ['rolePanelTitle', 'rolePanelDescription', 'rolePanelFooter'].forEach(name => {
    settingsForm?.querySelector(`[name="${name}"]`)?.addEventListener('input', updateRolePreview);
  });
  updateRolePreview();

  // Add a concise premium notice to fields already disabled by plan policy.
  if (settingsForm?.querySelector(':disabled')) {
    const notice = document.createElement('div');
    notice.className = 'z-premium-notice';
    notice.innerHTML = '🔒 أي خيار Premium يبقى مقفولًا تلقائيًا إذا السيرفر غير مشترك.';
    ensureSettingsGroup('premium').prepend(notice);
  }

  // Reliable section-scoped saving.
  // The server already saves only the section named in _settingsSection, so do not
  // disable controls from other pages. Disabling fields caused stale/partial FormData
  // and was the main reason one save could erase a previous save or require retries.
  if (settingsForm) {
    settingsForm.noValidate = true;
    let sectionInput = settingsForm.querySelector(':scope > input[name="_settingsSection"]');
    if (!sectionInput) {
      sectionInput = document.createElement('input');
      sectionInput.type = 'hidden';
      sectionInput.name = '_settingsSection';
      settingsForm.appendChild(sectionInput);
    }

    const resolvePage = button => button?.name === 'forceBotProfile'
      ? 'overview'
      : (button?.dataset?.page || currentFromUrl() || 'overview');

    const markSection = button => {
      const page = resolvePage(button);
      sectionInput.value = page;
      if (button) { button.dataset.page = page; if (button.name === '_saveSection' || button.classList.contains('z-local-save') || button.closest('.z-save-bar')) { button.name = '_saveSection'; button.value = page; } }
      return page;
    };

    settingsForm.addEventListener('click', event => {
      const button = event.target.closest('button[type="submit"]');
      if (!button || button.form !== settingsForm) return;
      markSection(button);
      // Validation belongs to the active server-side section. Hidden controls on
      // another page must never cancel this submit.
      button.formNoValidate = true;
    }, true);

    settingsForm.addEventListener('submit', event => {
      if (event.defaultPrevented) return;
      const button = event.submitter || settingsForm.querySelector(`button[type="submit"][data-page="${currentFromUrl()}"]`) || settingsForm.querySelector('.z-save-bar button[type="submit"]');
      markSection(button);
      if (settingsForm.dataset.zSaving === '1') {
        event.preventDefault();
        return;
      }
      settingsForm.dataset.zSaving = '1';
      if (button) {
        button.dataset.zOldText = button.textContent;
        button.textContent = '⏳ جارٍ الحفظ...';
      }
      // If navigation is blocked by a server/network error, re-enable saving.
      setTimeout(() => {
        settingsForm.dataset.zSaving = '0';
        if (button?.dataset?.zOldText) button.textContent = button.dataset.zOldText;
      }, 8000);
    }, true);

    settingsForm.addEventListener('z-save-failed', () => {
      settingsForm.dataset.zSaving = '0';
      settingsForm.querySelectorAll('button[data-z-old-text]').forEach(button => {
        button.textContent = button.dataset.zOldText;
        delete button.dataset.zOldText;
      });
    });
  }

  const allPostForms = () => [...content.querySelectorAll('form[method="post" i]')];
  const setReturnSection = section => {
    allPostForms().forEach(form => {
      let input = form.querySelector('input[name="_returnSection"]');
      if (!input) {
        input = document.createElement('input');
        input.type = 'hidden';
        input.name = '_returnSection';
        form.appendChild(input);
      }
      input.value = section;
    });
  };

  const showNode = (el, show) => {
    if (!el) return;
    el.classList.toggle('z-section-hidden', !show);
  };

  function render(section) {
    if (!pageDefs[section]) section = 'overview';
    const def = pageDefs[section];
    pageHeader.querySelector('h1').textContent = def.label;
    pageHeader.querySelector('p').textContent = def.desc;

    nav.querySelectorAll('a[data-section]').forEach(a => a.classList.toggle('active', a.dataset.section === section));

    if (settingsForm) {
      const hasSettings = settingsGroups.has(section);
      showNode(settingsForm, hasSettings);
      settingsGroups.forEach((group, key) => showNode(group, key === section));
      const globalSaveBar = settingsForm.querySelector('.z-save-bar');
      // Every page has its own local save button. The old global bar submitted
      // mixed fields from multiple hidden sections and made saves look broken.
      if (globalSaveBar) showNode(globalSaveBar, false);
      settingsForm.querySelectorAll('.z-local-save').forEach(btn => {
        btn.textContent = btn.dataset.page === 'roles' ? '💾 حفظ وتحديث إعدادات اللوحة' : `💾 حفظ ${pageDefs[btn.dataset.page]?.label || 'القسم'}`;
      });
      const profileBtn = settingsForm.querySelector('.z-save-bar button[name="forceBotProfile"]');
      if (profileBtn) profileBtn.classList.toggle('z-section-hidden', section !== 'premium');
    }

    [...content.querySelectorAll('[data-z-page]')].forEach(el => {
      if (el === settingsForm || el.closest('.z-settings-hub')) return;
      showNode(el, el.dataset.zPage === section);
    });

    // Command panel itself only stays on overview; cloned send buttons appear inside their own sections.
    if (commandPanel) showNode(commandPanel, section === 'overview');

    setReturnSection(section);
  }

  window.addEventListener('popstate', () => render(currentFromUrl()));
  render(currentFromUrl());
  hardRenderSection(currentFromUrl());

  const qs = new URLSearchParams(location.search);
  if (qs.get('saved') === '1') {
    const toast = document.createElement('div');
    toast.className = 'z-save-toast ok';
    toast.setAttribute('role','status');
    toast.textContent = '✅ تم حفظ الإعدادات بنجاح.';
    document.body.appendChild(toast);
    setTimeout(() => toast.classList.add('show'), 30);
    setTimeout(() => toast.remove(), 3500);
    qs.delete('saved');
    const clean = `${location.pathname}${qs.toString()?`?${qs}`:''}${location.hash}`;
    history.replaceState({}, '', clean);
  }
})();

// ZOMBI 9: section search, accessible navigation, unsaved change feedback.
(() => {
 const sidebar=document.querySelector('.z-dashboard-sidebar');if(!sidebar)return;
 const status=sidebar.querySelector('.z-side-status');if(status)status.textContent='إعدادات هذا السيرفر';
 const nav=sidebar.querySelector('nav'),search=document.createElement('input');
 search.type='search';search.placeholder='ابحث عن قسم…';search.className='z-section-search';search.setAttribute('aria-label','البحث في أقسام التحكم');sidebar.insertBefore(search,nav);
 search.addEventListener('input',()=>{const q=search.value.trim();nav.querySelectorAll('a').forEach(a=>a.hidden=!a.textContent.includes(q));});
 const form=document.querySelector('form[action$="/settings"]');if(!form)return;
 let dirty=false,submitting=false;const bar=form.querySelector('.z-save-bar'),label=document.createElement('span');
 label.className='z-dirty-status';label.setAttribute('role','status');if(bar)bar.prepend(label);
 form.addEventListener('input',()=>{dirty=true;label.textContent='تغييرات غير محفوظة';});
 form.addEventListener('change',()=>{dirty=true;label.textContent='تغييرات غير محفوظة';});
 form.addEventListener('submit',e=>{if(!e.defaultPrevented){submitting=true;label.textContent='جارٍ حفظ الإعدادات…';}});
 form.addEventListener('z-save-failed',()=>{submitting=false;label.textContent='لم تُحفظ التغييرات';});
 window.addEventListener('beforeunload',e=>{if(dirty&&!submitting){e.preventDefault();e.returnValue='';}});
 const update=()=>nav.querySelectorAll('a').forEach(a=>{if(a.classList.contains('active'))a.setAttribute('aria-current','page');else a.removeAttribute('aria-current');});
 nav.addEventListener('click',()=>queueMicrotask(update));update();
})();

// ZOMBI V9.6 professional command-center skin + strict plan locking is applied server-side.
