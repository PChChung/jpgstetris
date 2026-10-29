// 遊戲清單：新增遊戲時在這裡加一筆，並在 games/<id>/ 放遊戲本體
export const GAMES = [
  {
    id: 'tetris',
    title: '俄羅斯方塊',
    description: '衝高分上排行榜、闖 20 道關卡，或開房間和朋友即時對戰。',
    path: 'games/tetris/',
    tags: ['單人', '關卡挑戰', '雙人對戰'],
    accent: '#4dd8ff',
    // 卡帶標籤上的小圖：每列一個字元，. 是空格，其他字母是方塊顏色
    art: ['..T.', '.TTZ', 'IIZZ', 'LIZO', 'LIOO', 'LLJJ'],
  },
];
