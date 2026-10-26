import type { Place, Spot, Trip } from '../types'

const HER = 'her'
const ME = 'me'

const stay: Place = {
  name: 'HITHERE GUEST HOUSE',
  address: '333-41 Seogyo-dong, Mapo-gu, Seoul',
  addressLocal: ['서울특별시 마포구', '서교동 333-41'],
  mapLink: 'https://map.naver.com/p/entry/place/1093060585',
}

const arena: Place = {
  name: 'KBS Arena',
  local: 'KBS아레나',
  address: '376 Gonghang-daero, Gangseo-gu, Seoul',
  addressLocal: ['서울특별시 강서구', '공항대로 376 (화곡동)', 'KBS아레나'],
  mapQuery: 'KBS아레나',
}

const meetPoint: Place = {
  name: '會合點：KBS스포츠월드 公車站',
  local: 'KBS스포츠월드 정류장',
  mapQuery: 'KBS스포츠월드 정류장',
}

const hongdaeStation: Place = { name: '弘大入口站', local: '홍대입구역', mapQuery: '홍대입구역' }
const icnT1: Place = { name: '仁川機場第 1 航廈', local: '인천공항 제1여객터미널', mapQuery: '인천국제공항 제1여객터미널' }
const icnT2: Place = { name: '仁川機場第 2 航廈', local: '인천공항 제2여객터미널', mapQuery: '인천국제공항 제2여객터미널' }

const musinsaKicks: Place = { name: 'MUSINSA KICKS 弘大（鞋子）', local: '무신사 킥스 홍대', mapQuery: '무신사 킥스 홍대' }
const musinsaStandard: Place = {
  name: 'MUSINSA STANDARD 弘大（衣服）',
  local: '무신사 스탠다드 홍대',
  mapQuery: '무신사 스탠다드 홍대',
}
const jokbal: Place = {
  name: 'MISS 豬腳 弘大店',
  local: '미쓰족발 홍대본점',
  addressLocal: ['서울 마포구', '동교동 164-12 1층', '미쓰족발 홍대본점'],
  mapQuery: '미쓰족발 홍대',
}

const joseonHwaro: Place = {
  name: '朝鮮火爐烤肉 (조선화로구이)',
  local: '조선화로구이',
  address: '351-18 Seogyo-dong, Mapo-gu, Seoul',
  addressLocal: ['서울특별시 마포구 서교동 351-18'],
  mapQuery: '조선화로구이',
}
const ept: Place = {
  name: 'EPT 弘大店',
  local: '이피티 홍대점',
  address: '62 Dongmak-ro 7-gil, Mapo-gu, Seoul',
  addressLocal: ['서울특별시 마포구 독막로7길 62'],
  mapQuery: '이피티 홍대점',
}
const mangwon: Place = { name: '望遠市場', local: '망원시장', mapQuery: '망원시장' }

const hoursUnknown = '營業時間待確認（出發前看 Naver Map）'

// 地點分頁：已排進行程的店，和還沒排的口袋名單。營業時間查不到可靠來源前不填。
const spots: Spot[] = [
  {
    id: 'musinsa-kicks',
    place: musinsaKicks,
    category: 'shopping',
    area: '弘大',
    access: '弘大入口站 9 號出口附近',
    tags: ['鞋子'],
    note: '2026 年 1 月開的鞋子專門店，地上 1–3 樓。',
    verify: hoursUnknown,
  },
  {
    id: 'musinsa-standard',
    place: musinsaStandard,
    category: 'shopping',
    area: '弘大',
    tags: ['衣服', '可退稅'],
    note: 'MUSINSA 自有品牌旗艦店。外國旅客滿額可以退稅，記得帶護照。',
    verify: hoursUnknown,
  },
  {
    id: 'joseon-hwaro',
    place: joseonHwaro,
    category: 'food',
    area: '弘大',
    tags: ['韓牛', '燒肉'],
    verify: hoursUnknown,
  },
  {
    id: 'ept-hongdae',
    place: ept,
    category: 'shopping',
    area: '弘大',
    tags: ['鞋子'],
    verify: hoursUnknown,
  },
  {
    id: 'miss-jokbal',
    place: jokbal,
    category: 'food',
    area: '弘大',
    hours: '12:30–24:00（最後點餐 23:00）',
    tags: ['豬腳', '宵夜'],
    checkedAt: '2026-10-27',
    verify: '依 Kakao Map，只看到週二、週三的時間；11/7（六）出發前再確認一次',
  },
  {
    id: 'mega-coffee',
    place: { name: 'MEGA COFFEE 弘大入口站店', local: '메가커피 홍대입구역점', mapQuery: '메가커피 홍대입구역점' },
    category: 'cafe',
    area: '弘大',
    tags: ['咖啡', '連鎖店', '平價'],
    note: '弘大商圈的平價咖啡連鎖，適合逛街逛累了快速補給。',
  },
  {
    id: 'mega-coffee-2',
    place: { name: 'MEGA COFFEE 發山站店', local: '메가커피 발산역점', mapQuery: '메가커피 발산역점' },
    category: 'cafe',
    area: 'KBS Arena 周邊',
    tags: ['咖啡', '連鎖店', '平價'],
    note: 'KBS Arena 附近、發山站的平價咖啡，適合演唱會前或散場後短暫休息。',
  },
  {
    id: 'mangwon-market',
    place: mangwon,
    category: 'sight',
    area: '望遠',
    tags: ['市場', '小吃'],
    note: '在住宿附近，可以跟京義線林蔭道一起逛。',
    verify: hoursUnknown,
  },
]

const concert = '南優鉉《식목일VI – EVER GREEN》'

export const seoul2026: Trip = {
  id: 'seoul-2026-11',
  title: '首爾',
  subtitle: '南優鉉《植木日 VI》',
  emoji: '🌱',
  timezone: 'Asia/Seoul',
  startDate: '2026-11-06',
  endDate: '2026-11-08',
  mapProvider: 'naver',
  driverPhrase: '이 주소로 가 주세요',

  travelers: [
    { id: HER, name: '她', color: '#FFCCB8', ink: '#c4583a' },
    { id: ME, name: '我', color: '#97D7FF', ink: '#1f74ad' },
  ],

  spots,

  pending: [
    '周邊（MD）販售的時間與地點：等主辦（빌리언스）公告',
    '票的形式（實體 / 手機票）與座位區',
    'MISS 豬腳的營業時間（11/7 排在 21:30）：出發前在 Naver Map 確認',
  ],

  flights: [
    {
      label: '去程',
      date: '2026-11-06',
      airline: '真航空 Jin Air',
      number: 'LJ172',
      aircraft: 'Boeing 777-200',
      cabin: '經濟艙',
      duration: '2 小時 20 分',
      from: { code: 'TPE', name: '桃園機場', terminal: 'T1', time: '12:40', tzLabel: '台北' },
      to: { code: 'ICN', name: '仁川機場', terminal: 'T2', time: '16:00', tzLabel: '首爾' },
      notes: ['韓國比台灣快 1 小時，落地後手機時間會自動跳。', '行李：托運 15kg、手提 10kg（規定見下方「行李規定」）。'],
    },
    {
      label: '回程',
      date: '2026-11-08',
      airline: '濟州航空 Jeju Air',
      number: '7C6101',
      aircraft: 'Boeing 737 MAX',
      cabin: '經濟艙',
      duration: '2 小時 55 分',
      from: { code: 'ICN', name: '仁川機場', terminal: 'T1', time: '10:40', tzLabel: '首爾' },
      to: { code: 'TPE', name: '桃園機場', terminal: 'T1', time: '12:35', tzLabel: '台北' },
      notes: [
        '⚠️ 去程降落 T2，回程從 T1 出發。AREX 往機場方向會先停 T1，記得在 T1 下車。',
        '回程買了周邊和衣服鞋子，記得在住宿先秤重：托運 15kg、手提 10kg。',
      ],
    },
  ],

  stays: [
    {
      place: stay,
      checkIn: '11/6（五）15:00 後',
      checkOut: '11/8（日）11:00 前',
      notes: [
        '11/6 兩人先一起到場館，「我」再帶兩人的行李搭計程車來入住，「她」看完演唱會再一起回來。',
        '位在弘大，離弘大入口站直線約 300 公尺，步行約 5–10 分鐘（AREX 月台很深，出站要多走幾分鐘）。',
        '11/8 07:20 就要出門：前一晚先問好清晨怎麼退房、鑰匙怎麼還。',
        '評價提到房間偏小、冬天偏冷，可以先問有沒有電熱毯。',
      ],
    },
  ],

  days: [
    {
      date: '2026-11-06',
      title: '落地直奔場館',
      scene: 'depart',
      items: [
        {
          time: '10:15',
          tzLabel: '台北',
          kind: 'task',
          title: '抵達桃園機場 T1',
          place: { name: '桃園機場第一航廈', mapQuery: '桃園國際機場第一航廈' },
          note: '起飛前約 2.5 小時到。報到櫃檯通常在起飛前 50–60 分鐘關閉，以真航空公告為準。',
        },
        {
          time: '12:40',
          end: '16:00',
          tzLabel: '台北 → 首爾',
          kind: 'flight',
          title: 'LJ172 桃園 T1 → 仁川 T2',
          note: '兩人的入境申報要在抵達前 3 天內上網填好（11/3 起可填）。',
        },
        {
          time: '16:00',
          end: '17:00',
          kind: 'task',
          title: '入境・領行李・買交通卡',
          place: icnT2,
          note: '兩個人都要有交通卡（WOWPASS 或 T-money），也確認兩支手機都有網路，晚上會分開一陣子。',
        },
        {
          time: '17:00',
          end: '18:20',
          kind: 'transit',
          title: '一起搭機場巴士 6003 → KBS Arena',
          place: arena,
          routeId: 'icn-to-arena',
          note: '行李放巴士車底，在「KBS스포츠월드」下車，走 3 分鐘就到場館。',
        },
        {
          time: '18:20',
          who: [HER],
          kind: 'concert',
          title: '取票・簡單吃晚餐',
          place: arena,
          note: '今天的取票時間是 16:30–19:00（開演前 3 小時到前 30 分鐘），19:00 前一定要拿到票。演出約 150 分鐘，記得先吃東西。',
        },
        {
          time: '18:30',
          who: [ME],
          kind: 'transit',
          title: '帶兩人的行李搭計程車 → 弘大住宿',
          place: stay,
          routeId: 'arena-to-stay-luggage',
          note: '陪她到取票處再走。行李多，計程車門到門最輕鬆。',
        },
        {
          time: '19:00',
          who: [ME],
          kind: 'stay',
          title: '入住 HITHERE GUEST HOUSE',
          place: stay,
          note: '順便問老闆：11/8 清晨怎麼退房、鑰匙怎麼還。',
        },
        {
          time: '19:30',
          who: [HER],
          kind: 'concert',
          title: `第一場・${concert}`,
          place: arena,
          note: '帶護照正本（實名驗證）、票、應援棒。演出約 150 分鐘，預計 22:00 結束。',
        },
        {
          time: '19:30',
          who: [ME],
          kind: 'sight',
          title: '弘大晃晃・吃晚餐',
          place: { name: '弘大商圈', local: '홍대 거리', mapQuery: '홍대 맛집' },
          note: '可以先去 MUSINSA 探路，看看明天要帶她逛哪幾區。',
          tentative: true,
        },
        {
          time: '21:15',
          end: '21:55',
          who: [ME],
          kind: 'transit',
          title: '出發去 KBS Arena 接她',
          place: meetPoint,
          routeId: 'stay-to-arena',
          note: '21:55 前到會合點。',
        },
        {
          time: '22:00',
          kind: 'task',
          title: '散場會合',
          fixed: true,
          place: meetPoint,
          note: '演出約 150 分鐘，加上安可可能晚一點。場館門口人很多，約在公車站比較好找。手機打不通就在會合點等，最晚等到 22:45。',
        },
        {
          time: '22:10',
          end: '22:55',
          kind: 'transit',
          title: '一起搭地鐵回弘大',
          routeId: 'arena-to-stay',
        },
      ],
    },
    {
      date: '2026-11-07',
      title: '逛街・第二場',
      scene: 'concert',
      items: [
        {
          time: '12:00',
          kind: 'food',
          title: '午餐・韓牛燒肉「朝鮮火爐烤肉」',
          place: joseonHwaro,
          spotId: 'joseon-hwaro',
        },
        {
          time: '13:00',
          end: '13:30',
          kind: 'shopping',
          title: '逛鞋店 EPT 弘大店',
          place: ept,
          spotId: 'ept-hongdae',
          note: '弘大熱門鞋店，適合逛完 MUSINSA 後順路去。營業時間：12:00–22:00。',
        },
        {
          time: '13:30',
          end: '14:15',
          kind: 'shopping',
          title: 'MUSINSA KICKS 弘大：逛鞋子',
          place: musinsaKicks,
          spotId: 'musinsa-kicks',
          note: '2026 年 1 月開的鞋子專門店，地上 1–3 樓。吃飽後散步去逛街。',
        },
        {
          time: '14:15',
          kind: 'shopping',
          title: 'MUSINSA STANDARD 弘大：逛衣服',
          place: musinsaStandard,
          spotId: 'musinsa-standard',
          note: 'MUSINSA 自有品牌的旗艦店，外國旅客滿額退稅，記得帶護照。逛完直接送她去搭車。',
        },
        {
          time: '14:45',
          end: '15:30',
          who: [HER],
          kind: 'transit',
          title: '弘大 → KBS Arena',
          place: arena,
          routeId: 'stay-to-arena',
        },
        {
          time: '14:45',
          who: [ME],
          kind: 'sight',
          title: '自由時間：京義線林蔭道・望遠市場',
          place: mangwon,
          spotId: 'mangwon-market',
          alternatives: [
            {
              trigger: 'rain',
              title: '自由時間：逛 AK& 弘大',
              kind: 'shopping',
              place: { name: 'AK& 弘大', local: 'AK& 홍대', mapQuery: 'AK& 홍대' },
              note: '弘大入口站旁的購物中心，下雨也能逛。',
            },
            {
              trigger: 'tired',
              title: '回住宿休息',
              kind: 'stay',
              place: stay,
              note: '晚上還要去接她，先充電。',
            },
          ],
          note: '都在住宿附近，逛累了隨時能回去。晚上要吃豬腳，下午別吃太飽。',
          tentative: true,
        },
        {
          time: '15:30',
          who: [HER],
          kind: 'shopping',
          title: '取票・周邊排隊',
          fixed: true,
          place: arena,
          note: '今天的取票時間是 15:00–17:30（開演前 3 小時到前 30 分鐘）。',
          verify: '周邊販售時間與地點等主辦公告',
        },
        {
          time: '18:00',
          who: [HER],
          kind: 'concert',
          title: `第二場・${concert}`,
          place: arena,
          note: '帶護照正本、票、應援棒。演出約 150 分鐘，預計 20:30 結束。',
        },
        {
          time: '19:45',
          end: '20:25',
          who: [ME],
          kind: 'transit',
          title: '出發去 KBS Arena 接她',
          place: meetPoint,
          routeId: 'stay-to-arena',
        },
        {
          time: '20:30',
          kind: 'task',
          title: '散場會合',
          fixed: true,
          place: meetPoint,
          note: '跟昨天約同一個地方。',
        },
        {
          time: '20:40',
          end: '21:20',
          kind: 'transit',
          title: '一起搭地鐵回弘大',
          routeId: 'arena-to-stay',
        },
        {
          time: '21:30',
          kind: 'food',
          title: 'MISS 豬腳宵夜',
          place: jokbal,
          spotId: 'miss-jokbal',
          alternatives: [
            {
              trigger: 'full',
              title: '外帶 MISS 豬腳回住宿吃',
              note: '豬腳在韓國很常外帶，可以問店員「포장 돼요?」（可以外帶嗎？）',
            },
            {
              trigger: 'late',
              when: '散場太晚、店快打烊',
              title: '便利商店買宵夜回住宿',
              place: stay,
              note: '弘大一帶便利商店很多，買點吃的回去慶祝也很好。',
            },
          ],
          note: '慶祝兩場都看完！吃完回去收行李、秤重，明天 06:45 起床。',
          verify: '營業時間與最後點餐時間在 Naver Map 確認；太晚沒開就改到中午吃',
        },
      ],
    },
    {
      date: '2026-11-08',
      title: '回家囉',
      scene: 'home',
      items: [
        {
          time: '06:45',
          kind: 'task',
          title: '起床・整理・退房',
          note: '護照、退稅單據放隨身包；行動電源放手提，不能托運。',
        },
        {
          time: '07:20',
          kind: 'transit',
          title: '步行到弘大入口站',
          place: hongdaeStation,
          routeId: 'stay-to-icn',
        },
        {
          time: '07:35',
          end: '08:30',
          kind: 'transit',
          title: 'AREX 普通列車 → 仁川 T1',
          place: icnT1,
          routeId: 'stay-to-icn',
          note: '在「仁川機場第 1 航廈」下車，不要坐到終點 T2。',
        },
        {
          time: '08:40',
          kind: 'task',
          title: '濟州航空報到・退稅・出境',
          fixed: true,
          place: icnT1,
          note: '起飛前 2 小時到。有買東西要退稅的話，先到退稅機台處理再托運。',
        },
        {
          time: '10:40',
          end: '12:35',
          tzLabel: '首爾 → 台北',
          kind: 'flight',
          title: '7C6101 仁川 T1 → 桃園 T1',
        },
      ],
    },
  ],

  routes: [
    {
      id: 'icn-to-arena',
      title: '仁川 T2 → KBS Arena（兩人一起、帶行李）',
      when: '11/6（五）17:00 出發，她 19:00 前要取票',
      summary: '帶著行李，搭機場巴士讓行李放車底最輕鬆，下車走 3 分鐘就到場館。週五傍晚可能塞車，但就算塞到 90 分鐘，18:30 也到得了。',
      options: [
        {
          label: 'A',
          mode: '機場巴士 6003',
          tab: '巴士',
          recommended: true,
          duration: '約 60–80 分鐘（看車況）',
          cost: '約 ₩17,000 / 人（估）',
          steps: [
            '入境大廳後跟著「Bus / 버스」指標，找 6003 的乘車處（T2 的月台編號以現場指標為準）。',
            '刷交通卡或在售票機買票，行李交給司機放車底。',
            '上車時跟司機說「KBS 스포츠월드」，在這站下車。',
            '下車後步行約 3 分鐘到 KBS Arena。',
          ],
          pros: ['行李放車底，不用拖著轉車', '下車就在場館旁邊'],
          cons: ['週五傍晚可能塞車'],
          verify: '停靠「KBS스포츠월드」是 KBS Arena 官網寫的；乘車處、車資、班距請以 airportlimousine.co.kr 為準',
        },
        {
          label: 'B',
          mode: 'AREX + 9 號線',
          tab: '地鐵',
          duration: '約 75 分鐘（含步行 15 分）',
          cost: '約 ₩5,000 / 人（估）',
          steps: [
            '入境大廳往 B1 交通中心，搭 AREX「普通列車（일반열차）」往首爾方向。不要搭直達車（Express），它中間不停。',
            '在「마곡나루 Magongnaru」下車（約 45–50 分鐘），跟著指標轉乘 9 號線。',
            '搭 9 號線往「중앙보훈병원」方向，到「가양 Gayang」下車（普通車 2 站、急行 1 站）。',
            '從 8 號出口出站，步行約 15 分鐘到 KBS Arena。',
          ],
          pros: ['不受塞車影響，時間最準'],
          cons: ['拖行李轉車，出站後還要走 15 分鐘'],
          verify: '出口與步行時間依 KBS Arena 官網；AREX 車程是推算的',
        },
        {
          label: 'C',
          mode: '計程車',
          tab: '計程車',
          duration: '約 50–70 分鐘',
          cost: '約 ₩50,000–65,000 / 車（估）',
          steps: ['入境大廳外的計程車招呼站排班，或用 Kakao T 叫車。', '出示「給司機看」上的 KBS Arena 地址。'],
          pros: ['門到門，兩人分攤還可以'],
          cons: ['週五傍晚塞車時跳表會更貴'],
          verify: '價格是粗估',
        },
      ],
      fallback: [
        '班機延誤、17:45 後才出關：改搭計程車；如果路上很塞，她可以在發山站（5 號線）附近下車改走路，取票截止是 19:00。',
        '手機沒網路：場館韓文地址在「給司機看」，這個網頁離線也打得開。',
      ],
    },
    {
      id: 'arena-to-stay-luggage',
      title: 'KBS Arena → 弘大住宿（帶兩人的行李）',
      who: [ME],
      when: '11/6（五）約 18:30',
      summary: '一個人顧兩份行李，搭計程車門到門最輕鬆。',
      options: [
        {
          label: 'A',
          mode: '計程車',
          tab: '計程車',
          recommended: true,
          duration: '約 25–35 分鐘',
          cost: '約 ₩13,000–18,000 / 車（估）',
          steps: [
            '在場館前的大馬路（공항대로）攔車，或用 Kakao T 叫車。',
            '目的地輸入「서교동 333-41」，或出示「給司機看」。',
          ],
          pros: ['行李直接放後車廂'],
          cons: ['週五傍晚可能塞車'],
          verify: '價格是粗估',
        },
        {
          label: 'B',
          mode: '地鐵（9 號線 + 2 號線）',
          tab: '地鐵',
          duration: '約 45 分鐘（含步行 15 分）',
          cost: '約 ₩1,600 / 人（估）',
          steps: [
            '步行約 15 分鐘到「가양」站。',
            '搭 9 號線往「중앙보훈병원」方向，到「당산」下車（急行 2 站）。',
            '轉 2 號線往「홍대입구」方向（2 站），出站步行到住宿。',
          ],
          pros: ['不會塞車'],
          cons: ['推兩份行李走路、轉車很累'],
        },
      ],
    },
    {
      id: 'stay-to-arena',
      title: '弘大 → KBS Arena',
      when: '她：11/7 14:45 出發｜我：去接她時（11/6 21:15、11/7 19:45）',
      summary: '地鐵約 40–45 分鐘。兩條路線差不多，看哪個月台比較近。',
      options: [
        {
          label: 'A',
          mode: '2 號線 + 9 號線急行',
          tab: '地鐵',
          recommended: true,
          duration: '約 40–45 分鐘（含步行 15 分）',
          cost: '約 ₩1,600 / 人（估）',
          steps: [
            '弘大入口站搭 2 號線往「합정 Hapjeong」方向，到「당산 Dangsan」下車（2 站）。',
            '轉 9 號線往「개화 / 김포공항」方向，可以搭紅色的「급행（急行）」。',
            '在「가양 Gayang」下車（急行 2 站），從 8 號出口出站。',
            '步行約 15 分鐘到 KBS Arena；會合點「KBS스포츠월드」公車站在場館旁邊。',
          ],
          pros: ['9 號線急行很快'],
          cons: ['週六傍晚 9 號線可能很擠'],
        },
        {
          label: 'B',
          mode: 'AREX + 9 號線',
          tab: 'AREX',
          duration: '約 40–45 分鐘（含步行 15 分）',
          cost: '約 ₩1,600 / 人（估）',
          steps: [
            '弘大入口站搭 AREX 普通列車往「인천공항」方向，到「마곡나루」下車（2 站）。',
            '轉 9 號線往「중앙보훈병원」方向，到「가양」下車。',
            '8 號出口出站，步行約 15 分鐘。',
          ],
          pros: ['AREX 週末比較不擠'],
          cons: ['AREX 月台很深，進出站要多走幾分鐘'],
        },
        {
          label: 'C',
          mode: '計程車',
          tab: '計程車',
          duration: '約 25–35 分鐘',
          cost: '約 ₩13,000–18,000 / 車（估）',
          steps: ['用 Kakao T 叫車，出示 KBS Arena 地址。'],
          pros: ['最輕鬆'],
          cons: ['週六傍晚可能塞車'],
          verify: '價格是粗估',
        },
      ],
    },
    {
      id: 'arena-to-stay',
      title: 'KBS Arena → 弘大（散場）',
      when: '11/6 約 22:00、11/7 約 20:30（演出約 150 分鐘）',
      summary: '散場時幾千人同時離開，場館門口的計程車很難叫。兩天都沒有行李，搭地鐵最穩。',
      options: [
        {
          label: 'A',
          mode: '地鐵（9 號線 + 2 號線）',
          tab: '地鐵',
          recommended: true,
          duration: '約 40–45 分鐘',
          cost: '約 ₩1,600 / 人（估）',
          steps: [
            '從會合點步行約 15 分鐘到「가양」站。',
            '搭 9 號線往「중앙보훈병원」方向，到「당산」下車（急行 2 站）。',
            '轉 2 號線往「홍대입구」方向（2 站）。',
            '出站步行回住宿。',
          ],
          pros: ['時間穩定', '末班車在午夜前後，不用擔心'],
          cons: ['散場人潮會擠進同一個站'],
        },
        {
          label: 'B',
          mode: '計程車',
          tab: '計程車',
          duration: '約 25–30 分鐘',
          cost: '約 ₩13,000–18,000 / 車（估），深夜加成會更貴',
          steps: [
            '先沿著大馬路（공항대로）往遠離場館的方向走 5–10 分鐘，避開人潮再叫車。',
            '用 Kakao T 叫車，目的地輸入「서교동 333-41」或出示「給司機看」。',
          ],
          pros: ['她看完很累的話最輕鬆'],
          cons: ['散場時很難叫到車'],
          verify: '價格是粗估；22:00 後計程車有深夜加成',
        },
      ],
      fallback: ['가양站太擠：可以走到「발산」站（5 號線，約 14 分鐘），但回弘大要多轉一次車，通常改搭計程車比較快。'],
    },
    {
      id: 'stay-to-icn',
      title: '弘大 → 仁川 T1',
      when: '11/8（日）07:20 出門，10:40 起飛',
      summary: '起飛前 2 小時（08:40）到 T1。週日清晨交通順，AREX 最穩。',
      options: [
        {
          label: 'A',
          mode: 'AREX 普通列車',
          tab: 'AREX',
          recommended: true,
          duration: '約 50 分鐘 + 步行 10 分',
          cost: '約 ₩5,000 / 人（估）',
          steps: [
            '07:20 出門，步行到弘大入口站，跟著「공항철도 Airport Railroad」指標走。',
            '刷卡進站，搭往「인천공항 Incheon Airport」方向的普通列車（約 07:35 那班）。',
            '⚠️ 在「인천공항1터미널（第 1 航廈）」下車：濟州航空在 T1，不要坐到終點 T2。',
            '約 08:30 抵達，從 B1 搭電扶梯上 3F 出境大廳，找濟州航空報到櫃檯。',
          ],
          pros: ['時間最準', '週日早上車廂空'],
          cons: ['拖行李要走一段地下通道'],
          verify: '車資依網路資料，以站內票價表為準',
        },
        {
          label: 'B',
          mode: '計程車（前一晚預約）',
          tab: '計程車',
          duration: '約 50–60 分鐘',
          cost: '約 ₩55,000–75,000 / 車（估）',
          steps: ['前一晚用 Kakao T 預約 07:30 出發，或請民宿老闆幫忙叫車。', '上車時說「인천공항 제1터미널」。'],
          pros: ['行李多了也不用拖著走樓梯'],
          cons: ['比 AREX 貴很多', '預約不一定成功，要有 A 當備案'],
          verify: '價格是粗估',
        },
      ],
      fallback: [
        '坐過頭到 T2：搭航廈間的免費接駁巴士回 T1，約 15–20 分鐘。',
        '錯過 07:35 那班：下一班普通列車大約十多分鐘後到，還來得及；07:50 前還沒上車就改搭計程車。',
        '趕不上報到截止：立刻到濟州航空櫃檯找地勤，不要先去排安檢。',
      ],
    },
  ],

  tips: [
    {
      title: '入境',
      tips: [
        {
          title: '入境申報（e-Arrival Card）：要填',
          body: [
            '台灣旅客免申請 K-ETA（豁免已延長到 2026/12/31），但因為沒有 K-ETA，入境申報還是要填。',
            '抵達前 3 天內（11/3 起）在官網填寫，兩個人各填一份。',
            '只用官網填寫。搜尋時會跑出長得很像的收費代辦網站，不要在那些網站輸入護照資料。',
          ],
          level: 'warn',
          links: [{ label: 'e-Arrival Card 官網', url: 'https://www.e-arrivalcard.go.kr/portal/main/index.do?locale=CH' }],
        },
      ],
    },
    {
      title: '行李規定',
      tips: [
        {
          title: '你們的額度：托運 15kg・手提 10kg',
          body: [
            '真航空（去程）：手提 1 件 + 個人物品 1 件，合計 10kg 以內，三邊和 115cm 以內；托運 1 件 15kg，三邊和 203cm 以內。',
            '濟州航空（回程）：手提 1 件 + 個人物品 1 件，合計 10kg 以內，三邊和 115cm 以內；托運 15kg，三邊和 158cm 以內。',
            '韓國廉航在登機口真的會秤手提行李。回程買了鞋子衣服，記得在住宿先秤重。',
          ],
          level: 'warn',
          links: [
            { label: '真航空官網', url: 'https://www.jinair.com' },
            { label: '濟州航空托運規定', url: 'https://www.jejuair.net/ko/linkService/boardingProcessGuide/trustBaggage.do' },
          ],
        },
        {
          title: '行動電源（2026/4/20 起的新規定）',
          body: [
            '只能放手提，不能托運。',
            '每人最多 2 個，每個 160Wh（約 43,000mAh）以下。',
            '機上禁止用行動電源充電，也不能放在頭頂置物櫃，要放身上或前方座椅袋。',
            '端子貼絕緣膠帶，或一個一個裝進塑膠袋。',
          ],
          level: 'warn',
        },
        {
          title: '電池',
          body: [
            '應援棒用的一般鹼性乾電池（AA / AAA）：手提、托運都可以，建議跟應援棒一起放手提。',
            '備用鋰電池（相機電池、鋰乾電池）：只能放手提，端子要絕緣，或保留原包裝。',
            '裝在相機、手機裡的電池不受影響。',
          ],
        },
        {
          title: '暖暖包',
          body: [
            '一次性暖暖包（撕開會發熱的那種）一般不算危險物品，但我沒查到真航空、濟州航空的明文規定。',
            '最省事的做法：到韓國再買。便利商店都有賣「핫팩」，很便宜。',
            '充電式暖手寶內建鋰電池：只能放手提、不能托運；如果它也能幫手機充電，可能會被當成行動電源，算進每人 2 個的額度。',
          ],
          level: 'warn',
        },
        {
          title: '止痛藥・常備藥',
          body: [
            '止痛藥（普拿疼、布洛芬等）帶自己要吃的份量沒問題，放手提，盡量保留原包裝或藥袋，安檢和海關比較好辨識。',
            '液體藥（糖漿、眼藥水）超過 100ml 的，安檢時主動拿出來說明。',
            '含偽麻黃鹼的感冒藥、含可待因的止咳藥：韓國管制這類成分，最好不要帶；真的需要就帶處方或英文診斷書。',
            '在韓國臨時要買藥：藥局（약국）可以買到泰諾（타이레놀）。',
          ],
          links: [{ label: '食藥處：管制藥品攜帶說明', url: 'https://mfds.go.kr/brd/m_74/view.do?seq=43906' }],
        },
        {
          title: '液體與其他',
          body: [
            '液體：手提的每瓶 100ml 以下，全部裝進一個 1 公升的透明夾鏈袋；超過的放托運。',
            '打火機每人 1 個、隨身攜帶；電子菸只能放手提，機上禁止使用。',
          ],
        },
      ],
    },
    {
      title: '演唱會',
      tips: [
        {
          title: '取票時間：開演前 3 小時 ～ 前 30 分鐘',
          body: ['11/6（19:30 開演）：16:30–19:00 取票。', '11/7（18:00 開演）：15:00–17:30 取票。'],
          level: 'warn',
        },
        {
          title: '場館：KBS Arena',
          body: [
            '地址：서울 강서구 공항대로 376（舊名 88 體育館）。',
            '地鐵：9 號線가양站 8 號出口步行約 15 分鐘，或 5 號線발산站 5 號出口步行約 14 分鐘。',
            '公車：「KBS스포츠월드」站步行約 3 分鐘，機場巴士 6000、6003、6008 都有停。',
          ],
          links: [{ label: 'KBS Arena 交通指南', url: 'https://kbsarena.com/notice/locations.do' }],
        },
        {
          title: '散場會合',
          body: [
            '演出約 150 分鐘：11/6 約 22:00 結束、11/7 約 20:30 結束（安可可能更晚）。',
            '會合點：「KBS스포츠월드」公車站（場館步行 3 分鐘）。場館門口人太多，很難找到彼此。',
            '散場時網路很塞，手機可能打不通。約好「打不通就在會合點等，最晚等到幾點」。',
          ],
          level: 'warn',
        },
        {
          title: '帶護照正本',
          body: ['韓國演唱會常常要實名驗證才能入場，護照正本一定要帶，影本或照片不一定被接受。'],
          level: 'warn',
        },
        {
          title: '保暖',
          body: ['11 月首爾晚上約 5°C，戶外排隊很冷，場內反而熱。洋蔥式穿搭，暖暖包到當地便利商店買。'],
        },
      ],
    },
    {
      title: '交通與 App',
      tips: [
        {
          title: '地圖用 Naver Map',
          body: [
            'Google Maps 在韓國不能步行或開車導航，搜韓文地址也常常不準。',
            '先下載 Naver Map（有中文介面），把住宿、KBS Arena、會合點存起來。',
          ],
          level: 'warn',
          links: [{ label: '住宿的 Naver 地點', url: 'https://naver.me/F2LkMzgX' }],
        },
        {
          title: '交通卡',
          body: [
            'WOWPASS 可以換匯、刷卡，也能當 T-money 搭車，機場就有機台。兩個人都要有一張。',
            '在便利商店幫 T-money 加值常常只收現金，身上留一點韓元。',
          ],
        },
        {
          title: '叫車與翻譯',
          body: ['Kakao T：叫計程車用，出發前先註冊、綁好信用卡。', 'Papago：韓文翻譯比 Google 準，也可以拍照翻譯菜單。'],
        },
      ],
    },
    {
      title: '生活',
      tips: [
        { title: '電壓 220V', body: ['雙圓孔插座（C/F 型），台灣的電器要帶轉接頭。手機、筆電的充電器大多支援 220V。'] },
        { title: '天氣', body: ['11 月初白天約 12–15°C，早晚 3–7°C，偏乾冷，記得帶護唇膏和乳液。'] },
        { title: '購物退稅', body: ['有「Tax Free」標示的店，單筆消費達門檻就能退稅；市區即時退稅最方便，要帶護照。'] },
      ],
    },
  ],

  checklist: [
    {
      title: '證件與票券',
      items: [
        { id: 'passport', label: '護照（效期 6 個月以上）' },
        { id: 'ticket', label: '兩場演唱會的票 / 手機票 App 登入' },
        { id: 'arrival', label: '填好 e-Arrival Card（11/3 起，兩人各一份）' },
        { id: 'meet', label: '約好散場會合點與「打不通時」的規則' },
      ],
    },
    {
      title: 'App 與網路',
      items: [
        { id: 'esim', label: 'eSIM / 漫遊（兩人都要，分頭行動要能聯絡）' },
        { id: 'naver', label: 'Naver Map 下載，存好住宿、KBS Arena、會合點' },
        { id: 'kakaot', label: 'Kakao T 註冊、綁卡' },
        { id: 'papago', label: 'Papago 翻譯' },
        { id: 'pwa', label: '這個網頁「加入主畫面」' },
      ],
    },
    {
      title: '隨身物品',
      items: [
        { id: 'krw', label: '少量韓元現金' },
        { id: 'adapter', label: '轉接頭（雙圓孔）' },
        { id: 'powerbank', label: '行動電源（手提、每人最多 2 個、端子絕緣）' },
        { id: 'lightstick', label: '應援棒 + 乾電池，先配對好' },
        { id: 'meds', label: '止痛藥・常備藥（原包裝、放手提）' },
        { id: 'jacket', label: '保暖外套（暖暖包到當地買）' },
        { id: 'scale', label: '行李秤（回程手提 10kg）' },
      ],
    },
  ],
}
