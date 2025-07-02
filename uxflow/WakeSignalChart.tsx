import React from "react"
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip
} from "recharts"

interface Point {
  timestamp: number
  volume: number
}

interface ChartProps {
  data: Point[]
}

export const WakeSignalChart: React.FC<ChartProps> = ({ data }) => {
  const formatted = data.map(p => ({
    ...p,
    time: new Date(p.timestamp).toLocaleTimeString()
  }))

  return (
    <div className="w-full h-64">
      <ResponsiveContainer>
        <LineChart data={formatted}>
          <XAxis dataKey="time" />
          <YAxis />
          <Tooltip formatter={(v: any) => [v, "Volume"]} />
          <Line type="monotone" dataKey="volume" stroke="#4F46E5" dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
