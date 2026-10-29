-- 停用舊版資料表
-- 新版網站上線、確認排行榜正常之後再執行。執行後舊版單檔網頁的排行榜與對戰會失效。
-- 只關掉對外權限，資料本身保留；要徹底刪除請看最下方。

-- 先把舊版上線期間新增的分數補搬過來
insert into public.scores (game_id, player_name, score, meta, created_at, legacy_id)
select
  'tetris',
  left(coalesce(nullif(btrim(regexp_replace(player_name, '[<>]', '', 'g')), ''), '玩家'), 16),
  greatest(score, 0),
  jsonb_build_object('lines', coalesce(lines, 0), 'level', coalesce(level, 1)),
  coalesce(created_at, now()),
  id
from public.tetris_scores
on conflict (legacy_id) do nothing;

-- 移除舊表所有 RLS 規則並開啟 RLS：沒有規則 = 前端完全不能讀寫
do $$
declare
  r record;
begin
  for r in
    select tablename, policyname from pg_policies
    where schemaname = 'public' and tablename in ('tetris_scores', 'rooms', 'players', 'garbage_events')
  loop
    execute format('drop policy %I on public.%I', r.policyname, r.tablename);
  end loop;

  for r in
    select tablename from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public'
      and tablename in ('rooms', 'players', 'garbage_events')
  loop
    execute format('alter publication supabase_realtime drop table public.%I', r.tablename);
  end loop;
end $$;

alter table public.tetris_scores enable row level security;
alter table public.rooms enable row level security;
alter table public.players enable row level security;
alter table public.garbage_events enable row level security;

-- 確定不再需要舊資料時才執行（無法復原）：
-- drop table public.garbage_events;
-- drop table public.players;
-- drop table public.rooms;
-- drop table public.tetris_scores;
