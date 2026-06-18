import React, { useEffect, useState } from 'react';
import './LandingPage.css';
import nextgenLogo from '../assets/image.png';
import {
  HEADER_NAV_ITEMS,
  MARKETING_HOME_PATH,
  PLATFORM_DROPDOWN_ITEMS
} from '../pages/marketingPages';

const MarketingPage = ({ page, currentPath, navigate, onLogin }) => {
  const [platformOpen, setPlatformOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'auto' });
  }, [currentPath]);

  const handleNavigate = (event, path, external = false) => {
    if (!external) {
      event.preventDefault();
    }
    setPlatformOpen(false);
    if (!external) navigate(path);
  };

  const showAuthActions = String(currentPath || '').trim() !== MARKETING_HOME_PATH;

  return (
    <div className="landing-container light-mode">
      <div className="lp-bg-elements">
        <div className="mesh-gradient" />
        <div className="soft-glow-1" />
        <div className="soft-glow-2" />
      </div>

      <nav className={`lp-nav ${isScrolled ? 'scrolled' : ''}`}>
        <button type="button" className="lp-logo-button" onClick={() => navigate(MARKETING_HOME_PATH)}>
          <span className="lp-logo">
            <img src={nextgenLogo} alt="NEXTGEN" className="lp-logo-image" />
          </span>
        </button>
        <div className="lp-nav-links">
          <div
            className="nav-dropdown-wrapper"
            onMouseEnter={() => setPlatformOpen(true)}
            onMouseLeave={() => setPlatformOpen(false)}
          >
            <a
              href="/platform"
              className={`nav-link dropdown-trigger ${currentPath.startsWith('/platform') ? 'active' : ''}`}
              onClick={(event) => handleNavigate(event, '/platform')}
            >
              Platform <span className="chevron">⌄</span>
            </a>
            {platformOpen && (
              <div className="lp-dropdown">
                {PLATFORM_DROPDOWN_ITEMS.map((item) => (
                  <a
                    key={item.path}
                    href={item.path}
                    onClick={(event) => handleNavigate(event, item.path, item.external)}
                    target={item.external ? '_blank' : undefined}
                    rel={item.external ? 'noopener noreferrer' : undefined}
                  >
                    {item.label}
                  </a>
                ))}
              </div>
            )}
          </div>
          {HEADER_NAV_ITEMS.filter((item) => item.path !== '/platform').map((item) => (
            <a
              key={item.path}
              href={item.path}
              className={`nav-link ${currentPath === item.path ? 'active' : ''}`}
              onClick={(event) => handleNavigate(event, item.path)}
            >
              {item.label}
            </a>
          ))}
        </div>
        {showAuthActions && (
          <div className="lp-nav-actions">
            <button className="btn-ghost" onClick={onLogin}>Log in</button>
            <button className="btn-primary" onClick={onLogin}>Get Started</button>
          </div>
        )}
      </nav>

      <main className="lp-page-shell">
        <section className="lp-page-hero">
          <div className="lp-page-copy">
            <div className="lp-badge">{page.eyebrow}</div>
            <h1>{page.title}</h1>
            <p>{page.description}</p>
            <div className="lp-hero-btns">
              <button className="btn-primary-large" onClick={onLogin}>Book a Demo</button>
              <button className="btn-secondary-large" onClick={() => navigate(MARKETING_HOME_PATH)}>Back to Home</button>
            </div>
          </div>
          {page.heroVisual ? (
            <div className="lp-page-visual-shell">
              {page.heroVisual}
            </div>
          ) : (
            <div className="lp-page-panel lp-glass-card">
              <div className="page-panel-header">
                <span>Overview</span>
                <strong>{page.eyebrow}</strong>
              </div>
              <div className="lp-page-stats">
                {page.stats.map((stat) => (
                  <div key={stat.label} className="lp-page-stat">
                    <strong>{stat.value}</strong>
                    <span>{stat.label}</span>
                  </div>
                ))}
              </div>
              <ul className="lp-checklist lp-page-highlights">
                {page.highlights.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          )}
        </section>

        {page.customPanel}

        <section className="lp-page-section">
          <div className="section-header">
            <label>{page.sectionEyebrow || 'What you get'}</label>
            <h2>{page.sectionTitle || `Dedicated page for ${page.eyebrow.toLowerCase()}`}</h2>
          </div>
          <div className="lp-page-grid">
            {page.sections.map((section) => (
              <article key={section.title} className="lp-feature-card lp-page-card">
                <h3>{section.title}</h3>
                <p>{section.body}</p>
              </article>
            ))}
          </div>
        </section>
      </main>

      <footer className="lp-footer">
        <div className="footer-top">
          <div className="f-brand">
            <button type="button" className="lp-logo-button" onClick={() => navigate(MARKETING_HOME_PATH)}>
              <span className="lp-logo">
                <img src={nextgenLogo} alt="NEXTGEN" className="lp-logo-image" />
              </span>
            </button>
            <p>Leading the next generation of IT operations for the global enterprise.</p>
          </div>
          <div className="f-links">
            <div className="f-col">
              <strong>Platform</strong>
              <a href="/platform/asset-tracking" onClick={(event) => handleNavigate(event, '/platform/asset-tracking')}>Inventory</a>
              <a href="/platform/global-fleet" onClick={(event) => handleNavigate(event, '/platform/global-fleet')}>Fleet</a>
              <a href="/platform/security-ops" onClick={(event) => handleNavigate(event, '/platform/security-ops')}>Security</a>
            </div>
            <div className="f-col">
              <strong>Product</strong>
              <a href="/pricing" onClick={(event) => handleNavigate(event, '/pricing')}>Pricing</a>
              <a href="/resources" onClick={(event) => handleNavigate(event, '/resources')}>Resources</a>
              <a href="/solutions" onClick={(event) => handleNavigate(event, '/solutions')}>Solutions</a>
            </div>
            <div className="f-col">
              <strong>Company</strong>
              <a href="/enterprise" onClick={(event) => handleNavigate(event, '/enterprise')}>Enterprise</a>
              <a href="/contact" onClick={(event) => handleNavigate(event, '/contact')}>Contact Us</a>
              <a href="/" onClick={(event) => handleNavigate(event, MARKETING_HOME_PATH)}>Home</a>
            </div>
          </div>
        </div>
        <div className="footer-bottom">
          <p>© {new Date().getFullYear()} NEXTGEN Rentals and Trading Private Limited. All rights reserved.</p>
          <div className="f-social">
            <a href="/resources" onClick={(event) => handleNavigate(event, '/resources')}>Resources</a>
            <a href="/pricing" onClick={(event) => handleNavigate(event, '/pricing')}>Pricing</a>
            <a href="/contact" onClick={(event) => handleNavigate(event, '/contact')}>Contact</a>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default MarketingPage;
