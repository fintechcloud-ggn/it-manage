import React from 'react';
import MarketingPage from '../components/MarketingPage';

const page = {
  path: '/platform/security-ops',
  eyebrow: 'Security Ops',
  title: 'Enforce security controls directly in your asset operations.',
  description:
    'Reduce blind spots with policy-aware device handling, accountable access, and evidence-friendly workflows.',
  stats: [
    { value: 'SOC2', label: 'Aligned controls' },
    { value: 'RBAC', label: 'Access enforcement' },
    { value: 'Full logs', label: 'For every action' }
  ],
  highlights: [
    'SSO and IAM-friendly operations',
    'Audit logs for sensitive actions',
    'Offboarding and retrieval workflows'
  ],
  heroVisual: (
    <div className="security-visual lp-glass-card">
      <div className="security-visual-topbar">
        <span className="security-dot" />
        <span className="security-dot" />
        <span className="security-dot" />
        <strong>Security Command Center</strong>
      </div>

      <div className="security-visual-grid">
        <div className="security-score-card">
          <p>Trust Score</p>
          <div className="security-score-ring">
            <div className="security-score-inner">
              <strong>98%</strong>
              <span>Compliant</span>
            </div>
          </div>
        </div>

        <div className="security-activity-card">
          <div className="security-card-heading">
            <span>Live Security Signals</span>
            <b>24/7</b>
          </div>
          <div className="security-bars">
            <span style={{ height: '42%' }} />
            <span style={{ height: '68%' }} />
            <span style={{ height: '54%' }} />
            <span style={{ height: '86%' }} />
            <span style={{ height: '63%' }} />
            <span style={{ height: '92%' }} />
            <span style={{ height: '58%' }} />
          </div>
        </div>

        <div className="security-timeline-card">
          <div className="security-card-heading">
            <span>Risk Workflow</span>
            <b>Protected</b>
          </div>
          <div className="security-timeline">
            <div className="security-step active">
              <i />
              <div>
                <strong>Identity verified</strong>
                <span>SSO and device trust matched</span>
              </div>
            </div>
            <div className="security-step active">
              <i />
              <div>
                <strong>Access reviewed</strong>
                <span>Privileged actions logged automatically</span>
              </div>
            </div>
            <div className="security-step">
              <i />
              <div>
                <strong>Asset handoff sealed</strong>
                <span>Recovery and offboarding checkpoints ready</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  ),
  sections: [
    {
      title: 'Security by default',
      body: 'Bake approvals, device accountability, and status checks into everyday operational flows.'
    },
    {
      title: 'Investigation support',
      body: 'Quickly reconstruct asset movement, user assignments, and admin actions when incidents occur.'
    }
  ]
};

const SecurityOpsPage = (props) => <MarketingPage {...props} page={page} />;

export default SecurityOpsPage;
