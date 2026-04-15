import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
    ArrowLeft, BookOpen, Bookmark, BookmarkCheck,
    CheckCircle2, Clock, ChevronRight, Heart,
    Star, Share2, ShieldCheck, ExternalLink
} from 'lucide-react';
import { TIPS_DATA } from './PregnancyTips';
import '../../styles/pages/TipDetailPage.css';

const LS_BOOKMARKS = 'pt_bookmarks';
const LS_READ = 'pt_read';

const getLS = (key) => {
    try { return JSON.parse(localStorage.getItem(key)) || []; }
    catch { return []; }
};
const setLS = (key, val) => localStorage.setItem(key, JSON.stringify(val));

const TipDetailPage = () => {
    const { id } = useParams();
    const navigate = useNavigate();

    const tip = TIPS_DATA.find(t => t.id === id);

    const [bookmarks, setBookmarks] = useState(() => getLS(LS_BOOKMARKS));
    const [readIds, setReadIds] = useState(() => getLS(LS_READ));

    // Mark as read on mount
    useEffect(() => {
        if (!tip) return;
        if (!readIds.includes(id)) {
            const updated = [...readIds, id];
            setReadIds(updated);
            setLS(LS_READ, updated);
        }
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }, [id]);

    if (!tip) {
        return (
            <div className="tdp-not-found">
                <BookOpen size={64} />
                <h2>Article not found</h2>
                <button onClick={() => navigate('/dashboard/user-tips')}>
                    <ArrowLeft size={16} /> Back to Tips
                </button>
            </div>
        );
    }

    const isBookmarked = bookmarks.includes(id);
    const isRead = readIds.includes(id);

    const toggleBookmark = () => {
        const updated = isBookmarked
            ? bookmarks.filter(b => b !== id)
            : [...bookmarks, id];
        setBookmarks(updated);
        setLS(LS_BOOKMARKS, updated);
    };

    // Related articles: same category, exclude current
    const related = TIPS_DATA
        .filter(t => t.id !== id && (t.category === tip.category || Math.random() > 0.5))
        .slice(0, 3);

    return (
        <div className="tdp-page">
            {/* ── Breadcrumb ── */}
            <nav className="tdp-breadcrumb">
                <button className="tdp-back" onClick={() => navigate('/dashboard/user-tips')}>
                    <ArrowLeft size={16} /> Back to Pregnancy Tips
                </button>
                <span className="tdp-breadcrumb-sep">/</span>
                <span className="tdp-breadcrumb-current">{tip.title}</span>
            </nav>

            <header className="mother-page-header">
                <div className="mother-page-header-content">
                    <button className="back-btn" onClick={() => navigate('/dashboard/user-tips')}>
                        <ArrowLeft size={18} />
                    </button>
                    <div className="mother-page-header-text">
                        <h1>{tip.title}</h1>
                        <p>{tip.category} • {tip.readTime}</p>
                    </div>
                </div>
                <div className="mother-page-header-actions">
                    <button
                        className={`tdp-action-btn ${isBookmarked ? 'bookmarked' : ''}`}
                        onClick={toggleBookmark}
                    >
                        {isBookmarked ? <BookmarkCheck size={16} /> : <Bookmark size={16} />}
                        {isBookmarked ? 'Saved' : 'Save'}
                    </button>
                </div>
            </header>

            {/* ── Article Content ── */}
            <div className="tdp-layout">
                <article className="tdp-article">
                    {tip.fullContent.map((section, i) => (
                        <div key={i} className="tdp-section">
                            <h2>{section.heading}</h2>
                            <p>{section.body}</p>
                        </div>
                    ))}

                    {/* Key Tip Callout */}
                    <div className="tdp-callout">
                        <div className="tdp-callout-icon">
                            <Star size={20} />
                        </div>
                        <div className="tdp-callout-body">
                            <strong>Health Reminder</strong>
                            <p>Always consult your midwife or doctor before making significant changes to your diet, exercise routine, or supplement intake. Every pregnancy is unique.</p>
                        </div>
                    </div>

                    {/* Sources Section */}
                    {tip.sources && tip.sources.length > 0 && (
                        <div className="tdp-sources-section">
                            <h3><BookOpen size={18} /> Sources & Credentialing</h3>
                            <p className="tdp-sources-intro">The information in this article is supported by these credible organizations and guidelines:</p>
                            <div className="tdp-sources-list">
                                {tip.sources.map((source, i) => (
                                    <a key={i} href={source.url} target="_blank" rel="noopener noreferrer" className="tdp-source-card">
                                        <div className="tdp-source-info">
                                            <strong>{source.name}</strong>
                                            <span>{source.title}</span>
                                        </div>
                                        <ExternalLink size={14} className="tdp-source-link-icon" />
                                    </a>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Completion Indicator */}
                    <div className="tdp-completed-bar">
                        <CheckCircle2 size={20} />
                        <span>You've completed reading this article! Great job taking care of yourself. 💪</span>
                    </div>
                </article>

                {/* ── Sidebar ── */}
                <aside className="tdp-sidebar">
                    <div className="tdp-sidebar-card">
                        <h3><Heart size={16} /> Quick Summary</h3>
                        <ul className="tdp-sidebar-list">
                            {tip.fullContent.map((s, i) => (
                                <li key={i}>
                                    <ChevronRight size={12} />
                                    {s.heading}
                                </li>
                            ))}
                        </ul>
                    </div>

                    <div className="tdp-sidebar-card tdp-sidebar-actions">
                        <h3>Actions</h3>
                        <button
                            className={`tdp-sidebar-btn ${isBookmarked ? 'bookmarked' : ''}`}
                            onClick={toggleBookmark}
                        >
                            {isBookmarked ? <BookmarkCheck size={15} /> : <Bookmark size={15} />}
                            {isBookmarked ? 'Saved to Bookmarks' : 'Save for Later'}
                        </button>
                        <button className="tdp-sidebar-btn">
                            <Share2 size={15} /> Share Article
                        </button>
                    </div>
                </aside>
            </div>

            {/* ── Related Articles ── */}
            <section className="tdp-related">
                <h2 className="tdp-related-title">You May Also Like</h2>
                <div className="tdp-related-grid">
                    {related.map(rel => (
                        <div
                            key={rel.id}
                            className="tdp-related-card"
                            onClick={() => navigate(`/dashboard/user-tips/${rel.id}`)}
                        >
                            <div className={`tdp-related-cover ${rel.colorClass}`}>
                                <div className="tdp-related-icon">{rel.icon}</div>
                            </div>
                            <div className="tdp-related-body">
                                <span className="tdp-related-cat">{rel.category}</span>
                                <h4>{rel.title}</h4>
                                <p>{rel.description}</p>
                                <span className="tdp-related-cta">
                                    Read <ChevronRight size={12} />
                                </span>
                            </div>
                        </div>
                    ))}
                </div>
            </section>
        </div>
    );
};

export default TipDetailPage;
