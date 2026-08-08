// 启动与事件绑定
(function () {
  SFX.init();
  Save.init();

  // 注入 NPC 初始消息，使主屏"小信"显示未读红点
  // 仅给已解锁且无消息记录的 NPC 发送 opener
  GAME_CONFIG.npcs.forEach(npc => {
    if (!Save.isUnlocked(npc.id)) return;
    const conv = Save.getConversation(npc.id);
    if (conv.messages.length === 0) {
      Save.addMessage(npc.id, 'them', npc.opener);
    }
  });

  // 时钟
  function tick() {
    const d = new Date();
    document.getElementById('clock').textContent =
      d.getHours().toString().padStart(2, '0') + ':' + d.getMinutes().toString().padStart(2, '0');
  }
  tick(); setInterval(tick, 10000);

  // 全局按钮点击音效：所有 <button> / .btn / .tool-btn / .send-btn / .app-icon / .chat-item / .back / .gallery-item
  const clickSoundSel = 'button, .btn, .tool-btn, .send-btn, .app-icon, .chat-item, .back, .gallery-item, .gallery-item img';
  document.addEventListener('click', (e) => {
    if (e.target.closest(clickSoundSel)) SFX.play('button');
  }, true);

  // 模式提示
  function refreshModeHint() {
    const hint = document.getElementById('modeHint');
    hint.textContent = API.isDemoMode()
      ? '当前：演示模式（无 API 密钥，使用脚本回复）'
      : '当前：在线模式（使用 SiliconFlow API）';
  }

  // 返回按钮
  document.querySelectorAll('.back').forEach(b => {
    b.addEventListener('click', () => Game.showScreen(b.dataset.back));
  });

  // 输入发送
  const input = document.getElementById('msgInput');
  const send = () => {
    const v = input.value.trim();
    if (!v) return;
    input.value = '';
    // Debug 后门：神秘代码直接触发好/坏结局（无中文，避免误触）
    if (v === '#goodend') { Game.debugEnd('success'); return; }
    if (v === '#badend') { Game.debugEnd('fail'); return; }
    Game.send(v, 'text');
  };
  document.getElementById('btnSend').addEventListener('click', send);
  input.addEventListener('keydown', e => { if (e.key === 'Enter') send(); });

  // 红包：简单弹 prompt
  document.getElementById('btnRedPacket').addEventListener('click', () => {
    const def = GAME_CONFIG.defaultRedPacket || 8.88;
    const amount = prompt('红包金额（元）', String(def));
    if (amount === null) return;
    const title = prompt('红包寄语', '一点心意，愿你平安');
    Game.send('', 'redpacket', { amount: parseFloat(amount) || def, title: title || '红包' });
  });

  // 图片：从可发送图片中选
  document.getElementById('btnImage').addEventListener('click', () => {
    const list = GAME_CONFIG.sendableImages.map((i, idx) => `${idx + 1}. ${i.label}`).join('\n');
    const choice = prompt('选择图片发送：\n' + list, '1');
    const idx = parseInt(choice, 10) - 1;
    if (isNaN(idx) || idx < 0 || idx >= GAME_CONFIG.sendableImages.length) return;
    Game.send(GAME_CONFIG.sendableImages[idx].label, 'image');
  });

  // 设置
  document.getElementById('apiKeyInput').value = Save.data.apiKey;
  document.getElementById('modelInput').value = Save.data.model;

  // 界面大小调整
  const scaleInput = document.getElementById('scaleInput');
  const scaleVal = document.getElementById('scaleVal');
  const presetBtns = document.querySelectorAll('.scale-presets .btn.small');
  function applyUiScale(pct) {
    const scale = pct / 100;
    document.getElementById('phone').style.transform = `scale(${scale})`;
    scaleInput.value = pct;
    scaleVal.textContent = pct + '%';
    presetBtns.forEach(b => b.classList.toggle('active', parseInt(b.dataset.scale, 10) === pct));
  }
  function setUiScale(pct) {
    pct = Math.max(70, Math.min(130, parseInt(pct, 10) || 100));
    applyUiScale(pct);
    Save.setUiScale(pct / 100);
  }
  applyUiScale(Math.round((Save.data.uiScale || 1) * 100));
  scaleInput.addEventListener('input', () => setUiScale(scaleInput.value));
  presetBtns.forEach(b => b.addEventListener('click', () => setUiScale(b.dataset.scale)));

  // 界面比例调整
  const ratioBox = document.getElementById('ratioPresets');
  function applyUiRatio(id) {
    const r = GAME_CONFIG.ratios.find(x => x.id === id) || GAME_CONFIG.ratios[0];
    const phone = document.getElementById('phone');
    phone.style.width = r.w + 'px';
    phone.style.height = r.h + 'px';
    ratioBox.querySelectorAll('.btn.small').forEach(b => b.classList.toggle('active', b.dataset.ratio === r.id));
  }
  function setUiRatio(id) {
    applyUiRatio(id);
    Save.setUiRatio(id);
  }
  GAME_CONFIG.ratios.forEach(r => {
    const b = document.createElement('button');
    b.className = 'btn small';
    b.dataset.ratio = r.id;
    b.textContent = r.label;
    b.addEventListener('click', () => setUiRatio(r.id));
    ratioBox.appendChild(b);
  });
  applyUiRatio(Save.data.uiRatio || 'phone');

  document.getElementById('saveSettings').addEventListener('click', () => {
    const rawKey = document.getElementById('apiKeyInput').value.trim();
    // 校验 API 密钥：HTTP 头不允许非 ASCII 字符（中文/全角符号等）
    if (rawKey && /[^\x00-\x7F]/.test(rawKey)) {
      alert('API 密钥包含非 ASCII 字符（如中文或全角符号），这会导致请求失败。\n请检查是否粘贴了正确密钥（通常以 sk- 开头）。');
      return;
    }
    Save.setSettings(
      rawKey,
      document.getElementById('modelInput').value.trim() || 'Qwen/Qwen2.5-7B-Instruct'
    );
    refreshModeHint();
    alert('设置已保存');
  });
  document.getElementById('resetGame').addEventListener('click', () => {
    if (confirm('确定清空所有存档？此操作不可恢复。')) {
      Save.reset();
      document.getElementById('apiKeyInput').value = '';
      refreshModeHint();
      applyUiScale(100);
      applyUiRatio('phone');
      Game.showScreen('home');
    }
  });

  // 弹层关闭
  document.getElementById('overlayClose').addEventListener('click', () => {
    Game.hideOverlay();
    Game.showScreen('xiaoxin');
  });

  refreshModeHint();
  Game.showScreen('home');
})();
