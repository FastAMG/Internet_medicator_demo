// 主游戏控制器：屏幕切换、主屏、小信列表、聊天、进度、结局
const Game = {
  currentNpcId: null,

  // ===== 屏幕切换 =====
  showScreen(id) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    const el = document.getElementById('screen-' + id);
    if (el) el.classList.add('active');
    if (id === 'home') this.renderHome();
    if (id === 'xiaoxin') { this.renderChatList(); this.renderBalance(); }
    if (id === 'word') this.renderWord();
    if (id === 'gallery') this.renderGallery();
    if (id === 'updates') this.renderUpdates();
    if (id === 'chat') { this.renderChat(); this.renderBalance(); }
  },

  // ===== 余额显示 =====
  renderBalance() {
    const v = (Save.data.balance || 0).toFixed(2);
    document.querySelectorAll('.balance-val').forEach(el => el.textContent = v);
  },

  // ===== 头像 <img> =====
  avatarHtml(role, npc) {
    const isMe = role === 'me';
    const cfg = isMe ? GAME_CONFIG.player : npc;
    const fallback = Assets.avatarUri(cfg.avatarLabel, cfg.avatarColor);
    const src = cfg.avatarImg || fallback;
    return `<img class="avatar-img" src="${src}" onerror="this.onerror=null;this.src='${fallback}'">`;
  },

  // ===== 主屏 =====
  renderHome() {
    const wp = document.getElementById('wallpaper');
    wp.style.background = GAME_CONFIG.wallpapers[Save.data.wallpaperIndex];
    const grid = document.getElementById('homeGrid');
    grid.innerHTML = '';
    GAME_CONFIG.apps.forEach(app => {
      const div = document.createElement('div');
      div.className = 'app-icon';
      // 小信红点：统计未读会话
      let badge = '';
      if (app.id === 'xiaoxin') {
        const unread = Object.entries(Save.data.conversations)
          .filter(([id, c]) => !c.seen && c.status === 'active').length;
        if (unread > 0) badge = `<span class="badge">${unread}</span>`;
      }
      div.innerHTML = `
        <div class="icon" style="background:${app.color}">${app.icon}${badge}</div>
        <div class="name">${app.name}</div>`;
      div.addEventListener('click', () => this.showScreen(app.target));
      grid.appendChild(div);
    });
  },

  // ===== 小信会话列表 =====
  renderChatList() {
    const list = document.getElementById('chatList');
    list.innerHTML = '';
    GAME_CONFIG.npcs.forEach(npc => {
      if (!Save.isUnlocked(npc.id)) return;
      const conv = Save.getConversation(npc.id);
      // 首次进入且无消息：自动发 opener
      if (conv.messages.length === 0 && conv.status === 'active') {
        Save.addMessage(npc.id, 'them', npc.opener);
      }
      const last = conv.messages[conv.messages.length - 1];
      const item = document.createElement('div');
      item.className = 'chat-item';
      const statusTag = conv.status === 'success' ? '✓已调解'
        : conv.status === 'fail' ? '✗失败' : '';
      item.innerHTML = `
        <div class="avatar" style="background:${npc.avatarColor}">${this.avatarHtml('them', npc)}</div>
        <div class="meta">
          <div class="name-row">
            <span class="name">${npc.name} ${statusTag ? `<small style="color:#999;font-weight:400">${statusTag}</small>` : ''}</span>
            <span class="time">${last ? this.fmtTime(last.ts) : ''}</span>
          </div>
          <div class="preview">${last ? this.previewText(last) : ''}</div>
        </div>
        ${(!conv.seen && conv.status === 'active') ? '<div class="dot">1</div>' : ''}`;
      item.addEventListener('click', () => {
        this.currentNpcId = npc.id;
        Save.markSeen(npc.id);
        this.showScreen('chat');
      });
      list.appendChild(item);
    });
  },

  previewText(m) {
    if (m.type === 'image') return '[图片] ' + (m.content || '');
    if (m.type === 'redpacket') return '[红包] ' + (m.content || '');
    return m.content;
  },

  fmtTime(ts) {
    const d = new Date(ts);
    return d.getHours().toString().padStart(2, '0') + ':' + d.getMinutes().toString().padStart(2, '0');
  },

  // ===== 聊天界面 =====
  renderChat() {
    const npc = this.currentNpc();
    document.getElementById('chatTitle').textContent = npc.name;
    const conv = Save.getConversation(npc.id);
    const area = document.getElementById('msgArea');
    area.innerHTML = '';

    // 进度条：仅有目标进度（target>0）的会话显示
    const wrap = document.getElementById('progressWrap');
    if (npc.target && npc.target > 0) {
      wrap.style.display = 'block';
      this.updateProgress();
    } else {
      wrap.style.display = 'none';
    }

    conv.messages.forEach(m => area.appendChild(this.makeMsg(m, npc)));
    area.scrollTop = area.scrollHeight;

    // 输入栏按钮：彩蛋/剧情 NPC 不发红包，仅保留文字与图片
    const narrative = (npc.type === 'easter' || npc.type === 'story' || npc.type === 'chat');
    document.getElementById('btnRedPacket').style.display = narrative ? 'none' : 'block';
    document.getElementById('btnImage').style.display = 'block';
  },

  currentNpc() {
    return GAME_CONFIG.npcs.find(n => n.id === this.currentNpcId);
  },

  makeMsg(m, npc) {
    const row = document.createElement('div');
    row.className = 'msg-row ' + (m.role === 'me' ? 'me' : 'them');
    const cfg = m.role === 'me' ? GAME_CONFIG.player : npc;
    const avatarStyle = `background:${cfg.avatarColor}`;
    let bubble;
    if (m.type === 'image') {
      const img = GAME_CONFIG.sendableImages.find(i => i.label === m.content) || { emoji: '🖼', bg: '#eee', file: '' };
      const fallback = Assets.imageUri(img.emoji, img.bg);
      const src = img.file || fallback;
      bubble = `<div class="bubble img"><img class="msg-img" src="${src}" onerror="this.onerror=null;this.src='${fallback}'"></div>`;
    } else if (m.type === 'redpacket') {
      bubble = `<div class="bubble rp"><div class="rp-title">${this.escape(m.content || '红包')}</div><div class="rp-amount">¥ ${(m.amount||8.88).toFixed(2)}</div><div class="rp-sub">调解员的心意</div></div>`;
    } else {
      bubble = `<div class="bubble">${this.escape(m.content)}</div>`;
    }
    row.innerHTML = `<div class="avatar" style="${avatarStyle}">${this.avatarHtml(m.role, npc)}</div>${bubble}`;
    return row;
  },

  escape(s) {
    return String(s).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
  },

  updateProgress() {
    const npc = this.currentNpc();
    const conv = Save.getConversation(npc.id);
    const fill = document.getElementById('progressFill');
    const val = document.getElementById('progressVal');
    const aff = document.getElementById('affinityVal');
    val.textContent = Math.max(0, Math.round(conv.progress));
    aff.textContent = conv.affinity;
    const pct = Math.max(0, Math.min(100, conv.progress));
    fill.style.width = pct + '%';
    fill.classList.toggle('bad', conv.progress < 0);
  },

  // ===== 发送消息 =====
  async send(text, type = 'text', extra = null) {
    const npc = this.currentNpc();
    if (!npc) return;
    const conv = Save.getConversation(npc.id);
    if (conv.status !== 'active') {
      this.showOverlay(conv.status === 'success' ? '会话已结束' : '会话已失败',
        '此会话已结束，无法继续。', conv.status);
      return;
    }

    // 红包：校验并扣除余额
    if (type === 'redpacket') {
      const amount = extra?.amount || GAME_CONFIG.defaultRedPacket;
      if (!Save.canAfford(amount)) {
        this.showOverlay('余额不足',
          `当前余额 ¥${(Save.data.balance||0).toFixed(2)}，无法发送红包。\n完成调解可获得工资。`, 'fail');
        return;
      }
      Save.addBalance(-amount);
      extra.amount = amount;
    }

    // 写入玩家消息
    const content = type === 'redpacket' ? (extra?.title || '红包') : text;
    Save.addMessage(npc.id, 'me', content, type);
    if (type === 'redpacket') {
      conv.messages[conv.messages.length - 1].amount = extra?.amount || GAME_CONFIG.defaultRedPacket;
      Save.save();
    }
    // 和指定 NPC 对话后解锁对应 CG（如小白→gal_2）
    (GAME_CONFIG.galleryImages || []).forEach(cg => {
      if (cg.unlockAfterChat === npc.id && !Save.isGalleryUnlocked(cg.id)) {
        Save.unlockGallery(cg.id);
        setTimeout(() => this.showOverlay('图库解锁', `${cg.caption || cg.id} 已加入图库。`, 'info'), 800);
      }
    });
    this.renderChat();
    this.renderBalance();

    // 打字指示
    const area = document.getElementById('msgArea');
    const typing = document.createElement('div');
    typing.className = 'typing';
    typing.id = 'typing';
    typing.textContent = npc.name + ' 正在输入…';
    area.appendChild(typing);
    area.scrollTop = area.scrollHeight;

    document.getElementById('btnSend').disabled = true;

    try {
      const result = await API.reply(npc, conv.messages);
      // 移除打字指示
      const t = document.getElementById('typing');
      if (t) t.remove();

      // 写入 NPC 回复
      Save.addMessage(npc.id, 'them', result.text);

      // 处理进度
      if (result.progress) {
        const delta = Number(result.progress.delta) || 0;
        const aff = Number(result.progress.affinity) || 0;
        conv.progress = Math.round((conv.progress || 0) + delta);
        conv.affinity = (conv.affinity || 0) + aff;
        Save.save();
        this.updateProgress();
      }
      // 无论本轮是否有 progress 标记，都检查是否达成结局
      this.checkEnd(npc, conv);

      // 处理剧情结束（storyEnd）
      if (result.storyEnd && conv.status === 'active') {
        conv.status = 'success';
        const reward = npc.reward || 0;
        if (reward > 0) Save.addBalance(reward);
        Save.save();
        Save.recordHistory(npc.id, npc.name, 'success');
        this.renderBalance();
        this._onLevelCompleted(npc, 'success');
        setTimeout(() => this.showOverlay('剧情结束',
          `${npc.name} 的剧情已播完。${reward > 0 ? `\n获得 ¥${reward.toFixed(2)}\n余额 ¥${(Save.data.balance||0).toFixed(2)}` : ''}`, 'success'), 400);
      }

      // 处理彩蛋 action
      if (result.action) {
        const e = Easter.applyAction(result.action);
        if (e) {
          setTimeout(() => this.showOverlay('世界变了', e.msg, 'info'), 600);
        }
      }

      // 回退提示
      if (result.fallback) {
        this.showOverlay('API 调用失败', '已切换到演示模式继续。\n' + (result.error || ''), 'info');
      }
    } catch (e) {
      const t = document.getElementById('typing');
      if (t) t.remove();
      Save.addMessage(npc.id, 'them', '（信号不好，没能收到回复）');
      console.error(e);
    } finally {
      document.getElementById('btnSend').disabled = false;
      this.renderChat();
    }
  },

  checkEnd(npc, conv) {
    if (npc.type === 'easter' || npc.type === 'story' || npc.type === 'chat') return;
    // target 容错：缺失或非正数时默认 100
    const target = (typeof npc.target === 'number' && npc.target > 0) ? npc.target : 100;
    console.log('[checkEnd]', { type: npc.type, progress: conv.progress, target, status: conv.status });
    if (conv.status !== 'active') return;
    if (conv.progress >= target) {
      conv.status = 'success';
      const reward = npc.reward || 0;
      if (reward > 0) Save.addBalance(reward);
      Save.save();
      Save.recordHistory(npc.id, npc.name, 'success');
      this.renderBalance();
      this._onLevelCompleted(npc, 'success');
      setTimeout(() => this.showOverlay('调解成功',
        `${npc.name} 的问题已解决。\n好感度 ${conv.affinity}\n获得工资 ¥${reward.toFixed(2)}\n余额 ¥${(Save.data.balance||0).toFixed(2)}`, 'success'), 400);
    } else if (conv.progress <= -30) {
      conv.status = 'fail';
      Save.save();
      Save.recordHistory(npc.id, npc.name, 'fail');
      this._onLevelCompleted(npc, 'fail');
      setTimeout(() => this.showOverlay('调解失败', `${npc.name} 已离开。\n本次失败已被记录。`, 'fail'), 400);
    }
  },

  // 关卡完成后的解锁逻辑（成功/失败均触发）
  _onLevelCompleted(npc, result) {
    if (Save.isCompleted(npc.id)) return; // 首次完成才解锁
    Save.markCompleted(npc.id);
    const unlockedNames = [];

    // 隐藏关触发：完成文件传输助手后解锁 unlockCondition 指定的 NPC
    if (npc.id === 'xiaoxin_fta') {
      GAME_CONFIG.npcs.filter(n => n.unlockCondition === 'xiaoxin_fta').forEach(n => {
        if (!Save.isUnlocked(n.id)) {
          Save.unlockSpecific(n.id);
          unlockedNames.push(n.name);
        }
      });
    }

    // 完成非初始关后，解锁 unlockOnNonInitial 的 NPC（小白、???）
    if (!npc.initialUnlock) {
      GAME_CONFIG.npcs.filter(n => n.unlockOnNonInitial).forEach(n => {
        if (!Save.isUnlocked(n.id)) {
          Save.unlockSpecific(n.id);
          unlockedNames.push(n.name);
        }
      });
    }

    // 从随机池解锁下一关
    const next = Save.unlockRandom();
    if (next) unlockedNames.push(next.name);

    // CG 解锁：完成指定 NPC 后解锁对应 CG
    const cgUnlocked = [];
    (GAME_CONFIG.galleryImages || []).forEach(cg => {
      if (cg.unlockAfter === npc.id && !Save.isGalleryUnlocked(cg.id)) {
        Save.unlockGallery(cg.id);
        cgUnlocked.push(cg.caption || cg.id);
      }
    });
    // 随机解锁 1 个 CG
    const randomCg = Save.unlockRandomGallery();
    if (randomCg) cgUnlocked.push(randomCg.caption || randomCg.id);

    // 弹层提示所有新解锁
    const msgs = [];
    if (unlockedNames.length > 0) {
      msgs.push(unlockedNames.map(n => `${n} 已加入小信列表。`).join('\n'));
    }
    if (cgUnlocked.length > 0) {
      msgs.push(cgUnlocked.map(c => `图库解锁：${c}`).join('\n'));
    }
    if (msgs.length > 0) {
      setTimeout(() => this.showOverlay('新内容解锁', msgs.join('\n'), 'info'), 1200);
    }

    // 所有主线关卡完成后，解锁结局NPC
    if (Save.allMainLevelsCompleted() && !Save.isUnlocked('ending')) {
      Save.unlockSpecific('ending');
      setTimeout(() => this.showOverlay('年终评估',
        '仁爱调解处·通知 已加入小信列表。\n请前往人事部接受年度评估。', 'info'), 2000);
    }
  },

  // 根据调解成功率和隐藏关完成情况，生成结局剧本
  getEndingScript() {
    const stats = Save.getStats();
    const ratePct = Math.round(stats.rate * 100);
    const hollowDone = Save.isCompleted('hollow');

    // 完美结局：100%成功率 + 通关谁谁谁谁(彩蛋联系人)
    if (stats.rate >= 1 && hollowDone) {
      return [
        '调解员，请坐。',
        `本年度你的调解成功率达到 100%。这是仁爱调解处历史上前所未有的成绩。`,
        '不仅如此，我们还注意到——你找回了自己。',
        '那个叫"谁谁谁谁"的客户，不是别人，是你自己。你曾经也失去了自我认知，和那些客户一样。',
        '但你帮别人找回了方向，也慢慢找回了自己。你不再只是一个"调解员"，你是一个完整的人。',
        '作为表彰，我们为你准备了一份特殊的礼物：在浏览器地址栏末尾加上 /311 ，那里有留给你的东西。',
        '恭喜你。你做到了。'
      ];
    }

    // 主结局：基于成功率
    let main = [];
    if (stats.rate >= 0.75) {
      // 好结局
      main = [
        '调解员，请坐。关于你的年度评估——',
        `本年度你的调解成功率达到 ${ratePct}%，高于75%的优秀线。`,
        '仁爱网络调解处决定授予你"年度优秀调解员"称号，并发放奖金。',
        '你点头，却感觉这称号像属于别人。你依然想不起自己是谁。',
        '但至少，你知道自己帮到了人。继续工作吧。'
      ];
    } else if (stats.rate >= 0.5) {
      // 普通结局
      main = [
        '调解员，请坐。关于你的年度评估——',
        `本年度你的调解成功率为 ${ratePct}%，属于正常水平。`,
        '无功无过，继续留任。希望你下一年能有更好的表现。',
        '你点头。你不知道自己是谁，但这份工作至少还在。',
        '回到工位，等待下一条消息。'
      ];
    } else {
      // 坏结局
      main = [
        '调解员，请坐。关于你的年度评估——',
        `本年度你的调解成功率仅为 ${ratePct}%，低于50%的合格线。`,
        '很遗憾，仁爱网络调解处决定终止与你的合同。请于本月底前交接工作。',
        '你站起来。你不知道自己还能去哪——你甚至不知道自己从哪来。',
        '收拾工位时，你看到一张自己的旧工牌。照片上的人……是你吗？'
      ];
    }

    // 隐藏结局追加：通关了谁谁谁谁，但成功率不是100%
    if (hollowDone) {
      main = main.concat([
        '……',
        '等等。你想起了什么。',
        '那个叫"谁谁谁谁"的客户……不是别人，是你自己。',
        '你曾经也失去了自我认知，和那些客户一样。但你帮别人找回了方向，也慢慢找回了自己。',
        '你终于知道了自己的名字。虽然它已经不重要了——因为"调解员"这个词，已经足够定义你。'
      ]);
    }

    return main;
  },

  // Debug 后门：直接触发当前会话的好/坏结局
  debugEnd(result) {
    const npc = this.currentNpc();
    if (!npc) return;
    const conv = Save.getConversation(npc.id);
    if (conv.status !== 'active') {
      this.showOverlay('无法触发', '此会话已结束。', 'info');
      return;
    }
    if (result === 'success') {
      conv.status = 'success';
      conv.progress = npc.target || 100;
      const reward = npc.reward || 0;
      if (reward > 0) Save.addBalance(reward);
      Save.save();
      Save.recordHistory(npc.id, npc.name, 'success');
      this.renderBalance();
      this._onLevelCompleted(npc, 'success');
      this.renderChat();
      this.showOverlay('[DEBUG] 调解成功',
        `${npc.name} 的问题已解决。\n好感度 ${conv.affinity}${reward > 0 ? `\n获得工资 ¥${reward.toFixed(2)}\n余额 ¥${(Save.data.balance||0).toFixed(2)}` : ''}`, 'success');
    } else if (result === 'fail') {
      conv.status = 'fail';
      conv.progress = -30;
      Save.save();
      Save.recordHistory(npc.id, npc.name, 'fail');
      this._onLevelCompleted(npc, 'fail');
      this.renderChat();
      this.showOverlay('[DEBUG] 调解失败', `${npc.name} 已离开。\n本次失败已被记录。`, 'fail');
    }
  },

  // ===== 弹层 =====
  showOverlay(title, text, type) {
    const ov = document.getElementById('overlay');
    const card = ov.querySelector('.overlay-card');
    card.className = 'overlay-card ' + (type || '');
    document.getElementById('overlayTitle').textContent = title;
    document.getElementById('overlayText').textContent = text;
    ov.classList.remove('hidden');
    // 调解成功 / 失败音效
    if (type === 'success') SFX.play('ring');
    else if (type === 'fail') SFX.play('fail');
  },
  hideOverlay() {
    document.getElementById('overlay').classList.add('hidden');
  },

  // ===== Word 文档 =====
  renderWord() {
    const body = document.getElementById('docBody');
    const m = Easter.getManual();
    let html = `<h1>${m.title}</h1>`;
    m.sections.forEach(s => {
      html += `<h2>${s.h}</h2><p class="${s.tampered ? 'tampered' : ''}">${s.p}</p>`;
    });
    if (Save.data.docTampered) {
      html += `<p style="margin-top:20px;color:#999;font-size:12px">⚠ 本文档已被未知来源修改</p>`;
    }
    body.innerHTML = html;
  },

  // ===== 图库 =====
  renderGallery() {
    const body = document.getElementById('galleryBody');
    const imgs = GAME_CONFIG.galleryImages || [];
    const unlocked = imgs.filter(im => Save.isGalleryUnlocked(im.id));
    if (unlocked.length === 0) {
      body.innerHTML = `<div class="gallery-empty">图库暂时空空如也。\n完成调解后会逐步解锁图片。</div>`;
      return;
    }
    let html = '<div class="gallery-grid">';
    unlocked.forEach(im => {
      const fallback = Assets.galleryPlaceholderUri(im.caption);
      const src = im.file || fallback;
      html += `<div class="gallery-item">
        <img src="${src}" onerror="this.onerror=null;this.src='${fallback}'">
        <div class="cap">${this.escape(im.caption || '')}</div>
      </div>`;
    });
    html += '</div>';
    body.innerHTML = html;
  },

  // ===== 更新通知 =====
  renderUpdates() {
    const body = document.getElementById('updatesBody');
    const updates = GAME_CONFIG.updates || [];
    if (updates.length === 0) {
      body.innerHTML = '<div class="gallery-empty">暂无更新。</div>';
      return;
    }
    let html = '';
    updates.forEach(u => {
      html += `<div class="update-card">
        <div class="update-header">
          <span class="update-ver">${u.version}</span>
          <span class="update-date">${u.date}</span>
        </div>
        <div class="update-title">${this.escape(u.title)}</div>`;
      u.sections.forEach(s => {
        html += `<div class="update-section">
          <div class="update-h">${this.escape(s.h)}</div>
          <div class="update-p">${this.escape(s.p).replace(/\n/g, '<br>')}</div>`;
        if (s.demoKey) {
          html += `<div class="demo-key-box">
            <code class="demo-key" id="demoKeyVal">${this.escape(s.demoKey)}</code>
            <button class="btn copy-key-btn" data-key="${this.escape(s.demoKey)}">复制</button>
          </div>`;
        }
        html += `</div>`;
      });
      html += `</div>`;
    });
    body.innerHTML = html;
    // 绑定复制按钮
    body.querySelectorAll('.copy-key-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const key = btn.getAttribute('data-key');
        navigator.clipboard?.writeText(key).then(() => {
          btn.textContent = '已复制';
          setTimeout(() => { btn.textContent = '复制'; }, 1500);
        }).catch(() => {
          // 降级：选中文本
          const code = document.getElementById('demoKeyVal');
          if (code) {
            const range = document.createRange();
            range.selectNode(code);
            window.getSelection().removeAllRanges();
            window.getSelection().addRange(range);
          }
        });
      });
    });
  }
};

window.Game = Game;
