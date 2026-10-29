// 遊戲清單：新增遊戲時在這裡加一筆，並在 games/<id>/ 放遊戲本體
// levels：關卡數（首頁顯示星星進度）；leaderboard：有線上排行榜
// art：卡帶標籤上的小圖，每列一個字串，. 是空格，字母是顏色（I 青、J 藍、L 橘、O 黃、S 綠、T 紫、Z 粉）
export const GAMES = [
  {
    id: 'tetris',
    title: '俄羅斯方塊',
    description: '衝高分上排行榜、闖 20 道關卡，或開房間和朋友即時對戰。',
    path: 'games/tetris/',
    tags: ['單人', '關卡挑戰', '雙人對戰'],
    accent: '#4dd8ff',
    levels: 20,
    leaderboard: true,
    art: ['..T.', '.TTZ', 'IIZZ', 'LIZO', 'LIOO', 'LLJJ'],
  },
  {
    id: 'starguard',
    title: '星艦防線',
    description: '左右移動閃避子彈，擊落一波波排成隊形、輪流俯衝的敵機。',
    path: 'games/starguard/',
    tags: ['關卡挑戰', '射擊'],
    accent: '#ffd23f',
    levels: 20,
    art: ['S.S.S', '.S.S.', 'O...O', '.....', '..I..', '.III.'],
  },
  {
    id: 'bubbles',
    title: '泡泡連發',
    description: '瞄準射出泡泡，同色三顆就消除，趁天花板壓下來之前清光盤面。',
    path: 'games/bubbles/',
    tags: ['關卡挑戰', '益智'],
    accent: '#ff5c8a',
    levels: 20,
    art: ['ZZOO', 'SZOI', 'SSII', '.T..', '....', '.Z..'],
  },
  {
    id: 'dotmaze',
    title: '光點迷宮',
    description: '在迷宮裡收集所有光點，避開四種巡邏機；撿到電池就能反過來把它們撞回基地。',
    path: 'games/dotmaze/',
    tags: ['關卡挑戰', '迷宮'],
    accent: '#5ee0a0',
    levels: 20,
    art: ['TTTTT', 'T...T', 'T.S.T', 'T...T', 'TT.TT', '..Z..'],
  },
];
