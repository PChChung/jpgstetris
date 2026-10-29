import { getSupabase } from '../../shared/supabase.js?v=202610300028';

// 對戰房間：Supabase Realtime 的 Presence 管理誰在房內，Broadcast 傳遊戲訊息，完全不寫資料庫
const CHANNEL_PREFIX = 'tetris-room:';
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const MAX_PLAYERS = 2;
const JOIN_TIMEOUT = 8000;
const FIRST_SYNC_WAIT = 1500;

export function makeRoomCode() {
  let code = '';
  for (let i = 0; i < 6; i++) code += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
  return code;
}

function makeId() {
  return crypto.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

// 事件：players(list)、opponentLeft(player)、kicked(message)，以及對手送來的 start / state / attack / over
export class BattleRoom {
  constructor(code, name) {
    this.code = code;
    this.name = name;
    this.id = makeId();
    this.players = [];
    this.listeners = {};
    this.channel = null;
    this.db = null;
  }

  on(event, fn) {
    (this.listeners[event] ||= []).push(fn);
    return this;
  }

  emit(event, data) {
    (this.listeners[event] || []).forEach((fn) => fn(data));
  }

  get isHost() {
    return this.players[0]?.id === this.id;
  }

  get opponent() {
    return this.players.find((p) => p.id !== this.id) ?? null;
  }

  readPresence() {
    const state = this.channel.presenceState();
    return Object.values(state)
      .map((metas) => metas[0])
      .filter((p) => p?.id)
      .sort((a, b) => a.joinedAt - b.joinedAt || (a.id < b.id ? -1 : 1));
  }

  // mustExist：加入別人的房間時，房內沒人就視為房號錯誤
  async join({ mustExist }) {
    this.db = await getSupabase();
    this.channel = this.db.channel(CHANNEL_PREFIX + this.code, {
      config: { broadcast: { self: false }, presence: { key: this.id } },
    });

    return new Promise((resolve, reject) => {
      let settled = false;
      let tracked = false;
      const fail = (message) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        this.leave();
        reject(new Error(message));
      };
      const timeout = setTimeout(() => fail('連線逾時，請稍後再試'), JOIN_TIMEOUT);

      // 先看房內現況再決定要不要進去，避免進了才發現房間已滿
      const enter = async () => {
        if (tracked || settled) return;
        tracked = true;
        const others = this.readPresence();
        if (mustExist && others.length === 0) return fail('找不到房間，請確認房號');
        if (others.length >= MAX_PLAYERS) return fail('房間已滿');
        const latest = others.reduce((max, p) => Math.max(max, p.joinedAt), 0);
        const status = await this.channel.track({ id: this.id, name: this.name, joinedAt: Math.max(Date.now(), latest + 1) });
        if (status !== 'ok') fail('無法加入房間');
      };

      this.channel
        .on('presence', { event: 'sync' }, () => {
          if (!tracked) return enter();
          const list = this.readPresence();
          const meIndex = list.findIndex((p) => p.id === this.id);
          if (meIndex < 0) return;
          // 兩人同時加入時，以加入順序決定誰留下
          if (meIndex >= MAX_PLAYERS) {
            if (!settled) return fail('房間已滿');
            this.leave();
            return this.emit('kicked', '房間已滿');
          }
          const before = this.opponent;
          this.players = list.slice(0, MAX_PLAYERS);
          if (!settled) {
            settled = true;
            clearTimeout(timeout);
            resolve();
          }
          this.emit('players', this.players);
          if (before && !this.players.some((p) => p.id === before.id)) this.emit('opponentLeft', before);
        })
        .on('broadcast', { event: 'msg' }, ({ payload }) => {
          if (!payload || !this.players.some((p) => p.id === payload.from)) return;
          this.emit(payload.t, payload);
        })
        .subscribe((status) => {
          if (status === 'SUBSCRIBED') setTimeout(enter, FIRST_SYNC_WAIT);
          else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') fail('無法連線到對戰伺服器');
        });
    });
  }

  send(type, data = {}) {
    if (!this.channel) return;
    this.channel.send({ type: 'broadcast', event: 'msg', payload: { ...data, t: type, from: this.id } });
  }

  leave() {
    const channel = this.channel;
    this.channel = null;
    this.players = [];
    if (channel && this.db) {
      channel.untrack().catch(() => {});
      this.db.removeChannel(channel);
    }
  }
}
