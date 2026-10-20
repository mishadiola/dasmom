import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
    ArrowLeft, BookOpen, Bookmark, BookmarkCheck,
    CheckCircle2, Clock, ChevronRight, Heart,
    Star, ShieldCheck, ExternalLink
} from 'lucide-react';
import { TIPS_DATA, CATEGORY_IMAGES, CATEGORY_COLOR_CLASSES } from './PregnancyTips';
import { useLanguage } from '../../context/LanguageContext';
import '../../styles/pages/TipDetailPage.css';
import { isAndroidApp } from '../../services/secureStorage';

const LS_BOOKMARKS = 'pt_bookmarks';
const LS_READ = 'pt_read';

const getLS = (key) => {
    if (isAndroidApp()) return [];
    try { return JSON.parse(localStorage.getItem(key)) || []; }
    catch { return []; }
};
const setLS = (key, val) => {
    if (!isAndroidApp()) localStorage.setItem(key, JSON.stringify(val));
};

/**
 * Parses article text into structured paragraphs, bullet lists, and numbered lists.
 * Preserves all original wording and punctuation without losing any content.
 */
const renderArticleBody = (bodyText) => {
    if (!bodyText || typeof bodyText !== 'string') return null;

    // Normalize Windows CRLF newlines to \n
    const normalized = bodyText.replace(/\r\n/g, '\n').trim();
    if (!normalized) return null;

    // Regex matchers for list items
    const bulletRegex = /^[\u2022\u2023\u25E6\u2043\u2219\*\-]\s*(.*)$/;
    const numberedRegex = /^(\d+[\.\)])\s+(.*)$/;

    // Break into logical blocks by double (or more) newlines first
    const rawBlocks = normalized.split(/\n{2,}/);
    const elements = [];

    rawBlocks.forEach((block, blockIdx) => {
        const lines = block.split('\n').map(l => l.trim()).filter(Boolean);
        if (lines.length === 0) return;

        let currentListType = null; // 'ul' | 'ol'
        let currentListItems = [];

        const flushCurrentList = () => {
            if (currentListType && currentListItems.length > 0) {
                const listKey = `b${blockIdx}-list-${elements.length}`;
                if (currentListType === 'ul') {
                    elements.push(
                        <ul key={listKey} className="tdp-bullet-list">
                            {currentListItems.map((item, itemIdx) => (
                                <li key={itemIdx}>{item}</li>
                            ))}
                        </ul>
                    );
                } else if (currentListType === 'ol') {
                    elements.push(
                        <ol key={listKey} className="tdp-numbered-list">
                            {currentListItems.map((item, itemIdx) => (
                                <li key={itemIdx}>{item}</li>
                            ))}
                        </ol>
                    );
                }
                currentListType = null;
                currentListItems = [];
            }
        };

        lines.forEach((line, lineIdx) => {
            const bulletMatch = line.match(bulletRegex);
            const numberedMatch = line.match(numberedRegex);

            if (bulletMatch) {
                if (currentListType && currentListType !== 'ul') {
                    flushCurrentList();
                }
                currentListType = 'ul';
                currentListItems.push(bulletMatch[1]);
            } else if (numberedMatch) {
                if (currentListType && currentListType !== 'ol') {
                    flushCurrentList();
                }
                currentListType = 'ol';
                currentListItems.push(numberedMatch[2]);
            } else {
                // Regular line or standalone text
                flushCurrentList();
                elements.push(
                    <p key={`b${blockIdx}-p-${lineIdx}`} className="tdp-paragraph">
                        {line}
                    </p>
                );
            }
        });

        // Flush any remaining list at end of block
        flushCurrentList();
    });

    return elements;
};

const TipDetailPage = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const { t } = useLanguage();

    const tip = TIPS_DATA.find(t => t.id === id);

    const [bookmarks, setBookmarks] = useState(() => getLS(LS_BOOKMARKS));
    const [readIds, setReadIds] = useState(() => getLS(LS_READ));
    const [isTransitioning, setIsTransitioning] = useState(false);

    // Scroll to top of both window and any parent scrollable containers
    const scrollToTop = () => {
        // 1. Window scroll
        window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
        if (document.documentElement) document.documentElement.scrollTop = 0;
        if (document.body) document.body.scrollTop = 0;

        // 2. DashboardLayout or mother layout scrollable containers
        const scrollContainers = document.querySelectorAll(
            '.page-content, #main-content, .dashboard-main, .main-layout, .mother-layout-content'
        );
        scrollContainers.forEach(container => {
            if (container) {
                container.scrollTo({ top: 0, left: 0, behavior: 'instant' });
                container.scrollTop = 0;
            }
        });
    };

    // Reset scroll and mark as read whenever article ID changes
    useEffect(() => {
        if (!tip) return;

        // Immediate scroll reset
        scrollToTop();

        // Brief subtle transition state
        setIsTransitioning(true);
        const timer = setTimeout(() => {
            setIsTransitioning(false);
            scrollToTop();
        }, 120);

        if (!readIds.includes(id)) {
            const updated = [...readIds, id];
            setReadIds(updated);
            setLS(LS_READ, updated);
        }

        return () => clearTimeout(timer);
    }, [id]);

    if (!tip) {
        return (
            <div className="tdp-not-found">
                <BookOpen size={64} />
                <h2>{t('tips_not_found')}</h2>
                <button onClick={() => navigate('/mother-home/user-tips')}>
                    <ArrowLeft size={16} /> {t('tips_back')}
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

    // Related articles: same category prioritized, exclude current
    const related = TIPS_DATA
        .filter(t => t.id !== id && (t.category === tip.category || t.id !== id))
        .slice(0, 3);

    const handleSelectRelated = (relatedId) => {
        if (relatedId === id) return;
        setIsTransitioning(true);
        navigate(`/mother-home/user-tips/${relatedId}`);
    };

    return (
        <div className={`tdp-page ${isTransitioning ? 'tdp-page-transitioning' : ''}`}>
            {/* ── Breadcrumb ── */}
            <nav className="tdp-breadcrumb">
                <button className="tdp-back" onClick={() => navigate('/mother-home/user-tips')}>
                    <ArrowLeft size={16} /> {t('tips_back')}
                </button>
                <span className="tdp-breadcrumb-sep">/</span>
                <span className="tdp-breadcrumb-current">{tip.title}</span>
            </nav>

            <div className="page-header">
                <div>
                    <h1 className="page-title">
                        {tip.icon ? <span className="header-icon">{tip.icon}</span> : <BookOpen size={22} className="header-icon" />}
                        {tip.title}
                    </h1>
                    <p className="page-subtitle">{tip.category} • {tip.readTime}</p>
                </div>
                <div className="header-actions" style={{ display: 'flex', gap: '8px' }}>

                    <button
                        className="btn btn-outline"
                        style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                        onClick={toggleBookmark}
                    >
                        {isBookmarked ? <BookmarkCheck size={16} /> : <Bookmark size={16} />}
                        {isBookmarked ? t('tips_saved') : t('tips_save')}
                    </button>
                </div>
            </div>

            {/* ── Article Content ── */}
            <div className="tdp-layout">
                <article className="tdp-article">
                    {tip.fullContent.map((section, i) => (
                        <div key={i} className="tdp-section">
                            <h2>{section.heading}</h2>
                            <div className="tdp-section-content">
                                {renderArticleBody(section.body)}
                            </div>
                        </div>
                    ))}

                    {/* Key Tip Callout */}
                    <div className="tdp-callout">
                        <div className="tdp-callout-icon">
                            <Star size={20} />
                        </div>
                        <div className="tdp-callout-body">
                            <strong>{t('tips_health_reminder')}</strong>
                            <p>{t('tips_health_reminder_desc')}</p>
                        </div>
                    </div>

                    {/* Sources Section */}
                    {tip.sources && tip.sources.length > 0 && (
                        <div className="tdp-sources-section">
                            <h3><BookOpen size={18} /> {t('tips_sources')}</h3>
                            <p className="tdp-sources-intro">{t('tips_sources_desc')}</p>
                            <div className="tdp-sources-list">
                                {tip.sources.map((source, i) => (
                                    <a 
                                        key={i} 
                                        href={source.url} 
                                        target="_blank" 
                                        rel="noopener noreferrer" 
                                        className="tdp-source-card"
                                        onClick={(e) => e.currentTarget.blur()}
                                    >
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
                        <span>{t('tips_completed_read')}</span>
                    </div>
                </article>

                {/* ── Sidebar ── */}
                <aside className="tdp-sidebar">
                    <div className="tdp-sidebar-card">
                        <h3><Heart size={16} /> {t('tips_quick_summary')}</h3>
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
                        <h3>{t('tips_actions')}</h3>
                        <button
                            className={`tdp-sidebar-btn ${isBookmarked ? 'bookmarked' : ''}`}
                            onClick={toggleBookmark}
                        >
                            {isBookmarked ? <BookmarkCheck size={15} /> : <Bookmark size={15} />}
                            {isBookmarked ? t('tips_saved_bookmarks') : t('tips_save_later')}
                        </button>
                    </div>
                </aside>
            </div>

            {/* ── Related Articles ── */}
            <section className="tdp-related">
                <h2 className="tdp-related-title">{t('tips_also_like')}</h2>
                <div className="tdp-related-grid">
                    {related.map(rel => (
                        <div
                            key={rel.id}
                            className="tdp-related-card"
                            onClick={() => handleSelectRelated(rel.id)}
                        >
                            <div className={`tdp-related-cover ${CATEGORY_COLOR_CLASSES[rel.category] || rel.colorClass}`}>
                                {CATEGORY_IMAGES[rel.category] && (
                                    <img
                                        src={CATEGORY_IMAGES[rel.category]}
                                        alt={rel.category}
                                        className="tdp-related-cover-img"
                                    />
                                )}
                                <div className="tdp-related-icon">{rel.icon}</div>
                            </div>
                            <div className="tdp-related-body">
                                <span className="tdp-related-cat">{rel.category}</span>
                                <h4>{rel.title}</h4>
                                <p>{rel.description}</p>
                                <span className="tdp-related-cta">
                                    {t('tips_read')} <ChevronRight size={12} />
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
