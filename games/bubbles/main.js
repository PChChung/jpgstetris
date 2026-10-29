import { BubbleGame, W, H } from './game.js?v=202610300040';
import { LEVELS, describeGoal, starLimits, describeStars, starsFor } from './levels.js?v=202610300040';
import { trackViewport, bindHold, createProgress, renderLevelGrid, Overlay, fitStage, starText } from '../../shared/handheld.js?v=202610300040';

// 按住左右鍵時瞄準線連續轉動：一開始慢、方便微調，按越久轉越快
const AIM_TAP = 0.012;         // 輕點一下轉多少（弧度）
const AIM_SPEED_MIN = 0.5;     // 弧度／秒
const AIM_SPEED_MAX = 2.2;
const AIM_ACCEL = 2.4;         // 每秒加速多少

const $ = (id) => document.getElementById(id);
const canvas = $('canvas');
const ctx = canvas.getContext('2d');
const stage = $('stage');
const overlay = new Overlay($('overlay'));
const progress = createProgress('bubbles');
const game = new BubbleGame();

let scale = 1;
let levelIndex = 0;
let limits = [0, 0];
let running = false;
let paused = false;
let lastTime = 0;
let aimTurn = 0;      // +1 往左轉、-1 往右轉、0 不轉
let aimHeldFor = 0;

function resize() {
  scale = fitStage(canvas, stage, W, H);
}

function updateHud() {
  if (!game.level) return;
  $('shots').textContent = game.shots;
  $('dropIn').textContent = game.shotsUntilDrop;
  $('left').textContent = game.count;
}

function frame(t) {
  const dt = lastTime ? (t - lastTime) / 1000 : 0;
  lastTime = t;
  if (running && !paused) {
    if (aimTurn) {
      aimHeldFor += dt;
      const speed = Math.min(AIM_SPEED_MAX, AIM_SPEED_MIN + aimHeldFor * AIM_ACCEL);
      game.setAim(game.aim + aimTurn * speed * Math.min(dt, 0.05));
    }
    game.update(dt);
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
  limits = starLimits(game.initialCount);
  aimTurn = 0;
  running = false;
  paused = false;
  $('pauseBtn').textContent = 'Ⅱ';
  resize();
  const best = progress.load().stars[index] ?? 0;
  overlay.show({
    title: level.name,
    extra: describeGoal(level),
    hint: `${describeStars(limits)}${best ? `\n目前最佳 ${starText(best)}` : ''}`,
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
  const stars = starsFor(limits, game.shots);
  progress.save(levelIndex, stars);
  const hasNext = levelIndex + 1 < LEVELS.length;
  const retry = { label: '再試一次', run: () => openLevel(levelIndex) };
  overlay.show({
    title: '過關',
    cls: 'win',
    stars,
    extra: `用了 ${game.shots} 發`,
    hint: stars < 3 ? describeStars(limits) : (hasNext ? '' : '全部關卡都過了！'),
    action: hasNext ? { label: '下一關', run: () => openLevel(levelIndex + 1) } : { label: '回到選關', run: showLevels },
    secondary: stars < 3 ? retry : { label: '選其他關卡', run: showLevels },
  });
});
game.on('lost', () => {
  running = false;
  overlay.show({
    title: '挑戰失敗',
    extra: `泡泡壓到警戒線了，還剩 ${game.count} 顆`,
    action: { label: '再試一次', run: () => openLevel(levelIndex) },
    secondary: { label: '選其他關卡', run: showLevels },
  });
});

function canPlay() {
  return running && !paused;
}

// 拖曳瞄準，放開發射；手指拉到發射台下方再放開就取消
function toWorld(e) {
  const rect = canvas.getBoundingClientRect();
  return { x: (e.clientX - rect.left) / scale, y: (e.clientY - rect.top) / scale };
}
let aiming = false;
stage.addEventListener('pointerdown', (e) => {
  if (e.target.closest('button') || !canPlay()) return;
  const p = toWorld(e);
  aiming = game.aimAt(p.x, p.y);
  stage.setPointerCapture(e.pointerId);
});
stage.addEventListener('pointermove', (e) => {
  if (!aiming && !(e.buttons & 1)) return;
  const p = toWorld(e);
  aiming = game.aimAt(p.x, p.y);
});
stage.addEventListener('pointerup', (e) => {
  if (!aiming || !canPlay()) return;
  aiming = false;
  if (game.aimAt(toWorld(e).x, toWorld(e).y)) game.shoot();
});
stage.addEventListener('pointercancel', () => { aiming = false; });

function startTurn(dir) {
  if (!canPlay()) return;
  if (aimTurn !== dir) {
    game.setAim(game.aim + dir * AIM_TAP);
    aimHeldFor = 0;
  }
  aimTurn = dir;
}
function stopTurn(dir) {
  if (aimTurn === dir) aimTurn = 0;
}

bindHold($('leftBtn'), () => startTurn(1), { onRelease: () => stopTurn(1) });
bindHold($('rightBtn'), () => startTurn(-1), { onRelease: () => stopTurn(-1) });
bindHold($('shootBtn'), () => canPlay() && game.shoot());
bindHold($('swapBtn'), () => canPlay() && game.swap());

const TURN_KEYS = { arrowleft: 1, a: 1, arrowright: -1, d: -1 };
document.addEventListener('keyup', (e) => {
  const dir = TURN_KEYS[e.key.toLowerCase()];
  if (dir) stopTurn(dir);
});
document.addEventListener('keydown', (e) => {
  const key = e.key.toLowerCase();
  if (key === 'p') return togglePause();
  if (TURN_KEYS[key]) {
    e.preventDefault();
    if (!e.repeat) startTurn(TURN_KEYS[key]);
    return;
  }
  if (!canPlay()) return;
  const actions = {
    ' ': () => game.shoot(),
    arrowup: () => game.shoot(),
    enter: () => game.shoot(),
    x: () => game.swap(),
    shift: () => game.swap(),
  };
  if (actions[key]) {
    e.preventDefault();
    actions[key]();
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
