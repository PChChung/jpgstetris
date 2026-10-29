// 光點迷宮：迷宮產生、移動、巡邏機 AI 與繪圖。地圖 15×19 格，每格 16，畫面 240×304
import { seededRandom } from '../../shared/random.js?v=202610300028';

export const COLS = 15;
export const ROWS = 19;
export const T = 16;
export const W = COLS * T;
export const H = ROWS * T;

const PLAYER_SPEED = 5.2;        // 格／秒
const PATROL_SPEED = 4.6;
const LIVES = 3;
const RELEASE_GAP = 2.5;         // 巡邏機依序離開基地的間隔
const HOME_WAIT = 3;             // 被撞回基地後要等多久才出來
const READY_TIME = 1.2;          // 每次開局／復活前的停頓
const CORNER_GRACE = 0.4;        // 走過路口幾成格以內還能補轉彎
const HUNT_TIME = 12;           // 追 12 秒後回各自角落巡邏 5 秒，讓玩家有喘息空檔
const REST_TIME = 5;
const START = { x: 7, y: 15 };
const PEN = { x0: 6, x1: 8, y0: 8, y1: 10 };
const CORNERS = [{ x: 1, y: 1 }, { x: 13, y: 1 }, { x: 1, y: 17 }, { x: 13, y: 17 }];
const DIRS = [{ x: 0, y: -1 }, { x: -1, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 0 }];
const PATROL_COLOR = { chase: '#ff5c8a', ambush: '#b57bff', wander: '#ffd23f', guard: '#ff9a3c' };

const inPen = (x, y) => x >= PEN.x0 && x <= PEN.x1 && y >= PEN.y0 && y <= PEN.y1;
const same = (a, b) => a.x === b.x && a.y === b.y;

// 左半邊用深度優先挖出迷宮，再鏡像到右半邊；接著依 loops 比例打通死路，讓迷宮有迴圈可以繞
export function buildMaze(level, seed) {
  const rng = seededRandom(seed);
  const grid = Array.from({ length: ROWS }, () => Array(COLS).fill(1));
  const half = (x) => x <= 7;
  const stack = [{ x: 7, y: 17 }];
  grid[17][7] = 0;
  while (stack.length) {
    const cur = stack[stack.length - 1];
    const options = DIRS
      .map((d) => ({ x: cur.x + d.x * 2, y: cur.y + d.y * 2, wx: cur.x + d.x, wy: cur.y + d.y }))
      .filter((n) => n.x >= 1 && half(n.x) && n.y >= 1 && n.y <= ROWS - 2 && grid[n.y][n.x] === 1);
    if (!options.length) {
      stack.pop();
      continue;
    }
    const n = options[Math.floor(rng() * options.length)];
    grid[n.wy][n.wx] = 0;
    grid[n.y][n.x] = 0;
    stack.push(n);
  }

  const openAt = (x, y) => x >= 0 && x < COLS && y >= 0 && y < ROWS && grid[y][x] === 0;
  const mirror = () => {
    for (let y = 0; y < ROWS; y++) for (let x = 0; x < 7; x++) grid[y][COLS - 1 - x] = grid[y][x];
  };
  mirror();
  for (let y = 1; y < ROWS - 1; y += 2) {
    for (let x = 1; x <= 7; x += 2) {
      const exits = DIRS.filter((d) => openAt(x + d.x, y + d.y)).length;
      if (exits !== 1 || rng() >= level.loops) continue;
      const walls = DIRS
        .map((d) => ({ wx: x + d.x, wy: y + d.y, nx: x + d.x * 2, ny: y + d.y * 2 }))
        .filter((w) => w.nx >= 1 && w.nx <= COLS - 2 && w.ny >= 1 && w.ny <= ROWS - 2 && grid[w.wy][w.wx] === 1);
      if (!walls.length) continue;
      const w = walls[Math.floor(rng() * walls.length)];
      grid[w.wy][w.wx] = 0;
      grid[w.wy][COLS - 1 - w.wx] = 0;
    }
  }
  mirror();
  for (let y = PEN.y0; y <= PEN.y1; y++) for (let x = PEN.x0; x <= PEN.x1; x++) grid[y][x] = 0;
  return grid;
}

// 像素造型
function drawPlayer(ctx, px, py, dir, t) {
  const x = Math.round(px - 6);
  const y = Math.round(py - 6);
  ctx.fillStyle = '#ffd23f';
  ctx.fillRect(x + 5, y - 3 + (Math.floor(t * 4) % 2), 2, 2);
  ctx.fillStyle = '#5ee0a0';
  ctx.fillRect(x + 5, y - 1, 2, 2);
  ctx.fillRect(x, y + 1, 12, 11);
  ctx.fillRect(x + 1, y, 10, 13);
  ctx.fillStyle = '#111827';
  const ex = Math.round((dir?.x ?? 0) * 1.5);
  const ey = Math.round((dir?.y ?? 0) * 1.5);
  ctx.fillRect(x + 3 + ex, y + 4 + ey, 2, 3);
  ctx.fillRect(x + 7 + ex, y + 4 + ey, 2, 3);
}

function drawPatrol(ctx, px, py, color, dir, t, frozenBlink) {
  const x = Math.round(px - 6);
  const y = Math.round(py - 6);
  ctx.fillStyle = frozenBlink ?? color;
  ctx.fillRect(x + 2, y, 8, 2);
  ctx.fillRect(x, y + 2, 12, 8);
  const step = Math.floor(t * 6) % 2;
  for (let i = 0; i < 3; i++) ctx.fillRect(x + i * 4 + (step ? 1 : 0), y + 10, 3, 2);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(x + 3, y + 3, 6, 5);
  ctx.fillStyle = '#111827';
  ctx.fillRect(x + 5 + Math.round((dir?.x ?? 0) * 1.5), y + 4 + Math.round((dir?.y ?? 0) * 1.2), 2, 3);
}

// 事件：change（HUD 要更新）、won、lost
export class DotMaze {
  constructor() {
    this.listeners = {};
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
    this.rng = seededRandom(9000 + index * 7919);
    this.grid = buildMaze(level, 3000 + index * 104729);
    this.batteries = CORNERS.slice(0, level.batteries).map((c) => ({ ...c }));
    this.dots = new Set();
    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        if (this.grid[y][x] || inPen(x, y) || same({ x, y }, START) || this.batteries.some((b) => same(b, { x, y }))) continue;
        this.dots.add(`${x},${y}`);
      }
    }
    this.totalDots = this.dots.size;
    this.lives = LIVES;
    this.livesLost = 0;
    this.time = 0;
    this.frozen = 0;
    this.status = 'playing';
    this.wanted = null;
    this.resetActors();
    this.emit('change');
  }

  resetActors() {
    this.player = { x: START.x, y: START.y, dir: { x: 0, y: 0 }, t: 0 };
    this.patrols = this.level.patrols.map((kind, i) => ({
      kind,
      x: 7, y: 9,
      dir: { x: 0, y: 0 }, t: 0,
      wait: 0.6 + i * RELEASE_GAP,
      corner: CORNERS[i % 4],
    }));
    this.ready = READY_TIME;
    this.frozen = 0;
    this.huntClock = 0;
  }

  open(x, y) {
    return x >= 0 && x < COLS && y >= 0 && y < ROWS && this.grid[y][x] === 0;
  }

  pos(a) {
    return { x: a.x + a.dir.x * a.t, y: a.y + a.dir.y * a.t };
  }

  // 玩家想走的方向，到下一個路口時生效；反方向立刻轉身；
  // 剛走過路口一點點才按轉彎，就退回路口直接轉進去
  setDirection(dx, dy) {
    this.wanted = { x: dx, y: dy };
    const p = this.player;
    if (p.t > 0 && dx === -p.dir.x && dy === -p.dir.y) {
      p.x += p.dir.x;
      p.y += p.dir.y;
      p.dir = { x: dx, y: dy };
      p.t = 1 - p.t;
      return;
    }
    const turning = (dx !== 0) !== (p.dir.x !== 0);
    if (turning && p.t > 0 && p.t < CORNER_GRACE && this.open(p.x + dx, p.y + dy)) {
      p.dir = { x: dx, y: dy };
      p.t = 0;
    }
  }

  update(dt) {
    if (this.status !== 'playing') return;
    dt = Math.min(dt, 0.05);
    this.time += dt;
    if (this.ready > 0) {
      this.ready -= dt;
      return;
    }
    if (this.frozen > 0) this.frozen = Math.max(0, this.frozen - dt);
    else this.huntClock += dt;

    this.advance(this.player, PLAYER_SPEED * dt, (a) => this.choosePlayerDir(a));
    this.eat();
    if (this.status !== 'playing') return;

    for (const pt of this.patrols) {
      if (pt.wait > 0) {
        pt.wait -= dt;
        continue;
      }
      if (this.frozen > 0) continue;
      this.advance(pt, PATROL_SPEED * this.level.speed * dt, (a) => this.choosePatrolDir(a));
    }
    this.checkCollisions();
  }

  // 沿著目前方向前進；每到一格中心就問 choose 下一步往哪走
  advance(a, distance, choose) {
    if (!a.dir.x && !a.dir.y) {
      a.dir = choose(a);
      if (!a.dir.x && !a.dir.y) return;
    }
    a.t += distance;
    while (a.t >= 1) {
      a.x += a.dir.x;
      a.y += a.dir.y;
      a.t -= 1;
      if (a === this.player) this.eat();
      a.dir = choose(a);
      if (!a.dir.x && !a.dir.y) {
        a.t = 0;
        return;
      }
    }
  }

  choosePlayerDir(p) {
    const w = this.wanted;
    if (w && this.open(p.x + w.x, p.y + w.y)) return { ...w };
    if (this.open(p.x + p.dir.x, p.y + p.dir.y) && (p.dir.x || p.dir.y)) return p.dir;
    return { x: 0, y: 0 };
  }

  get resting() {
    return this.huntClock % (HUNT_TIME + REST_TIME) >= HUNT_TIME;
  }

  patrolTarget(pt) {
    const p = this.player;
    if (this.resting) return pt.corner;
    if (pt.kind === 'ambush') {
      const d = p.dir.x || p.dir.y ? p.dir : this.wanted ?? { x: 0, y: 0 };
      return { x: p.x + d.x * 4, y: p.y + d.y * 4 };
    }
    if (pt.kind === 'guard') {
      const near = Math.abs(p.x - pt.corner.x) + Math.abs(p.y - pt.corner.y) < 7;
      return near ? p : pt.corner;
    }
    return p;
  }

  // 不回頭；在可走的方向中挑離目標最近的，wander 隨機挑
  choosePatrolDir(pt) {
    let options = DIRS.filter((d) => this.open(pt.x + d.x, pt.y + d.y));
    const forward = options.filter((d) => !(d.x === -pt.dir.x && d.y === -pt.dir.y));
    if (forward.length) options = forward;
    if (!options.length) return { x: 0, y: 0 };
    if (pt.kind === 'wander' && !inPen(pt.x, pt.y) && !this.resting) return options[Math.floor(this.rng() * options.length)];
    const target = inPen(pt.x, pt.y) ? { x: 7, y: 5 } : this.patrolTarget(pt);
    let best = options[0];
    let bestD = Infinity;
    for (const d of options) {
      const dist = (pt.x + d.x - target.x) ** 2 + (pt.y + d.y - target.y) ** 2;
      if (dist < bestD) {
        bestD = dist;
        best = d;
      }
    }
    return best;
  }

  eat() {
    const p = this.pos(this.player);
    const tx = Math.round(p.x);
    const ty = Math.round(p.y);
    const key = `${tx},${ty}`;
    if (this.dots.delete(key)) this.emit('change');
    const b = this.batteries.findIndex((bt) => bt.x === tx && bt.y === ty);
    if (b >= 0) {
      this.batteries.splice(b, 1);
      this.frozen = this.level.freeze;
      this.emit('change');
    }
    if (!this.dots.size) {
      this.status = 'won';
      this.emit('won');
    }
  }

  checkCollisions() {
    const p = this.pos(this.player);
    for (const pt of this.patrols) {
      if (pt.wait > 0) continue;
      const q = this.pos(pt);
      if ((p.x - q.x) ** 2 + (p.y - q.y) ** 2 > 0.5) continue;
      if (this.frozen > 0) {
        // 凍住的巡邏機被撞回基地
        Object.assign(pt, { x: 7, y: 9, t: 0, dir: { x: 0, y: 0 }, wait: HOME_WAIT });
        continue;
      }
      this.lives--;
      this.livesLost++;
      this.emit('change');
      if (this.lives <= 0) {
        this.status = 'lost';
        this.emit('lost');
      } else {
        this.resetActors();
      }
      return;
    }
  }

  draw(ctx) {
    ctx.fillStyle = '#111827';
    ctx.fillRect(0, 0, W, H);
    if (!this.level) return;

    // 牆：深色方塊，朝通道的那一邊描亮邊
    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        if (!this.grid[y][x]) continue;
        ctx.fillStyle = '#2b2650';
        ctx.fillRect(x * T, y * T, T, T);
        ctx.fillStyle = '#7c6fd6';
        if (this.open(x, y - 1)) ctx.fillRect(x * T, y * T, T, 2);
        if (this.open(x, y + 1)) ctx.fillRect(x * T, y * T + T - 2, T, 2);
        if (this.open(x - 1, y)) ctx.fillRect(x * T, y * T, 2, T);
        if (this.open(x + 1, y)) ctx.fillRect(x * T + T - 2, y * T, 2, T);
      }
    }
    ctx.fillStyle = 'rgba(124,111,214,.12)';
    ctx.fillRect(PEN.x0 * T, PEN.y0 * T, (PEN.x1 - PEN.x0 + 1) * T, (PEN.y1 - PEN.y0 + 1) * T);

    ctx.fillStyle = '#d9f2e4';
    for (const key of this.dots) {
      const [x, y] = key.split(',').map(Number);
      ctx.fillRect(x * T + 7, y * T + 7, 2, 2);
    }
    const pulse = Math.floor(this.time * 4) % 2;
    for (const b of this.batteries) {
      ctx.fillStyle = pulse ? '#4dd8ff' : '#9fe8ff';
      ctx.fillRect(b.x * T + 4, b.y * T + 3, 8, 10);
      ctx.fillRect(b.x * T + 6, b.y * T + 1, 4, 2);
    }

    for (const pt of this.patrols) {
      const q = this.pos(pt);
      let ice = null;
      if (this.frozen > 0) ice = this.frozen < 1.5 && Math.floor(this.time * 8) % 2 ? PATROL_COLOR[pt.kind] : '#9fc9ff';
      if (pt.wait > 0 && !inPen(pt.x, pt.y)) continue;
      drawPatrol(ctx, q.x * T + T / 2, q.y * T + T / 2, PATROL_COLOR[pt.kind], pt.dir, this.time, ice);
    }

    const p = this.pos(this.player);
    if (!(this.ready > 0 && Math.floor(this.time * 8) % 2)) {
      drawPlayer(ctx, p.x * T + T / 2, p.y * T + T / 2, this.player.dir, this.time);
    }
  }
}
