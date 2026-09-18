import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { X, FileSpreadsheet, FileText, AlertCircle } from 'lucide-react';
import '../styles/components/ExportModal.css';

const ExportModal = ({ isOpen, onClose, onExport, hideDateRange = false }) => {
    const [datePreset, setDatePreset] = useState('This Month');
    const [customFrom, setCustomFrom] = useState('');
    const [customTo, setCustomTo] = useState('');
    const [format, setFormat] = useState('excel');
    const [error, setError] = useState('');

    useEffect(() => {
        if (isOpen) {
            setDatePreset('This Month');
            setCustomFrom('');
            setCustomTo('');
            setFormat('excel');
            setError('');
        }
    }, [isOpen]);

    if (!isOpen) return null;

    const handleExportClick = () => {
        let fromDate = null;
        let toDate = null;
        const now = new Date();

        if (datePreset === 'This Month') {
            fromDate = new Date(now.getFullYear(), now.getMonth(), 1);
            toDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
        } else if (datePreset === 'This Year') {
            fromDate = new Date(now.getFullYear(), 0, 1);
            toDate = new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999);
        } else if (datePreset === 'All Time') {
            fromDate = null;
            toDate = null;
        } else if (datePreset === 'Custom Range') {
            if (!customFrom || !customTo) {
                setError('Both From and To dates are required.');
                return;
            }
            fromDate = new Date(`${customFrom}T00:00:00`);
            toDate = new Date(`${customTo}T23:59:59.999`);
            
            if (fromDate > toDate) {
                setError('From date cannot be later than To date.');
                return;
            }
        }

        setError('');
        
        let reportPeriodText = datePreset;
        if (datePreset === 'Custom Range') {
            reportPeriodText = `${fromDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })} - ${toDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`;
        }

        onExport({
            format,
            dateRange: {
                from: fromDate,
                to: toDate
            },
            reportPeriodText
        });
        onClose();
    };

    return ReactDOM.createPortal(
        <div className="export-modal-overlay" onClick={onClose}>
            <div className="export-modal" onClick={e => e.stopPropagation()}>
                <div className="export-modal-header">
                    <h3>Export Report</h3>
                    <button className="export-modal-close" onClick={onClose}>
                        <X size={18} />
                    </button>
                </div>
                
                <div className="export-modal-body">
                    {!hideDateRange && (
                        <div className="export-modal-section">
                            <label className="export-modal-label">Date Range</label>
                            <div className="export-date-presets">
                            <button 
                                className={`export-preset-btn ${datePreset === 'This Month' ? 'active' : ''}`}
                                onClick={() => { setDatePreset('This Month'); setError(''); }}
                            >
                                This Month
                            </button>
                            <button 
                                className={`export-preset-btn ${datePreset === 'This Year' ? 'active' : ''}`}
                                onClick={() => { setDatePreset('This Year'); setError(''); }}
                            >
                                This Year
                            </button>
                            <button 
                                className={`export-preset-btn ${datePreset === 'All Time' ? 'active' : ''}`}
                                onClick={() => { setDatePreset('All Time'); setError(''); }}
                            >
                                All Time
                            </button>
                            <button 
                                className={`export-preset-btn ${datePreset === 'Custom Range' ? 'active' : ''}`}
                                onClick={() => { setDatePreset('Custom Range'); setError(''); }}
                            >
                                Custom Range
                            </button>
                        </div>
                        
                        {datePreset === 'Custom Range' && (
                            <div className="export-custom-dates">
                                <div className="export-date-field">
                                    <label>From</label>
                                    <input 
                                        type="date" 
                                        value={customFrom} 
                                        onChange={e => { setCustomFrom(e.target.value); setError(''); }} 
                                    />
                                </div>
                                <div className="export-date-field">
                                    <label>To</label>
                                    <input 
                                        type="date" 
                                        value={customTo} 
                                        min={customFrom}
                                        onChange={e => { setCustomTo(e.target.value); setError(''); }} 
                                    />
                                </div>
                            </div>
                        )}
                            {error && (
                                <div className="export-error-msg">
                                    <AlertCircle size={14} /> {error}
                                </div>
                            )}
                        </div>
                    )}

                    <div className="export-modal-section">
                        <label className="export-modal-label">Export Format</label>
                        <div className="export-format-options">
                            <div 
                                className={`export-format-card ${format === 'excel' ? 'active' : ''}`}
                                onClick={() => setFormat('excel')}
                            >
                                <FileSpreadsheet size={24} color={format === 'excel' ? '#b9818a' : '#94a3b8'} />
                                <div style={{ textAlign: 'center' }}>
                                    <p className="export-format-title">Excel</p>
                                    <p className="export-format-ext">.xlsx</p>
                                </div>
                            </div>
                            <div 
                                className={`export-format-card ${format === 'pdf' ? 'active' : ''}`}
                                onClick={() => setFormat('pdf')}
                            >
                                <FileText size={24} color={format === 'pdf' ? '#b9818a' : '#94a3b8'} />
                                <div style={{ textAlign: 'center' }}>
                                    <p className="export-format-title">PDF</p>
                                    <p className="export-format-ext">.pdf</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="export-modal-footer">
                    <button className="export-cancel-btn" onClick={onClose}>
                        Cancel
                    </button>
                    <button className="export-submit-btn" onClick={handleExportClick}>
                        Export
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
};

export default ExportModal;
