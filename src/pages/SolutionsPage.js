import React from 'react';
import MarketingPage from '../components/MarketingPage';

const page = {
  path: '/solutions',
  eyebrow: 'Solutions',
  title: 'Purpose-built workflows for scaling IT operations.',
  description:
    'Whether you run a distributed startup or a regulated enterprise, NEXTGEN adapts to the operating model you already have.',
  stats: [
    { value: 'Remote-first', label: 'Employee support' },
    { value: 'Hybrid', label: 'Store-aware flows' },
    { value: 'Enterprise', label: 'Policy coverage' }
  ],
  highlights: [
    'Employee onboarding and offboarding',
    'Spare pool and repair orchestration',
    'Role-aware operations for support teams'
  ],
  sections: [
    {
      title: 'For fast-growing teams',
      body: 'Standardize device issuance and eliminate spreadsheet-driven handoffs as headcount rises.'
    },
    {
      title: 'For multi-site operations',
      body: 'Keep stores, offices, and warehouses aligned with shared visibility and centralized reporting.'
    }
  ]
};

const SolutionsPage = (props) => <MarketingPage {...props} page={page} />;

export default SolutionsPage;
