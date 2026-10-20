import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Info } from 'lucide-react';
import './Legend.css';

/**
 * LegendInfo / Legend
 * Standardized icon-only info button with hover and accessible tap tooltip
 * displaying page-specific legend categories across DASMOM+ Staff Side.
 */
const LegendInfo = ({
    categories = [],
    className = '',
    ariaLabel = 'View legend',
    align = 'right'
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const [coords, setCoords] = useState({ top: 0, left: 0, placeAbove: false });
    const buttonRef = useRef(null);
    const popoverRef = useRef(null);
    const closeTimeoutRef = useRef(null);
    const isHoveringButtonRef = useRef(false);
    const isHoveringPopoverRef = useRef(false);

    const cancelCloseTimer = () => {
        if (closeTimeoutRef.current) {
            clearTimeout(closeTimeoutRef.current);
            closeTimeoutRef.current = null;
        }
    };

    const scheduleClose = (delay = 200) => {
        cancelCloseTimer();
        closeTimeoutRef.current = setTimeout(() => {
            if (!isHoveringButtonRef.current && !isHoveringPopoverRef.current) {
                setIsOpen(false);
            }
        }, delay);
    };

    const updatePosition = useCallback(() => {
        if (!buttonRef.current) return;
        const rect = buttonRef.current.getBoundingClientRect();
        if (rect.width === 0 && rect.height === 0) return;

        let popoverWidth = 280;
        if (popoverRef.current) {
            const measured = popoverRef.current.offsetWidth;
            if (measured > 0) {
                popoverWidth = Math.min(measured, window.innerWidth - 24);
            }
        } else {
            popoverWidth = Math.min(280, window.innerWidth - 24);
        }

        const estimatedHeight = popoverRef.current ? popoverRef.current.offsetHeight : 240;
        const spaceBelow = window.innerHeight - rect.bottom;
        const spaceAbove = rect.top;
        const placeAbove = spaceBelow < estimatedHeight + 16 && spaceAbove > spaceBelow;

        const top = placeAbove
            ? Math.max(12, rect.top - estimatedHeight - 8)
            : Math.min(window.innerHeight - 12 - estimatedHeight, rect.bottom + 8);

        let left = align === 'left' ? rect.left : rect.right - popoverWidth;
        if (left < 12) left = 12;
        if (left + popoverWidth > window.innerWidth - 12) {
            left = Math.max(12, window.innerWidth - 12 - popoverWidth);
        }

        setCoords({
            top,
            left,
            placeAbove
        });
    }, [align]);

    useEffect(() => {
        if (!isOpen) return;

        updatePosition();
        const animFrame = requestAnimationFrame(() => {
            updatePosition();
        });

        const handleScrollOrResize = () => {
            updatePosition();
        };

        const handlePointerDownOutside = (e) => {
            if (
                buttonRef.current?.contains(e.target) ||
                popoverRef.current?.contains(e.target)
            ) {
                return;
            }
            setIsOpen(false);
        };

        const handleKeyDown = (e) => {
            if (e.key === 'Escape') {
                setIsOpen(false);
                buttonRef.current?.focus();
            }
        };

        window.addEventListener('scroll', handleScrollOrResize, true);
        window.addEventListener('resize', handleScrollOrResize);
        document.addEventListener('pointerdown', handlePointerDownOutside);
        document.addEventListener('keydown', handleKeyDown);

        return () => {
            cancelAnimationFrame(animFrame);
            window.removeEventListener('scroll', handleScrollOrResize, true);
            window.removeEventListener('resize', handleScrollOrResize);
            document.removeEventListener('pointerdown', handlePointerDownOutside);
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [isOpen, updatePosition]);

    const handleButtonMouseEnter = () => {
        isHoveringButtonRef.current = true;
        cancelCloseTimer();
        setIsOpen(true);
    };

    const handleButtonMouseLeave = () => {
        isHoveringButtonRef.current = false;
        scheduleClose(220);
    };

    const handlePopoverMouseEnter = () => {
        isHoveringPopoverRef.current = true;
        cancelCloseTimer();
    };

    const handlePopoverMouseLeave = () => {
        isHoveringPopoverRef.current = false;
        scheduleClose(180);
    };

    const handleButtonClick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        setIsOpen(prev => !prev);
    };

    const handleButtonFocus = () => {
        cancelCloseTimer();
        setIsOpen(true);
    };

    const handleButtonBlur = (e) => {
        if (popoverRef.current && popoverRef.current.contains(e.relatedTarget)) {
            return;
        }
        scheduleClose(150);
    };

    if (!categories || categories.length === 0) return null;

    return (
        <div className={`shared-legend-container ${className}`.trim()}>
            <button
                ref={buttonRef}
                type="button"
                className={`shared-legend-btn ${isOpen ? 'active' : ''}`}
                onClick={handleButtonClick}
                onMouseEnter={handleButtonMouseEnter}
                onMouseLeave={handleButtonMouseLeave}
                onFocus={handleButtonFocus}
                onBlur={handleButtonBlur}
                aria-label={ariaLabel}
                aria-expanded={isOpen}
                aria-haspopup="dialog"
            >
                <Info size={16} className="shared-legend-icon" />
            </button>

            {isOpen && createPortal(
                <div
                    ref={popoverRef}
                    role="dialog"
                    aria-label={ariaLabel}
                    className="shared-legend-popover-portal"
                    onMouseEnter={handlePopoverMouseEnter}
                    onMouseLeave={handlePopoverMouseLeave}
                    style={{
                        position: 'fixed',
                        top: `${coords.top}px`,
                        left: `${coords.left}px`,
                        maxWidth: '340px',
                        minWidth: '220px',
                        width: 'max-content',
                        zIndex: 9999
                    }}
                >
                    <div className="shared-legend-header">
                        <Info size={13} className="shared-legend-header-icon" />
                        <span>Legend &amp; Guide</span>
                    </div>

                    <div className="shared-legend-body">
                        {categories.map((category, idx) => (
                            <div key={idx} className="shared-legend-category">
                                {category.title && (
                                    <div className="shared-legend-title">
                                        {category.title}
                                    </div>
                                )}
                                <div className="shared-legend-items">
                                    {category.items?.map((item, itemIdx) => (
                                        <span
                                            key={itemIdx}
                                            className={`shared-legend-badge ${item.className || ''}`}
                                            style={item.style || {}}
                                        >
                                            {item.icon && <span className="shared-legend-item-icon">{item.icon}</span>}
                                            {item.label}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
};

export const Legend = LegendInfo;
export { LegendInfo };
export default LegendInfo;
