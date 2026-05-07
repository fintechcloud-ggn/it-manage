import React from 'react';
import MarketingPage from '../components/MarketingPage';

const page = {
  path: '/resources',
  eyebrow: 'Resources',
  title: 'Practical guidance for IT teams managing modern device fleets.',
  description:
    'Explore playbooks, checklists, and strategic content designed to help you streamline asset operations.',
  stats: [
    { value: 'Guides', label: 'For admins' },
    { value: 'Playbooks', label: 'For operations' },
    { value: 'Templates', label: 'For compliance' }
  ],
  highlights: [
    'Onboarding and offboarding playbooks',
    'Audit preparation checklists',
    'Scaling guides for distributed teams'
  ],
  sections: [
    {
      title: 'Learning library',
      body: 'Turn recurring IT operations into repeatable systems with actionable, implementation-focused material.'
    },
    {
      title: 'Decision support',
      body: 'Use benchmark-style content to plan procurement, lifecycle refreshes, and support coverage.'
    }
  ]
};

const ResourcesPage = (props) => <MarketingPage {...props} page={page} />;

export default ResourcesPage;
