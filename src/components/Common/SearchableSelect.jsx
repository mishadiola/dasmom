import React, { useState, useRef, useEffect, useCallback, useId } from 'react';
import { createPortal } from 'react-dom';
import { Search, ChevronDown, X, Check, Loader2 } from 'lucide-react';

/**
 * SearchableSelect
 * Accessible, portal-rendered combobox / searchable dropdown for DASMOM+ forms.
 * - Prevents clipping in modals with overflow scroll containers.
 * - Real-time client search filtering as user types.
 * - Keyboard navigation (ArrowDown, ArrowUp, Enter, Escape).
 * - Mobile tap friendly with outside dismiss.
 * - Supports options with values, labels, and informative subtexts (e.g. stock count and unit).
 */
const SearchableSelect = ({
  id,
  value,
  onChange,
  options = [],
  placeholder = 'Select an option...',
  searchPlaceholder = 'Search...',
  disabled = false,
  loading = false,
  loadingText = 'Loading options...',
  emptyText = 'No options available',
  notFoundText = 'No matching options found',
  ariaLabel,
  className = '',
  clearable = true
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const [coords, setCoords] = useState({ top: 0, left: 0, width: 0, placeAbove: false });

  const triggerRef = useRef(null);
  const popoverRef = useRef(null);
  const searchInputRef = useRef(null);
  const generatedId = useId();
  const selectId = id || generatedId;

  // Filter options based on search query
  const filteredOptions = React.useMemo(() => {
    if (!search.trim()) return options;
    const query = search.toLowerCase().trim();
    return options.filter((opt) => {
      const label = typeof opt === 'string' ? opt : (opt.label || opt.value || '');
      const sub = typeof opt === 'object' ? (opt.subtext || '') : '';
      return label.toLowerCase().includes(query) || sub.toLowerCase().includes(query);
    });
  }, [options, search]);

  // Selected option display
  const selectedOption = React.useMemo(() => {
    return options.find((opt) => {
      const val = typeof opt === 'string' ? opt : opt.value;
      return String(val) === String(value);
    });
  }, [options, value]);

  const selectedLabel = selectedOption
    ? typeof selectedOption === 'string'
      ? selectedOption
      : selectedOption.label
    : '';

  // Calculate popover fixed position relative to trigger
  const updatePosition = useCallback(() => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const popoverMaxHeight = 240;
    const spaceBelow = window.innerHeight - rect.bottom;
    const placeAbove = spaceBelow < popoverMaxHeight && rect.top > popoverMaxHeight;

    const top = placeAbove ? rect.top - 4 : rect.bottom + 4;
    const left = rect.left;
    const width = rect.width;

    setCoords({
      top,
      left,
      width,
      placeAbove
    });
  }, []);

  // Handle open / close lifecycle
  useEffect(() => {
    if (!isOpen) {
      setSearch('');
      setHighlightedIndex(0);
      return;
    }

    updatePosition();
    // Focus search input after modal renders
    const focusTimer = setTimeout(() => {
      searchInputRef.current?.focus();
    }, 50);

    const handleScrollOrResize = () => {
      updatePosition();
    };

    const handlePointerDown = (e) => {
      if (
        triggerRef.current?.contains(e.target) ||
        popoverRef.current?.contains(e.target)
      ) {
        return;
      }
      setIsOpen(false);
    };

    window.addEventListener('scroll', handleScrollOrResize, true);
    window.addEventListener('resize', handleScrollOrResize);
    document.addEventListener('pointerdown', handlePointerDown);

    return () => {
      clearTimeout(focusTimer);
      window.removeEventListener('scroll', handleScrollOrResize, true);
      window.removeEventListener('resize', handleScrollOrResize);
      document.removeEventListener('pointerdown', handlePointerDown);
    };
  }, [isOpen, updatePosition]);

  // Keyboard navigation
  const handleKeyDown = (e) => {
    if (!isOpen) {
      if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        if (!disabled) setIsOpen(true);
      }
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setHighlightedIndex((prev) =>
          prev < filteredOptions.length - 1 ? prev + 1 : 0
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightedIndex((prev) =>
          prev > 0 ? prev - 1 : filteredOptions.length - 1
        );
        break;
      case 'Enter':
        e.preventDefault();
        if (filteredOptions[highlightedIndex]) {
          const item = filteredOptions[highlightedIndex];
          const val = typeof item === 'string' ? item : item.value;
          onChange(val, item);
          setIsOpen(false);
          triggerRef.current?.focus();
        }
        break;
      case 'Escape':
        e.preventDefault();
        setIsOpen(false);
        triggerRef.current?.focus();
        break;
      case 'Tab':
        setIsOpen(false);
        break;
      default:
        break;
    }
  };

  const handleSelectOption = (item) => {
    const val = typeof item === 'string' ? item : item.value;
    onChange(val, item);
    setIsOpen(false);
    triggerRef.current?.focus();
  };

  const handleClear = (e) => {
    e.stopPropagation();
    onChange('', null);
    setSearch('');
  };

  return (
    <div
      className={`searchable-select-container ${className}`.trim()}
      style={{ position: 'relative', width: '100%' }}
      onKeyDown={handleKeyDown}
    >
      <button
        ref={triggerRef}
        id={selectId}
        type="button"
        className={`searchable-select-trigger ${isOpen ? 'is-open' : ''}`}
        onClick={() => {
          if (!disabled) setIsOpen((prev) => !prev);
        }}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-label={ariaLabel || placeholder}
      >
        <span
          className="searchable-select-value"
          style={{
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            color: selectedLabel ? 'inherit' : '#9ca3af'
          }}
        >
          {selectedLabel || placeholder}
        </span>

        <span
          className="searchable-select-icons"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
            marginLeft: '8px',
            flexShrink: 0
          }}
        >
          {clearable && selectedLabel && !disabled && (
            <span
              role="button"
              tabIndex={0}
              className="searchable-select-clear-btn"
              onClick={handleClear}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  handleClear(e);
                }
              }}
              title="Clear selection"
              aria-label="Clear selection"
              style={{
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '2px',
                borderRadius: '50%',
                color: '#9ca3af',
                transition: 'color 0.15s'
              }}
            >
              <X size={13} />
            </span>
          )}
          <ChevronDown
            size={15}
            style={{
              color: '#9ca3af',
              transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
              transition: 'transform 0.2s ease'
            }}
          />
        </span>
      </button>

      {isOpen &&
        createPortal(
          <div
            ref={popoverRef}
            role="listbox"
            id={`${selectId}-listbox`}
            className="searchable-select-popover"
            style={{
              position: 'fixed',
              top: coords.placeAbove ? 'auto' : `${coords.top}px`,
              bottom: coords.placeAbove ? `${window.innerHeight - coords.top}px` : 'auto',
              left: `${coords.left}px`,
              width: `${coords.width}px`,
              background: '#ffffff',
              border: '1.5px solid #e2e8f0',
              borderRadius: '8px',
              boxShadow:
                '0 10px 25px -5px rgba(0, 0, 0, 0.12), 0 8px 10px -6px rgba(0, 0, 0, 0.08)',
              zIndex: 99999,
              display: 'flex',
              flexDirection: 'column',
              maxHeight: '260px',
              animation: 'searchablePopoverFadeIn 0.15s ease-out'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Search Input Box */}
            <div
              style={{
                padding: '8px',
                borderBottom: '1px solid #f1f5f9',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                background: '#fafbfc'
              }}
            >
              <Search size={14} style={{ color: '#94a3b8', flexShrink: 0 }} />
              <input
                ref={searchInputRef}
                type="text"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setHighlightedIndex(0);
                }}
                placeholder={searchPlaceholder}
                style={{
                  width: '100%',
                  border: 'none',
                  outline: 'none',
                  background: 'transparent',
                  fontSize: '12.5px',
                  color: '#1e293b',
                  padding: '2px 0'
                }}
                aria-label={searchPlaceholder}
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  style={{
                    border: 'none',
                    background: 'none',
                    padding: '2px',
                    cursor: 'pointer',
                    color: '#94a3b8',
                    display: 'flex',
                    alignItems: 'center'
                  }}
                  aria-label="Clear search"
                >
                  <X size={12} />
                </button>
              )}
            </div>

            {/* Options List */}
            <div
              className="searchable-select-options-list"
              style={{
                overflowY: 'auto',
                maxHeight: '200px',
                padding: '4px 0'
              }}
            >
              {loading ? (
                <div
                  style={{
                    padding: '16px 12px',
                    textAlign: 'center',
                    fontSize: '12px',
                    color: '#64748b',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px'
                  }}
                >
                  <Loader2 size={14} className="animate-spin" />
                  <span>{loadingText}</span>
                </div>
              ) : options.length === 0 ? (
                <div
                  style={{
                    padding: '16px 12px',
                    textAlign: 'center',
                    fontSize: '12px',
                    color: '#94a3b8',
                    fontStyle: 'italic'
                  }}
                >
                  {emptyText}
                </div>
              ) : filteredOptions.length === 0 ? (
                <div
                  style={{
                    padding: '16px 12px',
                    textAlign: 'center',
                    fontSize: '12px',
                    color: '#94a3b8',
                    fontStyle: 'italic'
                  }}
                >
                  {notFoundText}
                </div>
              ) : (
                filteredOptions.map((opt, idx) => {
                  const optVal = typeof opt === 'string' ? opt : opt.value;
                  const optLabel = typeof opt === 'string' ? opt : opt.label;
                  const optSubtext = typeof opt === 'object' ? opt.subtext : null;
                  const isSelected = String(optVal) === String(value);
                  const isHighlighted = idx === highlightedIndex;

                  return (
                    <div
                      key={`${optVal}-${idx}`}
                      role="option"
                      aria-selected={isSelected}
                      className={`searchable-select-option ${
                        isSelected ? 'is-selected' : ''
                      } ${isHighlighted ? 'is-highlighted' : ''}`}
                      onClick={() => handleSelectOption(opt)}
                      onMouseEnter={() => setHighlightedIndex(idx)}
                      style={{
                        padding: '8px 12px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '8px',
                        fontSize: '12.5px',
                        color: isSelected ? 'var(--color-rose, #803035)' : '#1e293b',
                        fontWeight: isSelected ? '600' : '400',
                        backgroundColor: isSelected
                          ? 'rgba(128, 48, 53, 0.08)'
                          : isHighlighted
                          ? '#f8fafc'
                          : 'transparent',
                        transition: 'background-color 0.1s ease'
                      }}
                    >
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div
                          style={{
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap'
                          }}
                        >
                          {optLabel}
                        </div>
                        {optSubtext && (
                          <div
                            style={{
                              fontSize: '11px',
                              color: isSelected ? 'var(--color-rose, #803035)' : '#64748b',
                              opacity: 0.85,
                              marginTop: '2px'
                            }}
                          >
                            {optSubtext}
                          </div>
                        )}
                      </div>
                      {isSelected && (
                        <Check
                          size={14}
                          style={{
                            color: 'var(--color-rose, #803035)',
                            flexShrink: 0
                          }}
                        />
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>,
          document.body
        )}
    </div>
  );
};

export default SearchableSelect;
