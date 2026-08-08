// 存档模块：基于 localStorage，存储会话、好感、进度、设置、结局
// 若 localStorage 不可用（如 file:// 沙盒），回退到内存存储
const SAVE_KEY = 'internet_medicator_save_v1';

const Save = {
  data: null,
  storage: null,

  init() {
    // 检测 localStorage 可用性
    try {
      const t = '__test__';
      localStorage.setItem(t, t);
      localStorage.removeItem(t);
      this.storage = localStorage;
    } catch (e) {
      this.storage = { _d: {}, getItem(k){return this._d[k]||null;}, setItem(k,v){this._d[k]=v;}, removeItem(k){delete this._d[k];} };
    }
    this.load();
    if (!this.data) {
      this.data = {
        apiKey: '',
        model: 'Qwen/Qwen2.5-7B-Instruct',
        wallpaperIndex: 0,
        docTampered: false,
        uiScale: 1,
        uiRatio: 'phone',
        balance: (window.GAME_CONFIG && GAME_CONFIG.startBalance) || 100,
        conversations: {}, // npcId -> { messages:[{role,content,type,ts}], progress, affinity, status:'active'|'success'|'fail', seen }
        history: [],       // 结局记录 [{npcId, name, result, ts }]
        seeded: false,     // 是否已注入初始消息
        unlockedNpcs: [],  // 已解锁的 NPC id 列表
        completedNpcs: [], // 已完成的 NPC id 列表（无论输赢）
        unlockedGallery: [] // 已解锁的图库 CG id 列表
      };
      // 初始化解锁列表：config 里标记 initialUnlock 的 NPC
      if (window.GAME_CONFIG) {
        this.data.unlockedNpcs = GAME_CONFIG.npcs.filter(n => n.initialUnlock).map(n => n.id);
      }
      this.save();
    } else {
      // 旧存档迁移：补齐新增字段
      if (this.data.uiScale === undefined) this.data.uiScale = 1;
      if (!this.data.uiRatio) this.data.uiRatio = 'phone';
      if (this.data.balance === undefined) this.data.balance = (window.GAME_CONFIG && GAME_CONFIG.startBalance) || 100;
      if (!this.data.conversations) this.data.conversations = {};
      if (!this.data.history) this.data.history = [];
      if (this.data.seeded === undefined) this.data.seeded = false;
      if (!this.data.unlockedNpcs) this.data.unlockedNpcs = [];
      if (!this.data.completedNpcs) this.data.completedNpcs = [];
      if (!this.data.unlockedGallery) this.data.unlockedGallery = [];
      // 旧存档迁移：若未初始化解锁列表，用 config 的 initialUnlock 填充
      if (this.data.unlockedNpcs.length === 0 && window.GAME_CONFIG) {
        this.data.unlockedNpcs = GAME_CONFIG.npcs.filter(n => n.initialUnlock).map(n => n.id);
      }
      this.save();
    }
  },

  load() {
    try {
      const raw = this.storage.getItem(SAVE_KEY);
      this.data = raw ? JSON.parse(raw) : null;
    } catch (e) {
      this.data = null;
    }
  },

  save() {
    try { this.storage.setItem(SAVE_KEY, JSON.stringify(this.data)); } catch (e) {}
  },

  reset() {
    try { this.storage.removeItem(SAVE_KEY); } catch (e) {}
    this.data = null;
    this.init();
  },

  // 获取/创建会话
  getConversation(npcId) {
    if (!this.data.conversations[npcId]) {
      this.data.conversations[npcId] = {
        messages: [],
        progress: 0,
        affinity: 0,
        status: 'active',
        seen: false
      };
    }
    return this.data.conversations[npcId];
  },

  addMessage(npcId, role, content, type = 'text') {
    const conv = this.getConversation(npcId);
    conv.messages.push({ role, content, type, ts: Date.now() });
    this.save();
  },

  setProgress(npcId, progress, affinity) {
    const conv = this.getConversation(npcId);
    conv.progress = progress;
    conv.affinity = affinity;
    this.save();
  },

  setStatus(npcId, status) {
    const conv = this.getConversation(npcId);
    conv.status = status;
    this.save();
  },

  markUnseen(npcId) {
    const conv = this.getConversation(npcId);
    conv.seen = false;
    this.save();
  },
  markSeen(npcId) {
    const conv = this.getConversation(npcId);
    conv.seen = true;
    this.save();
  },

  recordHistory(npcId, name, result) {
    this.data.history.push({ npcId, name, result, ts: Date.now() });
    this.save();
  },

  setSettings(apiKey, model) {
    this.data.apiKey = apiKey;
    this.data.model = model;
    this.save();
  },

  setWallpaper(index) {
    this.data.wallpaperIndex = index;
    this.save();
  },
  setDocTampered(v) {
    this.data.docTampered = v;
    this.save();
  },
  setUiScale(scale) {
    this.data.uiScale = scale;
    this.save();
  },
  setUiRatio(id) {
    this.data.uiRatio = id;
    this.save();
  },
  addBalance(delta) {
    this.data.balance = Math.max(0, Math.round((this.data.balance || 0) * 100 + delta * 100) / 100);
    this.save();
    return this.data.balance;
  },
  canAfford(amount) {
    return (this.data.balance || 0) >= amount;
  },

  // —— 关卡解锁系统 ——
  isUnlocked(npcId) {
    return (this.data.unlockedNpcs || []).includes(npcId);
  },

  isCompleted(npcId) {
    return (this.data.completedNpcs || []).includes(npcId);
  },

  markCompleted(npcId) {
    if (!this.isCompleted(npcId)) {
      this.data.completedNpcs.push(npcId);
      this.save();
    }
  },

  // 解锁指定 NPC（隐藏关用），返回是否新解锁
  unlockSpecific(npcId) {
    if (!this.isUnlocked(npcId)) {
      this.data.unlockedNpcs.push(npcId);
      // 注入 opener，使小信列表显示未读
      const npc = window.GAME_CONFIG && GAME_CONFIG.npcs.find(n => n.id === npcId);
      if (npc && npc.opener) this.addMessage(npcId, 'them', npc.opener);
      this.save();
      return true;
    }
    return false;
  },

  // 从未解锁的关卡池随机抽 1 个解锁，返回解锁的 NPC（null 表示池已空）
  // 排除：初始解锁、隐藏关触发(unlockCondition)、非初始关触发(unlockOnNonInitial)、结局(ending)、已解锁
  unlockRandom() {
    if (!window.GAME_CONFIG) return null;
    const EXCLUDE_IDS = ['ending'];
    const pool = GAME_CONFIG.npcs.filter(n =>
      !n.initialUnlock && !n.unlockCondition && !n.unlockOnNonInitial
      && !EXCLUDE_IDS.includes(n.id) && !this.isUnlocked(n.id)
    );
    if (pool.length === 0) return null;
    const pick = pool[Math.floor(Math.random() * pool.length)];
    this.data.unlockedNpcs.push(pick.id);
    // 注入 opener
    if (pick.opener) this.addMessage(pick.id, 'them', pick.opener);
    this.save();
    return pick;
  },

  // 统计主线关卡调解数据
  // 排除：隐藏关(unlockCondition)、文件传输助手(xiaoxin_fta，特殊机制，不影响结局触发)
  getStats() {
    if (!window.GAME_CONFIG) return { total: 0, success: 0, completed: 0, rate: 0 };
    const EXCLUDE_FROM_MAIN = ['xiaoxin_fta'];
    const mainNpcs = GAME_CONFIG.npcs.filter(n =>
      (n.type === 'psych' || n.type === 'anomaly') && n.target > 0
      && !n.unlockCondition && !EXCLUDE_FROM_MAIN.includes(n.id)
    );
    const total = mainNpcs.length;
    const success = mainNpcs.filter(n => this.getConversation(n.id).status === 'success').length;
    const completed = mainNpcs.filter(n => this.isCompleted(n.id)).length;
    return { total, success, completed, rate: total > 0 ? success / total : 0 };
  },

  // 所有主线关卡是否已完成（用于触发结局）
  allMainLevelsCompleted() {
    const stats = this.getStats();
    return stats.total > 0 && stats.completed >= stats.total;
  },

  // —— 图库 CG 解锁 ——
  isGalleryUnlocked(cgId) {
    return (this.data.unlockedGallery || []).includes(cgId);
  },

  unlockGallery(cgId) {
    if (!this.isGalleryUnlocked(cgId)) {
      this.data.unlockedGallery.push(cgId);
      this.save();
      return true;
    }
    return false;
  },

  // 从未解锁的随机 CG 池抽 1 个（排除有 unlockAfter/unlockAfterChat 的指定解锁 CG）
  unlockRandomGallery() {
    if (!window.GAME_CONFIG) return null;
    const pool = GAME_CONFIG.galleryImages.filter(g =>
      !g.unlockAfter && !g.unlockAfterChat && !this.isGalleryUnlocked(g.id)
    );
    if (pool.length === 0) return null;
    const pick = pool[Math.floor(Math.random() * pool.length)];
    this.data.unlockedGallery.push(pick.id);
    this.save();
    return pick;
  }
};

window.Save = Save;
