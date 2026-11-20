import { useEffect } from 'react'
import { useAuth } from './lib/authStore'
import { useRoute } from './lib/router'
import { useTrip, useTrips } from './lib/tripStore'
import { JoinView, LoginView, Splash } from './components/LoginView'
import TripList from './components/TripList'
import TripView from './components/TripView'

export default function App() {
  const route = useRoute()
  const trip = useTrip(route.tripId)
  const refresh = useTrips((s) => s.refresh)
  const status = useAuth((s) => s.status)
  const check = useAuth((s) => s.check)

  useEffect(() => {
    void check()
  }, [check])

  // 登入之後：打開網站、或從背景切回來時，抓一次最新的行程
  useEffect(() => {
    if (status !== 'signedIn' && status !== 'offline') return
    if (status === 'signedIn') void refresh()
    const onVisible = () => {
      if (document.visibilityState !== 'visible') return
      // 離線時切回來，先重新確認登入（網路可能恢復了）
      if (useAuth.getState().status === 'offline') void check()
      else void refresh()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [status, refresh, check])

  useEffect(() => {
    document.title = trip ? `${trip.title}・旅行手帖` : '旅行手帖'
  }, [trip])

  if (route.join && status !== 'signedIn') return <JoinView code={route.join} />
  if (status === 'checking') return <Splash />
  if (status === 'signedOut') return <LoginView />
  if (!trip) return <TripList />
  return <TripView key={trip.id} trip={trip} tab={route.tab} focus={route.focus} />
}
