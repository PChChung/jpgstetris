// 俄羅斯方塊核心規則：不碰 DOM，畫面與連線都只透過事件取得狀態
export const COLS = 10;
export const ROWS = 20;
export const TYPES = ['I', 'J', 'L', 'O', 'S', 'T', 'Z'];
export const GARBAGE = 'G';

const LOCK_DELAY = 500;      // 碰底後還能調整的時間
const MAX_LOCK_RESETS = 15;  // 碰底後移動/旋轉最多重置幾次，避免無限拖延
const CLEAR_DELAY = 140;     // 消行閃光時間
const MAX_PENDING_GARBAGE = 12;
const LINE_SCORES = [0, 100, 300, 700, 1500];
const HARD_DROP_BONUS = 2;
const ATTACK = [0, 0, 1, 2, 4];

// 方塊放在 N×N 方框內，直接旋轉方框就符合 SRS 的四個方向
const SHAPES = {
  I: [[0, 0, 0, 0], [1, 1, 1, 1], [0, 0, 0, 0], [0, 0, 0, 0]],
  J: [[1, 0, 0], [1, 1, 1], [0, 0, 0]],
  L: [[0, 0, 1], [1, 1, 1], [0, 0, 0]],
  O: [[1, 1], [1, 1]],
  S: [[0, 1, 1], [1, 1, 0], [0, 0, 0]],
  T: [[0, 1, 0], [1, 1, 1], [0, 0, 0]],
  Z: [[1, 1, 0], [0, 1, 1], [0, 0, 0]],
};

// SRS 順時針踢牆表，索引為旋轉前方向（0→R、R→2、2→L、L→0）；y 向下為正
const KICKS = {
  normal: [
    [[0, 0], [-1, 0], [-1, -1], [0, 2], [-1, 2]],
    [[0, 0], [1, 0], [1, 1], [0, -2], [1, -2]],
    [[0, 0], [1, 0], [1, -1], [0, 2], [1, 2]],
    [[0, 0], [-1, 0], [-1, 1], [0, -2], [-1, -2]],
  ],
  I: [
    [[0, 0], [-2, 0], [1, 0], [-2, 1], [1, -2]],
    [[0, 0], [-1, 0], [2, 0], [-1, -2], [2, 1]],
    [[0, 0], [2, 0], [-1, 0], [2, -1], [-1, 2]],
    [[0, 0], [1, 0], [-2, 0], [1, 2], [-2, -1]],
  ],
};

function rotateCW(matrix) {
  return matrix[0].map((_, i) => matrix.map((row) => row[i]).reverse());
}

export function shapeOf(type) {
  return SHAPES[type];
}

export function emptyBoard() {
  return Array.from({ length: ROWS }, () => Array(COLS).fill(null));
}

export function attackFor(cleared) {
  return ATTACK[cleared] ?? 0;
}

export { seededRandom } from '../../shared/random.js';

// 事件：change（畫面要更新）、lock({cleared})、attack(行數)、gameover
export class TetrisGame {
  constructor() {
    this.listeners = {};
    this.reset();
  }

  on(event, fn) {
    (this.listeners[event] ||= []).push(fn);
    return this;
  }

  emit(event, data) {
    if (event === 'change') this.version++;
    (this.listeners[event] || []).forEach((fn) => fn(data));
  }

  // startLevel：起始速度；garbageRows：開局預擺在底部的垃圾行數
  reset({ startLevel = 1, garbageRows = 0, random = Math.random } = {}) {
    this.random = random;
    this.startLevel = startLevel;
    this.board = emptyBoard();
    for (let i = 0; i < garbageRows; i++) {
      const hole = Math.floor(this.random() * COLS);
      this.board[ROWS - 1 - i] = Array.from({ length: COLS }, (_, x) => (x === hole ? null : GARBAGE));
    }
    this.bag = [];
    this.nextType = this.drawFromBag();
    this.piece = null;
    this.score = 0;
    this.lines = 0;
    this.level = startLevel;
    this.pieces = 0;
    this.over = false;
    this.flashRows = [];
    this.clearTimer = 0;
    this.pendingGarbage = 0;
    this.version = 0;
    this.spawn();
  }

  get dropInterval() {
    return Math.max(95, 700 - (this.level - 1) * 55);
  }

  // 遊戲結束或消行動畫中，不接受操作
  get busy() {
    return this.over || this.flashRows.length > 0 || !this.piece;
  }

  // 7-bag：每 7 顆一輪，七種各出現一次
  drawFromBag() {
    if (!this.bag.length) {
      this.bag = TYPES.slice();
      for (let i = this.bag.length - 1; i > 0; i--) {
        const j = Math.floor(this.random() * (i + 1));
        [this.bag[i], this.bag[j]] = [this.bag[j], this.bag[i]];
      }
    }
    return this.bag.pop();
  }

  spawn() {
    const type = this.nextType;
    this.nextType = this.drawFromBag();
    this.piece = {
      type,
      matrix: SHAPES[type].map((row) => row.slice()),
      rot: 0,
      x: type === 'O' ? 4 : 3,
      y: type === 'I' ? -1 : 0,
    };
    this.gravityTimer = 0;
    this.lockTimer = 0;
    this.lockResets = 0;
    if (this.collides(this.piece)) {
      this.finish();
      return;
    }
    this.emit('change');
  }

  // 盤面上方（y < 0）視為空地，方塊可以暫時超出頂端
  collides(p, dx = 0, dy = 0, matrix = p.matrix) {
    for (let y = 0; y < matrix.length; y++) {
      for (let x = 0; x < matrix[y].length; x++) {
        if (!matrix[y][x]) continue;
        const nx = p.x + x + dx;
        const ny = p.y + y + dy;
        if (nx < 0 || nx >= COLS || ny >= ROWS) return true;
        if (ny >= 0 && this.board[ny][nx]) return true;
      }
    }
    return false;
  }

  get garbageLeft() {
    return this.board.filter((row) => row.includes(GARBAGE)).length;
  }

  get grounded() {
    return !!this.piece && this.collides(this.piece, 0, 1);
  }

  ghostY() {
    if (!this.piece) return 0;
    let dy = 0;
    while (!this.collides(this.piece, 0, dy + 1)) dy++;
    return this.piece.y + dy;
  }

  afterManualMove() {
    if (this.lockTimer > 0 && this.lockResets < MAX_LOCK_RESETS) {
      this.lockTimer = 0;
      this.lockResets++;
    }
    this.emit('change');
  }

  move(dx) {
    if (this.busy || this.collides(this.piece, dx, 0)) return false;
    this.piece.x += dx;
    this.afterManualMove();
    return true;
  }

  rotate() {
    if (this.busy) return false;
    const p = this.piece;
    if (p.type === 'O') return true;
    const matrix = rotateCW(p.matrix);
    const kicks = (p.type === 'I' ? KICKS.I : KICKS.normal)[p.rot];
    for (const [kx, ky] of kicks) {
      if (!this.collides(p, kx, ky, matrix)) {
        p.matrix = matrix;
        p.x += kx;
        p.y += ky;
        p.rot = (p.rot + 1) % 4;
        this.afterManualMove();
        return true;
      }
    }
    return false;
  }

  // 軟降：碰底時不會立刻鎖定，仍保留鎖定延遲
  softDrop() {
    if (this.busy || this.grounded) return false;
    this.piece.y++;
    this.gravityTimer = 0;
    this.emit('change');
    return true;
  }

  hardDrop() {
    if (this.busy) return;
    this.piece.y = this.ghostY();
    this.score += HARD_DROP_BONUS;
    this.lock();
  }

  update(dt) {
    if (this.over) return;
    dt = Math.min(dt, 100);
    if (this.flashRows.length) {
      this.clearTimer -= dt;
      if (this.clearTimer <= 0) this.finishClear();
      return;
    }
    if (!this.piece) return;

    if (this.grounded) {
      this.lockTimer += dt;
      if (this.lockTimer >= LOCK_DELAY) this.lock();
      return;
    }
    this.lockTimer = 0;
    this.gravityTimer += dt;
    while (this.gravityTimer >= this.dropInterval) {
      this.gravityTimer -= this.dropInterval;
      if (this.grounded) break;
      this.piece.y++;
      this.emit('change');
    }
  }

  lock() {
    const p = this.piece;
    let lockedAboveTop = false;
    p.matrix.forEach((row, y) => row.forEach((v, x) => {
      if (!v) return;
      if (p.y + y < 0) lockedAboveTop = true;
      else this.board[p.y + y][p.x + x] = p.type;
    }));
    this.piece = null;
    this.pieces++;
    if (lockedAboveTop) {
      this.finish();
      return;
    }
    const full = [];
    this.board.forEach((row, y) => {
      if (row.every(Boolean)) full.push(y);
    });
    if (full.length) {
      this.flashRows = full;
      this.clearTimer = CLEAR_DELAY;
      this.emit('change');
    } else {
      this.afterLock(0);
    }
  }

  finishClear() {
    const cleared = this.flashRows.length;
    const full = new Set(this.flashRows);
    const remaining = this.board.filter((_, y) => !full.has(y));
    while (remaining.length < ROWS) remaining.unshift(Array(COLS).fill(null));
    this.board = remaining;
    this.flashRows = [];
    this.score += LINE_SCORES[cleared];
    this.lines += cleared;
    this.level = this.startLevel + Math.floor(this.lines / 10);
    this.afterLock(cleared);
  }

  // 消行先抵銷自己待收的垃圾行，剩下的才打給對手；沒消行才把垃圾行推進盤面
  afterLock(cleared) {
    let attack = attackFor(cleared);
    if (attack && this.pendingGarbage) {
      const cancel = Math.min(attack, this.pendingGarbage);
      attack -= cancel;
      this.pendingGarbage -= cancel;
    }
    if (attack) this.emit('attack', attack);
    if (!cleared && this.pendingGarbage && !this.raiseGarbage(Math.min(4, this.pendingGarbage))) return;
    this.emit('lock', { cleared });
    this.spawn();
  }

  addGarbage(rows) {
    if (this.over) return;
    this.pendingGarbage = Math.min(MAX_PENDING_GARBAGE, this.pendingGarbage + rows);
    this.emit('change');
  }

  raiseGarbage(rows) {
    const hole = Math.floor(this.random() * COLS);
    for (let i = 0; i < rows; i++) {
      const top = this.board.shift();
      this.board.push(Array.from({ length: COLS }, (_, x) => (x === hole ? null : GARBAGE)));
      this.pendingGarbage--;
      if (top.some(Boolean)) {
        this.finish();
        return false;
      }
    }
    return true;
  }

  finish() {
    if (this.over) return;
    this.over = true;
    this.emit('change');
    this.emit('gameover');
  }

  // 200 字元字串：盤面（含正在落下的方塊），對戰時傳給對手畫小盤面
  encode() {
    const cells = this.board.map((row) => row.slice());
    const p = this.piece;
    if (p) {
      p.matrix.forEach((row, y) => row.forEach((v, x) => {
        if (v && p.y + y >= 0) cells[p.y + y][p.x + x] = p.type;
      }));
    }
    return cells.map((row) => row.map((c) => c || '.').join('')).join('');
  }
}
