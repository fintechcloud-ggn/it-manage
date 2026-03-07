import React, { useState, useEffect } from 'react';
import './LandingPage.css';

const LandingPage = ({ onLogin }) => {
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
        const observerOptions = {
            threshold: 0.1,
            rootMargin: '0px 0px -50px 0px'
        };

        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('revealed');
                }
            });
        }, observerOptions);

        const revealElements = document.querySelectorAll('.reveal-on-scroll');
        revealElements.forEach(el => observer.observe(el));

        return () => {
            revealElements.forEach(el => observer.unobserve(el));
        };
    }, []);

    return (
        <div className="landing-container light-mode">
            <div className="lp-bg-elements">
                <div className="mesh-gradient" />
                <div className="soft-glow-1" />
                <div className="soft-glow-2" />
            </div>

            <nav className={`lp-nav ${isScrolled ? 'scrolled' : ''}`}>
                <div className="lp-logo">BranchGrid</div>
                <div className="lp-nav-links">
                    <div
                        className="nav-dropdown-wrapper"
                        onMouseEnter={() => setPlatformOpen(true)}
                        onMouseLeave={() => setPlatformOpen(false)}
                    >
                        <a
                            href="#platform"
                            className="nav-link dropdown-trigger"
                            onClick={(e) => {
                                e.preventDefault();
                                setPlatformOpen(!platformOpen);
                                document.getElementById('platform')?.scrollIntoView({ behavior: 'smooth' });
                            }}
                        >
                            Platform <span className="chevron">⌄</span>
                        </a>
                        {platformOpen && (
                            <div className="lp-dropdown">
                                <a href="#features" onClick={() => setPlatformOpen(false)}>Asset Tracking</a>
                                <a href="#solutions" onClick={() => setPlatformOpen(false)}>Global Fleet</a>
                                <a href="#enterprise" onClick={() => setPlatformOpen(false)}>Security Ops</a>
                            </div>
                        )}
                    </div>
                    <a href="#solutions" className="nav-link">Solutions</a>
                    <a href="#enterprise" className="nav-link">Enterprise</a>
                    <a href="#resources" className="nav-link">Resources</a>
                    <a href="#pricing" className="nav-link">Pricing</a>
                </div>
                <div className="lp-nav-actions">
                    <button className="btn-ghost" onClick={onLogin}>Log in</button>
                    <button className="btn-primary" onClick={onLogin}>Get Started</button>
                </div>
            </nav>

            <section className="lp-hero">
                <div className="lp-hero-content reveal-on-scroll">
                    <div className="lp-badge">New: Enterprise Suite v4.0</div>
                    <h1>Unified IT Ops for <span>Modern Fintech.</span></h1>
                    <p>
                        The intelligent core for global asset ecosystems.
                        Provision, monitor, and secure your entire IT infrastructure from one premium interface.
                    </p>
                    <div className="lp-hero-btns">
                        <button className="btn-primary-large" onClick={onLogin}>Start Free Trial</button>
                        <button className="btn-secondary-large" onClick={onLogin}>Book a Demo</button>
                    </div>
                    <div className="lp-hero-stats">
                        <div className="lp-stat-item">
                            <strong>20k+</strong>
                            <span>Nodes Managed</span>
                        </div>
                        <div className="lp-stat-item">
                            <strong>99.999%</strong>
                            <span>SLA Uptime</span>
                        </div>
                        <div className="lp-stat-item">
                            <strong>SOC2</strong>
                            <span>Verified</span>
                        </div>
                    </div>
                </div>
                <div className="lp-hero-visual reveal-on-scroll">
                    <div className="lp-glass-card dashboard-preview">
                        <div className="preview-header">
                            <div className="dots"><span /><span /><span /></div>
                            <div className="title-text">Cloud Infrastructure Health</div>
                        </div>
                        <div className="preview-body">
                            <svg className="hero-svg-viz" viewBox="0 0 400 240" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <rect x="20" y="20" width="360" height="200" rx="12" fill="#F8FAFC" />
                                <circle cx="100" cy="100" r="50" stroke="#E2E8F0" strokeWidth="12" />
                                <circle cx="100" cy="100" r="50" stroke="#007CF0" strokeWidth="12" strokeDasharray="240 314" strokeLinecap="round" transform="rotate(-90 100 100)" />
                                <text x="100" y="108" textAnchor="middle" fontSize="18" fontWeight="800" fill="#1E293B">96.4%</text>
                                <rect x="180" y="60" width="180" height="8" rx="4" fill="#E2E8F0" />
                                <rect x="180" y="60" width="140" height="8" rx="4" fill="#007CF0" />
                                <rect x="180" y="80" width="180" height="8" rx="4" fill="#E2E8F0" />
                                <rect x="180" y="80" width="110" height="8" rx="4" fill="#007CF0" />
                                <rect x="180" y="100" width="180" height="8" rx="4" fill="#E2E8F0" />
                                <rect x="180" y="100" width="160" height="8" rx="4" fill="#00DFD8" />
                                <g opacity="0.4">
                                    <rect x="40" y="170" width="100" height="30" rx="6" fill="#E2E8F0" />
                                    <rect x="150" y="170" width="100" height="30" rx="6" fill="#E2E8F0" />
                                    <rect x="260" y="170" width="100" height="30" rx="6" fill="#E2E8F0" />
                                </g>
                            </svg>
                        </div>
                        <div className="glow-corner" />
                    </div>
                </div>
            </section>

            <section id="platform" className="lp-section lp-features">
                <div className="section-header reveal-on-scroll">
                    <label>Platform</label>
                    <h2>Built for High-Stakes Complexity</h2>
                </div>
                <div className="lp-feature-grid">
                    <div className="lp-feature-card reveal-on-scroll">
                        <div className="icon-box">📦</div>
                        <h3>Deep Inventory Insight</h3>
                        <p>Track every serial number, warranty, and depreciation cycle with millisecond precision.</p>
                    </div>
                    <div className="lp-feature-card reveal-on-scroll">
                        <div className="icon-box">⚡</div>
                        <h3>Automated Onboarding</h3>
                        <p>Deploy hardware in minutes. Pre-configured workflows for global remote teams.</p>
                    </div>
                    <div className="lp-feature-card reveal-on-scroll">
                        <div className="icon-box">📊</div>
                        <h3>Operational Telemetry</h3>
                        <p>Real-time data lake connections for your entire distributed asset pool.</p>
                    </div>
                    <div className="lp-feature-card reveal-on-scroll">
                        <div className="icon-box">🛡️</div>
                        <h3>Compliance Vault</h3>
                        <p>Audit-ready logs and SOC2-compliant access controls built into the core.</p>
                    </div>
                </div>
            </section>

            <section id="solutions" className="lp-section lp-solutions">
                <div className="solutions-container reveal-on-scroll">
                    <div className="solutions-text">
                        <label>Solutions</label>
                        <h2>Your Global Fleet, Simplified</h2>
                        <p>Streamline logistics and inventory across borders. BranchGrid handles the complexity so you can focus on building.</p>
                        <ul className="lp-checklist">
                            <li>Multi-entity support</li>
                            <li>Automated replacement workflows</li>
                            <li>Integrated vendor management</li>
                        </ul>
                        <button className="btn-primary" onClick={onLogin}>Explore Solutions</button>
                    </div>
                    <div className="solutions-visual">
                        <div className="lp-glass-card map-view">
                            <svg className="map-svg" viewBox="0 0 500 300" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M50 150Q150 50 250 150T450 150" stroke="url(#map-grad)" strokeWidth="2" strokeDasharray="4 4" opacity="0.3" />
                                <defs>
                                    <linearGradient id="map-grad" x1="0" y1="0" x2="1" y2="0">
                                        <stop offset="0%" stopColor="#007CF0" />
                                        <stop offset="100%" stopColor="#00DFD8" />
                                    </linearGradient>
                                </defs>
                                <circle cx="100" cy="100" r="8" fill="#007CF0" className="map-node" />
                                <circle cx="100" cy="100" r="15" stroke="#007CF0" strokeWidth="2" opacity="0.2" className="ping" />
                                <circle cx="350" cy="200" r="8" fill="#00DFD8" className="map-node" />
                                <circle cx="350" cy="200" r="15" stroke="#00DFD8" strokeWidth="2" opacity="0.2" className="ping" />
                                <circle cx="250" cy="80" r="6" fill="#1E293B" className="map-node" />
                                <g opacity="0.1">
                                    <path d="M0 0 L500 0 L500 300 L0 300 Z" fill="url(#grid)" />
                                    <defs>
                                        <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                                            <path d="M 40 0 L 0 0 0 40" fill="none" stroke="currentColor" strokeWidth="0.5" />
                                        </pattern>
                                    </defs>
                                </g>
                            </svg>
                        </div>
                    </div>
                </div>
            </section>

            <section id="enterprise" className="lp-section lp-enterprise">
                <div className="enterprise-container reveal-on-scroll">
                    <div className="enterprise-visual-main">
                        <div className="enterprise-svg-wrapper">
                            <svg viewBox="0 0 600 400" fill="none" xmlns="http://www.w3.org/2000/svg" className="ent-illustration">
                                <rect x="100" y="100" width="400" height="200" rx="20" fill="white" stroke="#E2E8F0" strokeWidth="1" />
                                <rect x="130" y="130" width="340" height="140" rx="12" fill="#F8FAFC" />
                                <g className="floating-nodes">
                                    <rect x="80" y="60" width="80" height="80" rx="16" fill="white" filter="drop-shadow(0 10px 20px rgba(0,0,0,0.05))" />
                                    <text x="120" y="105" textAnchor="middle" fontSize="30">🏢</text>

                                    <rect x="440" y="260" width="100" height="100" rx="20" fill="white" filter="drop-shadow(0 10px 20px rgba(0,0,0,0.05))" />
                                    <text x="490" y="315" textAnchor="middle" fontSize="40">🔒</text>

                                    <rect x="450" y="40" width="70" height="70" rx="14" fill="white" filter="drop-shadow(0 10px 20px rgba(0,0,0,0.05))" />
                                    <text x="485" y="82" textAnchor="middle" fontSize="24">☁️</text>
                                </g>
                                <path d="M160 100 Q 250 50 450 75" stroke="#007CF0" strokeWidth="2" strokeDasharray="5 5" opacity="0.3" />
                                <path d="M450 310 Q 300 350 140 140" stroke="#00DFD8" strokeWidth="2" strokeDasharray="5 5" opacity="0.3" />
                            </svg>
                        </div>
                    </div>
                    <div className="enterprise-content-new">
                        <label>Enterprise Ready</label>
                        <h2>Mission-Critical Scale. <br />Fintech-Grade Security.</h2>
                        <p>Designed for the rigorous demands of modern financial institutions. BranchGrid provides the transparency, control, and compliance required to manage global IT operations at scale.</p>

                        <div className="ent-feature-list">
                            <div className="ent-feature">
                                <div className="ent-icon">🔑</div>
                                <div>
                                    <h4>SSO & IAM Integration</h4>
                                    <p>Connect seamlessly with Okta, Azure AD, and Google Workspace.</p>
                                </div>
                            </div>
                            <div className="ent-feature">
                                <div className="ent-icon">📑</div>
                                <div>
                                    <h4>Immutable Audit Logs</h4>
                                    <p>Comprehensive historical tracking of every asset change and access event.</p>
                                </div>
                            </div>
                            <div className="ent-feature">
                                <div className="ent-icon">🤝</div>
                                <div>
                                    <h4>Dedicated Success Team</h4>
                                    <p>Priority 24/7 support with guaranteed response times in your local region.</p>
                                </div>
                            </div>
                        </div>

                        <div className="enterprise-actions">
                            <button className="btn-primary-large" onClick={onLogin}>Contact Sales</button>
                            <button className="btn-ghost" onClick={onLogin}>Review Security Whitepaper →</button>
                        </div>
                    </div>
                </div>
            </section>

            <section id="resources" className="lp-section lp-resources">
                <div className="section-header reveal-on-scroll">
                    <label>Resources</label>
                    <h2>Insights for IT Leaders</h2>
                </div>
                <div className="lp-resource-grid">
                    <article className="lp-resource-card reveal-on-scroll">
                        <div className="resource-img">📄</div>
                        <div className="resource-info">
                            <span className="type">Whitepaper</span>
                            <h3>The Future of Unified IT Ops</h3>
                            <p>Deep dive into modern asset management strategies for hyper-growth fintechs.</p>
                            <a href="#docs" className="read-more">Download PDF →</a>
                        </div>
                    </article>
                    <article className="lp-resource-card reveal-on-scroll">
                        <div className="resource-img">💡</div>
                        <div className="resource-info">
                            <span className="type">Case Study</span>
                            <h3>Global Fleet at Scale</h3>
                            <p>How leading digital banks manage 10k+ remote devices across 15+ countries.</p>
                            <a href="#docs" className="read-more">Read Story →</a>
                        </div>
                    </article>
                    <article className="lp-resource-card reveal-on-scroll">
                        <div className="resource-img">🛠️</div>
                        <div className="resource-info">
                            <span className="type">Guide</span>
                            <h3>SOC2 Compliance Handbook</h3>
                            <p>A technical guide to implementing mandatory hardware controls for security audits.</p>
                            <a href="#docs" className="read-more">Get Guide →</a>
                        </div>
                    </article>
                </div>
            </section>

            <section id="pricing" className="lp-section lp-pricing">
                <div className="section-header reveal-on-scroll">
                    <label>Pricing</label>
                    <h2>Plans that Scale with You</h2>
                </div>
                <div className="pricing-container">
                    <div className="pricing-card reveal-on-scroll">
                        <h3>Standard</h3>
                        <div className="amt">$99<span>/mo</span></div>
                        <ul className="lp-checklist">
                            <li>Up to 250 assets</li>
                            <li>Core automation</li>
                            <li>Next-day support</li>
                        </ul>
                        <button className="btn-secondary" onClick={onLogin}>Get Started</button>
                    </div>
                    <div className="pricing-card featured reveal-on-scroll">
                        <div className="best-value">MOST POPULAR</div>
                        <h3>Enterprise</h3>
                        <div className="amt">$499<span>/mo</span></div>
                        <ul className="lp-checklist">
                            <li>Unlimited assets</li>
                            <li>Advanced telemetry</li>
                            <li>24/7 dedicated support</li>
                            <li>Custom integrations</li>
                        </ul>
                        <button className="btn-primary" onClick={onLogin}>Start Free Trial</button>
                    </div>
                    <div className="pricing-card reveal-on-scroll">
                        <h3>Global</h3>
                        <div className="amt">Custom</div>
                        <ul className="lp-checklist">
                            <li>Multi-entity billing</li>
                            <li>SLA Guarantees</li>
                            <li>On-prem options</li>
                        </ul>
                        <button className="btn-secondary" onClick={onLogin}>Contact Sales</button>
                    </div>
                </div>
            </section>

            <footer className="lp-footer">
                <div className="footer-top reveal-on-scroll">
                    <div className="f-brand">
                        <div className="lp-logo">BranchGrid</div>
                        <p>Leading the next generation of IT operations for the global enterprise.</p>
                    </div>
                    <div className="f-links">
                        <div className="f-col">
                            <strong>Platform</strong>
                            <a href="#features">Inventory</a>
                            <a href="#solutions">Fleet</a>
                            <a href="#enterprise">Security</a>
                        </div>
                        <div className="f-col">
                            <strong>Product</strong>
                            <a href="#pricing">Pricing</a>
                            <a href="#docs">Documentation</a>
                            <a href="#api">API</a>
                        </div>
                        <div className="f-col">
                            <strong>Company</strong>
                            <a href="#about">About</a>
                            <a href="#careers">Careers</a>
                            <a href="#privacy">Privacy</a>
                        </div>
                    </div>
                </div>
                <div className="footer-bottom">
                    <p>© {new Date().getFullYear()} BranchGrid Inc. All rights reserved.</p>
                    <div className="f-social">
                        <a href="#t">Twitter</a>
                        <a href="#li">LinkedIn</a>
                    </div>
                </div>
            </footer>
        </div>
    );
};

export default LandingPage;
