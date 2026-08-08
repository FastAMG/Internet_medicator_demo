// 资源模块：头像/图片均使用 PNG；资源文件缺失时用 canvas 生成默认 PNG 回退
const Assets = {
  _cache: new Map(),

  _ctx(w, h) {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    return c.getContext('2d');
  },

  // 通用默认头像（人物剪影），资源缺失时使用
  defaultAvatarUri() {
    if (this._cache.has('default_avatar')) return this._cache.get('default_avatar');
    const ctx = this._ctx(128, 128);
    ctx.fillStyle = '#8a8a8e';
    ctx.fillRect(0, 0, 128, 128);
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(64, 50, 26, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(64, 116, 42, 36, 0, 0, Math.PI * 2); ctx.fill();
    const uri = ctx.canvas.toDataURL('image/png');
    this._cache.set('default_avatar', uri);
    return uri;
  },

  // 带文字标签的彩色头像 PNG
  avatarUri(label, color) {
    const key = 'av_' + label + '_' + color;
    if (this._cache.has(key)) return this._cache.get(key);
    const ctx = this._ctx(128, 128);
    ctx.fillStyle = color || '#888';
    ctx.fillRect(0, 0, 128, 128);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 60px "PingFang SC",sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label || '?', 64, 70);
    const uri = ctx.canvas.toDataURL('image/png');
    this._cache.set(key, uri);
    return uri;
  },

  // 图片消息占位 PNG（带 emoji）
  imageUri(emoji, bg) {
    const key = 'img_' + emoji + '_' + bg;
    if (this._cache.has(key)) return this._cache.get(key);
    const ctx = this._ctx(240, 160);
    ctx.fillStyle = bg || '#eee';
    ctx.fillRect(0, 0, 240, 160);
    ctx.font = '80px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(emoji || '🖼', 120, 85);
    const uri = ctx.canvas.toDataURL('image/png');
    this._cache.set(key, uri);
    return uri;
  },

  // 图库占位 PNG
  galleryPlaceholderUri(text) {
    const key = 'gal_' + text;
    if (this._cache.has(key)) return this._cache.get(key);
    const ctx = this._ctx(300, 300);
    const grad = ctx.createLinearGradient(0, 0, 300, 300);
    grad.addColorStop(0, '#bdc3c7');
    grad.addColorStop(1, '#2c3e50');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 300, 300);
    ctx.fillStyle = 'rgba(255,255,255,.9)';
    ctx.font = 'bold 30px "PingFang SC",sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text || '图片', 150, 150);
    const uri = ctx.canvas.toDataURL('image/png');
    this._cache.set(key, uri);
    return uri;
  },

  // 生成 <img>：优先加载 src(PNG)，失败回退到 fallbackUri
  imgHtml(src, fallbackUri, cls) {
    return `<img class="${cls || ''}" src="${src}" onerror="this.onerror=null;this.src='${fallbackUri}'">`;
  }
};

window.Assets = Assets;
