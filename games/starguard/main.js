import { StarGuard, W, H } from './game.js?v=202610300028';
import { LEVELS, describeGoal, STAR_RULE, starsFor } from './levels.js?v=202610300028';
import { trackViewport, bindHold, createProgress, renderLevelGrid, Overlay, fitStage, starText } from '../../shared/handheld.js?v=202610300028';

const $ = (id) => document.getElementById(id);
const canvas = $('canvas');
const ctx = canvas.getContext('2d');
const stage = $('stage');
const overlay = new Overlay($('overlay'));
const progress = createProgress('starguard');
const game = new StarGuard();

let scale = 1;
let levelIndex = 0;
let running = false;
let paused = false;
let lastTime = 0;

function resize() {
  scale = fitStage(canvas, stage, W, H);
}

function updateHud() {
  $('lives').textContent = '♥'.repeat(Math.max(0, game.lives ?? 3)) || '－';
  $('enemiesLeft').textContent = game.enemiesLeft ?? 0;
  const p = game.player;
  $('power').textContent = p ? [p.double > 0 ? '雙發' : '', p.shield ? '護盾' : ''].filter(Boolean).join('＋') : '';
}

function frame(t) {
  const dt = lastTime ? (t - lastTime) / 1000 : 0;
  lastTime = t;
  const active = running && !paused;
  if (active) game.update(dt);
  game.draw(ctx, Math.min(dt, 0.05));
  if (active) updateHud();
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
  $('modeTag').textContent = `第 ${index + 1} 波　${level.name}`;
  game.start(level);
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
    action: { label: '出擊', run: () => { overlay.hide(); running = true; } },
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
    extra: `還剩 ${game.enemiesLeft} 架敵機`,
    action: { label: '再試一次', run: () => openLevel(levelIndex) },
    secondary: { label: '選其他關卡', run: showLevels },
  });
});

// 拖曳：手指移動多少，自機就跟著移動多少
let dragStart = null;
stage.addEventListener('pointerdown', (e) => {
  if (e.target.closest('button') || !running) return;
  dragStart = { px: e.clientX, x: game.player.x };
  game.dragTarget = game.player.x;
  stage.setPointerCapture(e.pointerId);
});
stage.addEventListener('pointermove', (e) => {
  if (!dragStart) return;
  game.dragTarget = Math.max(10, Math.min(W - 10, dragStart.x + ((e.clientX - dragStart.px) / scale) * 1.3));
});
['pointerup', 'pointercancel'].forEach((ev) => stage.addEventListener(ev, () => {
  dragStart = null;
  game.dragTarget = null;
}));

bindHold($('leftBtn'), () => { game.dir = -1; }, { onRelease: () => { if (game.dir < 0) game.dir = 0; } });
bindHold($('rightBtn'), () => { game.dir = 1; }, { onRelease: () => { if (game.dir > 0) game.dir = 0; } });

const keys = new Set();
function keyDir() {
  game.dir = (keys.has('right') ? 1 : 0) - (keys.has('left') ? 1 : 0);
}
const KEYMAP = { arrowleft: 'left', a: 'left', arrowright: 'right', d: 'right' };
document.addEventListener('keydown', (e) => {
  const key = e.key.toLowerCase();
  if (key === 'p') return togglePause();
  if (KEYMAP[key]) {
    e.preventDefault();
    keys.add(KEYMAP[key]);
    keyDir();
  }
});
document.addEventListener('keyup', (e) => {
  const key = KEYMAP[e.key.toLowerCase()];
  if (key) {
    keys.delete(key);
    keyDir();
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
