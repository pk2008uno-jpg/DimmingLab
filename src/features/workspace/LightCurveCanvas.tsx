/**
 * DimmingLab - High-Performance Canvas Plot
 * Renders dense astronomical time-series and phase-folded scatter plots.
 * Supports high-DPI retina rendering, interactive tooltips, in-transit window highlights,
 * box-model overlays, and accessible tabular fallback for screen readers.
 */

import React, { useRef, useEffect, useState, useId } from 'react';

export interface DataPoint2D {
  x: number; // time or phase
  y: number; // flux
  inTransit?: boolean;
  cycle?: number;
}

export interface BoxModelOverlay {
  centerPhase: number;
  halfPhaseWidth: number;
  baseline: number;
  depth: number;
}

export interface LightCurveCanvasProps {
  data: DataPoint2D[];
  xLabel: string;
  yLabel: string;
  xRange?: [number, number];
  yRange?: [number, number];
  boxModel?: BoxModelOverlay;
  highlightWindows?: Array<{ start: number; end: number }>; // for time-domain transit windows
  theme?: 'dark' | 'light';
  height?: number;
  title: string;
}

export const LightCurveCanvas: React.FC<LightCurveCanvasProps> = ({
  data,
  xLabel,
  yLabel,
  xRange,
  yRange,
  boxModel,
  highlightWindows,
  theme = 'dark',
  height = 280,
  title,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [hoveredPoint, setHoveredPoint] = useState<DataPoint2D | null>(null);
  const [showTableFallback, setShowTableFallback] = useState(false);
  const tableId = useId();

  // Compute bounding box
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;

  if (xRange) {
    minX = xRange[0];
    maxX = xRange[1];
  }
  if (yRange) {
    minY = yRange[0];
    maxY = yRange[1];
  }

  if (data.length > 0) {
    for (let i = 0; i < data.length; i++) {
      const p = data[i];
      if (!xRange) {
        if (p.x < minX) minX = p.x;
        if (p.x > maxX) maxX = p.x;
      }
      if (!yRange) {
        if (p.y < minY) minY = p.y;
        if (p.y > maxY) maxY = p.y;
      }
    }
  }

  // Fallbacks if data is empty or constant
  if (!Number.isFinite(minX) || !Number.isFinite(maxX) || minX >= maxX) {
    minX = 0;
    maxX = 1;
  }
  if (!Number.isFinite(minY) || !Number.isFinite(maxY) || minY >= maxY) {
    minY = 0.98;
    maxY = 1.02;
  }

  // Add 4% vertical margin
  const yPadding = (maxY - minY) * 0.05 || 0.01;
  const effMinY = minY - yPadding;
  const effMaxY = maxY + yPadding;

  const isDark = theme === 'dark';
  const bgColor = isDark ? '#191e28' : '#ffffff';
  const gridColor = isDark ? 'rgba(220, 230, 250, 0.06)' : 'rgba(80, 100, 130, 0.07)';
  const textColor = isDark ? '#a3adbe' : '#606b7b';
  const axisColor = isDark ? '#3d485b' : '#d4dbe5';
  const pointColorOut = isDark ? '#8ca9d2' : '#6083b6';
  const pointColorIn = isDark ? '#6acbd2' : '#0f8e9e';
  const boxModelColor = isDark ? '#e2bd7c' : '#b17822';

  const renderPlot = () => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const rect = container.getBoundingClientRect();
    const width = Math.max(280, Math.floor(rect.width));
    const dpr = window.devicePixelRatio || 1;

    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.scale(dpr, dpr);

    // Padding for axes
    const padLeft = 65;
    const padRight = 20;
    const padTop = 25;
    const padBottom = 40;

    const plotW = width - padLeft - padRight;
    const plotH = height - padTop - padBottom;

    const toX = (val: number) => padLeft + ((val - minX) / (maxX - minX)) * plotW;
    const toY = (val: number) => padTop + (1 - (val - effMinY) / (effMaxY - effMinY)) * plotH;

    // Background
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, width, height);

    // Highlight windows (e.g. in-transit times)
    if (highlightWindows && highlightWindows.length > 0) {
      ctx.fillStyle = isDark ? 'rgba(106, 203, 210, 0.1)' : 'rgba(15, 142, 158, 0.08)';
      for (const w of highlightWindows) {
        if (w.end < minX || w.start > maxX) continue;
        const x1 = Math.max(padLeft, toX(w.start));
        const x2 = Math.min(padLeft + plotW, toX(w.end));
        if (x2 > x1) {
          ctx.fillRect(x1, padTop, x2 - x1, plotH);
        }
      }
    }

    // Grid lines & Axis ticks (X)
    ctx.strokeStyle = gridColor;
    ctx.lineWidth = 1;
    ctx.font = '10px ui-monospace, Consolas, monospace';
    ctx.fillStyle = textColor;
    ctx.textAlign = 'center';

    const xTicks = 6;
    for (let i = 0; i <= xTicks; i++) {
      const frac = i / xTicks;
      const val = minX + frac * (maxX - minX);
      const xPos = toX(val);

      ctx.beginPath();
      ctx.moveTo(xPos, padTop);
      ctx.lineTo(xPos, padTop + plotH);
      ctx.stroke();

      ctx.fillText(val.toFixed(2), xPos, padTop + plotH + 15);
    }

    // Grid lines & Axis ticks (Y)
    ctx.textAlign = 'right';
    const yTicks = 4;
    for (let i = 0; i <= yTicks; i++) {
      const frac = i / yTicks;
      const val = effMinY + frac * (effMaxY - effMinY);
      const yPos = toY(val);

      ctx.beginPath();
      ctx.moveTo(padLeft, yPos);
      ctx.lineTo(padLeft + plotW, yPos);
      ctx.stroke();

      ctx.fillText(val.toFixed(4), padLeft - 8, yPos + 4);
    }

    // Axis lines
    ctx.strokeStyle = axisColor;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(padLeft, padTop);
    ctx.lineTo(padLeft, padTop + plotH);
    ctx.lineTo(padLeft + plotW, padTop + plotH);
    ctx.stroke();

    // Axis labels
    ctx.fillStyle = textColor;
    ctx.font = '12px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(xLabel, padLeft + plotW / 2, height - 8);

    ctx.save();
    ctx.translate(16, padTop + plotH / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText(yLabel, 0, 0);
    ctx.restore();

    // Box model overlay (for phase folded plot)
    if (boxModel && boxModel.depth > 0) {
      const { centerPhase, halfPhaseWidth, baseline, depth } = boxModel;
      const inPhaseY = toY(baseline - depth);
      const outPhaseY = toY(baseline);
      const xStart = toX(centerPhase - halfPhaseWidth);
      const xEnd = toX(centerPhase + halfPhaseWidth);

      ctx.strokeStyle = boxModelColor;
      ctx.lineWidth = 2.5;
      ctx.beginPath();

      // Left baseline
      ctx.moveTo(padLeft, outPhaseY);
      ctx.lineTo(xStart, outPhaseY);
      // Left vertical step down
      ctx.lineTo(xStart, inPhaseY);
      // Bottom transit trough
      ctx.lineTo(xEnd, inPhaseY);
      // Right vertical step up
      ctx.lineTo(xEnd, outPhaseY);
      // Right baseline
      ctx.lineTo(padLeft + plotW, outPhaseY);
      ctx.stroke();
    }

    // Plot scatter points
    const ptRadius = data.length > 5000 ? 1.2 : data.length > 2000 ? 1.5 : 1.8;

    // Draw out-of-transit points first
    ctx.fillStyle = pointColorOut;
    for (let i = 0; i < data.length; i++) {
      const p = data[i];
      if (p.inTransit) continue;
      const px = toX(p.x);
      const py = toY(p.y);
      if (px < padLeft || px > padLeft + plotW || py < padTop || py > padTop + plotH) continue;

      ctx.beginPath();
      ctx.arc(px, py, ptRadius, 0, Math.PI * 2);
      ctx.fill();
    }

    // Draw in-transit points on top with distinct cyan highlight
    ctx.fillStyle = pointColorIn;
    for (let i = 0; i < data.length; i++) {
      const p = data[i];
      if (!p.inTransit) continue;
      const px = toX(p.x);
      const py = toY(p.y);
      if (px < padLeft || px > padLeft + plotW || py < padTop || py > padTop + plotH) continue;

      ctx.beginPath();
      ctx.arc(px, py, ptRadius + 0.5, 0, Math.PI * 2);
      ctx.fill();
    }
  };

  useEffect(() => {
    renderPlot();

    const handleResize = () => {
      renderPlot();
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [data, xRange, yRange, boxModel, highlightWindows, theme, height]);

  // Handle canvas mouse move for interactive tooltip
  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas || data.length === 0) return;

    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const padLeft = 65;
    const padRight = 20;
    const padTop = 25;
    const padBottom = 40;
    const plotW = rect.width - padLeft - padRight;
    const plotH = rect.height - padTop - padBottom;

    if (mouseX < padLeft || mouseX > padLeft + plotW || mouseY < padTop || mouseY > padTop + plotH) {
      setHoveredPoint(null);
      return;
    }

    const mouseDataX = minX + ((mouseX - padLeft) / plotW) * (maxX - minX);

    // Find closest point by X coordinate
    let closest: DataPoint2D | null = null;
    let closestDist = Infinity;

    for (let i = 0; i < data.length; i++) {
      const p = data[i];
      const dist = Math.abs(p.x - mouseDataX);
      if (dist < closestDist) {
        closestDist = dist;
        closest = p;
      }
    }

    // Only hover if mouse is reasonably close
    const xThreshold = (maxX - minX) * 0.05;
    if (closestDist < xThreshold) {
      setHoveredPoint(closest);
    } else {
      setHoveredPoint(null);
    }
  };

  const handleMouseLeave = () => {
    setHoveredPoint(null);
  };

  return (
    <div className="light-curve-plot-card" ref={containerRef} style={{ width: '100%', position: 'relative' }}>
      <div className="plot-header-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
        <h4 style={{ margin: 0, fontSize: '0.875rem', fontWeight: 600, color: 'var(--ink)' }}>
          {title}
        </h4>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          {hoveredPoint && (
            <span style={{ fontSize: '0.75rem', color: isDark ? '#38bdf8' : '#0284c7', fontFamily: 'monospace' }}>
              {xLabel}: {hoveredPoint.x.toFixed(4)} | Flux: {hoveredPoint.y.toFixed(5)}
              {hoveredPoint.cycle !== undefined ? ` (Cycle ${hoveredPoint.cycle})` : ''}
            </span>
          )}
          <button
            type="button"
            onClick={() => setShowTableFallback(!showTableFallback)}
            aria-expanded={showTableFallback}
            aria-controls={tableId}
            style={{
              fontSize: '0.75rem',
              padding: '2px 8px',
              borderRadius: '4px',
              border: `1px solid ${isDark ? '#334155' : '#cbd5e1'}`,
              backgroundColor: isDark ? '#1e293b' : '#f8fafc',
              color: isDark ? '#94a3b8' : '#475569',
              cursor: 'pointer',
            }}
          >
            {showTableFallback ? 'Hide Data Table' : 'Data Table'}
          </button>
        </div>
      </div>

      <div style={{ position: 'relative', borderRadius: '6px', overflow: 'hidden', border: `1px solid ${isDark ? '#1e293b' : '#e2e8f0'}` }}>
        <canvas
          ref={canvasRef}
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
          role="img"
          aria-label={`${title}. Showing ${data.length} observations. ${xLabel} spans ${minX.toFixed(2)} to ${maxX.toFixed(2)}.`}
          style={{ display: 'block', width: '100%', height: `${height}px`, cursor: 'crosshair' }}
        />
      </div>

      {showTableFallback && (
        <div
          id={tableId}
          style={{
            marginTop: '8px',
            maxHeight: '180px',
            overflowY: 'auto',
            border: `1px solid ${isDark ? '#334155' : '#cbd5e1'}`,
            borderRadius: '4px',
            fontSize: '0.75rem',
          }}
        >
          <div style={{ padding: '6px 8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: isDark ? '#0d131f' : '#f8fafc', borderBottom: `1px solid ${isDark ? '#1e293b' : '#e2e8f0'}` }}>
            <span style={{ fontWeight: 600 }}>Observations Table ({data.length} total points, {data.filter(p => p.inTransit).length} in-transit)</span>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ backgroundColor: isDark ? '#1e293b' : '#f1f5f9' }}>
                <th style={{ padding: '4px 8px' }}>Index</th>
                <th style={{ padding: '4px 8px' }}>{xLabel}</th>
                <th style={{ padding: '4px 8px' }}>Flux</th>
                <th style={{ padding: '4px 8px' }}>In Transit?</th>
              </tr>
            </thead>
            <tbody>
              {data.slice(0, 100).map((pt, idx) => (
                <tr key={idx} style={{ borderBottom: `1px solid ${isDark ? '#1e293b' : '#f1f5f9'}` }}>
                  <td style={{ padding: '3px 8px' }}>{idx + 1}</td>
                  <td style={{ padding: '3px 8px', fontFamily: 'monospace' }}>{pt.x.toFixed(4)}</td>
                  <td style={{ padding: '3px 8px', fontFamily: 'monospace' }}>{pt.y.toFixed(5)}</td>
                  <td style={{ padding: '3px 8px' }}>{pt.inTransit ? 'Yes (Candidate window)' : 'No (Baseline)'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {data.length > 100 && (
            <div style={{ padding: '4px 8px', fontStyle: 'italic', color: isDark ? '#94a3b8' : '#64748b' }}>
              Showing first 100 of {data.length} observations.
            </div>
          )}
        </div>
      )}
    </div>
  );
};
