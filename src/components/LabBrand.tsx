import React from 'react';

export const LabBrand: React.FC<{ compact?: boolean }> = ({ compact = false }) => (
  <span className="lab-brand">
    <svg width="30" height="30" viewBox="0 0 32 32" aria-hidden="true">
      <rect width="32" height="32" rx="9" fill="currentColor" />
      <circle cx="14" cy="16" r="8" fill="var(--brand-cutout, #fff)" />
      <circle cx="19" cy="12" r="8" fill="currentColor" />
      <circle cx="24" cy="23" r="1.5" fill="var(--brand-cutout, #fff)" />
    </svg>
    {!compact && <span>Dimming<span className="brand-light">Lab</span></span>}
  </span>
);
