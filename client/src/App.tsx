
import { Dialer } from './components/Dialer'

function App() {
  return (
    <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center p-4">
      <header className="mb-8 text-center">
        <h1 className="text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-teal-400 to-indigo-500 tracking-tight">
          Twilio Voiceflow Dialer
        </h1>
        <p className="text-gray-500 mt-2">Agent Workspace</p>
      </header>
      <main className="w-full max-w-lg">
        <Dialer />
      </main>
    </div>
  )
}

export default App
