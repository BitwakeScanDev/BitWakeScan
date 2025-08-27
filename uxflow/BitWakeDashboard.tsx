import React, { useEffect, useState, useCallback, useRef, useMemo } from "react"
import { WakeSignalChart } from "./WakeSignalChart"
import { DEFAULT_SCAN_INTERVAL } from "../config"

interface SignalData {
  timestamp: Date
  volume: number
}

interface RawSignalData {
  timestamp: number | string
  volume: number
}

interface DashboardProps {
  mint: string
  scanInterval?: number
}

function normalizeTimestamp(ts: number | string): Date {
  const n = typeof ts === "string" ? Number(ts) : ts
  // If seconds (10 digits), convert to ms
  if (Number.isFinite(n) && n < 1e12) return new Date(n * 1000)
  return new Date(n)
}

export const BitWakeDashboard: React.FC<DashboardProps> = ({
  mint,
  scanInterval = DEFAULT_SCAN_INTERVAL,
}) => {
  const [data, setData] = useState<SignalData[]>([])
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)

  const isMounted = useRef(true)
  const isFetching = useRef(false)
  const seqRef = useRef(0)

  const intervalMs = useMemo(() => Math.max(1000, scanInterval || DEFAULT_SCAN_INTERVAL), [scanInterval])

  const fetchData = useCallback(async () => {
    if (isFetching.current) return
    isFetching.current = true
    setError(null)
    setLoading(prev => prev && data.length === 0) // keep spinner only if we truly have no data yet

    const controller = new AbortController()
    const signal = controller.signal
    const seq = ++seqRef.current

    try {
      const res = await fetch(`/api/wake-signals?mint=${encodeURIComponent(mint)}`, { signal })
      if (!res.ok) {
        const text = await res.text().catch(() => "")
        throw new Error(text || `HTTP ${res.status}`)
      }
      const raw: RawSignalData[] = await res.json()
      const next = raw.map(d => ({
        timestamp: normalizeTimestamp(d.timestamp),
        volume: d.volume,
      }))

      // ignore out-of-order responses
      if (!isMounted.current || seq !== seqRef.current) return

      setData(next)
    } catch (e: any) {
      if (e.name !== "AbortError") {
        setError(e.message || "Failed to load data")
      }
    } finally {
      if (isMounted.current) setLoading(false)
      isFetching.current = false
    }
  }, [mint, data.length])

  useEffect(() => {
    isMounted.current = true
    void fetchData()
    const id = setInterval(() => void fetchData(), intervalMs)
    return () => {
      isMounted.current = false
      clearInterval(id)
      seqRef.current++ // invalidate any in-flight responses
    }
  }, [fetchData, intervalMs])

  return (
    <section className="p-6 bg-gray-50 rounded-lg shadow min-h-[240px]" aria-busy={loading}>
      <div className="mb-4 flex items-center justify-between gap-4">
        <h1 className="text-2xl font-bold">BitWake Scan: {mint}</h1>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => void fetchData()}
            className="rounded-md border px-3 py-1.5 text-sm font-medium hover:bg-gray-100"
            aria-label="Refresh data"
          >
            Refresh
          </button>
          {loading && <span className="text-sm text-gray-500">Loading…</span>}
        </div>
      </div>

      {error && !loading && (
        <div className="text-red-600">
          Error: {error}
        </div>
      )}

      {!loading && !error && data.length === 0 && (
        <p className="text-gray-600">No wake signals detected yet</p>
      )}

      {!loading && !error && data.length > 0 && (
        <WakeSignalChart data={data} />
      )}
    </section>
  )
}

export default BitWakeDashboard
