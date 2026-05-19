import React, { useEffect, useRef } from 'react'
import {
  Chart, LineController, LineElement, PointElement,
  LinearScale, CategoryScale, Filler, Tooltip,
} from 'chart.js'

// Register once at module level so the chart constructor finds the bits it
// needs. Tree-shaking friendly — we only pull what the line chart uses.
Chart.register(LineController, LineElement, PointElement, LinearScale, CategoryScale, Filler, Tooltip)

export default function TrendChart({ title, labels = [], data = [], color = '#7C3AED', valueFormatter }) {
  const ref = useRef(null)
  const chartRef = useRef(null)

  useEffect(() => {
    if (!ref.current) return
    if (chartRef.current) chartRef.current.destroy()
    chartRef.current = new Chart(ref.current, {
      type: 'line',
      data: {
        labels,
        datasets: [{
          data,
          borderColor: color,
          backgroundColor: hexToRgba(color, 0.12),
          fill: true,
          tension: 0.32,
          pointRadius: 0,
          pointHoverRadius: 4,
          borderWidth: 2,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            displayColors: false,
            callbacks: {
              label: (ctx) => (valueFormatter ? valueFormatter(ctx.parsed.y) : `${ctx.parsed.y}`),
            },
          },
        },
        scales: {
          x: { display: true, grid: { display: false }, ticks: { color: '#94A3B8', font: { size: 10 } } },
          y: { display: true, beginAtZero: true, grid: { color: '#F1F5F9' }, ticks: { color: '#94A3B8', font: { size: 10 } } },
        },
      },
    })
    return () => chartRef.current?.destroy()
  }, [labels.join('|'), data.join('|'), color, valueFormatter])

  return (
    <div className="bg-white border border-[#E5E7EB] rounded-xl p-4">
      <div className="text-[10.5px] font-bold uppercase tracking-widest text-[#6B7280] mb-2">{title}</div>
      <div style={{ height: 180 }}>
        <canvas ref={ref} />
      </div>
    </div>
  )
}

function hexToRgba(hex, alpha) {
  const m = /^#?([a-f0-9]{6})$/i.exec(hex)
  if (!m) return `rgba(124,58,237,${alpha})`
  const v = parseInt(m[1], 16)
  return `rgba(${(v >> 16) & 0xff},${(v >> 8) & 0xff},${v & 0xff},${alpha})`
}
