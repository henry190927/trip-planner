import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { MotionConfig } from 'motion/react'
import { registerSW } from 'virtual:pwa-register'
import App from './App'
import ErrorBoundary from './components/ErrorBoundary'
import './index.css'

// 加到主畫面的 App 從背景切回來時不會重新載入，也就不會去檢查有沒有新版，
// 會一直跑舊的程式。所以每次切回來都主動檢查一次；有新版會自動換上並重新整理
registerSW({
  immediate: true,
  onRegisteredSW(_url, registration) {
    if (!registration) return
    const check = () => {
      if (document.visibilityState === 'visible' && navigator.onLine) void registration.update().catch(() => undefined)
    }
    document.addEventListener('visibilitychange', check)
    setInterval(check, 60 * 60 * 1000)
  },
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <MotionConfig reducedMotion="user">
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </MotionConfig>
  </StrictMode>,
)
