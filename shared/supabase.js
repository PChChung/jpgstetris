import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config.js?v=202610300040';

const SDK_URL = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.115.0/+esm';
let clientPromise = null;

// 延遲載入：SDK 載不到時只有線上功能失效，單機遊戲照常可玩
export function getSupabase() {
  if (!clientPromise) {
    clientPromise = import(SDK_URL)
      .then(({ createClient }) =>
        createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: false } }))
      .catch(() => {
        clientPromise = null;
        throw new Error('無法連線到伺服器，請檢查網路');
      });
  }
  return clientPromise;
}
