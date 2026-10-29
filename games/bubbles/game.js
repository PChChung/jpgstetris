// 泡泡連發：遊戲規則與繪圖。畫面固定 240×360，由外層縮放
import { seededRandom } from '../../shared/random.js?v=202610300024';

export const W = 240;
export const H = 360;
const R = 15;
const D = R * 2;
const ROW_H = R * Math.sqrt(3);
const COLS = 8;                     // 偶數列 8 顆、奇數列 7 顆（往右錯半顆）
const CEILING = 6;
const LAUNCH = { x: W / 2, y: 338 };
const DANGER_Y = 298;               // 泡泡中心超過這條線就輸了
const SHOT_SPEED = 640;
const MIN_ANGLE = 0.08 * Math.PI;
const MAX_ANGLE = 0.92 * Math.PI;
const STICK = D * 0.86;             // 飛行中的泡泡離其他泡泡多近就黏住
export const COLORS = ['#ff5c8a', '#ffd23f', '#5ee0a0', '#4dd8ff', '#b57bff', '#ff9a3c'];

const colsIn = (r) => (r % 2 ? COLS - 1 : COLS);

function neighbors(r, c) {
  const shift = r % 2 ? 0 : -1; // 偶數列往左上、左下對齊，奇數列往右
  return [
    [r, c - 1], [r, c + 1],
    [r - 1, c + shift], [r - 1, c + shift + 1],
    [r + 1, c + shift], [r + 1, c + shift + 1],
  ].filter(([nr, nc]) => nr >= 0 && nc >= 0 && nc < colsIn(nr));
}

const SHAPES = {
  full: () => true,
  funnel: (r, u, rows) => Math.abs(u) <= 1.05 - (r / rows) * 0.9,
  center: (r, u) => r < 2 || Math.abs(u) < 0.5,
  teeth: (r, u, rows, c) => r < 2 + ((c * 5) % (rows - 1)),
  arch: (r, u) => r < 2 || Math.abs(u) > 0.45,
  pillars: (r, u, rows, c) => r < 2 || c % 4 < 2,
  holes: (r, u, rows, c, rng) => r === 0 || rng() > 0.24,
};

function cellX(r, c) {
  return R + c * D + (r % 2 ? R : 0);
}

// 依關卡設定產生盤面，最後移除沒有連到天花板的泡泡
function buildGrid(level, rng) {
  const shape = SHAPES[level.shape];
  const grid = [];
  for (let r = 0; r < level.rows; r++) {
    grid.push(Array.from({ length: colsIn(r) }, (_, c) => {
      const u = (cellX(r, c) - W / 2) / (W / 2);
      if (!shape(r, u, level.rows, c, rng)) return null;
      if (r < 2) return -2; // 最上面兩排相鄰不同色，避免打掉一團就整片掉光
      if (level.paint === 'stripes') return r % level.colors;
      if (level.paint === 'columns') return Math.floor(c / 2) % level.colors;
      return -1; // 稍後依鄰居上色
    }));
  }
  grid.forEach((row, r) => row.forEach((v, c) => {
    if (v !== -2) return;
    const avoid = new Set(neighbors(r, c).map(([nr, nc]) => grid[nr]?.[nc]).filter((n) => n >= 0));
    const options = [...Array(level.colors).keys()].filter((k) => !avoid.has(k));
    const pool = options.length ? options : [...Array(level.colors).keys()];
    row[c] = pool[Math.floor(rng() * pool.length)];
  }));
  grid.forEach((row, r) => row.forEach((v, c) => {
    if (v !== -1) return;
    const painted = neighbors(r, c).map(([nr, nc]) => grid[nr]?.[nc]).filter((n) => n !== null && n !== undefined && n >= 0);
    row[c] = painted.length && rng() < 0.6 ? painted[Math.floor(rng() * painted.length)] : Math.floor(rng() * level.colors);
  }));
  removeFloating(grid);
  return grid;
}

// 回傳被移除的泡泡（沒連到第 0 列的都會掉下去）
function removeFloating(grid) {
  const seen = new Set();
  const stack = [];
  (grid[0] || []).forEach((v, c) => {
    if (v !== null) {
      seen.add(`0,${c}`);
      stack.push([0, c]);
    }
  });
  while (stack.length) {
    const [r, c] = stack.pop();
    for (const [nr, nc] of neighbors(r, c)) {
      const key = `${nr},${nc}`;
      if (!seen.has(key) && grid[nr]?.[nc] !== null && grid[nr]?.[nc] !== undefined) {
        seen.add(key);
        stack.push([nr, nc]);
      }
    }
  }
  const dropped = [];
  grid.forEach((row, r) => row.forEach((v, c) => {
    if (v !== null && !seen.has(`${r},${c}`)) {
      dropped.push({ r, c, color: v });
      row[c] = null;
    }
  }));
  return dropped;
}

function drawBubble(ctx, x, y, color, radius = R - 0.5, alpha = 1) {
  ctx.globalAlpha = alpha;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,.25)';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,.5)';
  ctx.beginPath();
  ctx.arc(x - radius * 0.35, y - radius * 0.38, radius * 0.28, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;
}

// 事件：change（HUD 要更新）、won、lost
export class BubbleGame {
  constructor() {
    this.listeners = {};
    this.drops = 0;
    this.grid = [];
  }

  on(event, fn) {
    (this.listeners[event] ||= []).push(fn);
    return this;
  }

  emit(event, data) {
    (this.listeners[event] || []).forEach((fn) => fn(data));
  }

  start(level, index) {
    this.level = level;
    this.rng = seededRandom(5000 + index * 7919);
    this.grid = buildGrid(level, this.rng);
    this.initialCount = this.count;
    this.drops = 0;
    this.shots = 0;
    this.sinceDrop = 0;
    this.status = 'playing';
    this.aim = Math.PI / 2;
    this.flying = null;
    this.effects = [];
    this.current = this.pickColor();
    this.next = this.pickColor();
    this.emit('change');
  }

  get top() {
    return CEILING + this.drops * ROW_H;
  }

  get count() {
    return this.grid.reduce((n, row) => n + row.filter((v) => v !== null).length, 0);
  }

  get shotsUntilDrop() {
    return this.level.dropEvery - this.sinceDrop;
  }

  cellPos(r, c) {
    return { x: cellX(r, c), y: this.top + R + r * ROW_H };
  }

  // 只發盤面上還有的顏色
  pickColor() {
    const present = [...new Set(this.grid.flat().filter((v) => v !== null))];
    if (!present.length) return 0;
    return present[Math.floor(this.rng() * present.length)];
  }

  setAim(angle) {
    this.aim = Math.max(MIN_ANGLE, Math.min(MAX_ANGLE, angle));
  }

  aimAt(x, y) {
    if (y > LAUNCH.y - 12) return false;
    this.setAim(Math.atan2(LAUNCH.y - y, x - LAUNCH.x));
    return true;
  }

  swap() {
    if (this.flying || this.status !== 'playing') return;
    [this.current, this.next] = [this.next, this.current];
    this.emit('change');
  }

  shoot() {
    if (this.flying || this.status !== 'playing') return;
    this.flying = {
      x: LAUNCH.x, y: LAUNCH.y,
      vx: Math.cos(this.aim) * SHOT_SPEED, vy: -Math.sin(this.aim) * SHOT_SPEED,
      color: this.current,
    };
    this.current = this.next;
    this.next = this.pickColor();
    this.shots++;
    this.emit('change');
  }

  touches(x, y) {
    if (y - R <= this.top) return true;
    for (let r = 0; r < this.grid.length; r++) {
      for (let c = 0; c < this.grid[r].length; c++) {
        if (this.grid[r][c] === null) continue;
        const p = this.cellPos(r, c);
        if ((p.x - x) ** 2 + (p.y - y) ** 2 < STICK * STICK) return true;
      }
    }
    return false;
  }

  // 沿著瞄準方向走一遍，回傳路徑上的轉折點（給瞄準線用）
  tracePath(maxLength = 520) {
    let x = LAUNCH.x;
    let y = LAUNCH.y;
    let vx = Math.cos(this.aim);
    const vy = -Math.sin(this.aim);
    const points = [{ x, y }];
    for (let travelled = 0; travelled < maxLength; travelled += 4) {
      x += vx * 4;
      y += vy * 4;
      if (x < R || x > W - R) {
        x = Math.max(R, Math.min(W - R, x));
        vx = -vx;
        points.push({ x, y });
      }
      if (this.touches(x, y)) break;
    }
    points.push({ x, y });
    return points;
  }

  update(dt) {
    dt = Math.min(dt, 0.05);
    this.effects = this.effects.filter((fx) => {
      fx.t += dt;
      if (fx.kind === 'fall') {
        fx.vy += 900 * dt;
        fx.y += fx.vy * dt;
        fx.x += fx.vx * dt;
        return fx.y < H + R;
      }
      return fx.t < 0.2;
    });
    if (!this.flying || this.status !== 'playing') return;

    // 分小步移動，避免高速穿過泡泡
    const f = this.flying;
    const steps = Math.ceil((SHOT_SPEED * dt) / 4);
    for (let i = 0; i < steps; i++) {
      f.x += (f.vx * dt) / steps;
      f.y += (f.vy * dt) / steps;
      if (f.x < R || f.x > W - R) {
        f.x = Math.max(R, Math.min(W - R, f.x));
        f.vx = -f.vx;
      }
      if (this.touches(f.x, f.y)) {
        this.attach(f);
        return;
      }
    }
  }

  // 黏到離落點最近、且有東西可以依附的空格
  attach(f) {
    const approx = Math.round((f.y - this.top - R) / ROW_H);
    let best = null;
    for (let r = Math.max(0, approx - 1); r <= approx + 1; r++) {
      for (let c = 0; c < colsIn(r); c++) {
        if (this.grid[r]?.[c] !== null && this.grid[r]?.[c] !== undefined) continue;
        const supported = r === 0 || neighbors(r, c).some(([nr, nc]) => this.grid[nr]?.[nc] !== null && this.grid[nr]?.[nc] !== undefined);
        if (!supported) continue;
        const p = this.cellPos(r, c);
        const d = (p.x - f.x) ** 2 + (p.y - f.y) ** 2;
        if (!best || d < best.d) best = { r, c, d };
      }
    }
    this.flying = null;
    if (!best) return;
    while (this.grid.length <= best.r) this.grid.push(Array(colsIn(this.grid.length)).fill(null));
    this.grid[best.r][best.c] = f.color;
    this.resolve(best.r, best.c, f.color);
  }

  resolve(r, c, color) {
    // 同色相連三顆以上就消除
    const group = [[r, c]];
    const seen = new Set([`${r},${c}`]);
    for (let i = 0; i < group.length; i++) {
      for (const [nr, nc] of neighbors(...group[i])) {
        const key = `${nr},${nc}`;
        if (!seen.has(key) && this.grid[nr]?.[nc] === color) {
          seen.add(key);
          group.push([nr, nc]);
        }
      }
    }
    if (group.length >= 3) {
      group.forEach(([gr, gc]) => {
        this.effects.push({ kind: 'pop', ...this.cellPos(gr, gc), color, t: 0 });
        this.grid[gr][gc] = null;
      });
      removeFloating(this.grid).forEach((b) => {
        this.effects.push({ kind: 'fall', ...this.cellPos(b.r, b.c), color: b.color, vx: (this.rng() - 0.5) * 60, vy: -40, t: 0 });
      });
      while (this.grid.length && this.grid[this.grid.length - 1].every((v) => v === null)) this.grid.pop();
    }

    if (!this.count) {
      this.status = 'won';
      this.emit('change');
      this.emit('won');
      return;
    }

    this.sinceDrop++;
    if (this.sinceDrop >= this.level.dropEvery) {
      this.sinceDrop = 0;
      this.drops++;
    }

    // 手上的顏色已經不在盤面上就換掉
    const present = new Set(this.grid.flat().filter((v) => v !== null));
    if (!present.has(this.current)) this.current = this.pickColor();
    if (!present.has(this.next)) this.next = this.pickColor();

    const lowest = this.grid.reduce((max, row, gr) => (row.some((v) => v !== null) ? gr : max), -1);
    if (lowest >= 0 && this.cellPos(lowest, 0).y > DANGER_Y) {
      this.status = 'lost';
      this.emit('change');
      this.emit('lost');
      return;
    }
    this.emit('change');
  }

  draw(ctx) {
    ctx.fillStyle = '#111827';
    ctx.fillRect(0, 0, W, H);

    // 天花板：往下壓的板子
    ctx.fillStyle = '#2b2650';
    ctx.fillRect(0, 0, W, this.top);
    ctx.fillStyle = '#4b4384';
    ctx.fillRect(0, this.top - 3, W, 3);

    // 警戒線
    ctx.strokeStyle = 'rgba(255,107,107,.35)';
    ctx.setLineDash([6, 6]);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, DANGER_Y + R);
    ctx.lineTo(W, DANGER_Y + R);
    ctx.stroke();
    ctx.setLineDash([]);
    if (!this.level) return;

    this.grid.forEach((row, r) => row.forEach((v, c) => {
      if (v === null) return;
      const p = this.cellPos(r, c);
      drawBubble(ctx, p.x, p.y, COLORS[v]);
    }));

    for (const fx of this.effects) {
      if (fx.kind === 'pop') drawBubble(ctx, fx.x, fx.y, COLORS[fx.color], R * (1 + fx.t * 2), 1 - fx.t * 5);
      else drawBubble(ctx, fx.x, fx.y, COLORS[fx.color]);
    }

    if (this.status === 'playing' && !this.flying) {
      ctx.fillStyle = 'rgba(217,242,228,.55)';
      const pts = this.tracePath();
      for (let i = 1; i < pts.length; i++) {
        const a = pts[i - 1];
        const b = pts[i];
        const len = Math.hypot(b.x - a.x, b.y - a.y);
        for (let d = 14; d < len; d += 12) {
          ctx.beginPath();
          ctx.arc(a.x + ((b.x - a.x) * d) / len, a.y + ((b.y - a.y) * d) / len, 1.6, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }

    if (this.flying) drawBubble(ctx, this.flying.x, this.flying.y, COLORS[this.flying.color]);

    // 發射台：目前的泡泡在中間，下一顆在左下
    ctx.strokeStyle = '#b9b3dc';
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(LAUNCH.x, LAUNCH.y);
    ctx.lineTo(LAUNCH.x + Math.cos(this.aim) * 30, LAUNCH.y - Math.sin(this.aim) * 30);
    ctx.stroke();
    if (this.status === 'playing') drawBubble(ctx, LAUNCH.x, LAUNCH.y, COLORS[this.current]);
    drawBubble(ctx, LAUNCH.x - 52, LAUNCH.y + 6, COLORS[this.next], R * 0.7);
    ctx.fillStyle = '#7f9a8d';
    ctx.font = '10px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('下一顆', LAUNCH.x - 52, LAUNCH.y - 9);
  }
}
