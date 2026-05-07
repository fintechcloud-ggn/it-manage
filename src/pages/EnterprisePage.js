import React from 'react';
import MarketingPage from '../components/MarketingPage';

const page = {
  path: '/enterprise',
  eyebrow: 'Enterprise',
  title: 'Control, compliance, and scale for mission-critical environments.',
  description:
    'Built for teams that need structured access, accountability, and confidence across every admin action.',
  stats: [
    { value: 'Granular', label: 'Admin permissions' },
    { value: 'Immutable', label: 'Audit history' },
    { value: '24/7', label: 'Operational visibility' }
  ],
  highlights: [
    'Permission-based section access',
    'Secure workflows for sensitive changes',
    'Enterprise-ready reporting foundations'
  ],
  sections: [
    {
      title: 'Governance without slowdown',
      body: 'Separate visibility from edit rights so teams can move fast without sacrificing control.'
    },
    {
      title: 'High-trust operations',
      body: 'Support audits, reviews, and executive reporting with reliable operational records.'
    }
  ]
};

const EnterprisePage = (props) => <MarketingPage {...props} page={page} />;

export default EnterprisePage;
