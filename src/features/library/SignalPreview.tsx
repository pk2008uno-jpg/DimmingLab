import React, { useEffect, useState } from 'react';
import type { LightCurveData } from '../../domain/types';

/** Small multiples made from the actual packaged data, never a fabricated light curve. */
export const SignalPreview: React.FC<{ path: string; title: string; hero?: boolean }> = ({ path, title, hero = false }) => {
  const [preview, setPreview] = useState<{ dots: string; min: number; max: number } | null>(null);
  const [unavailable, setUnavailable] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    fetch(path, { signal: controller.signal }).then(res => {
      if (!res.ok) throw new Error('Preview unavailable');
      return res.json();
    }).then((data: LightCurveData) => {
      const points = data.points.filter(p => Number.isFinite(p.time) && Number.isFinite(p.flux));
      if (!points.length) throw new Error('No preview measurements');
      const times = points.map(p => p.time), fluxes = points.map(p => p.flux);
      const min = Math.min(...times), max = Math.max(...times);
      const low = Math.min(...fluxes), high = Math.max(...fluxes);
      const dots = points.map(p => {
        const x = 12 + (p.time - min) / (max - min || 1) * 336;
        const y = 12 + (1 - (p.flux - low) / (high - low || 1)) * 66;
        return `M${x.toFixed(1)},${y.toFixed(1)}h.2`;
      }).join('');
      setPreview({ dots, min, max });
    }).catch(() => { if (!controller.signal.aborted) setUnavailable(true); });
    return () => controller.abort();
  }, [path]);
  return (
    <figure className={`signal-preview ${hero ? 'signal-preview-hero' : ''}`}>
      <svg viewBox="0 0 360 92" role="img" aria-label={`${title}: brightness over time from the supplied data. Open the investigation for full axes and measurements.`}>
        {[22, 47, 72].map(y => <line key={y} x1="8" x2="352" y1={y} y2={y} className="preview-grid" />)}
        {preview && <path d={preview.dots} fill="none" stroke="currentColor" strokeWidth={hero ? 1.5 : 1.7} strokeLinecap="round" opacity=".8" />}
      </svg>
      <figcaption><span>Brightness / time</span><span>{preview ? `${preview.min.toFixed(1)}–${preview.max.toFixed(1)} d` : unavailable ? 'Preview unavailable' : 'Loading preview…'}</span></figcaption>
    </figure>
  );
};
