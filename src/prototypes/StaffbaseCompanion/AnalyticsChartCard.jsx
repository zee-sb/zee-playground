import { useEffect, useRef } from 'react';
import { Chart, registerables } from 'chart.js';

Chart.register(...registerables);

function hexToRgba(hex, alpha) {
  const h = hex.replace('#', '');
  const r = parseInt(h.substring(0, 2), 16);
  const g = parseInt(h.substring(2, 4), 16);
  const b = parseInt(h.substring(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function buildConfig(chart) {
  const { kind, labels = [], datasets = [] } = chart;
  const isLine = kind === 'line';
  const data = {
    labels,
    datasets: datasets.map((d) => {
      const color = d.color || '#7C3AED';
      return {
        label: d.label,
        data: d.data || [],
        backgroundColor: isLine ? hexToRgba(color, 0.18) : hexToRgba(color, 0.85),
        borderColor: color,
        borderWidth: isLine ? 2 : 1,
        borderRadius: isLine ? 0 : 6,
        tension: 0.3,
        pointRadius: isLine ? 0 : undefined,
        pointHoverRadius: isLine ? 4 : undefined,
        fill: isLine,
      };
    }),
  };
  return {
    type: isLine ? 'line' : 'bar',
    data,
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: {
          position: 'bottom',
          labels: { color: '#475569', font: { size: 11 }, boxWidth: 10, boxHeight: 10, padding: 10 },
        },
        tooltip: {
          backgroundColor: '#111827',
          titleColor: '#fff',
          bodyColor: '#e5e7eb',
          padding: 10,
          cornerRadius: 6,
        },
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: { color: '#94A3B8', font: { size: 10 }, maxRotation: 0, autoSkip: true, maxTicksLimit: 8 },
        },
        y: {
          beginAtZero: true,
          grid: { color: 'rgba(148, 163, 184, 0.15)' },
          ticks: { color: '#94A3B8', font: { size: 10 } },
        },
      },
    },
  };
}

export default function AnalyticsChartCard({ chart, source }) {
  const canvasRef = useRef(null);
  const chartRef = useRef(null);

  useEffect(() => {
    if (!canvasRef.current || !chart) return;
    const cfg = buildConfig(chart);
    chartRef.current = new Chart(canvasRef.current, cfg);
    return () => {
      chartRef.current?.destroy();
      chartRef.current = null;
    };
  }, [chart]);

  const hasData = chart?.labels?.length && chart?.datasets?.some((d) => (d.data || []).some((v) => Number(v) > 0));

  return (
    <div style={{
      margin: '8px 0',
      padding: 14,
      background: '#FFFFFF',
      border: '1px solid #E2E8F0',
      borderRadius: 12,
      boxShadow: '0 1px 2px rgba(15, 23, 42, 0.04)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: '#0F172A' }}>{chart?.title || 'Analytics'}</div>
        <div style={{
          fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em',
          color: '#7C3AED', background: '#EDE9FE', padding: '2px 8px', borderRadius: 999,
        }}>
          Live · Staffbase
        </div>
      </div>
      {hasData ? (
        <div style={{ height: 200 }}>
          <canvas ref={canvasRef} />
        </div>
      ) : (
        <div style={{
          height: 80, display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: '#94A3B8', fontSize: 12, fontStyle: 'italic',
        }}>
          No data in this window.
        </div>
      )}
      {source ? (
        <div style={{ marginTop: 8, fontSize: 10, color: '#94A3B8' }}>{source}</div>
      ) : null}
    </div>
  );
}
