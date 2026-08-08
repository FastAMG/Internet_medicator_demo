// 彩蛋模块：神秘客户可篡改壁纸和文档内容
const Easter = {
  // 根据神秘客户的 action 改变世界
  applyAction(action) {
    if (!action || !action.type) return null;
    if (action.type === 'wallpaper') {
      return this.cycleWallpaper();
    }
    if (action.type === 'doc') {
      return this.tamperDoc();
    }
    return null;
  },

  cycleWallpaper() {
    const total = GAME_CONFIG.wallpapers.length;
    const next = (Save.data.wallpaperIndex + 1) % total;
    Save.setWallpaper(next);
    return { type: 'wallpaper', msg: '壁纸已被神秘客户更换。' };
  },

  // 篡改手册：插入诡异内容并标记
  tamperDoc() {
    Save.setDocTampered(true);
    return { type: 'doc', msg: '异象应对手册被注入了未知文字。' };
  },

  // 生成可能被篡改的手册渲染数据
  getManual() {
    const m = JSON.parse(JSON.stringify(GAME_CONFIG.manual));
    if (Save.data.docTampered) {
      m.sections.push({
        h: '五、调解员',
        p: '特征：总以为自己在帮助别人。应对：无需应对。我们早已在屏幕另一侧。',
        tampered: true
      });
      // 篡改已有段落
      m.sections[0].p += ' （注：红包无效。他只收名字。）';
      m.sections[0].tampered = true;
    }
    return m;
  }
};

window.Easter = Easter;
