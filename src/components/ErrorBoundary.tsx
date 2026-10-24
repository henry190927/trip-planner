import { Component, type ReactNode } from 'react'
import { Suitcase } from './illustrations'

// 任何一個畫面出錯時，顯示可以重新載入的提示，而不是整頁空白
export default class ErrorBoundary extends Component<{ children: ReactNode }, { error?: Error }> {
  state: { error?: Error } = {}

  static getDerivedStateFromError(error: Error) {
    return { error }
  }

  componentDidCatch(error: Error) {
    console.error(error)
  }

  render() {
    if (!this.state.error) return this.props.children
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-4 px-8 text-center">
        <Suitcase className="w-32" />
        <h1 className="text-xl font-black">畫面出了點問題</h1>
        <p className="text-sm text-mute">重新載入通常就會好。行程資料都還在。</p>
        <button
          type="button"
          onClick={() => {
            window.location.hash = ''
            window.location.reload()
          }}
          className="rounded-full bg-[linear-gradient(135deg,var(--sky),var(--peach))] px-6 py-2.5 font-black"
        >
          重新載入
        </button>
        <p className="max-w-xs break-all text-[11px] text-mute">{this.state.error.message}</p>
      </div>
    )
  }
}
