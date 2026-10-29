import { DotMaze, W, H } from './game.js';
import { LEVELS, describeGoal, STAR_RULE, starsFor } from './levels.js';
import { trackViewport, bindHold, createProgress, renderLevelGrid, Overlay, fitStage, starText } from '../../shared/handheld.js';

const SWIPE = 18; // 手指移動超過幾像素算一次滑動

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

// 滑動轉向：手指不用放開，連續滑可以連續轉彎
let swipeFrom = null;
stage.addEventListener('pointerdown', (e) => {
  if (e.target.closest('button')) return;
  swipeFrom = { x: e.clientX, y: e.clientY };
  stage.setPointerCapture(e.pointerId);
});
stage.addEventListener('pointermove', (e) => {
  if (!swipeFrom) return;
  const dx = e.clientX - swipeFrom.x;
  const dy = e.clientY - swipeFrom.y;
  if (Math.max(Math.abs(dx), Math.abs(dy)) < SWIPE) return;
  if (Math.abs(dx) > Math.abs(dy)) steer(Math.sign(dx), 0);
  else steer(0, Math.sign(dy));
  swipeFrom = { x: e.clientX, y: e.clientY };
});
['pointerup', 'pointercancel'].forEach((ev) => stage.addEventListener(ev, () => { swipeFrom = null; }));

bindHold($('upBtn'), () => steer(0, -1));
bindHold($('downBtn'), () => steer(0, 1));
bindHold($('leftBtn'), () => steer(-1, 0));
bindHold($('rightBtn'), () => steer(1, 0));

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
