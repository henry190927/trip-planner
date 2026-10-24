import type { Place, Trip } from '../types'

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

const hongdaeStation: Place = { name: '弘大入口站', local: '홍대입구역', mapQuery: '홍대입구역' }
const icnT1: Place = { name: '仁川機場第 1 航廈', local: '인천공항 제1여객터미널', mapQuery: '인천국제공항 제1여객터미널' }
const icnT2: Place = { name: '仁川機場第 2 航廈', local: '인천공항 제2여객터미널', mapQuery: '인천국제공항 제2여객터미널' }

const concertName = '南優鉉 10 週年演唱會《식목일VI – EVER GREEN》'

export const seoul2026: Trip = {
  id: 'seoul-2026-11',
  title: '首爾',
  subtitle: '南優鉉《植木日 VI》',
  emoji: '🌳',
  timezone: 'Asia/Seoul',
  startDate: '2026-11-06',
  endDate: '2026-11-08',
  theme: { accent: '#2f9e6b', accent2: '#9ccc3c' },
  mapProvider: 'naver',
  driverPhrase: '이 주소로 가 주세요',

  pending: [
    'KBS Arena 能不能寄放行李箱（11/6 會帶行李直接去場館）——可打 02-2600-8851 問，或看主辦公告',
    '周邊（MD）販售時間與地點、入場時間——等主辦（빌리언스）公告',
    '票的形式（實體 / 手機票）與座位區',
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
      notes: [
        '韓國比台灣快 1 小時，落地後手機時間會自動跳。',
        '行李：托運 15kg、手提 10kg（詳細規定見下方「行李規定」）。',
      ],
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
        '行李：托運 15kg、手提 10kg。回程買了周邊記得秤重。',
      ],
    },
  ],

  stays: [
    {
      place: stay,
      checkIn: '11/6（五）15:00 後',
      checkOut: '11/8（日）11:00 前',
      notes: [
        '⚠️ 11/6 看完演唱會才入住，預計 23:00 後才到。出發前一定要先傳訊息告訴老闆會晚到，並問清楚自助入住方式（大門密碼、鑰匙放哪）。',
        '位在弘大，離弘大入口站直線約 300 公尺，步行約 5–10 分鐘（AREX 月台很深，出站要多走幾分鐘）。',
        '11/8 07:20 就要出門：前一晚先問好清晨怎麼退房、鑰匙怎麼還。',
        '評價提到房間偏小、冬天偏冷，可以先問有沒有電熱毯。',
      ],
    },
  ],

  days: [
    {
      date: '2026-11-06',
      title: '落地直奔第一場',
      items: [
        {
          time: '09:40',
          tzLabel: '台北',
          kind: 'task',
          title: '抵達桃園機場 T1',
          place: { name: '桃園機場第一航廈', mapQuery: '桃園國際機場第一航廈' },
          note: '國際線建議提早 3 小時到；報到櫃檯關閉時間以真航空公告為準。',
        },
        {
          time: '12:40',
          end: '16:00',
          tzLabel: '台北 → 首爾',
          kind: 'flight',
          title: 'LJ172 桃園 T1 → 仁川 T2',
          note: '入境申報要在抵達前 3 天內上網填好（11/3 起可填），在機上就能確認。',
        },
        {
          time: '16:00',
          end: '17:00',
          kind: 'task',
          title: '入境・領行李',
          place: icnT2,
          note: '今天時間很趕，機場只做一件事：買 / 加值交通卡（WOWPASS 或 T-money）。換錢、逛街都留到明天。',
        },
        {
          time: '17:10',
          end: '18:30',
          kind: 'transit',
          title: '機場巴士 6003 → KBS Arena',
          place: arena,
          routeId: 'icn-to-arena',
          note: '在「KBS스포츠월드」站下車，走 3 分鐘到場館。行李可以放巴士車底，不用拖著轉地鐵。',
        },
        {
          time: '18:30',
          kind: 'food',
          title: '寄放行李・簡單吃晚餐',
          place: { name: '發山站周邊', local: '발산역', mapQuery: '발산역 맛집' },
          note: '場館附近的發山站（5 號線）一帶有很多餐廳和便利商店。演唱會約 3 小時，一定要先吃東西。',
          tentative: true,
          verify: '行李寄放：先確認場館是否提供，或預約附近的行李寄放店（營業時間要到 23:00 之後）',
        },
        {
          time: '19:30',
          kind: 'concert',
          title: `第一場・${concertName}`,
          place: arena,
          note: '帶護照正本（實名驗證）、票、應援棒。入場時間依主辦公告。',
        },
        {
          time: '22:30',
          kind: 'transit',
          title: '散場 → 弘大（帶行李建議搭計程車）',
          routeId: 'arena-to-stay',
          note: '結束時間是依前幾屆約 3 小時估的。',
          tentative: true,
        },
        {
          time: '23:15',
          kind: 'stay',
          title: '入住 HITHERE GUEST HOUSE',
          place: stay,
          note: '晚到入住，記得事先通知老闆。',
        },
      ],
    },
    {
      date: '2026-11-07',
      title: '弘大散步・第二場',
      items: [
        {
          time: '10:00',
          kind: 'food',
          title: '睡飽・早午餐',
          place: { name: '延南洞', local: '연남동', mapQuery: '연남동 브런치' },
          note: '延南洞就在弘大入口站另一側，咖啡廳和早午餐店很多。',
          tentative: true,
        },
        {
          time: '11:30',
          kind: 'sight',
          title: '京義線林蔭道・望遠市場',
          place: { name: '望遠市場', local: '망원시장', mapQuery: '망원시장' },
          note: '從延南洞沿京義線林蔭道散步，望遠市場可以搭 6 號線一站或計程車。都在住宿附近，累了隨時能回去。',
          tentative: true,
        },
        {
          time: '14:30',
          kind: 'task',
          title: '回住宿休息、充電',
          place: stay,
          note: '手機、行動電源、應援棒都充飽，換保暖的衣服。',
        },
        {
          time: '16:00',
          end: '16:45',
          kind: 'transit',
          title: '弘大 → KBS Arena',
          place: arena,
          routeId: 'stay-to-arena',
        },
        {
          time: '16:45',
          kind: 'shopping',
          title: '周邊・入場排隊',
          place: arena,
          tentative: true,
          verify: '販售與入場時間等主辦公告；想買的周邊如果是限量款，可能要更早到',
        },
        {
          time: '18:00',
          kind: 'concert',
          title: `第二場・${concertName}`,
          place: arena,
          note: '帶護照正本、票、應援棒。',
        },
        {
          time: '21:00',
          kind: 'transit',
          title: '散場 → 弘大（地鐵）',
          routeId: 'arena-to-stay',
          note: '結束時間是估計的。',
          tentative: true,
        },
        {
          time: '21:45',
          kind: 'food',
          title: '弘大宵夜・收行李',
          place: { name: '弘大商圈', local: '홍대', mapQuery: '홍대 맛집' },
          note: '早點睡：明天 06:45 起床。行李今晚收好，周邊放托運前先秤重。',
          tentative: true,
        },
      ],
    },
    {
      date: '2026-11-08',
      title: '回程',
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
      title: '仁川 T2 → KBS Arena（帶行李）',
      when: '11/6（五）約 17:00 出發，19:30 開演',
      summary:
        '落地到開演只有 3.5 小時，先回弘大放行李再來回會非常趕（約 19:05 才到場館，班機一延誤就來不及）。建議帶著行李直接去場館，散場後再搭計程車回弘大。',
      options: [
        {
          label: 'A',
          mode: '機場巴士 6003', tab: '巴士',
          recommended: true,
          duration: '約 60–80 分鐘（看車況）',
          cost: '約 ₩17,000 / 人（估）',
          steps: [
            '出入境大廳後跟著「Bus / 버스」指標，找 6003 的乘車處（T2 的月台編號以現場指標為準）。',
            '刷交通卡或在售票機買票，行李交給司機放車底。',
            '上車時跟司機說「KBS 스포츠월드」，在這站下車。',
            '下車後步行約 3 分鐘到 KBS Arena。',
          ],
          pros: ['行李放車底，不用拖著轉地鐵', '下車就在場館旁邊'],
          cons: ['週五傍晚可能塞車，時間比地鐵難抓'],
          verify: '停靠「KBS스포츠월드」是 KBS Arena 官網寫的；乘車處、車資、班距請以 airportlimousine.co.kr 為準',
        },
        {
          label: 'B',
          mode: 'AREX + 9 號線', tab: 'AREX',
          duration: '約 75 分鐘（含步行 15 分）',
          cost: '約 ₩5,000 / 人（估）',
          steps: [
            '入境後往 B1 交通中心，搭 AREX「普通列車（일반열차）」往首爾方向。',
            '在「마곡나루 Magongnaru」下車（約 45–50 分鐘），跟著指標轉乘 9 號線。',
            '搭 9 號線往「중앙보훈병원」方向，到「가양 Gayang」下車（普通車 2 站、急行 1 站）。',
            '從 8 號出口出站，步行約 15 分鐘到 KBS Arena。',
          ],
          pros: ['不受塞車影響，時間最準'],
          cons: ['拖行李轉車、上下樓梯', '出站後還要走 15 分鐘'],
          verify: '出口與步行時間依 KBS Arena 官網；AREX 車程是推算的',
        },
        {
          label: 'C',
          mode: '先回弘大放行李', tab: '先放行李',
          duration: '到場館約 19:05',
          cost: '約 ₩10,000 / 人',
          steps: [
            '只在 16:45 前就出關時才考慮。',
            'AREX 普通列車到「홍대입구」（約 58 分），走到住宿放行李。',
            '回弘大入口站搭 AREX 到「마곡나루」（2 站），轉 9 號線到「가양」，8 號出口走 15 分鐘。',
          ],
          pros: ['不用帶行李看演唱會'],
          cons: ['完全沒有緩衝，入境慢一點就趕不上開場', '住宿要能提早自助入住'],
        },
        {
          label: 'D',
          mode: '計程車', tab: '計程車',
          duration: '約 50–70 分鐘',
          cost: '約 ₩50,000–65,000 / 車（估）',
          steps: ['入境大廳外的計程車招呼站排班，或用 Kakao T 叫車。', '出示「給司機看」上的 KBS Arena 地址。'],
          pros: ['門到門，兩人分攤還算可以'],
          cons: ['週五傍晚塞車時跳表會更貴'],
          verify: '價格是粗估',
        },
      ],
      fallback: [
        '班機延誤：17:45 後才出關就直接搭計程車，最省時。',
        '場館不能寄行李：可以用行李寄放 App（例如 Bounce）找發山站附近的店。要注意營業時間必須到散場之後，不然行李會拿不回來。',
        '手機沒網路：場館與住宿的韓文地址都在「給司機看」，這個網頁離線也打得開。',
      ],
    },
    {
      id: 'stay-to-arena',
      title: '弘大 → KBS Arena',
      when: '11/7（六）16:00 出發，18:00 開演',
      summary: '地鐵約 40–45 分鐘。兩條路線差不多，看哪個月台比較近。',
      options: [
        {
          label: 'A',
          mode: '2 號線 + 9 號線急行', tab: '地鐵',
          recommended: true,
          duration: '約 40–45 分鐘（含步行 15 分）',
          cost: '約 ₩1,600 / 人（估）',
          steps: [
            '弘大入口站搭 2 號線往「합정 Hapjeong」方向，到「당산 Dangsan」下車（2 站）。',
            '轉 9 號線往「개화 / 김포공항」方向，可以搭紅色的「급행（急行）」。',
            '在「가양 Gayang」下車（急行 2 站），從 8 號出口出站。',
            '步行約 15 分鐘到 KBS Arena。',
          ],
          pros: ['9 號線急行很快'],
          cons: ['週六傍晚 9 號線可能很擠'],
        },
        {
          label: 'B',
          mode: 'AREX + 9 號線', tab: 'AREX',
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
          mode: '計程車', tab: '計程車',
          duration: '約 25–35 分鐘',
          cost: '約 ₩13,000–18,000 / 車（估）',
          steps: ['用 Kakao T 叫車，出示 KBS Arena 地址。'],
          pros: ['兩人分攤不貴，最輕鬆'],
          cons: ['週六傍晚可能塞車'],
          verify: '價格是粗估',
        },
      ],
      fallback: ['公車也可以：場館旁的「KBS스포츠월드」站有多路公車，用 Naver Map 查即時路線。'],
    },
    {
      id: 'arena-to-stay',
      title: 'KBS Arena → 弘大（散場）',
      when: '11/6 約 22:30、11/7 約 21:00（估）',
      summary:
        '散場時幾千人同時離開，最近的地鐵站和場館門口的計程車都會很擠。11/6 帶著行李建議搭計程車，11/7 搭地鐵。',
      options: [
        {
          label: 'A',
          mode: '地鐵（9 號線 + 2 號線）', tab: '地鐵',
          recommended: true,
          duration: '約 40–45 分鐘',
          cost: '約 ₩1,600 / 人（估）',
          steps: [
            '步行約 15 分鐘到「가양」站。',
            '搭 9 號線往「중앙보훈병원」方向，到「당산」下車（急行 2 站）。',
            '轉 2 號線往「홍대입구」方向（2 站）。',
            '出站步行回住宿。',
          ],
          pros: ['時間穩定', '末班車在午夜前後，不用擔心'],
          cons: ['散場人潮會擠進同一個站'],
        },
        {
          label: 'B',
          mode: '計程車', tab: '計程車',
          duration: '約 25–30 分鐘',
          cost: '約 ₩13,000–18,000 / 車（估），深夜加成會更貴',
          steps: [
            '先沿著大馬路（공항대로）往遠離場館的方向走 5–10 分鐘，避開人潮再叫車。',
            '用 Kakao T 叫車，目的地輸入「서교동 333-41」或出示「給司機看」。',
          ],
          pros: ['帶行李時最輕鬆'],
          cons: ['散場時很難叫到車'],
          verify: '價格是粗估；22:00 後計程車有深夜加成',
        },
      ],
      fallback: ['가양站太擠：可以走到「발산」站（5 號線，約 14 分鐘），但回弘大要多轉一次車，搭計程車通常比較快。'],
    },
    {
      id: 'stay-to-icn',
      title: '弘大 → 仁川 T1',
      when: '11/8（日）07:20 出門，10:40 起飛',
      summary: '起飛前 2 小時（08:40）到 T1。週日清晨交通順，AREX 最穩。',
      options: [
        {
          label: 'A',
          mode: 'AREX 普通列車', tab: 'AREX',
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
          mode: '計程車（前一晚預約）', tab: '計程車',
          duration: '約 50–60 分鐘',
          cost: '約 ₩55,000–75,000 / 車（估）',
          steps: ['前一晚用 Kakao T 預約 07:30 出發，或請民宿老闆幫忙叫車。', '上車時說「인천공항 제1터미널」。'],
          pros: ['不用拖行李走樓梯'],
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
            '韓國廉航在登機口真的會秤手提行李。回程買了周邊，記得在住宿先秤重。',
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
          title: '其他要注意的東西',
          body: [
            '液體：手提的每瓶 100ml 以下，全部裝進一個 1 公升的透明夾鏈袋；超過的放托運。',
            '應援棒用的乾電池可以放手提。',
            '打火機每人 1 個、隨身攜帶；電子菸只能放手提，機上禁止使用。',
          ],
        },
      ],
    },
    {
      title: '演唱會',
      tips: [
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
          title: '帶護照正本',
          body: ['韓國演唱會常常要實名驗證才能入場，護照正本一定要帶，影本或照片不一定被接受。'],
          level: 'warn',
        },
        {
          title: '網路一定會塞',
          body: ['幾千人同時在場館周邊上網，票券、QR code、回程路線都先截圖。這個網頁離線也打得開。'],
        },
        {
          title: '保暖',
          body: ['11 月首爾晚上約 5°C，戶外排隊很冷，場內反而熱。洋蔥式穿搭，帶暖暖包。'],
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
            '先下載 Naver Map（有中文介面），把住宿和 KBS Arena 存起來。',
          ],
          level: 'warn',
          links: [{ label: '住宿的 Naver 地點', url: 'https://naver.me/F2LkMzgX' }],
        },
        {
          title: '交通卡',
          body: [
            'WOWPASS 可以換匯、刷卡，也能當 T-money 搭車，機場就有機台。',
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
        { id: 'late-checkin', label: '傳訊息告訴民宿 11/6 晚到（23:00 後），問自助入住方式' },
        { id: 'luggage', label: '確認 11/6 行李寄放方式（場館或附近寄放店）' },
      ],
    },
    {
      title: 'App 與網路',
      items: [
        { id: 'esim', label: 'eSIM / 漫遊（兩人都要）' },
        { id: 'naver', label: 'Naver Map 下載，存好住宿和 KBS Arena' },
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
        { id: 'lightstick', label: '應援棒 + 電池，先配對好' },
        { id: 'jacket', label: '保暖外套、暖暖包' },
        { id: 'scale', label: '行李秤（回程手提 10kg）' },
      ],
    },
  ],
}
