import { create } from 'zustand'
import { startAuthentication, startRegistration } from '@simplewebauthn/browser'
import * as api from './api'
import { clearTripCache, hasTripCache, useTrips } from './tripStore'
import { useChat } from './chatStore'

// 登入狀態。
//   checking   剛打開，還在問後端
//   signedIn   登入了
//   signedOut  沒登入或登入過期，要用 passkey 登入
//   offline    連不上網路：這支手機之前登入過、有存行程的話，先用存著的那份
export type AuthStatus = 'checking' | 'signedIn' | 'signedOut' | 'offline'

interface AuthState {
  status: AuthStatus
  user?: api.Account
  check: () => Promise<void>
  login: () => Promise<void>
  /** name：新旅伴自己填的名字 */
  join: (code: string, name?: string) => Promise<void>
  rename: (name: string) => Promise<void>
  logout: () => Promise<void>
  /** 重新抓帳號資料（例如刪了裝置之後） */
  reload: () => Promise<void>
}

/** 使用者自己按取消、或關掉 Face ID 視窗時不要顯示成錯誤 */
export const isCancelled = (e: unknown) => e instanceof Error && (e.name === 'NotAllowedError' || e.name === 'AbortError')

function forgetLocalData() {
  clearTripCache()
  useChat.getState().reset()
}

export const useAuth = create<AuthState>()((set, get) => {
  api.setUnauthorizedHandler(() => {
    if (get().status === 'signedIn' || get().status === 'checking') {
      forgetLocalData()
      set({ status: 'signedOut', user: undefined })
    }
  })

  return {
    status: 'checking',

    check: async () => {
      try {
        const { user } = await api.fetchMe()
        set({ status: 'signedIn', user })
      } catch (e) {
        if (e instanceof api.ApiError && e.status === 401) set({ status: 'signedOut', user: undefined })
        else set({ status: hasTripCache() ? 'offline' : 'signedOut' })
      }
    },

    reload: async () => {
      const { user } = await api.fetchMe()
      set({ user })
    },

    login: async () => {
      const { options, challengeId } = await api.loginOptions()
      const response = await startAuthentication({ optionsJSON: options as Parameters<typeof startAuthentication>[0]['optionsJSON'] })
      const { user } = await api.loginVerify(challengeId, response)
      set({ status: 'signedIn', user })
      void useTrips.getState().refresh()
    },

    join: async (code, name) => {
      const { options, challengeId } = await api.inviteOptions(code, name)
      const response = await startRegistration({ optionsJSON: options as Parameters<typeof startRegistration>[0]['optionsJSON'] })
      const { user } = await api.inviteVerify(code, challengeId, response)
      set({ status: 'signedIn', user })
      void useTrips.getState().refresh()
    },

    rename: async (name) => {
      const { user } = await api.rename(name)
      set({ user })
    },

    logout: async () => {
      await api.logout().catch(() => undefined)
      forgetLocalData()
      set({ status: 'signedOut', user: undefined })
    },
  }
})
