import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { HistogramBin } from '../../types'
import { CHART_TOOLTIP } from './chartTheme'

export function HistogramChart({
  bins,
  height = 230,
  color = '#60a5fa',
}: {
  bins: HistogramBin[]
  height?: number
  color?: string
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={bins} margin={{ top: 6, right: 8, bottom: 0, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#162a44" vertical={false} />
        <XAxis
          dataKey="label"
          tick={{ fill: '#5f7492', fontSize: 9 }}
          axisLine={{ stroke: '#1d3350' }}
          tickLine={false}
          interval="preserveStartEnd"
        />
        <YAxis
          tick={{ fill: '#5f7492', fontSize: 10 }}
          axisLine={false}
          tickLine={false}
          width={38}
        />
        <Tooltip {...CHART_TOOLTIP} />
        <Bar dataKey="count" fill={color} radius={[3, 3, 0, 0]} isAnimationActive={false} />
      </BarChart>
    </ResponsiveContainer>
  )
}
