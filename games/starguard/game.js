// 星艦防線：遊戲規則與繪圖。畫面固定 240×360，由外層縮放
export const W = 240;
export const H = 360;

const PX = 2; // 像素圖每格的大小
const PLAYER_Y = 334;
const PLAYER_SPEED = 160;
const DRAG_SPEED = 260;
const FIRE_INTERVAL = 0.26;
const MAX_SHOTS = 4;
const SHOT_SPEED = 330;
const LIVES = 3;
const RESPAWN_DELAY = 1.4;
const INVULN_TIME = 2;
const DOUBLE_TIME = 9;

// 像素造型：每個字母是一種顏色，. 是透明；敵機有兩格翅膀動畫
const PALETTE = {
  W: '#e4e1ef', C: '#4dd8ff', Y: '#ffd23f', P: '#ff5c8a', M: '#5ee0a0', V: '#b57bff', E: '#111827',
};
const SPRITES = {
  player: [[
    '....W....',
    '...WWW...',
    '...WCW...',
    '.Y.WWW.Y.',
    '.WWWWWWW.',
    'WWWPWPWWW',
    'WW.WWW.WW',
    'W...P...W',
  ]],
  d: [[
    '..M..M..',
    '...MM...',
    '.MMMMMM.',
    'MM.MM.MM',
    'M.MMMM.M',
    '...MM...',
    '..M..M..',
  ], [
    '..M..M..',
    '...MM...',
    '.MMMMMM.',
    'MM.MM.MM',
    'MMMMMMMM',
    '.M.MM.M.',
    'M......M',
  ]],
  g: [[
    '...YY...',
    '..YYYY..',
    '.YYEEYY.',
    'YYYYYYYY',
    'Y.YYYY.Y',
    'Y..YY..Y',
    '...YY...',
  ], [
    '...YY...',
    '..YYYY..',
    '.YYEEYY.',
    'YYYYYYYY',
    '.YYYYYY.',
    '..Y..Y..',
    '.Y....Y.',
  ]],
  t: [[
    '.PPPPPP.',
    'PPWPPWPP',
    'PPPPPPPP',
    '.PPPPPP.',
    'P.P..P.P',
    'P......P',
  ], [
    '.PPPPPP.',
    'PPWPPWPP',
    'PPPPPPPP',
    '.PPPPPP.',
    '.P.PP.P.',
    '..P..P..',
  ]],
  c: [[
    '...VV...',
    '.VVVVVV.',
    'VVYVVYVV',
    'VVVVVVVV',
    '.V.VV.V.',
    'V..VV..V',
    '.V....V.',
  ], [
    '...VV...',
    '.VVVVVV.',
    'VVYVVYVV',
    'VVVVVVVV',
    'VV.VV.VV',
    '.V.VV.V.',
    '..V..V..',
  ]],
};
const ENEMY = {
  d: { hp: 1, score: 50, shoots: false, color: PALETTE.M },
  g: { hp: 1, score: 80, shoots: true, color: PALETTE.Y },
  t: { hp: 2, score: 120, shoots: false, color: PALETTE.P },
  c: { hp: 3, score: 200, shoots: true, spread: true, color: PALETTE.V },
};

function drawSprite(ctx, rows, cx, cy, flash = false) {
  const ox = Math.round(cx - (rows[0].length * PX) / 2);
  const oy = Math.round(cy - (rows.length * PX) / 2);
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      const c = row[x];
      if (c === '.') continue;
      ctx.fillStyle = flash ? '#ffffff' : PALETTE[c];
      ctx.fillRect(ox + x * PX, oy + y * PX, PX, PX);
    }
  });
}

const hit = (a, b, r) => (a.x - b.x) ** 2 + (a.y - b.y) ** 2 < r * r;

// 事件：change（HUD 要更新）、won、lost
export class StarGuard {
  constructor() {
    this.listeners = {};
    this.stars = Array.from({ length: 50 }, () => ({ x: Math.random() * W, y: Math.random() * H, s: 10 + Math.random() * 40 }));
  }

  on(event, fn) {
    (this.listeners[event] ||= []).push(fn);
    return this;
  }

  emit(event, data) {
    (this.listeners[event] || []).forEach((fn) => fn(data));
  }

  start(level) {
    this.level = level;
    this.time = 0;
    this.lives = LIVES;
    this.livesLost = 0;
    this.score = 0;
    this.status = 'playing';
    this.player = { x: W / 2, y: PLAYER_Y, alive: true, invuln: 0, shield: false, double: 0, fireCd: 0.4, respawn: 0 };
    this.dir = 0;
    this.dragTarget = null;
    this.shots = [];
    this.bullets = [];
    this.items = [];
    this.sparks = [];
    this.diveCd = 2.5; // 開場先讓隊形就位
    this.formationFireCd = 2;
    this.cols = Math.max(...level.rows.map((r) => r.length));
    this.enemies = [];
    level.rows.forEach((row, r) => [...row].forEach((type, c) => {
      if (type === '.') return;
      const e = { type, row: r, col: c, hp: ENEMY[type].hp, state: 'enter', delay: c * 0.06 + r * 0.18, flash: 0, x: 0, y: -20 };
      this.enemies.push(e);
    }));
    this.emit('change');
  }

  slotX(e) {
    return W / 2 + (e.col - (this.cols - 1) / 2) * 25 + Math.sin(this.time * 0.8) * 16;
  }

  slotY(e) {
    return 46 + e.row * 22;
  }

  get enemiesLeft() {
    return this.enemies.length;
  }

  update(dt) {
    if (this.status !== 'playing') return;
    dt = Math.min(dt, 0.05);
    this.time += dt;
    this.updatePlayer(dt);
    this.updateEnemies(dt);
    this.updateProjectiles(dt);
    this.sparks = this.sparks.filter((s) => {
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      s.life -= dt;
      return s.life > 0;
    });
    if (!this.enemies.length) {
      this.status = 'won';
      this.emit('won');
    }
  }

  updatePlayer(dt) {
    const p = this.player;
    if (!p.alive) {
      p.respawn -= dt;
      if (p.respawn <= 0 && this.lives > 0) {
        Object.assign(p, { alive: true, x: W / 2, invuln: INVULN_TIME, fireCd: 0.3 });
        this.bullets = [];
      }
      return;
    }
    if (this.dragTarget !== null) {
      const d = this.dragTarget - p.x;
      p.x += Math.sign(d) * Math.min(Math.abs(d), DRAG_SPEED * dt);
    } else {
      p.x += this.dir * PLAYER_SPEED * dt;
    }
    p.x = Math.max(10, Math.min(W - 10, p.x));
    p.invuln = Math.max(0, p.invuln - dt);
    p.double = Math.max(0, p.double - dt);

    // 自動連射
    p.fireCd -= dt;
    if (p.fireCd <= 0 && this.shots.length < MAX_SHOTS * (p.double ? 2 : 1)) {
      p.fireCd = FIRE_INTERVAL;
      if (p.double) this.shots.push({ x: p.x - 6, y: p.y - 8 }, { x: p.x + 6, y: p.y - 8 });
      else this.shots.push({ x: p.x, y: p.y - 10 });
    }
  }

  updateEnemies(dt) {
    const lv = this.level;
    const formed = this.enemies.filter((e) => e.state === 'form');
    const diving = this.enemies.filter((e) => e.state === 'dive').length;

    this.diveCd -= dt;
    if (this.diveCd <= 0 && formed.length && diving < lv.divers && this.player.alive) {
      this.diveCd = lv.dive * (0.7 + Math.random() * 0.6);
      this.launchDive(formed[Math.floor(Math.random() * formed.length)]);
    }

    // 隊形中的砲手偶爾往正下方開火
    if (lv.fire > 0 && this.player.alive) {
      this.formationFireCd -= dt;
      if (this.formationFireCd <= 0) {
        this.formationFireCd = (2.6 + Math.random() * 1.6) / lv.fire;
        const shooters = formed.filter((e) => ENEMY[e.type].shoots);
        const s = shooters[Math.floor(Math.random() * shooters.length)];
        if (s) this.bullets.push({ x: s.x, y: s.y + 8, vx: 0, vy: 120 });
      }
    }

    for (const e of this.enemies) {
      e.flash = Math.max(0, e.flash - dt);
      const tx = this.slotX(e);
      const ty = this.slotY(e);
      if (e.state === 'enter') {
        e.delay -= dt;
        if (e.delay > 0) {
          e.x = tx;
          continue;
        }
        e.y += 170 * dt;
        e.x += (tx - e.x) * Math.min(1, 6 * dt);
        if (e.y >= ty) Object.assign(e, { y: ty, state: 'form' });
      } else if (e.state === 'form') {
        e.x = tx;
        e.y = ty;
      } else if (e.state === 'dive') {
        this.updateDive(e, dt);
      } else if (e.state === 'return') {
        const dx = tx - e.x;
        const dy = ty - e.y;
        const dist = Math.hypot(dx, dy);
        const step = 130 * dt;
        if (dist <= step) Object.assign(e, { x: tx, y: ty, state: 'form' });
        else {
          e.x += (dx / dist) * step;
          e.y += (dy / dist) * step;
        }
      }
    }
  }

  // 俯衝：先往上側翻，再蛇行衝向自機當下的位置，掉出畫面後從上方繞回隊形
  launchDive(e) {
    e.state = 'dive';
    e.t = 0;
    e.side = e.x < W / 2 ? -1 : 1;
    e.aimX = this.player.x;
    e.fireCd = 0.5 + Math.random() * 0.6;
  }

  updateDive(e, dt) {
    const lv = this.level;
    e.t += dt;
    if (e.t < 0.45) {
      e.x += e.side * 70 * dt;
      e.y -= (45 - e.t * 160) * dt;
    } else {
      const vy = (95 + e.t * 40) * lv.speed;
      e.y += Math.min(vy, 230 * lv.speed) * dt;
      const target = e.aimX + Math.sin(e.t * 3.2) * 38;
      e.x += Math.sign(target - e.x) * Math.min(Math.abs(target - e.x), 100 * lv.speed * dt);
      if (lv.fire > 0 && ENEMY[e.type].shoots && e.y < PLAYER_Y - 60) {
        e.fireCd -= dt;
        if (e.fireCd <= 0) {
          e.fireCd = (1.1 + Math.random() * 0.8) / lv.fire;
          this.fireAt(e, ENEMY[e.type].spread);
        }
      }
    }
    if (e.y > H + 16) Object.assign(e, { y: -16, state: 'return' });
  }

  fireAt(e, spread) {
    const p = this.player;
    const base = Math.atan2(p.y - e.y, p.x - e.x);
    const speed = 135 + this.level.fire * 15;
    const angles = spread ? [base - 0.3, base, base + 0.3] : [base];
    angles.forEach((a) => this.bullets.push({ x: e.x, y: e.y + 6, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed }));
  }

  updateProjectiles(dt) {
    const p = this.player;
    this.shots = this.shots.filter((s) => {
      s.y -= SHOT_SPEED * dt;
      if (s.y < -10) return false;
      const e = this.enemies.find((en) => en.y > 0 && hit(s, en, 9));
      if (!e) return true;
      this.damage(e);
      return false;
    });

    this.bullets = this.bullets.filter((b) => {
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      if (b.y > H + 8 || b.x < -8 || b.x > W + 8 || b.y < -8) return false;
      if (p.alive && hit(b, p, 6)) {
        this.hurtPlayer();
        return false;
      }
      return true;
    });

    // 被俯衝的敵機撞到：敵機同歸於盡
    if (p.alive && !p.invuln) {
      const rammer = this.enemies.find((e) => e.state === 'dive' && hit(e, p, 12));
      if (rammer) {
        this.damage(rammer, rammer.hp);
        this.hurtPlayer();
      }
    }

    this.items = this.items.filter((it) => {
      it.y += 55 * dt;
      if (it.y > H + 10) return false;
      if (p.alive && hit(it, p, 14)) {
        if (it.kind === 'double') p.double = DOUBLE_TIME;
        else p.shield = true;
        this.emit('change');
        return false;
      }
      return true;
    });
  }

  damage(e, amount = 1) {
    e.hp -= amount;
    e.flash = 0.08;
    if (e.hp > 0) return;
    this.enemies.splice(this.enemies.indexOf(e), 1);
    const diving = e.state === 'dive';
    this.score += ENEMY[e.type].score * (diving ? 2 : 1);
    this.burst(e.x, e.y, ENEMY[e.type].color);
    if (Math.random() < (diving ? 0.16 : 0.04)) this.items.push({ x: e.x, y: e.y, kind: Math.random() < 0.6 ? 'double' : 'shield' });
    this.emit('change');
  }

  hurtPlayer() {
    const p = this.player;
    if (!p.alive || p.invuln > 0) return;
    if (p.shield) {
      p.shield = false;
      p.invuln = 1;
      this.emit('change');
      return;
    }
    p.alive = false;
    p.double = 0;
    p.respawn = RESPAWN_DELAY;
    this.lives--;
    this.livesLost++;
    this.burst(p.x, p.y, PALETTE.W, 18);
    this.emit('change');
    if (this.lives <= 0) {
      this.status = 'lost';
      this.emit('lost');
    }
  }

  burst(x, y, color, n = 10) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const v = 30 + Math.random() * 90;
      this.sparks.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 0.35 + Math.random() * 0.3, color });
    }
  }

  // 背景星空在暫停或選關時也會繼續流動
  draw(ctx, dt = 0) {
    ctx.fillStyle = '#111827';
    ctx.fillRect(0, 0, W, H);
    for (const s of this.stars) {
      s.y += s.s * dt;
      if (s.y > H) Object.assign(s, { y: 0, x: Math.random() * W });
      ctx.fillStyle = s.s > 35 ? 'rgba(217,242,228,.8)' : 'rgba(217,242,228,.35)';
      ctx.fillRect(Math.round(s.x), Math.round(s.y), 1, s.s > 35 ? 2 : 1);
    }
    if (!this.level) return;

    const frame = Math.floor(this.time * 3) % 2;
    for (const e of this.enemies) {
      if (e.state === 'enter' && e.delay > 0) continue;
      drawSprite(ctx, SPRITES[e.type][frame], e.x, e.y, e.flash > 0);
    }

    ctx.fillStyle = '#ffd23f';
    for (const s of this.shots) ctx.fillRect(Math.round(s.x) - 1, Math.round(s.y) - 4, 2, 7);
    ctx.fillStyle = '#ff5c8a';
    for (const b of this.bullets) ctx.fillRect(Math.round(b.x) - 2, Math.round(b.y) - 2, 4, 4);

    for (const it of this.items) {
      ctx.fillStyle = it.kind === 'double' ? '#ffd23f' : '#4dd8ff';
      ctx.fillRect(Math.round(it.x) - 6, Math.round(it.y) - 6, 12, 12);
      ctx.fillStyle = '#111827';
      ctx.font = 'bold 9px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(it.kind === 'double' ? '2' : 'S', it.x, it.y + 0.5);
    }

    const p = this.player;
    if (p.alive && !(p.invuln > 0 && Math.floor(this.time * 12) % 2)) {
      drawSprite(ctx, SPRITES.player[0], p.x, p.y);
      if (p.shield) {
        ctx.strokeStyle = 'rgba(77,216,255,.8)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 13, 0, Math.PI * 2);
        ctx.stroke();
      }
    }

    for (const s of this.sparks) {
      ctx.fillStyle = s.color;
      ctx.fillRect(Math.round(s.x), Math.round(s.y), 2, 2);
    }
  }
}
