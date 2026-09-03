import { useState } from 'react'
import LookupPage from './components/LookupPage'
import TrackerPage from './components/TrackerPage'

export default function App() {
  const [playerData, setPlayerData] = useState(null)

  return (
    <div style={{ position: 'relative', zIndex: 1 }}>
      {!playerData
        ? <LookupPage onPlayer={setPlayerData} />
        : <TrackerPage player={playerData} onBack={() => setPlayerData(null)} />
      }
    </div>
  )
}
