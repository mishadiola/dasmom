import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Shield,
  Lock,
  CheckCircle2,
  ArrowRight,
  Menu,
  X,
  Activity,
  Calendar,
  Heart,
  Baby,
  Users,
  Bell,
  Syringe,
  AlertTriangle,
  HeartPulse,
  FileText,
  ShieldCheck,
  BarChart3,
  Building2,
  Globe2,
  Star,
  MapPin,
  TrendingUp,
  UserCheck,
  ClipboardList,
  Stethoscope,
} from "lucide-react";
import "../../styles/pages/Landing.css";
import supabase from "../../config/supabaseclient";

const Landing = () => {
  const navigate = useNavigate();
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [dbStats, setDbStats] = useState({
    mothers: "—",
    vaccinations: "—",
    stations: "—",
    deliveries: "—"
  });

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handleScroll);
    
    const fetchStats = async () => {
      try {
        const [mothersRes, vaccinesRes, stationsRes, deliveriesRes] = await Promise.all([
          supabase.from("patient_basic_info").select("*", { count: "exact", head: true }),
          supabase.from("vaccinations").select("*", { count: "exact", head: true }),
          supabase.from("stations").select("*", { count: "exact", head: true }),
          supabase.from("deliveries").select("*", { count: "exact", head: true })
        ]);

        setDbStats({
          mothers: mothersRes.count !== null ? mothersRes.count : "—",
          vaccinations: vaccinesRes.count !== null ? vaccinesRes.count : "—",
          stations: stationsRes.count !== null ? stationsRes.count : "—",
          deliveries: deliveriesRes.count !== null ? deliveriesRes.count : "—"
        });
      } catch (err) {
        console.error("Error fetching stats:", err);
      }
    };

    fetchStats();

    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const scrollToSection = (id) => {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
    setMobileMenuOpen(false);
  };

  const handleLogin = () => navigate("/mother-login");

  const navLinks = [
    { id: "home", label: "Home" },
    { id: "services", label: "Services" },
    { id: "journey", label: "Your Care Journey" },
    { id: "impact", label: "Our Impact" },
    { id: "about", label: "About DASMOM+" },
    { id: "benefits", label: "Benefits" },
  ];

  const healthServices = [
    {
      icon: HeartPulse,
      title: "Prenatal Care Monitoring",
      description:
        "Follow your pregnancy progress, prenatal visits, trimester milestones, and important health updates.",
      benefit: "Stay informed about your pregnancy and keep track of your important checkups.",
      color: "mauve",
    },
    {
      icon: Calendar,
      title: "Appointment Scheduling",
      description:
        "View your upcoming prenatal visits and keep track of your healthcare schedule.",
      benefit: "Know when and where your next visit is.",
      color: "sage",
    },
    {
      icon: Syringe,
      title: "Vaccination Tracking",
      description:
        "Keep track of vaccinations and supplements recommended during pregnancy and after your baby is born.",
      benefit: "Help protect yourself and your baby through timely care.",
      color: "amber",
    },
    {
      icon: AlertTriangle,
      title: "Maternal Risk Monitoring",
      description:
        "Helps healthcare workers identify mothers who may need closer monitoring and additional support.",
      benefit: "Identifying concerns early can help healthcare workers provide timely care.",
      color: "rose",
    },
    {
      icon: Activity,
      title: "Postpartum Follow-Up",
      description:
        "Keep track of follow-up visits and care during the important weeks after delivery.",
      benefit: "Your care continues even after your baby is born.",
      color: "sage",
    },
    {
      icon: Users,
      title: "Healthcare Coordination",
      description:
        "Helps your healthcare team keep maternal health information organized and up to date.",
      benefit: "Better coordination means your care team can better support you.",
      color: "mauve",
    },
  ];

  const careJourneySteps = [
    {
      icon: ClipboardList,
      step: "01",
      title: "Pregnancy Registration",
      desc: "Begin your maternal care journey through your local health station. Your pregnancy information and health history are recorded to help your healthcare team provide appropriate care.",
    },
    {
      icon: Stethoscope,
      step: "02",
      title: "Prenatal Monitoring",
      desc: "Your prenatal visits and health information are recorded and kept up to date throughout your pregnancy.",
    },
    {
      icon: Syringe,
      step: "03",
      title: "Vaccination & Supplement Tracking",
      desc: "Recommended vaccinations and supplements are recorded to help you stay on track with your maternal care.",
    },
    {
      icon: Building2,
      step: "04",
      title: "Delivery Care",
      desc: "Important delivery and newborn information is recorded as part of your maternal health record.",
    },
    {
      icon: HeartPulse,
      step: "05",
      title: "Postpartum Recovery",
      desc: "Your follow-up care after delivery is recorded to help support your recovery during the postpartum period.",
    },
    {
      icon: Baby,
      step: "06",
      title: "Newborn Monitoring",
      desc: "Your baby's vaccinations, checkups, and important health milestones can be tracked as part of continued care.",
    },
  ];

  const whoUsers = [
    {
      icon: Baby,
      title: "Pregnancy Care",
      desc: "Keep track of your pregnancy progress, prenatal visits, important milestones, and health information.",
      tag: "For Every Mother",
      color: "mauve",
    },
    {
      icon: Stethoscope,
      title: "Appointments",
      desc: "Stay updated with your upcoming prenatal visits and important healthcare schedules.",
      tag: "Easy to Keep Track",
      color: "sage",
    },
    {
      icon: Users,
      title: "Vaccinations & Supplements",
      desc: "Keep track of recommended vaccinations and supplements for you and your baby.",
      tag: "Stay Protected",
      color: "amber",
    },
    {
      icon: Building2,
      title: "Postpartum Care",
      desc: "Continue receiving support and follow-up care after delivery as you recover and care for your newborn.",
      tag: "Care Beyond Pregnancy",
      color: "lavender",
    },
  ];

  const impactStats = [
    { icon: Heart, val: dbStats.mothers, lbl: "Mothers Supported", color: "mauve" },
    { icon: Syringe, val: dbStats.vaccinations, lbl: "Vaccinations Tracked", color: "sage" },
    { icon: Building2, val: dbStats.stations, lbl: "Connected Health Stations", color: "amber" },
  ];

  const testimonialCards = [
    {
      icon: Baby,
      role: "For Mothers",
      sub: "Pregnant & Postpartum Mothers",
      type: "mother",
      quote:
        '"It feels easier to keep track of my prenatal visits and health information. I know when my next appointment is and where I need to go."',
      benefits: [
        "View your care schedule",
        "Keep track of your health records",
        "Stay updated with your vaccinations",
      ],
    },
    {
      icon: Stethoscope,
      role: "For Your Healthcare Team",
      sub: "City Health Office Healthcare Staff",
      type: "midwife",
      quote:
        '"DASMOM+ helps us keep maternal records organized and makes it easier to monitor mothers who need follow-up care."',
      benefits: [
        "Keep maternal records organized",
        "Monitor follow-up needs",
        "Coordinate maternal healthcare",
      ],
    },
    {
      icon: Users,
      role: "For the Community",
      sub: "Dasmariñas City",
      type: "worker",
      quote:
        '"When maternal healthcare is organized and connected, mothers can receive better support throughout their journey."',
      benefits: [
        "Support accessible maternal care",
        "Improve healthcare coordination",
        "Strengthen community maternal health",
      ],
    },
  ];

  const whyBenefits = [
    {
      title: "Keeping Health Records Organized",
      cap: "Maternal health information is organized in one secure digital record for easier access by your healthcare team.",
    },
    {
      title: "Remembering Appointments",
      cap: "Upcoming visits are recorded so mothers can easily keep track of their maternal healthcare schedule.",
    },
    {
      title: "Keeping Vaccinations Updated",
      cap: "Vaccination records help mothers and healthcare workers keep track of recommended immunizations.",
    },
    {
      title: "Identifying Mothers Who Need Extra Support",
      cap: "Healthcare workers can identify and monitor mothers who may require closer attention.",
    },
    {
      title: "Connecting Health Stations",
      cap: "Helps participating City Health Office health stations coordinate maternal care and information.",
    },
    {
      title: "Understanding Community Health Needs",
      cap: "Health information and reports help the City Health Office understand maternal healthcare needs across Dasmariñas.",
    },
    {
      title: "Protecting Health Information",
      cap: "Access to maternal health information is controlled and limited to authorized users.",
    },
  ];

  return (
    <div className="ldg-page">
      {/* ══════════════ NAVBAR ══════════════ */}
      <nav
        className={`ldg-nav${scrolled ? " ldg-nav--scrolled" : ""}`}
        role="navigation"
        aria-label="Main navigation"
      >
        <div className="ldg-nav__container">
          <div className="ldg-nav__brand">
            <div className="ldg-nav__logo-mark">
              <HeartPulse size={18} />
            </div>
            <span className="ldg-nav__logo-text">
              DASMOM<span className="ldg-nav__plus">+</span>
            </span>
            <span className="ldg-nav__tagline">Maternal Health Support</span>
          </div>

          <div
            className={`ldg-nav__links${mobileMenuOpen ? " ldg-nav__links--open" : ""}`}
          >
            {navLinks.map((link) => (
              <button
                key={link.id}
                className="ldg-nav__link"
                onClick={() => scrollToSection(link.id)}
              >
                {link.label}
              </button>
            ))}
          </div>

          <div className="ldg-nav__actions">
            <button
              className="ldg-nav__login-btn"
              onClick={handleLogin}
              id="nav-login-btn"
            >
              <Lock size={13} />
              Login
            </button>
            <button
              className="ldg-nav__mobile-toggle"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label="Toggle navigation menu"
              id="mobile-menu-toggle"
            >
              {mobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
            </button>
          </div>
        </div>
      </nav>

      {/* ══════════════ HERO SECTION ══════════════ */}
      <section
        id="home"
        className="ldg-hero"
        aria-label="DASMOM+ maternal healthcare platform"
      >
        <div className="ldg-hero__blob1" aria-hidden="true"></div>
        <div className="ldg-hero__blob2" aria-hidden="true"></div>
        <div className="ldg-hero__blob3" aria-hidden="true"></div>
        <div className="ldg-hero__pattern" aria-hidden="true"></div>

        <div className="ldg-hero__container">
          {/* Left: Content */}
          <div className="ldg-hero__content">
            <div className="ldg-hero__gov-badge">
              <ShieldCheck size={13} />
              <span>City Health Office · Dasmariñas City</span>
            </div>

            <h1 className="ldg-hero__title">
              Congratulations, Mommy!
            </h1>



            <p className="ldg-hero__desc">
              DASMOM+ is here to support you through every step of your motherhood journey — from pregnancy to postpartum care.
            </p>
            <p className="ldg-hero__desc" style={{marginTop: '12px'}}>
              Keep track of your prenatal visits, health records, vaccinations, pregnancy progress, and postpartum care while staying connected with your healthcare team.
            </p>

            <ul
              className="ldg-hero__trust-list"
              aria-label="Key platform benefits"
            >
              {[
                "Easy to Use",
                "Keep Track of Your Care",
                "Secure Maternal Records",
                "Connected to Your Health Center",
              ].map((item, i) => (
                <li key={i} className="ldg-hero__trust-item">
                  <span className="ldg-hero__trust-check">✓</span>
                  {item}
                </li>
              ))}
            </ul>

            <div className="ldg-hero__cta-group">
              <button
                className="ldg-btn ldg-btn--white ldg-btn--lg"
                onClick={handleLogin}
                id="hero-login-btn"
              >
                <Heart size={16} />
                Get Started
              </button>
              <button
                className="ldg-btn ldg-btn--ghost ldg-btn--lg"
                onClick={() => scrollToSection("who")}
                id="hero-learn-btn"
              >
                Learn More
                <ArrowRight size={16} />
              </button>
            </div>
          </div>

          {/* Right: Illustration + Stats */}
          <div className="ldg-hero__visual">
            <div className="ldg-hero__illus-wrap">
              <div className="ldg-hero__illus-card">
                {/* Mini stat chips */}
                <div className="ldg-hero__mini-stats">
                  <div className="ldg-hero__mini-stat">
                    <span className="ldg-hero__mini-stat-val">{dbStats.mothers}</span>
                    <span className="ldg-hero__mini-stat-lbl">
                      Mothers Supported
                    </span>
                  </div>
                  <div className="ldg-hero__mini-stat">
                    <span className="ldg-hero__mini-stat-val">{dbStats.stations}</span>
                    <span className="ldg-hero__mini-stat-lbl">
                      Connected Health Stations
                    </span>
                  </div>
                  <div className="ldg-hero__mini-stat">
                    <span className="ldg-hero__mini-stat-val">{dbStats.deliveries}</span>
                    <span className="ldg-hero__mini-stat-lbl">
                      Deliveries Recorded
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ══════════════ WHO CAN USE DASMOM+ ══════════════ */}
      <section id="who" className="ldg-who" aria-label="Who can use DASMOM+">
        <div className="ldg-who__inner">
          <div className="ldg-section-head ldg-section-head--center">
            <span className="ldg-badge">Community Maternal Care</span>
            <h2 className="ldg-section-title">Care Made for Every Mother</h2>
            <p className="ldg-section-sub">
              DASMOM+ helps mothers in Dasmariñas stay connected with maternal healthcare services provided by the City Health Office — from pregnancy registration to postpartum and newborn care.
            </p>
          </div>

          <div className="ldg-who__grid">
            {whoUsers.map((user, i) => (
              <div
                key={i}
                className={`ldg-who-card ldg-who-card--${user.color}`}
                id={`who-card-${i}`}
              >
                <div className="ldg-who-card__icon-wrap">
                  <user.icon size={32} strokeWidth={1.5} />
                </div>
                <h3 className="ldg-who-card__title">{user.title}</h3>
                <p className="ldg-who-card__desc">{user.desc}</p>
                <span className="ldg-who-card__tag">{user.tag}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════ ABOUT SECTION ══════════════ */}
      <section id="about" className="ldg-about" aria-label="About DASMOM+">
        <div className="ldg-about__inner">
          {/* Visual Card */}
          <div className="ldg-about__visual">
            <div className="ldg-about-visual-card">
              <div className="ldg-about-visual-card__header">
                <div className="ldg-about-visual-card__title">
                  DASMOM+ — How It Works
                </div>
                <div className="ldg-about-visual-card__sub">
                  Your Care, Connected Across Dasmariñas
                  <div style={{marginTop: '6px', fontSize: '11px', opacity: 0.8, lineHeight: 1.4}}>DASMOM+ helps connect mothers with the maternal healthcare services of the City Health Office and its participating health stations.</div>
                </div>
              </div>
              <div className="ldg-about-visual-card__body">
                <svg
                  className="ldg-about-visual-card__svg"
                  viewBox="0 0 480 320"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                  aria-label="Hub and spoke connectivity diagram"
                  role="img"
                  style={{ width: "100%", height: "auto", display: "block" }}
                >
                  <defs>
                    <marker id="arr-start" viewBox="0 0 10 10" refX="2" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
                      <path d="M 10 1 L 2 5 L 10 9 z" fill="#b9818a" />
                    </marker>
                    <marker id="arr-end" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto">
                      <path d="M 0 1 L 8 5 L 0 9 z" fill="#b9818a" />
                    </marker>
                    <filter id="card-shadow" x="-20%" y="-20%" width="140%" height="140%">
                      <feDropShadow dx="0" dy="3" stdDeviation="3" floodColor="#2d2234" floodOpacity="0.08" />
                    </filter>

                    <g id="station-icon">
                      <circle cx="0" cy="-5" r="40" fill="#e8f0e3" opacity="0.6" />
                      <rect x="-24" y="-14" width="48" height="34" rx="4" fill="#ffffff" stroke="#7a9b6a" strokeWidth="1.5" />
                      <path d="M -28 -14 L 28 -14 L 20 -28 L -20 -28 Z" fill="#7a9b6a" />
                      <rect x="-6" y="8" width="12" height="12" rx="2" fill="#7a9b6a" opacity="0.8" />
                      <rect x="-16" y="-4" width="8" height="8" rx="1" fill="#e8f0e3" stroke="#7a9b6a" strokeWidth="1" />
                      <rect x="8" y="-4" width="8" height="8" rx="1" fill="#e8f0e3" stroke="#7a9b6a" strokeWidth="1" />
                      <circle cx="0" cy="-20" r="7" fill="#ffffff" />
                      <rect x="-1.5" y="-23.5" width="3" height="7" fill="#7a9b6a" />
                      <rect x="-3.5" y="-21.5" width="7" height="3" fill="#7a9b6a" />
                    </g>

                    <g id="hub-icon">
                      <circle cx="0" cy="0" r="70" fill="#f5eaec" opacity="0.7" />
                      <rect x="-45" y="-20" width="90" height="55" rx="6" fill="#ffffff" stroke="#b9818a" strokeWidth="2" />
                      <path d="M -52 -20 L 52 -20 L 40 -38 L -40 -38 Z" fill="#b9818a" />
                      <rect x="-12" y="15" width="24" height="20" rx="3" fill="#b9818a" opacity="0.9" />
                      <rect x="-32" y="-5" width="12" height="12" rx="2" fill="#f5eaec" stroke="#b9818a" strokeWidth="1" />
                      <rect x="20" y="-5" width="12" height="12" rx="2" fill="#f5eaec" stroke="#b9818a" strokeWidth="1" />
                      <rect x="-32" y="15" width="12" height="12" rx="2" fill="#f5eaec" stroke="#b9818a" strokeWidth="1" />
                      <rect x="20" y="15" width="12" height="12" rx="2" fill="#f5eaec" stroke="#b9818a" strokeWidth="1" />
                      <circle cx="0" cy="-30" r="12" fill="#ffffff" stroke="#b9818a" strokeWidth="1.5" />
                      <rect x="-2" y="-35" width="4" height="10" fill="#b9818a" />
                      <rect x="-5" y="-32" width="10" height="4" fill="#b9818a" />
                    </g>
                  </defs>

                  {/* Lines */}
                  <g stroke="#b9818a" strokeWidth="2" strokeDasharray="5 5" markerStart="url(#arr-start)" markerEnd="url(#arr-end)" opacity="0.6">
                    <line x1="175" y1="117" x2="125" y2="83" />
                    <line x1="305" y1="117" x2="355" y2="83" />
                    <line x1="165" y1="160" x2="105" y2="160" />
                    <line x1="315" y1="160" x2="375" y2="160" />
                    <line x1="175" y1="203" x2="125" y2="237" />
                    <line x1="305" y1="203" x2="355" y2="237" />
                  </g>

                  {/* Stations */}
                  {[
                    { x: 90, y: 60, name: "Armstrong" },
                    { x: 390, y: 60, name: "Dasma II" },
                    { x: 60, y: 160, name: "Dasma I" },
                    { x: 420, y: 160, name: "Dasma III" },
                    { x: 90, y: 260, name: "Dasma IV" },
                    { x: 390, y: 260, name: "Salawag" }
                  ].map((s, i) => (
                    <g key={i} transform={`translate(${s.x}, ${s.y})`}>
                      <use href="#station-icon" />
                      <rect x="-40" y="28" width="80" height="22" rx="11" fill="#ffffff" filter="url(#card-shadow)" />
                      <text x="0" y="43" textAnchor="middle" fill="#7a4e58" fontSize="11" fontWeight="700" fontFamily="Poppins, sans-serif">
                        {s.name}
                      </text>
                    </g>
                  ))}

                  {/* Center Hub */}
                  <g transform="translate(240, 160)">
                    <use href="#hub-icon" />
                    <rect x="-70" y="42" width="140" height="38" rx="14" fill="#ffffff" filter="url(#card-shadow)" />
                    <text x="0" y="58" textAnchor="middle" fill="#7a4e58" fontSize="13" fontWeight="800" fontFamily="Poppins, sans-serif">
                      City Health Office 3
                    </text>
                    <text x="0" y="72" textAnchor="middle" fill="#9c6672" fontSize="10" fontWeight="600" fontFamily="Poppins, sans-serif">
                      (Main Office)
                    </text>
                  </g>
                </svg>

                <div className="ldg-about-visual-card__stats">
                  <div className="ldg-about-vc-stat">
                    <span className="ldg-about-vc-stat__val">501</span>
                    <span className="ldg-about-vc-stat__lbl">
                      Active Mothers
                    </span>
                  </div>
                  <div className="ldg-about-vc-stat">
                    <span className="ldg-about-vc-stat__val">85%</span>
                    <span className="ldg-about-vc-stat__lbl">Vacc. Rate</span>
                  </div>
                  <div className="ldg-about-vc-stat">
                    <span className="ldg-about-vc-stat__val">7</span>
                    <span className="ldg-about-vc-stat__lbl">Stations</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Text Content */}
          <div className="ldg-about__content">
            <span className="ldg-badge">About the Platform</span>
            <h2 className="ldg-section-title">
              A Caring Platform Built for Mothers
            </h2>
            <p className="ldg-about__intro">
              DASMOM+ is a maternal health monitoring platform of the City Health Office of Dasmariñas City. It helps organize maternal health information and connect mothers with the healthcare services they need throughout pregnancy, delivery, postpartum recovery, and newborn care.
            </p>

            <div className="ldg-about__mvp-cards">
              <div className="ldg-about-mvp-card">
                <div className="ldg-about-mvp-card__icon">
                  <Heart size={16} />
                </div>
                <h4>Our Mission</h4>
                <p>
                  To make maternal healthcare more accessible, organized, and compassionate — so every mother can receive the care and support she deserves.
                </p>
              </div>
              <div className="ldg-about-mvp-card">
                <div className="ldg-about-mvp-card__icon">
                  <Globe2 size={16} />
                </div>
                <h4>Our Vision</h4>
                <p>
                  A caring and connected community where every mother in Dasmariñas City can access timely maternal healthcare and feel supported throughout her motherhood journey.
                </p>
              </div>
              <div className="ldg-about-mvp-card">
                <div className="ldg-about-mvp-card__icon">
                  <ShieldCheck size={16} />
                </div>
                <h4>Our Promise</h4>
                <p>
                  Your health information is handled with care and kept secure, helping you and your healthcare team stay informed throughout your maternal care journey.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ══════════════ HEALTHCARE SERVICES ══════════════ */}
      <section
        id="services"
        className="ldg-services"
        aria-label="Healthcare services"
      >
        <div className="ldg-services__inner">
          <div className="ldg-section-head ldg-section-head--center">
            <span className="ldg-badge ldg-badge--sage">
              Healthcare Services
            </span>
            <h2 className="ldg-section-title">
              Care and Support for Every Step
            </h2>
            <p className="ldg-section-sub">
              From your first prenatal visit to postpartum recovery and your baby's early care, DASMOM+ helps you keep track of the care that matters most.
            </p>
          </div>

          <div className="ldg-services__grid">
            {healthServices.map((service, i) => {
              const Icon = service.icon;
              return (
                <div
                  key={i}
                  className={`ldg-service-card ldg-service-card--${service.color}`}
                  id={`service-card-${i}`}
                >
                  <div className="ldg-service-card__head">
                    <div className="ldg-service-card__icon">
                      <Icon size={26} />
                    </div>
                    <h3 className="ldg-service-card__title">{service.title}</h3>
                  </div>
                  <p className="ldg-service-card__desc">
                    {service.description}
                  </p>
                  <div className="ldg-service-card__benefit">
                    <span className="ldg-service-card__benefit-label">
                      - Why it matters
                    </span>
                    <span className="ldg-service-card__benefit-text">
                      {service.benefit}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ══════════════ MATERNAL CARE JOURNEY ══════════════ */}
      <section
        id="journey"
        className="ldg-journey"
        aria-label="Maternal care journey"
      >
        <div className="ldg-journey__deco" aria-hidden="true"></div>
        <div className="ldg-journey__deco2" aria-hidden="true"></div>
        <div className="ldg-journey__inner">
          <div className="ldg-section-head ldg-section-head--center">
            <span className="ldg-badge">Your Care Journey</span>
            <h2 className="ldg-section-title">
              Your Pregnancy Journey with DASMOM+
            </h2>
            <p className="ldg-section-sub">
              From your first registration to your newborn's first checkup —
              we're with you every step of the way.
            </p>
          </div>

          <div className="ldg-journey-grid">
            {careJourneySteps.map((step, i) => (
              <div
                key={i}
                className="ldg-journey-step"
                id={`journey-step-${i}`}
              >
                <div className="ldg-journey-step__num">{step.step}</div>
                <div className="ldg-journey-step__icon">
                  <step.icon size={32} strokeWidth={1.5} />
                </div>
                <h3 className="ldg-journey-step__title">{step.title}</h3>
                <p className="ldg-journey-step__desc">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════ COMMUNITY IMPACT ══════════════ */}
      <section
        id="impact"
        className="ldg-impact"
        aria-label="Community impact statistics"
      >
        <div className="ldg-impact__deco1" aria-hidden="true"></div>
        <div className="ldg-impact__deco2" aria-hidden="true"></div>
        <div className="ldg-impact__inner">
          <div className="ldg-section-head ldg-section-head--center">
            <span className="ldg-badge">Community Impact</span>
            <h2 className="ldg-section-title">
              Supporting Mothers Across Dasmariñas City
            </h2>
            <p className="ldg-section-sub">
              DASMOM+ supports the City Health Office in organizing maternal healthcare and keeping mothers connected with the care they need.
            </p>
          </div>

          <div className="ldg-impact__grid">
            {impactStats.map((stat, i) => (
              <div
                key={i}
                className={`ldg-impact-card ldg-impact-card--${stat.color}`}
                id={`impact-stat-${i}`}
              >
                <div className="ldg-impact-card__icon">
                  <stat.icon size={32} strokeWidth={1.5} />
                </div>
                <div className="ldg-impact-card__val">{stat.val}</div>
                <div className="ldg-impact-card__lbl">{stat.lbl}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════ TESTIMONIALS / SUPPORTING BETTER HEALTHCARE ══════════════ */}
      <section
        className="ldg-testimonials"
        aria-label="Supporting better maternal healthcare"
      >
        <div className="ldg-testimonials__inner">
          <div className="ldg-section-head ldg-section-head--center">
            <span className="ldg-badge ldg-badge--peach">Community Voices</span>
            <h2 className="ldg-section-title">
              Built Around the Needs of Mothers
            </h2>
            <p className="ldg-section-sub">
              DASMOM+ is designed to make maternal healthcare easier to follow, easier to access, and more supportive for mothers in Dasmariñas City.
            </p>
          </div>

          <div className="ldg-testimonials__grid">
            {testimonialCards.map((card, i) => (
              <div
                key={i}
                className={`ldg-testimonial-card ldg-testimonial-card--${card.type}`}
                id={`testimonial-${i}`}
              >
                <div className="ldg-testimonial-card__top">
                  <div className="ldg-testimonial-card__avatar">
                    <card.icon size={32} strokeWidth={1.5} />
                  </div>
                  <div className="ldg-testimonial-card__who">
                    <span className="ldg-testimonial-card__role">
                      {card.role}
                    </span>
                    <span className="ldg-testimonial-card__sub">
                      {card.sub}
                    </span>
                  </div>
                </div>

                <p className="ldg-testimonial-card__quote">{card.quote}</p>

                <div className="ldg-testimonial-card__benefits">
                  {card.benefits.map((b, j) => (
                    <div key={j} className="ldg-testimonial-card__benefit">
                      <span className="ldg-testimonial-card__benefit-dot"></span>
                      {b}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════ HEALTHCARE BENEFITS MATRIX ══════════════ */}
      <section
        id="benefits"
        className="ldg-benefits"
        aria-label="Healthcare benefits"
      >
        <div className="ldg-benefits__inner">
          <div className="ldg-section-head ldg-section-head--center">
            <span className="ldg-badge ldg-badge--lavender">
              Platform Benefits
            </span>
            <h2 className="ldg-section-title">
              Making Maternal Care Easier
            </h2>
            <p className="ldg-section-sub">
              DASMOM+ helps make maternal healthcare more organized, accessible, and easier to follow for mothers and their healthcare team.
            </p>
          </div>

          <div className="ldg-benefits-matrix">
            <div className="ldg-benefits-matrix__header">
              <div>Healthcare Need</div>
              <div>DASMOM+ Solution</div>
            </div>
            <div className="ldg-benefits-matrix__body">
              {whyBenefits.map((b, i) => (
                <div key={i} className="ldg-benefits-matrix__row">
                  <div className="ldg-benefits-matrix__cell-req">
                    <div className="ldg-benefits-matrix__cell-req-inner">
                      <span className="check-dot">✓</span>
                      <strong>{b.title}</strong>
                    </div>
                  </div>
                  <div className="ldg-benefits-matrix__cell-cap">{b.cap}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ══════════════ ACCESS SECTION ══════════════ */}
      <section className="ldg-access-cta" aria-label="Access DASMOM+ account">
        <div className="ldg-access-cta__deco" aria-hidden="true"></div>
        <div className="ldg-access-cta__inner">
          <span
            className="ldg-badge ldg-badge--sage"
            style={{ margin: "0 auto 16px" }}
          >
            Your Healthcare Portal
          </span>
          <h2 className="ldg-access-cta__title">
            Your Maternal Care, <span>All in One Place</span>
          </h2>
          <p className="ldg-access-cta__desc">
            Access your DASMOM+ account to view your health records, upcoming appointments, vaccination information, pregnancy progress, and available support services.
          </p>

          <div className="ldg-access-cta__icons">
            {[
              { icon: ShieldCheck, label: "Your Health Records" },
              { icon: Activity, label: "Your Appointments" },
              { icon: ClipboardList, label: "Your Pregnancy Care" },
              { icon: UserCheck, label: "Your Support" },
            ].map((item, i) => (
              <div key={i} className="ldg-access-cta__icon-item">
                <div className="ldg-access-cta__icon-circle">
                  <item.icon size={32} strokeWidth={1.5} />
                </div>
                <span className="ldg-access-cta__icon-lbl">{item.label}</span>
              </div>
            ))}
          </div>

          <div className="ldg-access-cta__btns">
            <button
              className="ldg-btn ldg-btn--sage ldg-btn--lg"
              onClick={handleLogin}
              id="access-cta-login-btn"
            >
              <Heart size={16} />
              Login to DASMOM+
            </button>
            <button
              className="ldg-btn ldg-btn--outline ldg-btn--lg"
              onClick={() => scrollToSection("who")}
              id="access-cta-learn-btn"
            >
              Learn More
              <ArrowRight size={16} />
            </button>
          </div>
        </div>
      </section>

      {/* ══════════════ FOOTER ══════════════ */}
      <footer className="ldg-footer" role="contentinfo">
        <div className="ldg-footer__inner">
          <div className="ldg-footer__grid">
            {/* Column 1: Branding */}
            <div className="ldg-footer__brand">
              <div className="ldg-footer__logo">
                <div className="ldg-footer__logo-icon">
                  <HeartPulse size={16} />
                </div>
                <span>
                  DASMOM<span className="ldg-footer__plus">+</span>
                </span>
              </div>
              <p className="ldg-footer__desc">
                A public maternal healthcare platform of the City Health Office of Dasmariñas City, created to support mothers throughout pregnancy, delivery, postpartum recovery, and newborn care.
              </p>
              <div className="ldg-footer__heart">
                <span className="ldg-footer__heart-icon">❤️</span>
                Made with care for mothers & communities
              </div>
              <span className="ldg-footer__version">
                System Version 2.0 · Capstone 2026
              </span>
            </div>

            {/* Column 2: Navigation */}
            <div className="ldg-footer__col">
              <h4>Platform</h4>
              <ul>
                {navLinks.map((link) => (
                  <li key={link.id}>
                    <button onClick={() => scrollToSection(link.id)}>
                      {link.label}
                    </button>
                  </li>
                ))}
              </ul>
            </div>

            {/* Column 3: Coverage */}
            <div className="ldg-footer__col">
              <h4>Program Coverage</h4>
              <ul>
                <li>
                  <span>Dasmariñas City Maternal Health</span>
                </li>
                <li>
                  <span>7 Connected Health Stations</span>
                </li>
                <li>
                  <span>Rural Health Units (RHU)</span>
                </li>
                <li>
                  <span>Barangay Health Workers (BHW)</span>
                </li>

              </ul>
            </div>

            {/* Column 4: Contact */}
            <div className="ldg-footer__col">
              <h4>City Health Office</h4>
              <div className="ldg-footer__contact">
                <div className="ldg-footer__contact-item">
                  <MapPin size={13} />
                  <span>
                    Municipal Health Office
                    <br />
                    Dasmariñas City
                    <br />
                    Cavite, Philippines
                  </span>
                </div>
                <div className="ldg-footer__contact-item">
                  <Building2 size={13} />
                  <span>City Government Health Services</span>
                </div>
                <div className="ldg-footer__contact-item">
                  <ShieldCheck size={13} />
                  <span>Data Privacy Act Compliant</span>
                </div>
              </div>
            </div>
          </div>

          <div className="ldg-footer__bottom">
            <p>
              © {new Date().getFullYear()} DASMOM+ Maternal Health Monitoring
              System. All Rights Reserved.
            </p>
            <p>
              Official Digital Maternal Health Platform · Dasmariñas City Health
              Office
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Landing;
