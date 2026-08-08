// 音效管理：assets/下的 MP3（button.mp3 / ring.mp3 / fail.mp3）
// 资源缺失或音频上下文被浏览器拦截（未用户手势）时静默失败
const SFX = {
  _cache: new Map(),
  _enabled: true,
  _base: 'assets/',
  _ext: '.mp3',

  _load(name) {
    if (this._cache.has(name)) return this._cache.get(name);
    const url = this._base + name + this._ext;
    try {
      const a = new Audio(url);
      a.preload = 'auto';
      a.volume = 0.7;
      a.addEventListener('error', () => { /* 缺失文件时静默 */ });
      this._cache.set(name, a);
      return a;
    } catch (e) {
      return null;
    }
  },

  init() {
    ['button', 'ring', 'fail'].forEach(n => this._load(n));
  },

  play(name) {
    if (!this._enabled) return;
    const a = this._load(name);
    if (!a) return;
    try {
      // 重置到开头再播放（支持连续点击重复播放）
      a.pause();
      a.currentTime = 0;
      const p = a.play();
      if (p && typeof p.catch === 'function') p.catch(() => { /* 浏览器策略拦截，忽略 */ });
    } catch (e) { /* 静默 */ }
  },

  setEnabled(v) { this._enabled = !!v; }
};

window.SFX = SFX;
