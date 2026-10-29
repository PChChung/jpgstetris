import { DotMaze, W, H } from './game.js?v=202610300040';
import { LEVELS, describeGoal, STAR_RULE, starsFor } from './levels.js?v=202610300040';
import { trackViewport, createProgress, renderLevelGrid, Overlay, fitStage, starText } from '../../shared/handheld.js?v=202610300040';

const STICK_DEADZONE = 12; // 手指離開按下的位置多遠才算有方向
const STICK_RANGE = 36;    // 超過這個距離，搖桿中心就跟著手指移動

const $ = (id) => document.getElementById(id);
const canvas = $('canvas');
const ctx = canvas.getContext('2d');
const stage = $('stage');
const overlay = new Overlay($('overlay'));
const progress = createProgress('dotmaze');
const game = new DotMaze();

let levelIndex = 0;
let running = false;
let paused = false;
let lastTime = 0;

function resize() {
  fitStage(canvas, stage, W, H);
}

function updateHud() {
  if (!game.level) return;
  $('lives').textContent = '♥'.repeat(Math.max(0, game.lives)) || '－';
  $('dotsLeft').textContent = game.dots.size;
  $('freeze').textContent = game.frozen > 0 ? `凍結 ${Math.ceil(game.frozen)}` : '';
}

function frame(t) {
  const dt = lastTime ? (t - lastTime) / 1000 : 0;
  lastTime = t;
  if (running && !paused) {
    game.update(dt);
    updateHud();
  }
  game.draw(ctx);
  requestAnimationFrame(frame);
}

function showLevels() {
  running = false;
  overlay.hide();
  renderLevelGrid({ grid: $('levelGrid'), totalEl: $('starTotal'), levels: LEVELS, progressStore: progress, onPick: openLevel });
  $('levels').classList.remove('hide');
}

function openLevel(index) {
  levelIndex = index;
  const level = LEVELS[index];
  $('levels').classList.add('hide');
  $('modeTag').textContent = `第 ${index + 1} 關　${level.name}`;
  game.start(level, index);
  running = false;
  paused = false;
  $('pauseBtn').textContent = 'Ⅱ';
  updateHud();
  resize();
  const best = progress.load().stars[index] ?? 0;
  overlay.show({
    title: level.name,
    extra: describeGoal(level),
    hint: `${STAR_RULE}${best ? `\n目前最佳 ${starText(best)}` : ''}`,
    action: { label: '開始', run: () => { overlay.hide(); running = true; } },
    secondary: { label: '選其他關卡', run: showLevels },
  });
}

function togglePause() {
  if (!running && !paused) return;
  paused = !paused;
  running = !paused;
  $('pauseBtn').textContent = paused ? '▶' : 'Ⅱ';
  if (paused) overlay.show({ title: '暫停中', action: { label: '繼續', run: togglePause } });
  else overlay.hide();
}

game.on('change', updateHud);
game.on('won', () => {
  running = false;
  const stars = starsFor(game.livesLost);
  progress.save(levelIndex, stars);
  const hasNext = levelIndex + 1 < LEVELS.length;
  const retry = { label: '再試一次', run: () => openLevel(levelIndex) };
  overlay.show({
    title: '過關',
    cls: 'win',
    stars,
    extra: game.livesLost ? `丟了 ${game.livesLost} 條命` : '一條命都沒丟',
    hint: stars < 3 ? STAR_RULE : (hasNext ? '' : '全部關卡都過了！'),
    action: hasNext ? { label: '下一關', run: () => openLevel(levelIndex + 1) } : { label: '回到選關', run: showLevels },
    secondary: stars < 3 ? retry : { label: '選其他關卡', run: showLevels },
  });
});
game.on('lost', () => {
  running = false;
  overlay.show({
    title: '挑戰失敗',
    extra: `還剩 ${game.dots.size} 個光點`,
    action: { label: '再試一次', run: () => openLevel(levelIndex) },
    secondary: { label: '選其他關卡', run: showLevels },
  });
});

function steer(dx, dy) {
  if (running && !paused) game.setDirection(dx, dy);
}

// 按住拖曳轉向（像搖桿）：以按下的位置為中心，手指偏向哪邊就往哪邊走，按住不放就一直維持；
// 手指拉太遠時中心會跟著移過去，所以往回拉一點點就能立刻掉頭
let stick = null;
const stickEl = $('stick');
function showStick(x, y) {
  const rect = stage.getBoundingClientRect();
  stickEl.style.left = `${x - rect.left}px`;
  stickEl.style.top = `${y - rect.top}px`;
  stickEl.classList.add('show');
}
stage.addEventListener('pointerdown', (e) => {
  if (e.target.closest('button')) return;
  stick = { x: e.clientX, y: e.clientY };
  showStick(stick.x, stick.y);
  try {
    stage.setPointerCapture(e.pointerId);
  } catch {
    // 少數瀏覽器在觸控剛開始時拿不到指標，不影響操作
  }
});
stage.addEventListener('pointermove', (e) => {
  if (!stick) return;
  let dx = e.clientX - stick.x;
  let dy = e.clientY - stick.y;
  const dist = Math.hypot(dx, dy);
  if (dist < STICK_DEADZONE) return;
  if (Math.abs(dx) > Math.abs(dy)) steer(Math.sign(dx), 0);
  else steer(0, Math.sign(dy));
  if (dist > STICK_RANGE) {
    stick.x = e.clientX - (dx / dist) * STICK_RANGE;
    stick.y = e.clientY - (dy / dist) * STICK_RANGE;
    showStick(stick.x, stick.y);
  }
});
['pointerup', 'pointercancel'].forEach((ev) => stage.addEventListener(ev, () => {
  stick = null;
  stickEl.classList.remove('show');
}));

// 十字鍵整塊都是感應區：依手指偏向中心的哪一邊決定方向，角落空白處也算；按著滑動可以直接換方向
const dpad = $('dpad');
const PAD_KEYS = {
  up: { el: $('upBtn'), dir: [0, -1] },
  down: { el: $('downBtn'), dir: [0, 1] },
  left: { el: $('leftBtn'), dir: [-1, 0] },
  right: { el: $('rightBtn'), dir: [1, 0] },
};
let padPressed = false;
function padSteer(e) {
  const rect = dpad.getBoundingClientRect();
  const dx = e.clientX - (rect.left + rect.width / 2);
  const dy = e.clientY - (rect.top + rect.height / 2);
  if (Math.hypot(dx, dy) < rect.width * 0.1) return;
  const name = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up');
  Object.entries(PAD_KEYS).forEach(([k, v]) => v.el.classList.toggle('holding', k === name));
  steer(...PAD_KEYS[name].dir);
}
function padRelease() {
  padPressed = false;
  Object.values(PAD_KEYS).forEach((v) => v.el.classList.remove('holding'));
}
dpad.addEventListener('pointerdown', (e) => {
  e.preventDefault();
  padPressed = true;
  try {
    dpad.setPointerCapture(e.pointerId);
  } catch {
    // 拿不到指標也照樣能用
  }
  padSteer(e);
}, { passive: false });
dpad.addEventListener('pointermove', (e) => {
  if (padPressed) padSteer(e);
});
['pointerup', 'pointercancel', 'lostpointercapture'].forEach((ev) => dpad.addEventListener(ev, padRelease));

const KEYS = {
  arrowup: [0, -1], w: [0, -1],
  arrowdown: [0, 1], s: [0, 1],
  arrowleft: [-1, 0], a: [-1, 0],
  arrowright: [1, 0], d: [1, 0],
};
document.addEventListener('keydown', (e) => {
  const key = e.key.toLowerCase();
  if (key === 'p') return togglePause();
  if (KEYS[key]) {
    e.preventDefault();
    steer(...KEYS[key]);
  }
});

document.addEventListener('visibilitychange', () => {
  if (document.hidden && running && !paused) togglePause();
});

$('backBtn').onclick = showLevels;
$('restartBtn').onclick = () => openLevel(levelIndex);
$('pauseBtn').onclick = togglePause;

trackViewport(resize);
showLevels();
requestAnimationFrame(frame);
