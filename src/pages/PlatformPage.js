import React from 'react';
import MarketingPage from '../components/MarketingPage';

const page = {
  path: '/platform',
  eyebrow: 'Platform',
  title: 'One control layer for every asset, workflow, and location.',
  description:
    'Run procurement, lifecycle management, compliance, and visibility from a single operating surface built for fast-moving IT teams.',
  stats: [
    { value: '20k+', label: 'Tracked devices' },
    { value: '120+', label: 'Policy automations' },
    { value: '99.9%', label: 'Data accuracy' }
  ],
  highlights: [
    'Unified inventory with lifecycle timelines',
    'Role-based controls for admins, operators, and auditors',
    'Real-time operational alerts across entities'
  ],
  sections: [
    {
      title: 'Operational visibility',
      body: 'See ownership, status, serial history, warranty windows, and maintenance events without switching tools.'
    },
    {
      title: 'Workflow automation',
      body: 'Standardize onboarding, recovery, repair, and replacement flows with rule-driven actions.'
    },
    {
      title: 'Audit readiness',
      body: 'Preserve traceability with immutable change history and exportable compliance evidence.'
    }
  ]
};

const PlatformPage = (props) => <MarketingPage {...props} page={page} />;

export default PlatformPage;
