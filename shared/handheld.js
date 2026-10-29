// 掌機外殼的共用行為：視窗高度、長按按鍵、關卡進度、選關格子、結果訊息層

export function trackViewport(onResize) {
  const update = () => {
    const h = window.visualViewport ? window.visualViewport.height : window.innerHeight;
    document.documentElement.style.setProperty('--vh', `${h}px`);
    requestAnimationFrame(() => onResize?.());
  };
  window.addEventListener('resize', update);
  window.visualViewport?.addEventListener('resize', update);
  update();
}

// 按住期間持續觸發：先停 delay 毫秒再每 repeat 毫秒一次；repeat 為 0 只觸發一次
export function bindHold(el, fn, { repeat = 0, delay = 170, onRelease } = {}) {
  let timer = null;
  let wait = null;
  const stop = (e) => {
    e?.preventDefault();
    if (!el.classList.contains('holding')) return;
    el.classList.remove('holding');
    clearInterval(timer);
    clearTimeout(wait);
    onRelease?.();
  };
  el.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    el.classList.add('holding');
    fn();
    if (repeat) wait = setTimeout(() => { timer = setInterval(fn, repeat); }, delay);
  }, { passive: false });
  ['pointerup', 'pointercancel', 'pointerleave', 'lostpointercapture'].forEach((ev) => el.addEventListener(ev, stop, { passive: false }));
}

export function starText(n) {
  return '★'.repeat(n) + '☆'.repeat(3 - n);
}

// 每個遊戲的關卡星等存在瀏覽器：{ stars: { 關卡索引: 星數 } }
export function createProgress(gameId) {
  const key = `smallgames.${gameId}.challenge`;
  const load = () => {
    try {
      const data = JSON.parse(localStorage.getItem(key) || '{}');
      return { stars: data.stars ?? {} };
    } catch {
      return { stars: {} };
    }
  };
  return {
    load,
    // 只保留最好的星等
    save(index, stars) {
      const progress = load();
      if ((progress.stars[index] ?? 0) >= stars) return progress;
      progress.stars[index] = stars;
      try {
        localStorage.setItem(key, JSON.stringify(progress));
      } catch {
        // 寫不進去就只在這次有效
      }
      return progress;
    },
    isUnlocked: (progress, index) => index === 0 || (progress.stars[index - 1] ?? 0) > 0,
    total: (progress) => Object.values(progress.stars).reduce((sum, n) => sum + n, 0),
  };
}

// 畫出選關格子；未解鎖的關卡不能按
export function renderLevelGrid({ grid, totalEl, levels, progressStore, onPick }) {
  const progress = progressStore.load();
  if (totalEl) totalEl.textContent = `★ ${progressStore.total(progress)} / ${levels.length * 3}`;
  grid.replaceChildren();
  levels.forEach((level, i) => {
    const stars = progress.stars[i] ?? 0;
    const tile = document.createElement('button');
    tile.className = `levelTile${stars ? ' cleared' : ''}`;
    tile.disabled = !progressStore.isUnlocked(progress, i);
    tile.setAttribute('aria-label', `第 ${i + 1} 關 ${level.name}${tile.disabled ? '，未解鎖' : `，${stars} 星`}`);
    const no = document.createElement('span');
    no.className = 'levelNo';
    no.textContent = i + 1;
    const starLine = document.createElement('span');
    starLine.className = 'levelStars';
    starLine.textContent = tile.disabled ? '🔒' : starText(stars);
    tile.append(no, starLine);
    tile.onclick = () => onPick(i);
    grid.append(tile);
  });
}

// 畫面上的訊息層，搭配 handheld.css 的 .overlay 結構
export class Overlay {
  constructor(root) {
    this.root = root;
    root.innerHTML = `<div class="overlayInner">
      <div class="resultTitle"></div>
      <div class="resultStars hide"></div>
      <div class="overExtra"></div>
      <div class="hint"></div>
      <button class="btn primary hide"></button>
      <button class="btn ghost small hide"></button>
    </div>`;
    this.titleEl = root.querySelector('.resultTitle');
    this.starsEl = root.querySelector('.resultStars');
    this.extraEl = root.querySelector('.overExtra');
    this.hintEl = root.querySelector('.hint');
    [this.mainBtn, this.subBtn] = root.querySelectorAll('button');
    this.mainBtn.onclick = () => this.main?.();
    this.subBtn.onclick = () => this.sub?.();
  }

  get visible() {
    return this.root.classList.contains('show');
  }

  show({ title, cls = 'text', stars = null, extra = '', hint = '', action = null, secondary = null }) {
    this.titleEl.textContent = title;
    this.titleEl.className = `resultTitle ${cls}`;
    this.starsEl.classList.toggle('hide', stars === null);
    this.starsEl.textContent = stars === null ? '' : starText(stars);
    this.extraEl.textContent = extra;
    this.hintEl.textContent = hint;
    [[this.mainBtn, action], [this.subBtn, secondary]].forEach(([btn, a]) => {
      btn.classList.toggle('hide', !a);
      if (a) btn.textContent = a.label;
    });
    this.main = action?.run;
    this.sub = secondary?.run;
    this.root.classList.add('show');
  }

  hide() {
    this.root.classList.remove('show');
    this.main = this.sub = null;
  }
}

// 讓固定解析度的遊戲畫面等比例塞進容器，回傳縮放倍率
export function fitStage(canvas, container, width, height) {
  const scale = Math.max(0.5, Math.min(container.clientWidth / width, container.clientHeight / height));
  const dpr = window.devicePixelRatio || 1;
  canvas.style.width = `${Math.floor(width * scale)}px`;
  canvas.style.height = `${Math.floor(height * scale)}px`;
  canvas.width = Math.round(width * scale * dpr);
  canvas.height = Math.round(height * scale * dpr);
  canvas.getContext('2d').setTransform(scale * dpr, 0, 0, scale * dpr, 0, 0);
  return scale;
}
