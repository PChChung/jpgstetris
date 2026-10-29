import { COLS, ROWS, GARBAGE, shapeOf } from './engine.js?v=202610300040';

export const COLORS = {
  I: '#4dd8ff', J: '#5b7cff', L: '#ff9a3c', O: '#ffd23f', S: '#5ee0a0', T: '#b57bff', Z: '#ff5c8a',
  [GARBAGE]: '#5a5f7a',
};

const LCD = '#111827';

// 像積木一樣：上緣亮、下緣暗
function drawCell(ctx, color, x, y, size) {
  const px = x * size + 1;
  const py = y * size + 1;
  const s = size - 2;
  const edge = Math.max(2, Math.round(size * 0.14));
  ctx.fillStyle = color;
  ctx.fillRect(px, py, s, s);
  ctx.fillStyle = 'rgba(255,255,255,.32)';
  ctx.fillRect(px, py, s, edge);
  ctx.fillStyle = 'rgba(0,0,0,.22)';
  ctx.fillRect(px, py + s - edge, s, edge);
}

function drawGrid(ctx, size, alpha) {
  ctx.fillStyle = LCD;
  ctx.fillRect(0, 0, COLS * size, ROWS * size);
  ctx.strokeStyle = `rgba(120,140,190,${alpha})`;
  ctx.lineWidth = 1;
  // 線畫在格線內側半像素，最右、最下那條才不會被 canvas 邊界裁掉
  const w = COLS * size;
  const h = ROWS * size;
  const line = (v, max) => Math.min(v + 0.5, max - 0.5);
  ctx.beginPath();
  for (let x = 0; x <= COLS; x++) {
    ctx.moveTo(line(x * size, w), 0);
    ctx.lineTo(line(x * size, w), h);
  }
  for (let y = 0; y <= ROWS; y++) {
    ctx.moveTo(0, line(y * size, h));
    ctx.lineTo(w, line(y * size, h));
  }
  ctx.stroke();
}

// 依容器大小與螢幕像素密度調整 canvas，回傳每格像素
export function fitCanvas(canvas, maxW, maxH) {
  const cell = Math.max(10, Math.floor(Math.min(maxW / COLS, maxH / ROWS)));
  const dpr = window.devicePixelRatio || 1;
  canvas.style.width = `${cell * COLS}px`;
  canvas.style.height = `${cell * ROWS}px`;
  canvas.width = Math.round(cell * COLS * dpr);
  canvas.height = Math.round(cell * ROWS * dpr);
  canvas.getContext('2d').setTransform(dpr, 0, 0, dpr, 0, 0);
  return cell;
}

export function drawBoard(ctx, game, size) {
  drawGrid(ctx, size, 0.16);
  game.board.forEach((row, y) => row.forEach((c, x) => {
    if (c) drawCell(ctx, COLORS[c], x, y, size);
  }));

  if (game.flashRows.length) {
    game.flashRows.forEach((y) => {
      ctx.fillStyle = 'rgba(255,255,255,.85)';
      ctx.fillRect(0, y * size, COLS * size, size);
    });
  }

  const p = game.piece;
  if (!p) return;
  // 落點預覽
  const ghostY = game.ghostY();
  ctx.strokeStyle = COLORS[p.type];
  ctx.globalAlpha = 0.55;
  ctx.lineWidth = 2;
  p.matrix.forEach((row, y) => row.forEach((v, x) => {
    if (v && ghostY + y >= 0) ctx.strokeRect((p.x + x) * size + 2, (ghostY + y) * size + 2, size - 4, size - 4);
  }));
  ctx.globalAlpha = 1;
  p.matrix.forEach((row, y) => row.forEach((v, x) => {
    if (v && p.y + y >= 0) drawCell(ctx, COLORS[p.type], p.x + x, p.y + y, size);
  }));
}

// 對手小盤面：encoded 是 TetrisGame.encode() 的 200 字元字串
export function drawMiniBoard(ctx, encoded, size) {
  drawGrid(ctx, size, 0.1);
  if (!encoded) return;
  for (let i = 0; i < encoded.length; i++) {
    const c = encoded[i];
    if (COLORS[c]) drawCell(ctx, COLORS[c], i % COLS, Math.floor(i / COLS), size);
  }
}

export function drawNext(ctx, type, width, height) {
  ctx.clearRect(0, 0, width, height);
  if (!type) return;
  const matrix = shapeOf(type);
  const rows = matrix.filter((row) => row.some(Boolean));
  const cols = matrix[0].map((_, x) => x).filter((x) => matrix.some((row) => row[x]));
  const size = Math.min(22, Math.floor(width / 4.5));
  const ox = (width - cols.length * size) / 2;
  const oy = (height - rows.length * size) / 2;
  ctx.save();
  ctx.translate(ox, oy);
  rows.forEach((row, y) => cols.forEach((cx, x) => {
    if (row[cx]) drawCell(ctx, COLORS[type], x, y, size);
  }));
  ctx.restore();
}
