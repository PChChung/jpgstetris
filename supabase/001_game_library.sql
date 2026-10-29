-- 遊戲庫共用排行榜
-- 執行方式：Supabase 後台 → SQL Editor → 貼上整份 → Run。可重複執行。
-- 這份不會動到舊表，舊版網頁在新版上線前仍可正常使用。

create table if not exists public.scores (
  id bigint generated always as identity primary key,
  game_id text not null,
  player_name text not null check (char_length(player_name) between 1 and 16),
  score integer not null check (score >= 0),
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  legacy_id bigint unique -- 從 tetris_scores 搬過來的原始 id，避免重複匯入
);

create index if not exists scores_game_score_idx on public.scores (game_id, score desc);

-- 任何人都能讀排行榜，但不能直接寫入；寫入只能透過 submit_score()
alter table public.scores enable row level security;
drop policy if exists scores_select on public.scores;
create policy scores_select on public.scores for select to anon, authenticated using (true);
revoke insert, update, delete on public.scores from anon, authenticated;

create or replace function public.submit_score(
  p_game_id text,
  p_player_name text,
  p_score integer,
  p_meta jsonb default '{}'::jsonb
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text := left(btrim(regexp_replace(coalesce(p_player_name, ''), '[<>]', '', 'g')), 16);
  v_meta jsonb;
  v_lines integer;
  v_level integer;
begin
  if v_name = '' then
    raise exception '名稱不可空白';
  end if;
  if p_score is null or p_score <= 0 then
    raise exception '分數不正確';
  end if;

  -- 每個遊戲各自的合理性檢查；新增遊戲時在這裡加一段
  if p_game_id = 'tetris' then
    v_lines := (p_meta ->> 'lines')::integer;
    v_level := (p_meta ->> 'level')::integer;
    if v_lines is null or v_lines < 0 or v_level is distinct from v_lines / 10 + 1 then
      raise exception '資料不一致';
    end if;
    -- 每行最多 375 分（四消 1500），每顆方塊硬降最多 2 分，方塊數 ≤（消除格數 + 盤面 200 格）÷ 4
    if p_score > v_lines * 380 + 100 then
      raise exception '分數超出合理範圍';
    end if;
    v_meta := jsonb_build_object('lines', v_lines, 'level', v_level);
  else
    raise exception '未知的遊戲：%', p_game_id;
  end if;

  -- 同一名稱 10 秒內只能送一次，擋掉灌分腳本
  if exists (
    select 1 from public.scores
    where game_id = p_game_id and player_name = v_name and created_at > now() - interval '10 seconds'
  ) then
    raise exception '送出太頻繁，請稍後再試';
  end if;

  insert into public.scores (game_id, player_name, score, meta)
  values (p_game_id, v_name, p_score, v_meta);
end;
$$;

revoke all on function public.submit_score(text, text, integer, jsonb) from public;
grant execute on function public.submit_score(text, text, integer, jsonb) to anon, authenticated;

-- 搬移舊排行榜（重複執行也不會重複匯入）
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
