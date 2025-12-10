
import { Dialer } from './components/Dialer'

function App() {
  return (
    <div className="min-h-screen bg-[#020B2D] text-white font-sans flex flex-col items-center justify-start pt-5 p-4 selection:bg-blue-500/30">
      <div className="w-full max-w-lg">

        <main>
          <Dialer />
        </main>
      </div>
    </div>
  )
}

export default App
