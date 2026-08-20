import React, { useState, useRef, useEffect } from 'react';
import { Info } from 'lucide-react';
import './Legend.css';

const Legend = ({ categories, className = '' }) => {
    const [isOpen, setIsOpen] = useState(false);
    const popoverRef = useRef(null);
    const buttonRef = useRef(null);

    // Close on click outside and handle positioning
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (
                popoverRef.current && !popoverRef.current.contains(event.target) &&
                buttonRef.current && !buttonRef.current.contains(event.target)
            ) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    useEffect(() => {
        if (isOpen && popoverRef.current) {
            // Reset to right-aligned default
            popoverRef.current.style.right = '0';
            popoverRef.current.style.left = 'auto';
            
            const rect = popoverRef.current.getBoundingClientRect();
            
            // If it overflows the left edge of the viewport
            if (rect.left < 10) {
                popoverRef.current.style.right = 'auto';
                popoverRef.current.style.left = '0';
            }
        }
    }, [isOpen]);

    return (
        <div className={`shared-legend-container ${className}`}>
            <button 
                ref={buttonRef}
                className={`shared-legend-btn ${isOpen ? 'active' : ''}`}
                onClick={() => setIsOpen(!isOpen)}
            >
                <Info size={14} className="shared-legend-icon" />
                Legend
            </button>
            
            {isOpen && (
                <div ref={popoverRef} className="shared-legend-popover">
                    {categories.map((category, idx) => (
                        <div key={idx} className="shared-legend-category">
                            {category.title && (
                                <div className="shared-legend-title">
                                    {category.title}
                                </div>
                            )}
                            <div className="shared-legend-items">
                                {category.items.map((item, itemIdx) => (
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
            )}
        </div>
    );
};

export default Legend;
