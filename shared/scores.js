import { getSupabase } from './supabase.js?v=202610300028';

// 寫入一律走 submit_score()：資料庫會檢查分數是否合理，前端無法直接 insert
export async function submitScore(gameId, playerName, score, meta = {}) {
  const db = await getSupabase();
  const { error } = await db.rpc('submit_score', {
    p_game_id: gameId,
    p_player_name: playerName,
    p_score: score,
    p_meta: meta,
  });
  if (error) throw new Error(error.message);
}

export async function fetchTopScores(gameId, limit = 10) {
  const db = await getSupabase();
  const { data, error } = await db
    .from('scores')
    .select('player_name,score,meta,created_at')
    .eq('game_id', gameId)
    .order('score', { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return data ?? [];
}
