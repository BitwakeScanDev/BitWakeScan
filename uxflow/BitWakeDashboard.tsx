import React, { useEffect, useState, useCallback } from "react"
import { WakeSignalChart } from "./WakeSignalChart"
import { DEFAULT_SCAN_INTERVAL } from "../config"

interface SignalData {
  timestamp: Date
  volume: number
}

interface RawSignalData {
  timestamp: number
  volume: number
}

interface DashboardProps {
  mint: string
  scanInterval?: number
}

export const BitWakeDashboard: React.FC<DashboardProps> = ({
  mint,
  scanInterval = DEFAULT_SCAN_INTERVAL,
}) => {
  const [data, setData] = useState<SignalData[]>([])
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)

  const fetchData = useCallback(async (signal: AbortSignal) => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(
        `/api/wake-signals?mint=${encodeURIComponent(mint)}`,
        { signal }
      )
      if (!res.ok) {
        const text = await res.text()
        throw new Error(text || `HTTP ${res.status}`)
      }
      const raw: RawSignalData[] = await res.json()
      setData(
        raw.map(d => ({
          timestamp: new Date(d.timestamp),
          volume: d.volume,
        }))
      )
    } catch (e: any) {
      if (e.name !== "AbortError") {
        setError(e.message)
      }
    } finally {
      setLoading(false)
    }
  }, [mint])

  useEffect(() => {
    const controller = new AbortController()
    const { signal } = controller

    // initial fetch
    fetchData(signal)

    // polling
    const id = setInterval(() => {
      fetchData(signal)
    }, scanInterval)

    return () => {
      controller.abort()
      clearInterval(id)
    }
  }, [fetchData, scanInterval])

  return (
    <div className="p-6 bg-gray-50 rounded-lg shadow">
      <h1 className="text-2xl font-bold mb-4">BitWake Scan: {mint}</h1>

      {loading && <p className="text-gray-500">Loading data…</p>}

      {error && !loading && (
        <p className="text-red-600">Error: {error}</p>
      )}

      {!loading && !error && data.length === 0 && (
        <p className="text-gray-600">No wake signals detected yet</p>
      )}

      {!loading && !error && data.length > 0 && (
        <WakeSignalChart data={data} />
      )}
    </div>
  )
}
