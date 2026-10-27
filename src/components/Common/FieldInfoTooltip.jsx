import React, { useState, useRef, useEffect, useCallback, useId } from 'react';
import { createPortal } from 'react-dom';
import { Info } from 'lucide-react';

/**
 * FieldInfoTooltip
 * Standardized accessible info tooltip for form field labels across DASMOM+ Staff Side.
 * - Rendered via createPortal to prevent clipping behind modals or scroll containers.
 * - Supports hover and keyboard focus on desktop.
 * - Supports tap to toggle and tap-outside to dismiss on mobile.
 * - Fully accessible with proper ARIA attributes and Escape key dismissal.
 */
const FieldInfoTooltip = ({
  title = 'Maximum Stock Capacity',
  text,
  ariaLabel,
  className = '',
  iconSize = 14
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [coords, setCoords] = useState({ top: 0, left: 0, placeAbove: true, arrowLeft: 0 });
  const buttonRef = useRef(null);
  const popoverRef = useRef(null);
  const pointerTypeRef = useRef(null);
  const tooltipId = useId();

  const updatePosition = useCallback(() => {
    if (!buttonRef.current) return;
    const rect = buttonRef.current.getBoundingClientRect();
    const popoverWidth = Math.min(290, window.innerWidth - 32);
    const estimatedHeight = 120; // approximate popover height

    // Determine whether to place above or below based on viewport space
    const spaceAbove = rect.top;
    const placeAbove = spaceAbove >= estimatedHeight + 16;

    let top = placeAbove ? rect.top - 8 : rect.bottom + 8;

    // Center horizontally on button, clamped to viewport margins
    let left = rect.left + rect.width / 2 - popoverWidth / 2;
    if (left < 16) left = 16;
    if (left + popoverWidth > window.innerWidth - 16) {
      left = window.innerWidth - 16 - popoverWidth;
    }

    // Arrow relative position inside the popover
    const buttonCenter = rect.left + rect.width / 2;
    let arrowLeft = buttonCenter - left;
    arrowLeft = Math.max(14, Math.min(arrowLeft, popoverWidth - 14));

    setCoords({
      top,
      left,
      width: popoverWidth,
      placeAbove,
      arrowLeft
    });
  }, []);

  useEffect(() => {
    if (!isOpen) return;

    updatePosition();

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
      window.removeEventListener('scroll', handleScrollOrResize, true);
      window.removeEventListener('resize', handleScrollOrResize);
      document.removeEventListener('pointerdown', handlePointerDownOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, updatePosition]);

  return (
    <span
      className={`field-info-tooltip-wrap ${className}`.trim()}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        verticalAlign: 'middle',
        position: 'relative'
      }}
      onMouseEnter={() => setIsOpen(true)}
      onMouseLeave={() => setIsOpen(false)}
    >
      <button
        ref={buttonRef}
        type="button"
        className="field-info-icon-btn"
        onPointerDown={(event) => {
          pointerTypeRef.current = event.pointerType;
        }}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          if (pointerTypeRef.current === 'touch' || e.detail === 0) {
            setIsOpen((prev) => !prev);
          }
          pointerTypeRef.current = null;
        }}
        onFocus={(event) => {
          if (event.currentTarget.matches(':focus-visible')) {
            setIsOpen(true);
          }
        }}
        onBlur={(e) => {
          if (!popoverRef.current?.contains(e.relatedTarget)) {
            setIsOpen(false);
          }
        }}
        aria-label={ariaLabel || `${title} information`}
        aria-expanded={isOpen}
        aria-describedby={isOpen ? tooltipId : undefined}
        style={{
          background: 'none',
          border: 'none',
          padding: '2px',
          margin: 0,
          cursor: 'pointer',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--color-primary, #8c757a)',
          opacity: 0.85,
          borderRadius: '50%',
          outline: 'none',
          lineHeight: 1,
          transition: 'opacity 0.15s ease, transform 0.15s ease'
        }}
      >
        <Info size={iconSize} />
      </button>

      {isOpen &&
        createPortal(
          <div
            id={tooltipId}
            ref={popoverRef}
            role="tooltip"
            className="field-info-popover-portal"
            style={{
              position: 'fixed',
              top: coords.placeAbove ? 'auto' : `${coords.top}px`,
              bottom: coords.placeAbove ? `${window.innerHeight - coords.top}px` : 'auto',
              left: `${coords.left}px`,
              width: `${coords.width}px`,
              background: '#ffffff',
              border: '1px solid #e2e8f0',
              borderRadius: '8px',
              padding: '12px 14px',
              boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.12), 0 8px 10px -6px rgba(0, 0, 0, 0.08)',
              zIndex: 99999,
              pointerEvents: 'auto',
              textAlign: 'left',
              textTransform: 'none',
              letterSpacing: 'normal',
              animation: 'fieldTooltipFadeIn 0.15s ease-out'
            }}
            onClick={(e) => e.stopPropagation()}
            onMouseEnter={() => setIsOpen(true)}
            onMouseLeave={() => setIsOpen(false)}
          >
            {title && (
              <div
                style={{
                  fontSize: '12.5px',
                  fontWeight: '700',
                  color: '#1f2937',
                  marginBottom: '4px',
                  letterSpacing: '0.2px'
                }}
              >
                {title}
              </div>
            )}
            <div
              style={{
                fontSize: '12px',
                lineHeight: '1.45',
                color: '#4b5563',
                fontWeight: '400'
              }}
            >
              {text}
            </div>

            {/* Pointer Arrow */}
            <div
              style={{
                position: 'absolute',
                left: `${coords.arrowLeft}px`,
                transform: 'translateX(-50%)',
                ...(coords.placeAbove
                  ? {
                      top: '100%',
                      width: 0,
                      height: 0,
                      borderLeft: '6px solid transparent',
                      borderRight: '6px solid transparent',
                      borderTop: '6px solid #ffffff'
                    }
                  : {
                      bottom: '100%',
                      width: 0,
                      height: 0,
                      borderLeft: '6px solid transparent',
                      borderRight: '6px solid transparent',
                      borderBottom: '6px solid #ffffff'
                    })
              }}
            />
          </div>,
          document.body
        )}
    </span>
  );
};

export default FieldInfoTooltip;
