import { fetchTopScores } from './scores.js?v=202610300028';
import { cleanName, getPlayerName, setPlayerName } from './player.js?v=202610300028';

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function openDialog(title) {
  const overlay = el('div', 'dialog');
  const box = el('div', 'dialogBox');
  const head = el('div', 'dialogHead');
  head.append(el('div', 'dialogTitle', title));
  box.append(head);
  overlay.append(box);
  document.body.append(overlay);
  return { overlay, box, head, close: () => overlay.remove() };
}

// 取代瀏覽器 prompt()：回傳輸入的名稱，取消則回傳 null
export function askName({ title = '輸入玩家名稱', note = '' } = {}) {
  return new Promise((resolve) => {
    const dlg = openDialog(title);
    const input = el('input', 'input');
    input.maxLength = 16;
    input.placeholder = '玩家';
    input.value = getPlayerName();
    const actions = el('div', 'dialogActions');
    const cancel = el('button', 'btn', '取消');
    const ok = el('button', 'btn primary', '確定');
    actions.append(cancel, ok);
    dlg.box.append(input);
    if (note) dlg.box.append(el('div', 'dialogNote', note));
    dlg.box.append(actions);

    const finish = (value) => {
      dlg.close();
      resolve(value);
    };
    ok.onclick = () => {
      const name = cleanName(input.value);
      if (!name) return input.focus();
      finish(setPlayerName(name));
    };
    cancel.onclick = () => finish(null);
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') ok.click();
      if (e.key === 'Escape') cancel.click();
    });
    setTimeout(() => input.focus(), 0);
  });
}

// formatMeta(row) 回傳名稱後方的小字，例如「32行 Lv.4」
export async function openLeaderboard({ gameId, title, formatMeta = () => '' }) {
  const dlg = openDialog(title);
  const closeBtn = el('button', 'btn small', '關閉');
  closeBtn.style.width = '88px';
  closeBtn.onclick = dlg.close;
  dlg.head.append(closeBtn);
  dlg.overlay.addEventListener('click', (e) => {
    if (e.target === dlg.overlay) dlg.close();
  });

  const rows = el('div', 'screenPanel');
  const status = el('div', 'dialogNote', '讀取中...');
  dlg.box.append(rows, status);

  try {
    const data = await fetchTopScores(gameId, 10);
    if (!data.length) {
      rows.remove();
      status.textContent = '還沒有人上榜，玩一局搶第一名。';
      return;
    }
    data.forEach((r, i) => {
      const row = el('div', 'leaderRow');
      const name = el('div', 'leaderName', r.player_name);
      const meta = formatMeta(r);
      if (meta) name.append(el('span', 'leaderMeta', meta));
      row.append(el('div', 'leaderRank', String(i + 1)), name, el('div', 'leaderScore', String(r.score)));
      rows.append(row);
    });
    status.textContent = '顯示前 10 名。';
  } catch (e) {
    status.textContent = '讀取失敗：' + e.message;
  }
}
