import React, { useEffect, useState } from "react"
import { WakeSignalChart } from "./WakeSignalChart"
import { DEFAULT_SCAN_INTERVAL } from "../config"

interface SignalData {
  timestamp: number
  volume: number
}

interface DashboardProps {
  mint: string
}

export const BitWakeDashboard: React.FC<DashboardProps> = ({ mint }) => {
  const [data, setData] = useState<SignalData[]>([])
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let isMounted = true
    let intervalId: NodeJS.Timeout

    const fetchData = async () => {
      setLoading(true)
      setError(null)
      try {
        const res = await fetch(`/api/wake-signals?mint=${encodeURIComponent(mint)}`)
        if (!res.ok) {
          const text = await res.text()
          throw new Error(text || `HTTP ${res.status}`)
        }
        const json: SignalData[] = await res.json()
        if (isMounted) {
          setData(json)
        }
      } catch (e: any) {
        if (isMounted) {
          setError(e.message)
        }
      } finally {
        if (isMounted) {
          setLoading(false)
        }
      }
    }

    // initial load
    fetchData()

    // set up polling
    intervalId = setInterval(fetchData, DEFAULT_SCAN_INTERVAL)

    return () => {
      isMounted = false
      clearInterval(intervalId)
    }
  }, [mint])

  return (
    <div className="p-6 bg-gray-50 rounded-lg shadow">
      <h1 className="text-2xl font-bold mb-4">BitWake Scan: {mint}</h1>

      {loading && (
        <p className="text-gray-500">Loading data...</p>
      )}

      {error && !loading && (
        <p className="text-red-600">Error: {error}</p>
      )}

      {!loading && !error && data.length === 0 && (
        <p className="text-gray-600">No wake signals detected yet</p>
      )}

      {!loading && !error && data.length > 0 && (
        <WakeSignalChart data={data.map(d => ({
          ...d,
          // convert ms timestamp to Date for chart if needed
          timestamp: new Date(d.timestamp),
        }))} />
      )}
    </div>
  )
}
