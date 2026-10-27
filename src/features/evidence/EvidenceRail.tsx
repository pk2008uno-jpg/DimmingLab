import React, { useId, useState } from 'react';
import { EvidenceItem, EvidenceStatus } from '../../domain/types';
import { CheckCircle2, AlertTriangle, HelpCircle, ShieldAlert, ChevronDown } from 'lucide-react';

export interface EvidenceRailProps { evidence: EvidenceItem[]; theme?: 'dark' | 'light' }
const STATUS = {
  measured: { label: 'Measured', Icon: CheckCircle2 },
  needs_review: { label: 'Needs review', Icon: AlertTriangle },
  inconclusive: { label: 'Inconclusive', Icon: HelpCircle },
  not_assessed: { label: 'Not assessed', Icon: ShieldAlert },
};

export const EvidenceRail: React.FC<EvidenceRailProps> = ({ evidence, theme }) => {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const prefix = useId();
  return (
    <section className="evidence-rail-card" data-appearance={theme} aria-labelledby={`${prefix}-title`}>
      <div className="evidence-intro"><span className="eyebrow">THE EVIDENCE CHECKLIST</span><h2 id={`${prefix}-title`}>Challenge the signal</h2><p>Open each check to review the measurements and their limitations.</p></div>
      <div className="evidence-checks">
        {evidence.map(item => {
          const expanded = expandedId === item.id;
          const status = STATUS[item.status as EvidenceStatus] || STATUS.not_assessed;
          const Icon = status.Icon;
          return <div className="evidence-check" key={item.id}>
            <button type="button" className="evidence-toggle" aria-expanded={expanded} aria-controls={`${prefix}-${item.id}`} onClick={() => setExpandedId(expanded ? null : item.id)}><div><span className="evidence-title">{item.title}</span><span className={`evidence-status ${item.status}`}><Icon size={12} />{status.label}</span></div><ChevronDown size={14} className={expanded ? 'chevron-expanded' : ''} /></button>
            {expanded && <div className="evidence-details" id={`${prefix}-${item.id}`}><p>{item.explanation}</p><dl className="evidence-metrics">{item.metrics.map((metric, index) => <div key={index}><dt>{metric.name}</dt><dd>{metric.formatted ?? (metric.value !== null ? `${metric.value} ${metric.unit || ''}` : 'N/A')}</dd></div>)}</dl>{item.limitations.length > 0 && <div className="evidence-limits"><strong>What this check cannot tell you</strong><ul>{item.limitations.map((limit, index) => <li key={index}>{limit}</li>)}</ul></div>}</div>}
          </div>;
        })}
      </div>
    </section>
  );
};
