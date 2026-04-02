// ─── Team Logos ──────────────────────────────────────────────────────────────

// SVG helper: colored circle with team initial
const svg = (letter: string, bg: string, fg = 'white') =>
  `data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'><circle cx='16' cy='16' r='16' fill='${bg.replace('#', '%23')}'/><text x='16' y='21' text-anchor='middle' font-family='Arial,sans-serif' font-size='13' font-weight='bold' fill='${fg}'>${letter}</text></svg>`;

const NPB_LOGO = (code: string) => `https://p.npb.jp/img/common/logo/2026/logo_${code}_m.gif`;

export const teamLogos: Record<string, string> = {
  // ── NPB 中央聯盟 ───────────────────────────────────────────────────────────
  '巨人':         NPB_LOGO('g'),
  '読売':         NPB_LOGO('g'),
  'ヤクルト':     NPB_LOGO('s'),
  '中日':         NPB_LOGO('d'),
  '横浜DeNA':     NPB_LOGO('db'),
  'DeNA':         NPB_LOGO('db'),
  '広島':         NPB_LOGO('c'),
  '阪神':         NPB_LOGO('t'),
  // ── NPB 太平洋聯盟 ─────────────────────────────────────────────────────────
  'ソフトバンク': NPB_LOGO('h'),
  'ロッテ':       NPB_LOGO('m'),
  '楽天':         NPB_LOGO('e'),
  '西武':         NPB_LOGO('l'),
  '日本ハム':     NPB_LOGO('f'),
  'オリックス':   NPB_LOGO('b'),
  // ── NPB2 獨立聯盟 ──────────────────────────────────────────────────────────
  'オイシックス':  svg('O', '#6daa2c'),
  'くふうハヤテ':  svg('H', '#e5002b'),
  // ── CPBL ──────────────────────────────────────────────────────────────────
  '中信兄弟':   'https://www.cpbl.com.tw/files/atts/0L021497108709222204/logo_brothers.png',
  '味全龍':     'https://www.cpbl.com.tw/files/atts/0L021497845061333235/logo_dragon.png',
  '統一獅':     'https://www.cpbl.com.tw/files/atts/0L021496162893869773/logo_lions.png',
  '富邦悍將':   'https://www.cpbl.com.tw/files/atts/0L021495969510091777/logo_fubon.png',
  '樂天桃猿':   'https://www.cpbl.com.tw/files/atts/0L015574823122453305/2024_CPBL%E5%85%AD%E9%9A%8ALogo_R2_%E5%AE%98%E7%B6%B2.png',
  '台鋼雄鷹':   'https://www.cpbl.com.tw/files/atts/0M259522048557486065/%E5%96%AE%E8%89%B2T-100x100.png',
  // ── CPBL-W ────────────────────────────────────────────────────────────────
  '台電':       svg('電', '#003087'),
  // ── Fallbacks ─────────────────────────────────────────────────────────────
  '兄弟':       'https://www.cpbl.com.tw/files/atts/0L021497108709222204/logo_brothers.png',
  '味全':       'https://www.cpbl.com.tw/files/atts/0L021497845061333235/logo_dragon.png',
};

// ─── WBC Players ─────────────────────────────────────────────────────────────
export const playersData: Record<string, Record<string, { name: string; team: string }[]>> = {
  '中華隊': {
    '投手': [
      { name: '張奕', team: '富邦悍將' }, { name: '陳柏毓', team: '匹茲堡海盜' }, { name: '鄭浩均', team: '中信兄弟' }, { name: '古林睿煬', team: '北海道日本火腿鬥士' },
      { name: '徐若熙', team: '福岡軟銀鷹' }, { name: '胡智爲', team: '統一獅' }, { name: '林凱威', team: '味全龍' }, { name: '林詩翔', team: '台鋼雄鷹' },
      { name: '沙子宸', team: '運動家' }, { name: '孫易磊', team: '北海道日本火腿鬥士' }, { name: '曾峻岳', team: '富邦悍將' }, { name: '林昱珉', team: '亞利桑那響尾蛇' },
    ],
    '捕手': [{ name: '林家正', team: '' }, { name: '蔣少宏', team: '味全龍' }, { name: '吉力吉撈・鞏冠', team: '味全龍' }],
    '內野手': [
      { name: '張育成', team: '富邦悍將' }, { name: '吳念庭', team: '台鋼雄鷹' }, { name: '李灝宇', team: '底特律老虎' }, { name: '鄭宗哲', team: '華盛頓國民' },
      { name: '林子偉', team: '樂天桃猿' }, { name: '江坤宇', team: '中信兄弟' },
    ],
    '外野手': [{ name: '林安可', team: '埼玉西武獅' }, { name: '費爾柴德', team: '克里夫蘭守護者' }, { name: '陳晨威', team: '樂天桃猿' }, { name: '陳傑憲', team: '統一獅' }],
  },
  '日本武士隊': {
    '投手': [
      { name: '大谷翔平', team: '洛杉磯道奇隊' }, { name: '山本由伸', team: '洛杉磯道奇隊' }, { name: '宮城大弥', team: '歐力士猛牛隊' },
      { name: '高橋宏斗', team: '中日龍隊' }, { name: '種市篤暉', team: '千葉羅德海洋隊' }, { name: '菊池雄星', team: '洛杉磯天使隊' },
    ],
    '捕手': [{ name: '若月健矢', team: '歐力士猛牛隊' }, { name: '坂本誠志郎', team: '阪神虎隊' }, { name: '中村悠平', team: '東京養樂多燕子隊' }],
    '內野手': [{ name: '牧秀悟', team: '橫濱 DeNA 海灣之星隊' }, { name: '岡本和真', team: '多倫多藍鳥隊' }, { name: '村上宗隆', team: '芝加哥白襪隊' }, { name: '源田壯亮', team: '埼玉西武獅隊' }],
    '外野手': [{ name: '近藤健介', team: '福岡軟銀鷹隊' }, { name: '鈴木誠也', team: '芝加哥小熊隊' }, { name: '森下翔太', team: '阪神虎隊' }],
  },
  '南韓': {
    '投手': [{ name: '柳賢振', team: '韓華鷹' }, { name: '高祐錫', team: '底特律老虎' }, { name: '郭彬', team: '斗山熊' }, { name: '趙丙炫', team: 'SSG登陸者' }],
    '捕手': [{ name: '崔在勳', team: '韓華鷹' }, { name: '朴東原', team: 'LG雙子' }],
    '內野手': [{ name: '金慧成', team: '洛杉磯道奇' }, { name: '文保景', team: 'LG雙子' }, { name: '申珉哉', team: 'LG雙子' }],
    '外野手': [{ name: '李政厚', team: '舊金山巨人' }, { name: '安賢民', team: 'KT巫師' }, { name: '具滋昱', team: '三星獅' }],
  },
  '澳洲': {
    '投手': [{ name: 'ALEXANDER WELLS', team: '' }, { name: 'LACHLAN WELLS', team: '' }, { name: 'BLAKE TOWNSEND', team: '' }, { name: 'KY HAMPTON', team: '' }],
    '捕手': [{ name: 'ROBBIE PERKINS', team: '' }, { name: 'ALEX HALL', team: '' }],
    '內野手': [{ name: 'CURTIS MEAD', team: '' }, { name: 'TRAVIS BAZZANA', team: '' }, { name: 'LOGAN WADE', team: '' }],
    '外野手': [{ name: 'TIM KENNELLY', team: '' }, { name: 'AARON WHITEFIELD', team: '' }, { name: 'ULRICH BOJARSKI', team: '' }],
  },
  '捷克': {
    '投手': [{ name: 'FILIP CAPKA', team: '' }, { name: 'MARTIN SCHNEIDER', team: '' }, { name: 'JEFF BARTO', team: '' }, { name: 'LUKAS ERCOLI', team: '' }],
    '捕手': [{ name: 'Matous Bubenik', team: '' }, { name: 'Martin Zelenka', team: '' }],
    '內野手': [{ name: 'Terrin Vavra', team: '' }, { name: 'Ryan Johnson', team: '' }, { name: 'Martin Cervinka', team: '' }],
    '外野手': [{ name: 'Marek Chlup', team: '' }, { name: 'William Escala', team: '' }, { name: 'Max Prejda', team: '' }],
  },
};

// ─── NPB Teams & Rosters ─────────────────────────────────────────────────────
export const npbCentralTeams = ['讀賣巨人', '阪神虎', '中日龍', '橫濱DeNA', '廣島鯉魚', '養樂多燕子'];
export const npbPacificTeams = ['歐力士猛牛', '羅德海洋', '軟銀鷹', '樂天金鷲', '西武獅', '日本火腿'];

export interface NpbPlayer { number: string; name: string; position: string; bats_throws: string; taiwanese?: boolean; }
export interface NpbDraftPick { round: string; name: string; position: string; school: string; taiwanese?: boolean; }

export const npbRosters: Record<string, NpbPlayer[]> = {
  '讀賣巨人': [
    { number: '6', name: '坂本勇人', position: 'SS', bats_throws: '右/左' },
    { number: '25', name: '岡本和真', position: '1B/3B', bats_throws: '右/右' },
    { number: '8', name: '丸佳浩', position: 'OF', bats_throws: '右/左' },
    { number: '39', name: '吉川尚輝', position: '2B', bats_throws: '右/左' },
    { number: '24', name: '大城卓三', position: 'C', bats_throws: '右/右' },
    { number: '1', name: '門脇誠', position: 'SS/2B', bats_throws: '右/左' },
    { number: '7', name: '萩尾匡也', position: 'OF', bats_throws: '右/左' },
    { number: '18', name: '戸郷翔征', position: 'SP', bats_throws: '右/右' },
    { number: '14', name: '菅野智之', position: 'SP', bats_throws: '右/右' },
    { number: '13', name: '山﨑伊織', position: 'SP', bats_throws: '右/右' },
    { number: '47', name: '陳冠宇', position: 'RP', bats_throws: '右/右', taiwanese: true },
    { number: '41', name: '大勢', position: 'CL', bats_throws: '右/右' },
    { number: '38', name: '泉圭輔', position: 'RP', bats_throws: '右/左' },
  ],
  '阪神虎': [
    { number: '4', name: '大山悠輔', position: '1B', bats_throws: '右/右' },
    { number: '5', name: '佐藤輝明', position: '3B/OF', bats_throws: '右/右' },
    { number: '23', name: '近本光司', position: 'OF', bats_throws: '右/左' },
    { number: '22', name: '森下翔太', position: 'OF', bats_throws: '右/右' },
    { number: '2', name: '中野拓夢', position: 'SS/2B', bats_throws: '右/左' },
    { number: '12', name: '梅野隆太郎', position: 'C', bats_throws: '右/右' },
    { number: '16', name: '才木浩人', position: 'SP', bats_throws: '右/右' },
    { number: '15', name: '青柳晃洋', position: 'SP', bats_throws: '右/右' },
    { number: '11', name: '伊藤将司', position: 'SP', bats_throws: '左/左' },
    { number: '46', name: '岩崎優', position: 'CL', bats_throws: '左/左' },
    { number: '62', name: '湯浅京己', position: 'RP', bats_throws: '右/右' },
  ],
  '中日龍': [
    { number: '6', name: '岡林勇希', position: 'OF', bats_throws: '右/左' },
    { number: '3', name: '石川昂弥', position: '3B', bats_throws: '右/右' },
    { number: '24', name: '大島洋平', position: 'OF', bats_throws: '右/左' },
    { number: '21', name: '大野雄大', position: 'SP', bats_throws: '左/左' },
    { number: '19', name: '柳裕也', position: 'SP', bats_throws: '右/右' },
    { number: '22', name: '高橋宏斗', position: 'SP', bats_throws: '右/右' },
    { number: '13', name: '清水達也', position: 'RP', bats_throws: '右/右' },
    { number: '49', name: 'ライデル・マルティネス', position: 'CL', bats_throws: '右/右' },
  ],
  '橫濱DeNA': [
    { number: '3', name: '牧秀悟', position: '2B', bats_throws: '右/右' },
    { number: '51', name: '宮崎敏郎', position: '3B', bats_throws: '右/右' },
    { number: '2', name: '林琢真', position: 'SS', bats_throws: '右/右' },
    { number: '14', name: '今永昇太', position: 'SP', bats_throws: '左/左' },
    { number: '18', name: '東克樹', position: 'SP', bats_throws: '左/左' },
    { number: '11', name: '濱口遥大', position: 'SP', bats_throws: '左/左' },
    { number: '21', name: '三嶋一輝', position: 'RP', bats_throws: '右/右' },
    { number: '34', name: '山﨑康晃', position: 'CL', bats_throws: '右/右' },
  ],
  '廣島鯉魚': [
    { number: '1', name: '菊池涼介', position: '2B', bats_throws: '右/右' },
    { number: '3', name: '西川龍馬', position: 'OF', bats_throws: '左/左' },
    { number: '5', name: '坂倉将吾', position: 'C/1B', bats_throws: '左/左' },
    { number: '14', name: '大瀬良大地', position: 'SP', bats_throws: '右/右' },
    { number: '21', name: '森下暢仁', position: 'SP', bats_throws: '右/右' },
    { number: '20', name: '九里亜蓮', position: 'SP', bats_throws: '右/右' },
    { number: '18', name: 'ターリー', position: 'CL', bats_throws: '右/右' },
  ],
  '養樂多燕子': [
    { number: '55', name: '村上宗隆', position: '1B/3B', bats_throws: '右/左' },
    { number: '2', name: '山田哲人', position: '2B', bats_throws: '右/右' },
    { number: '1', name: '塩見泰隆', position: 'OF', bats_throws: '右/右' },
    { number: '14', name: '小川泰弘', position: 'SP', bats_throws: '右/右' },
    { number: '18', name: '石川雅規', position: 'SP', bats_throws: '左/左' },
    { number: '11', name: '高橋奎二', position: 'SP', bats_throws: '左/左' },
    { number: '21', name: 'マクガフ', position: 'CL', bats_throws: '右/右' },
  ],
  '歐力士猛牛': [
    { number: '1', name: '福田周平', position: '2B/OF', bats_throws: '右/左' },
    { number: '7', name: '吉田正尚', position: 'OF', bats_throws: '右/左' },
    { number: '2', name: '紅林弘太郎', position: 'SS', bats_throws: '右/右' },
    { number: '16', name: '山本由伸', position: 'SP', bats_throws: '右/右' },
    { number: '18', name: '宮城大弥', position: 'SP', bats_throws: '左/左' },
    { number: '28', name: '山崎颯一郎', position: 'RP', bats_throws: '右/右' },
    { number: '30', name: '平野佳寿', position: 'CL', bats_throws: '右/右' },
  ],
  '羅德海洋': [
    { number: '3', name: '中村奨吾', position: '2B', bats_throws: '右/右' },
    { number: '7', name: '荻野貴司', position: 'OF', bats_throws: '右/右' },
    { number: '2', name: '藤岡裕大', position: 'SS', bats_throws: '右/左' },
    { number: '18', name: '種市篤暉', position: 'SP', bats_throws: '右/右' },
    { number: '14', name: '石川歩', position: 'SP', bats_throws: '右/右' },
    { number: '11', name: '佐々木朗希', position: 'SP', bats_throws: '右/右' },
    { number: '51', name: '益田直也', position: 'CL', bats_throws: '右/右' },
  ],
  '軟銀鷹': [
    { number: '3', name: '柳田悠岐', position: 'OF', bats_throws: '右/左' },
    { number: '9', name: '近藤健介', position: 'OF/DH', bats_throws: '右/左' },
    { number: '2', name: '今宮健太', position: 'SS', bats_throws: '右/右' },
    { number: '18', name: '石川柊太', position: 'SP', bats_throws: '右/右' },
    { number: '19', name: '千賀滉大', position: 'SP', bats_throws: '右/右' },
    { number: '11', name: '東浜巨', position: 'SP', bats_throws: '右/右' },
    { number: '22', name: 'モイネロ', position: 'CL', bats_throws: '左/左' },
    { number: '48', name: '徐若熙', position: 'RP', bats_throws: '右/右', taiwanese: true },
  ],
  '樂天金鷲': [
    { number: '2', name: '浅村栄斗', position: '2B', bats_throws: '右/右' },
    { number: '3', name: '島内宏明', position: 'OF', bats_throws: '右/右' },
    { number: '24', name: '鈴木大地', position: '1B/3B', bats_throws: '右/左' },
    { number: '18', name: '則本昂大', position: 'SP', bats_throws: '右/右' },
    { number: '14', name: '瀧中瞭太', position: 'SP', bats_throws: '右/右' },
    { number: '19', name: '岸孝之', position: 'SP', bats_throws: '右/右' },
    { number: '15', name: '松井裕樹', position: 'CL', bats_throws: '左/左' },
  ],
  '西武獅': [
    { number: '3', name: '源田壯亮', position: 'SS', bats_throws: '右/左' },
    { number: '5', name: '中村剛也', position: '3B', bats_throws: '右/右' },
    { number: '1', name: '外崎修汰', position: '2B/OF', bats_throws: '右/右' },
    { number: '11', name: '高橋光成', position: 'SP', bats_throws: '右/右' },
    { number: '18', name: '今井達也', position: 'SP', bats_throws: '右/右' },
    { number: '28', name: '平良海馬', position: 'SP', bats_throws: '右/右' },
    { number: '21', name: 'ギャレット', position: 'CL', bats_throws: '右/右' },
    { number: '54', name: '呉念庭', position: '1B/3B', bats_throws: '右/左', taiwanese: true },
  ],
  '日本火腿': [
    { number: '11', name: '伊藤大海', position: 'SP', bats_throws: '右/右' },
    { number: '18', name: '上沢直之', position: 'SP', bats_throws: '右/右' },
    { number: '6', name: '清宮幸太郎', position: '1B', bats_throws: '右/左' },
    { number: '2', name: '水野達稀', position: 'SS', bats_throws: '右/右' },
    { number: '25', name: '松本剛', position: 'OF', bats_throws: '右/右' },
    { number: '19', name: 'ポンセ', position: 'SP', bats_throws: '右/右' },
    { number: '15', name: '田中正義', position: 'CL', bats_throws: '右/右' },
    { number: '50', name: '古林睿煬', position: 'SP', bats_throws: '左/左', taiwanese: true },
  ],
};

export const npbDrafts: Record<string, NpbDraftPick[]> = {
  '讀賣巨人': [
    { round: '1', name: '西舘勇陽', position: 'SP', school: '中央大學' },
    { round: '2', name: '浦田俊輔', position: 'SP', school: '九州産業大學' },
    { round: '3', name: '松井颯', position: 'SP', school: '三菱重工East' },
    { round: '4', name: '泉口友汰', position: 'SS', school: 'NTT西日本' },
  ],
  '阪神虎': [
    { round: '1', name: '下村海翔', position: 'SP', school: '青山學院大學' },
    { round: '2', name: '茨木秀俊', position: 'SP', school: '京都國際高校' },
    { round: '3', name: '椎葉剛', position: 'RP', school: '徳島インディゴソックス' },
    { round: '4', name: '津田淳哉', position: 'SP', school: '新日本製鉄鹿島' },
  ],
  '中日龍': [
    { round: '1', name: '草加勝', position: 'SP', school: '亜細亜大學' },
    { round: '2', name: '津田啓史', position: 'C', school: '三菱重工East' },
    { round: '3', name: '山本泰輔', position: 'SP', school: '神奈川大學' },
    { round: '4', name: '田中幹也', position: '2B', school: '亜細亜大學' },
  ],
  '橫濱DeNA': [
    { round: '1', name: '度会隆輝', position: 'OF', school: 'ENEOS' },
    { round: '2', name: '武田陸玖', position: 'OF', school: '山形中央高校' },
    { round: '3', name: '石上泰輝', position: 'SS', school: '東洋大學' },
    { round: '4', name: '井上絢登', position: 'C', school: '履正社高校' },
  ],
  '廣島鯉魚': [
    { round: '1', name: '常廣羽也斗', position: 'SP', school: '青山學院大學' },
    { round: '2', name: '高太一', position: 'SP', school: '大阪商業大學' },
    { round: '3', name: '仲田侑仁', position: 'SS', school: '沖縄尚學高校' },
    { round: '4', name: '河野佳', position: 'SP', school: '大阪商業大學' },
  ],
  '養樂多燕子': [
    { round: '1', name: '西舘昂汰', position: 'SP', school: '専修大學' },
    { round: '2', name: '石原勇輝', position: 'SP', school: '明治大學' },
    { round: '3', name: '松本健吾', position: 'SP', school: 'トヨタ自動車' },
    { round: '4', name: '北村恵吾', position: 'C/1B', school: '近畿大學' },
  ],
  '歐力士猛牛': [
    { round: '1', name: '曾谷龍平', position: 'SP', school: '白鴎大學' },
    { round: '2', name: '横山聖哉', position: 'SS', school: '上田西高校' },
    { round: '3', name: '齋藤響介', position: 'C', school: '鶴岡東高校' },
    { round: '4', name: '内藤鵬', position: 'OF', school: '大阪桐蔭高校' },
  ],
  '羅德海洋': [
    { round: '1', name: '齋藤大翔', position: 'SS', school: '東海大菅生高校' },
    { round: '2', name: '田中楓基', position: 'SP', school: '四国IL高知' },
    { round: '3', name: '木村優人', position: 'SP', school: '霞ヶ浦高校' },
    { round: '4', name: '村山亮介', position: 'RP', school: '専修大學' },
  ],
  '軟銀鷹': [
    { round: '1', name: '前田悠伍', position: 'SP', school: '大阪桐蔭高校' },
    { round: '2', name: '廣瀬隆太', position: 'OF', school: '慶應義塾大學' },
    { round: '3', name: '岩井俊介', position: 'RP', school: '名城大學' },
    { round: '4', name: '岡山龍倫', position: 'OF', school: 'NTT西日本' },
  ],
  '樂天金鷲': [
    { round: '1', name: '古謝樹', position: 'SP', school: '桐蔭横浜大學' },
    { round: '2', name: '坂井陽翔', position: 'SP', school: '近江高校' },
    { round: '3', name: '日當直喜', position: 'SP', school: '東海大菅生高校' },
    { round: '4', name: '中島大輔', position: 'C', school: '愛知産業大學三河高校' },
  ],
  '西武獅': [
    { round: '1', name: '村田怜音', position: 'SS', school: '皇學館大學' },
    { round: '2', name: '糸川亮太', position: 'SP', school: '亜細亜大學' },
    { round: '3', name: '児玉亮涼', position: 'SS', school: '山梨学院大學' },
    { round: '4', name: '進藤勇也', position: 'C', school: '上田西高校' },
    { round: '5', name: '奥田怜央', position: 'OF', school: '大阪桐蔭高校' },
  ],
  '日本火腿': [
    { round: '1', name: '細野晴希', position: 'SP', school: '東洋大學' },
    { round: '2', name: '宮崎一樹', position: 'OF', school: '九州産業大學' },
    { round: '3', name: '進藤連', position: 'SS', school: '横浜高校' },
    { round: '4', name: '進藤勇也', position: 'C', school: '上田西高校' },
    { round: '5', name: '奥田怜央', position: 'OF', school: '大阪桐蔭高校' },
  ],
};
