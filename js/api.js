// SiliconFlow API 调用模块 + 演示模式回退
const API = {
  endpoint: 'https://api.siliconflow.cn/v1/chat/completions',

  isDemoMode() {
    return !Save.data.apiKey;
  },

  // 解析 AI 回复中的 JSON 标记
  // 支持 [PROGRESS{...}] 和 [ACTION{...}]，并兜底处理格式不规范的输出
  parseTags(text) {
    const result = { text: text, progress: null, action: null };

    // PROGRESS：先严格匹配 [PROGRESS{...}]，再兜底匹配裸 PROGRESS{...}
    const pMatch = text.match(/\[?PROGRESS\s*(\{[\s\S]*?\})\s*\]?/);
    if (pMatch) {
      let jsonStr = pMatch[1];
      // 兜底：补全字段间缺失的逗号。仅当「值结束字符」后紧跟「下一个 key 的开始引号」时补逗号
      // 值结束字符: \w(数字/字母/true/false/null) ] } " '
      jsonStr = this._fixMissingCommas(jsonStr);
      try {
        result.progress = JSON.parse(jsonStr);
        result.text = text.replace(pMatch[0], '').trim();
      } catch (e) {
        // JSON 仍解析失败：仍把这段标记从正文中剥离，避免泄露给玩家
        result.text = text.replace(pMatch[0], '').trim();
      }
    }

    // ACTION
    const aMatch = text.match(/\[?ACTION\s*(\{[\s\S]*?\})\s*\]?/);
    if (aMatch) {
      let jsonStr = aMatch[1];
      jsonStr = this._fixMissingCommas(jsonStr);
      try {
        result.action = JSON.parse(jsonStr);
        result.text = text.replace(aMatch[0], '').trim();
      } catch (e) {
        result.text = text.replace(aMatch[0], '').trim();
      }
    }
    return result;
  },

  // 补全 JSON 字段间缺失的逗号
  // 仅当「值结束字符」后紧跟「下一个 key 的开始引号」时补逗号
  // 值结束字符: \w(数字/字母/true/false/null) ] } " '
  // key 判定: 引号后形如 "xxx":
  // 这样可安全处理数字值与字符串值缺逗号的情况，且不会破坏合法 JSON
  _fixMissingCommas(s) {
    return s.replace(/([\w\]\}"'])\s*(")(?="[^"]*"\s*:)/g, '$1,$2');
  },

  // 真实 API 调用
  async callReal(npc, history) {
    // 追加强制格式要求，确保 AI 输出 PROGRESS/ACTION 标记（chat 类型无需格式）
    const formatReminder = npc.type === 'easter'
      ? '\n\n【重要】你必须在回复末尾另起一行输出：[ACTION{"type":"wallpaper"}] 或 [ACTION{"type":"doc"}] 或 [ACTION{"type":"none"}]，不可省略。'
      : (npc.type === 'chat' ? '' : '\n\n【重要】你必须在回复末尾另起一行输出进度标记，格式严格为：[PROGRESS{"delta":数字,"affinity":数字,"mood":"情绪"}]，不可省略，不可写在正文里。');
    const messages = [
      { role: 'system', content: npc.prompt + formatReminder },
      ...history.map(m => ({
        role: m.role === 'me' ? 'user' : 'assistant',
        content: m.content
      }))
    ];
    // 清洗 API 密钥：HTTP 头只允许 ISO-8859-1，去除非 ASCII 字符（如中文、全角符号）
    const rawKey = (Save.data.apiKey || '').trim();
    const apiKey = rawKey.replace(/[^\x00-\x7F]/g, '');
    if (!apiKey) {
      throw new Error('API 密钥无效或为空，请检查设置。');
    }
    const res = await fetch(this.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + apiKey
      },
      body: JSON.stringify({
        model: Save.data.model,
        messages: messages,
        temperature: 0.8,
        max_tokens: 600
      })
    });
    if (!res.ok) {
      const err = await res.text();
      throw new Error('API错误 ' + res.status + ': ' + err);
    }
    const json = await res.json();
    const content = json.choices[0].message.content;
    // 打印 AI 原始输出，便于调试 JSON 标记格式
    console.log('[AI 原始输出]', content);
    const parsed = this.parseTags(content);
    // 兜底：AI 未输出 PROGRESS/ACTION 时，根据回复内容推断进度（chat 类型无需兜底）
    if (!parsed.progress && !parsed.action && npc.type !== 'easter' && npc.type !== 'chat') {
      const fallback = this._guessProgress(content, history, npc);
      parsed.progress = fallback;
      console.log('[AI 兜底进度]', fallback);
    }
    if (!parsed.action && npc.type === 'easter') {
      parsed.action = { type: 'none' };
      console.log('[AI 兜底 ACTION]', parsed.action);
    }
    console.log('[AI 解析结果]', parsed);
    return parsed;
  },

  // 兜底：AI 未输出 PROGRESS 时，根据回复内容做简单情感推断
  _guessProgress(text, history, npc) {
    const t = (text || '').toLowerCase();

    // 文件传输助手等 empathyOnly NPC：仅在情感倾诉回应时 +1，其他 +0
    if (npc && npc.empathyOnly) {
      const empathyWords = ['乐意', '谈谈', '聊聊', '倾听', '陪你', '我在听', '愿意', '说说'];
      const isEmpathy = empathyWords.some(w => t.includes(w));
      return { delta: isEmpathy ? 1 : 0, affinity: isEmpathy ? 1 : 0, mood: isEmpathy ? '愉快' : 'none' };
    }

    // 默认兜底：根据正面/负面词推断
    const positiveWords = ['谢谢', '好的', '好', '明白', '我知道了', '对不起', '抱歉', '也许', '可能', '试试', '下来', '回家', '想通', '活着', '妈妈', '感谢', '你说得对'];
    const negativeWords = ['不', '滚', '闭嘴', '算了', '没用', '不懂', '不想', '离开', '跳', '死', '烦', '别管'];
    const isPositive = positiveWords.some(w => t.includes(w));
    const isNegative = negativeWords.some(w => t.includes(w));
    let delta = 5; // 默认小幅推进
    if (isNegative && !isPositive) delta = -8;
    else if (isPositive) delta = 10;
    return { delta, affinity: delta > 0 ? 1 : -1, mood: '推断' };
  },

  // 演示模式：基于 NPC 的 demo 脚本和玩家输入关键词推断回复
  callDemo(npc, history) {
    const playerMsgs = history.filter(m => m.role === 'me');
    const step = playerMsgs.length - 1;
    let scripted;
    if (step < npc.demo.length) {
      scripted = npc.demo[step];
    } else {
      // 超出脚本：通用回应，继续小幅推进
      scripted = npc.type === 'easter'
        ? { t: '随你喜欢，世界任我改写。', action: 'none' }
        : { t: '…谢谢你愿意一直听我说这些。', d: 12, a: 1, m: '平静' };
    }

    // 关键词简单感知：负面话术退进度
    const last = (playerMsgs[playerMsgs.length - 1]?.content || '').toLowerCase();
    const negativeWords = ['跳', '算了', '随便你', '关我什么事', '活该', '懦夫', '去死', '无聊'];
    const isNegative = negativeWords.some(w => last.includes(w));

    let out;
    if (npc.type === 'easter') {
      out = { text: scripted.t, action: scripted.action ? { type: scripted.action } : null };
    } else {
      const d = isNegative ? -Math.abs(scripted.d) : scripted.d;
      out = {
        text: scripted.t,
        progress: { delta: d, affinity: isNegative ? -1 : scripted.a, mood: scripted.m }
      };
    }
    // 模拟延迟
    return new Promise(resolve => setTimeout(() => resolve(out), 700 + Math.random() * 600));
  },

  // 剧情类型：不调用 API，只按脚本推进
  callStory(npc, history) {
    // 结局NPC：剧本由 Game.getEndingScript() 动态生成
    let script = npc.script || [];
    if (npc.id === 'ending' && window.Game && Game.getEndingScript) {
      script = Game.getEndingScript();
    }
    const playerMsgs = history.filter(m => m.role === 'me');
    const step = playerMsgs.length - 1; // 本次应给出的脚本索引
    const idx = Math.min(step, script.length - 1);
    const beat = script[idx];
    const text = typeof beat === 'string' ? beat : (beat && beat.t) || '……';
    const isLast = script.length > 0 && step >= script.length - 1;
    const out = { text, storyEnd: isLast };
    if (beat && typeof beat === 'object' && beat.progress != null) {
      out.progress = { delta: beat.progress, affinity: beat.affinity || 0, mood: beat.mood || '' };
    }
    return new Promise(r => setTimeout(() => r(out), 600 + Math.random() * 500));
  },

  // 统一入口
  async reply(npc, history) {
    // 剧情类型：始终走脚本，不调用 API
    if (npc.type === 'story') {
      return this.callStory(npc, history);
    }
    if (this.isDemoMode()) {
      return this.callDemo(npc, history);
    }
    try {
      return await this.callReal(npc, history);
    } catch (e) {
      console.warn('API 调用失败，回退到演示模式:', e.message);
      const out = await this.callDemo(npc, history);
      out.fallback = true;
      out.error = e.message;
      return out;
    }
  }
};

window.API = API;
