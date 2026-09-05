'use strict';

(() => {
  const match = location.pathname.match(/^\/dashboard\/(\d{15,25})\/?$/);
  if (!match) return;

  const guildId = match[1];
  const main = document.querySelector('main');
  if (!main) return;

  document.body.classList.add('zombi-dashboard');

  const pageDefs = {
    overview: { label: 'الرئيسية', icon: '⌂', desc: 'نظرة عامة وإعدادات ZOMBI الأساسية لهذا السيرفر.' },
    economy: { label: 'الاقتصاد', icon: '◈', desc: 'العملة، المكافآت، التحويلات وإدارة اقتصاد السيرفر.' },
    members: { label: 'الأعضاء', icon: '♟', desc: 'المستويات، أرصدة الأعضاء وأدوات الإدارة.' },
    store: { label: 'المتجر', icon: '◆', desc: 'متجر الرتب، الأسعار، المميزات وشكل لوحة المتجر.' },
    games: { label: 'الألعاب', icon: '◉', desc: 'تشغيل الألعاب، الجولات، الوقت، الجوائز والروليت.' },
    'game-content': { label: 'محتوى الألعاب', icon: '▤', desc: 'الأسئلة والكلمات والمحتوى الذي تستخدمه الألعاب.' },
    killer: { label: 'من القاتل', icon: '⌕', desc: 'إنشاء وتعديل قضايا من القاتل من الداشبورد.' },
    city: { label: 'ZOMBI City', icon: '▰', desc: 'البنك المركزي، العصابات، المهمات وسرقة البنك.' },
    roles: { label: 'رتب الإشعارات', icon: '🔔', desc: 'لوحة Self Roles الاحترافية؛ العضو يأخذ أو يلغي الرتبة بنفسه.' },
    name: { label: 'تغيير الاسم', icon: '✏️', desc: 'لوحة تغيير الاسم ونافذة إدخال الاسم داخل السيرفر.' },
    tickets: { label: 'التذاكر', icon: '▣', desc: 'لوحة التذاكر، أنواعها، الرتب والصلاحيات.' },
    voice: { label: 'الرومات الصوتية', icon: '◐', desc: 'الرومات المؤقتة ومكافآت الفويس وقنوات التحكم.' },
    premium: { label: 'Premium', icon: '💎', desc: 'الاشتراك والحدود وتخصيص صورة البوت والبنر والـNickname لكل سيرفر.' }
  };

  const groups = [
    ['التحكم', ['overview', 'economy', 'members', 'store']],
    ['الألعاب والمدينة', ['games', 'game-content', 'killer', 'city']],
    ['الأنظمة', ['roles', 'name', 'tickets', 'voice', 'premium']]
  ];

  const currentFromUrl = () => {
    const s = new URLSearchParams(location.search).get('section') || 'overview';
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

  const oldHead = content.querySelector('.dash-head');
  const guildName = oldHead?.querySelector('h1')?.textContent?.trim() || 'ZOMBI Server';
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
    if (text.includes('تحديد كل الرومات')) return 'overview';
    if (text.includes('تشغيل وإيقاف')) return 'overview';
    if (text.includes('Economy')) return 'economy';
    if (text.includes('Bank')) return 'city';
    if (text.includes('Levels')) return 'members';
    if (text.includes('العصابات')) return 'city';
    if (text.includes('سرقة البنك')) return 'city';
    if (text.includes('الرومات الصوتية')) return 'voice';
    if (text.includes('Moderation')) return 'members';
    if (text.includes('عجلة الحظ')) return 'games';
    if (text.includes('🎮 الألعاب')) return 'games';
    if (text.includes('تغيير الاسم')) return 'name';
    if (text.includes('التذاكر')) return 'tickets';
    if (text.includes('متجر الرتب')) return 'store';
    if (text.includes('Self Roles')) return 'roles';
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
      ensureSettingsGroup(page).appendChild(node);
    }
    settingsGroups.forEach((w, pageId) => {
      // Keep an explicit save button inside every settings section so the user
      // never has to hunt for the global/sticky save bar.
      const localBar = document.createElement('div');
      localBar.className = 'z-local-save-bar';
      const localSave = document.createElement('button');
      localSave.type = 'submit';
      localSave.className = 'btn primary z-local-save';
      localSave.dataset.page = pageId;
      localSave.textContent = `💾 حفظ ${pageDefs[pageId]?.label || 'القسم'}`;
      localBar.appendChild(localSave);
      w.appendChild(localBar);
      settingsForm.appendChild(w);
    });
    if (actionBar) {
      const bar = document.createElement('div');
      bar.className = 'z-save-bar';
      while (actionBar.firstChild) bar.appendChild(actionBar.firstChild);
      actionBar.remove();
      settingsForm.appendChild(bar);
    }
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

  moveControl('gamePanel', 'games', 'قناة لوحة الألعاب');
  moveControl('ticketPanel', 'tickets', 'قنوات التذاكر');
  moveControl('ticketCategory', 'tickets', 'قنوات التذاكر');
  moveControl('storePanel', 'store', 'قناة لوحة المتجر');
  moveControl('rolePanel', 'roles', 'القناة التي تُرسل فيها لوحة رتب الإشعارات');
  moveControl('levelUp', 'members', 'قناة إشعارات المستويات');
  moveControl('bankPanel', 'city', 'قنوات ZOMBI City');
  moveControl('centralBank', 'city', 'قنوات ZOMBI City');
  moveControl('gangCategory', 'city', 'قنوات ZOMBI City');
  moveControl('gangLogs', 'city', 'قنوات ZOMBI City');
  moveControl('voiceCreate', 'voice', 'إعداد قنوات الرومات الصوتية');
  moveControl('voiceControl', 'voice', 'إعداد قنوات الرومات الصوتية');
  moveControl('voiceCategory', 'voice', 'إعداد قنوات الرومات الصوتية');
  moveControl('voiceChannelIds', 'voice', 'إعداد قنوات الرومات الصوتية');
  moveControl('nameChangePanel', 'name', 'قناة لوحة تغيير الاسم');
  moveControl('messageChannelIds', 'economy', 'قنوات مكافآت الرسائل');
  moveControl('currencyName', 'economy', 'العملة');
  moveControl('currencyEmoji', 'economy', 'العملة');

  // Mark major dashboard cards so only their section is visible.
  const pageByPanelTitle = title => {
    title = String(title || '');
    if (title.includes('محتوى الألعاب')) return 'game-content';
    if (title.includes('من القاتل')) return 'killer';
    if (title.includes('قوالب مهمات العصابات') || title.includes('العصابات الحالية')) return 'city';
    if (title.includes('أنواع التذاكر')) return 'tickets';
    if (title.includes('متجر الرتب')) return 'store';
    if (title.includes('Self Roles')) return 'roles';
    if (title.includes('إدارة أرصدة')) return 'members';
    if (title.includes('Premium') || title.includes('حدود الخطة') || title.includes('تخصيص بروفايل البوت')) return 'premium';
    return null;
  };

  [...content.querySelectorAll(':scope > section.panel')].forEach(panel => {
    if (panel === settingsForm) return;
    const title = panel.querySelector(':scope > h2')?.textContent || '';
    if (panel.classList.contains('legacy-panel')) panel.dataset.zPage = 'overview';
    else if (panel.classList.contains('command-sync')) panel.dataset.zPage = 'overview';
    else {
      const page = pageByPanelTitle(title);
      if (page) panel.dataset.zPage = page;
    }
  });

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
    roles: actionFor('/send/roles')
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

  Object.entries(actionTargets).forEach(([page, form]) => {
    if (!form) return;
    const clone = form.cloneNode(true);
    clone.classList.add('z-panel-send-form');
    const btn = clone.querySelector('button');
    if (btn) btn.textContent = page === 'roles' ? 'إعادة إرسال / تحديث اللوحة' : page === 'city' ? '🏦 إرسال / تحديث لوحة البنك' : btn.textContent;
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
      const saveBtn = settingsForm.querySelector('.z-save-bar button[type="submit"]:not([name="forceBotProfile"])');
      if (saveBtn) saveBtn.textContent = section === 'roles' ? '💾 حفظ وتحديث إعدادات اللوحة' : `💾 حفظ ${def.label}`;
      settingsForm.querySelectorAll('.z-local-save').forEach(btn => {
        btn.textContent = btn.dataset.page === 'roles' ? '💾 حفظ وتحديث إعدادات اللوحة' : `💾 حفظ ${pageDefs[btn.dataset.page]?.label || 'القسم'}`;
      });
      const profileBtn = settingsForm.querySelector('.z-save-bar button[name="forceBotProfile"]');
      if (profileBtn) profileBtn.classList.toggle('z-section-hidden', section !== 'overview');
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
})();
