import React, { useEffect, useState } from "react"
import { WakeSignalChart } from "./WakeSignalChart"

interface DashboardProps {
  mint: string
}

export const BitWakeDashboard: React.FC<DashboardProps> = ({ mint }) => {
  const [data, setData] = useState<{ timestamp: number; volume: number }[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/wake-signals?mint=${mint}`)
        if (!res.ok) throw new Error(await res.text())
        setData(await res.json())
      } catch (e: any) {
        setError(e.message)
      }
    }
    load()
  }, [mint])

  return (
    <div className="p-6 bg-gray-50 rounded-lg shadow">
      <h1 className="text-2xl font-bold mb-4">BitWake Scan: {mint}</h1>
      {error && <p className="text-red-600">{error}</p>}
      {!error && <WakeSignalChart data={data} />}
    </div>
  )
}
