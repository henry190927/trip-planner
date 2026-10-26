import type { ReactNode } from 'react'
import type { Scene } from '../types'

// 手繪風插圖：同一組線條與配色，動畫用 index.css 的 .a-* class（會尊重「減少動態效果」設定）
const INK = '#4a4458'
const C = {
  cream: '#FCF0DA',
  light: '#FFF4DE',
  peachCream: '#FFE8C4',
  sky: '#97D7FF',
  peach: '#FFCCB8',
  leaf: '#A8DDA0',
  white: '#FFFFFF',
}

type Props = { className?: string }
const line = { stroke: INK, strokeWidth: 2.5, strokeLinecap: 'round', strokeLinejoin: 'round' } as const

function Svg({ children, className, box = 120 }: Props & { children: ReactNode; box?: number }) {
  return (
    <svg viewBox={`0 0 ${box} ${box}`} className={className} aria-hidden="true" fill="none">
      {children}
    </svg>
  )
}

function Face({ x, y, s = 1 }: { x: number; y: number; s?: number }) {
  return (
    <g>
      <circle cx={x - 7 * s} cy={y} r={2.4 * s} fill={INK} />
      <circle cx={x + 7 * s} cy={y} r={2.4 * s} fill={INK} />
      <path d={`M${x - 3.5 * s} ${y + 5 * s} Q${x} ${y + 8 * s} ${x + 3.5 * s} ${y + 5 * s}`} {...line} strokeWidth={2 * s} />
      <ellipse cx={x - 12 * s} cy={y + 5 * s} rx={3.5 * s} ry={2.2 * s} fill={C.peach} />
      <ellipse cx={x + 12 * s} cy={y + 5 * s} rx={3.5 * s} ry={2.2 * s} fill={C.peach} />
    </g>
  )
}

export function Sparkle({ x, y, r = 6, delay = 0, fill = C.white }: { x: number; y: number; r?: number; delay?: number; fill?: string }) {
  return (
    <path
      className="a-twinkle"
      style={{ animationDelay: `${delay}s` }}
      d={`M${x} ${y - r} Q${x} ${y} ${x + r} ${y} Q${x} ${y} ${x} ${y + r} Q${x} ${y} ${x - r} ${y} Q${x} ${y} ${x} ${y - r}Z`}
      fill={fill}
      stroke={INK}
      strokeWidth={1.5}
      strokeLinejoin="round"
    />
  )
}

/** 小樹：這趟旅程的吉祥物（植木日 → 種一棵樹） */
export function Sprout({ className }: Props) {
  return (
    <Svg className={className}>
      <ellipse cx="60" cy="108" rx="26" ry="5" fill={INK} opacity=".08" />
      <g className="a-bob">
        <g className="a-sway" style={{ transformOrigin: '60px 50px' }}>
          <path d="M60 52 V38" {...line} />
          <path d="M60 42 C50 26 32 28 30 36 C36 46 50 46 60 42Z" fill={C.leaf} {...line} />
          <path d="M60 40 C70 22 90 24 92 32 C86 44 70 44 60 40Z" fill={C.leaf} {...line} />
        </g>
        <path d="M30 80 C30 58 44 50 60 50 C76 50 90 58 90 80 C90 96 77 104 60 104 C43 104 30 96 30 80Z" fill={C.peachCream} {...line} />
        <Face x={60} y={78} />
      </g>
    </Svg>
  )
}

/** 飛機：起飛日、回程日 */
export function Plane({ className }: Props) {
  return (
    <Svg className={className}>
      <path className="a-dash" d="M6 92 Q30 96 44 74" stroke={INK} strokeWidth="2.5" strokeDasharray="4 7" strokeLinecap="round" opacity=".45" />
      <g className="a-cloud">
        <path d="M78 98 a8 8 0 0 1 14 -6 a10 10 0 0 1 18 4 a6 6 0 0 1 -2 12 h-28 a6 6 0 0 1 -2 -10Z" fill={C.white} {...line} />
      </g>
      <g className="a-fly">
        <path d="M44 78 L72 36 C78 28 90 26 96 30 C100 36 96 48 88 52 L46 82 Z" fill={C.white} {...line} />
        <path d="M66 46 L42 40 L36 46 L58 58Z" fill={C.peach} {...line} />
        <path d="M78 58 L84 82 L78 88 L68 64Z" fill={C.peach} {...line} />
        <path d="M48 76 L34 74 L32 80 L46 84Z" fill={C.sky} {...line} />
        <circle cx="86" cy="38" r="3.2" fill={C.sky} stroke={INK} strokeWidth="1.8" />
        <circle cx="78" cy="46" r="3.2" fill={C.sky} stroke={INK} strokeWidth="1.8" />
      </g>
      <Sparkle x={24} y={26} r={6} />
      <Sparkle x={104} y={70} r={4.5} delay={0.8} />
    </Svg>
  )
}

/** 應援棒：演唱會 */
export function Lightstick({ className }: Props) {
  return (
    <Svg className={className}>
      <circle className="a-glow" cx="60" cy="42" r="34" fill={C.sky} opacity=".35" />
      <g className="a-wave" style={{ transformOrigin: '60px 108px' }}>
        <rect x="53" y="62" width="14" height="44" rx="6" fill={C.peachCream} {...line} />
        <path d="M53 74 H67" {...line} />
        <circle cx="60" cy="42" r="22" fill={C.white} {...line} />
        <path d="M60 52 C50 44 48 36 54 33 C57 31.5 59.5 33 60 36 C60.5 33 63 31.5 66 33 C72 36 70 44 60 52Z" fill={C.peach} {...line} strokeWidth={2} />
      </g>
      <Sparkle x={20} y={30} r={7} fill={C.peachCream} />
      <Sparkle x={100} y={22} r={5} delay={0.5} fill={C.sky} />
      <Sparkle x={98} y={76} r={6} delay={1.1} fill={C.peach} />
      <Sparkle x={22} y={84} r={4} delay={1.6} />
    </Svg>
  )
}

/** 小電車：交通 */
export function Train({ className }: Props) {
  return (
    <Svg className={className}>
      <path d="M8 104 H112" {...line} opacity=".4" />
      <path d="M20 110 H34 M48 110 H62 M76 110 H90" {...line} opacity=".25" />
      <g className="a-bob">
        <rect x="20" y="30" width="80" height="66" rx="18" fill={C.sky} {...line} />
        <rect x="32" y="42" width="56" height="22" rx="8" fill={C.light} {...line} />
        <Face x={60} y={78} s={0.8} />
        <circle cx="38" cy="96" r="7" fill={C.white} {...line} />
        <circle cx="82" cy="96" r="7" fill={C.white} {...line} />
        <path d="M50 30 L46 20 M70 30 L74 20 M44 20 H76" {...line} />
      </g>
    </Svg>
  )
}

/** 月亮小屋：住宿 / 晚上 */
export function SleepyHouse({ className }: Props) {
  return (
    <Svg className={className}>
      <path d="M92 16 a16 16 0 1 0 14 24 a13 13 0 1 1 -14 -24Z" fill={C.peachCream} {...line} />
      <text className="a-zzz" x="30" y="30" fontSize="16" fontWeight="800" fill={INK}>z</text>
      <text className="a-zzz" style={{ animationDelay: '0.7s' }} x="40" y="20" fontSize="12" fontWeight="800" fill={INK}>z</text>
      <path d="M22 62 L60 32 L98 62" fill={C.peach} {...line} />
      <rect x="30" y="58" width="60" height="46" rx="6" fill={C.light} {...line} />
      <rect x="52" y="76" width="16" height="28" rx="5" fill={C.sky} {...line} />
      <rect x="36" y="68" width="12" height="12" rx="3" fill={C.peachCream} {...line} />
      <Sparkle x={18} y={88} r={4} delay={0.4} />
    </Svg>
  )
}

/** 冒煙的碗：吃飯 */
export function Bowl({ className }: Props) {
  return (
    <Svg className={className}>
      <path className="a-steam" d="M46 44 C40 36 52 32 46 22" {...line} opacity=".5" />
      <path className="a-steam" style={{ animationDelay: '0.6s' }} d="M60 42 C54 34 66 30 60 20" {...line} opacity=".5" />
      <path className="a-steam" style={{ animationDelay: '1.2s' }} d="M74 44 C68 36 80 32 74 22" {...line} opacity=".5" />
      <path d="M86 40 L104 22 M80 38 L100 16" {...line} />
      <path d="M20 58 H100 C100 82 84 98 60 98 C36 98 20 82 20 58Z" fill={C.peach} {...line} />
      <path d="M30 56 C34 48 44 50 48 54 C52 46 64 46 68 54 C72 48 84 48 90 56" fill={C.white} {...line} />
      <Face x={60} y={74} s={0.75} />
    </Svg>
  )
}

/** 購物袋 + 球鞋：逛街 */
export function ShoppingBag({ className }: Props) {
  return (
    <Svg className={className}>
      <g className="a-bob">
        <path d="M44 40 C44 24 76 24 76 40" {...line} />
        <path d="M28 40 H92 L88 102 H32Z" fill={C.peachCream} {...line} />
        <Face x={60} y={66} s={0.75} />
      </g>
      <g className="a-hop" style={{ transformOrigin: '96px 104px' }}>
        <path d="M74 104 V92 C74 88 78 86 82 88 L94 92 C102 94 112 96 112 102 V104Z" fill={C.sky} {...line} />
        <path d="M74 104 H112" {...line} />
        <path d="M84 92 L88 96 M90 94 L93 98" {...line} strokeWidth={2} />
      </g>
      <Sparkle x={16} y={30} r={5} delay={0.3} fill={C.peach} />
    </Svg>
  )
}

/** 行李箱：準備清單 */
export function Suitcase({ className }: Props) {
  return (
    <Svg className={className}>
      <g className="a-bob">
        <path d="M48 30 V22 H72 V30" {...line} />
        <rect x="26" y="30" width="68" height="70" rx="12" fill={C.sky} {...line} />
        <path d="M46 30 V100 M74 30 V100" {...line} opacity=".5" />
        <circle cx="40" cy="104" r="5" fill={C.white} {...line} />
        <circle cx="80" cy="104" r="5" fill={C.white} {...line} />
        <rect x="52" y="48" width="18" height="12" rx="3" fill={C.peach} {...line} transform="rotate(-8 61 54)" />
        <circle cx="62" cy="80" r="8" fill={C.peachCream} {...line} />
      </g>
      <Sparkle x={104} y={34} r={6} delay={0.6} fill={C.peachCream} />
    </Svg>
  )
}

/** 兩個人揮手：她（桃色）與我（天空藍） */
export function TwoFriends({ className }: Props) {
  return (
    <Svg className={className} box={140}>
      <ellipse cx="70" cy="124" rx="56" ry="6" fill={INK} opacity=".08" />
      <g className="a-bob">
        <path className="a-wave-arm" style={{ transformOrigin: '24px 82px' }} d="M24 82 L12 66" {...line} strokeWidth={4} />
        <path d="M18 96 C18 72 30 60 44 60 C58 60 70 72 70 96 C70 112 58 120 44 120 C30 120 18 112 18 96Z" fill={C.peach} {...line} />
        <path d="M36 58 L44 50 L52 58 L44 62Z" fill={C.sky} {...line} strokeWidth={2} />
        <Face x={44} y={90} s={0.85} />
      </g>
      <g className="a-bob" style={{ animationDelay: '0.4s' }}>
        <path className="a-wave-arm" style={{ transformOrigin: '118px 82px', animationDelay: '0.3s' }} d="M118 82 L130 66" {...line} strokeWidth={4} />
        <path d="M72 96 C72 72 84 60 98 60 C112 60 124 72 124 96 C124 112 112 120 98 120 C84 120 72 112 72 96Z" fill={C.sky} {...line} />
        <path d="M82 64 C86 54 110 54 114 64Z" fill={C.peachCream} {...line} strokeWidth={2} />
        <Face x={98} y={90} s={0.85} />
      </g>
      <Sparkle x={70} y={30} r={6} fill={C.peachCream} />
    </Svg>
  )
}

/** 清單進度：種子慢慢長成一棵常青樹 */
export function GrowingTree({ progress, className }: Props & { progress: number }) {
  const stage = progress >= 1 ? 4 : Math.floor(progress * 4)
  return (
    <Svg className={className}>
      <path d="M24 100 C24 92 96 92 96 100 L90 112 H30Z" fill={C.peach} {...line} />
      {stage === 0 && (
        <g className="a-bob">
          <path d="M60 70 C66 64 72 66 70 72" {...line} stroke={C.leaf} strokeWidth={4} />
          <ellipse cx="60" cy="84" rx="14" ry="11" fill={C.peachCream} {...line} />
          <Face x={60} y={84} s={0.5} />
        </g>
      )}
      {stage >= 1 && <path d={`M60 96 V${[0, 76, 64, 52, 46][stage]}`} {...line} strokeWidth={stage >= 3 ? 5 : 2.5} />}
      {stage === 1 && (
        <g className="a-sway" style={{ transformOrigin: '60px 78px' }}>
          <path d="M60 80 C52 70 42 72 42 76 C46 82 54 82 60 80Z" fill={C.leaf} {...line} />
          <path d="M60 78 C68 68 78 70 78 74 C74 80 66 80 60 78Z" fill={C.leaf} {...line} />
        </g>
      )}
      {stage === 2 && (
        <g className="a-sway" style={{ transformOrigin: '60px 66px' }}>
          <circle cx="60" cy="56" r="18" fill={C.leaf} {...line} />
          <Face x={60} y={56} s={0.6} />
        </g>
      )}
      {stage >= 3 && (
        <g className="a-sway" style={{ transformOrigin: '60px 60px' }}>
          <path d="M60 14 L88 50 H76 L94 76 H26 L44 50 H32Z" fill={C.leaf} {...line} />
          <Face x={60} y={56} s={0.7} />
          {stage === 4 && (
            <>
              <circle cx="44" cy="68" r="4" fill={C.peach} {...line} strokeWidth={1.8} />
              <circle cx="78" cy="64" r="4" fill={C.sky} {...line} strokeWidth={1.8} />
              <circle cx="66" cy="36" r="4" fill={C.peachCream} {...line} strokeWidth={1.8} />
            </>
          )}
        </g>
      )}
      {stage === 4 && (
        <>
          <Sparkle x={18} y={30} r={6} fill={C.peachCream} />
          <Sparkle x={102} y={40} r={5} delay={0.6} fill={C.sky} />
        </>
      )}
    </Svg>
  )
}

const sceneArt: Record<Scene, (p: Props) => ReactNode> = {
  depart: Plane,
  concert: Lightstick,
  stroll: ShoppingBag,
  home: Suitcase,
}

export function SceneArt({ scene, className }: Props & { scene: Scene }) {
  const Art = sceneArt[scene]
  return <Art className={className} />
}
