import React from 'react';
import { HeartPulse, AlertCircle, RefreshCw } from 'lucide-react';
import '../../styles/components/StaffPageLoader.css';

/**
 * Standardized full-page loading screen for DASMOM+ Staff Side.
 * Features the signature centered pulsing heartbeat animation with dusty rose theme.
 */
const StaffPageLoader = ({ 
    message = 'Loading...', 
    error = null, 
    onRetry = null,
    minHeight = '60vh'
}) => {
    if (error) {
        return (
            <div className="staff-loader-container staff-loader-error" style={{ minHeight }} role="alert">
                <div className="staff-loader-card">
                    <AlertCircle size={44} className="staff-loader-error-icon" />
                    <h3>Unable to load page</h3>
                    <p>
                        {typeof error === 'string' 
                            ? error 
                            : error?.message || 'A network or system error occurred while retrieving data.'}
                    </p>
                    {onRetry && (
                        <button type="button" className="staff-loader-retry-btn" onClick={onRetry}>
                            <RefreshCw size={15} /> Retry
                        </button>
                    )}
                </div>
            </div>
        );
    }

    return (
        <div className="staff-loader-container" style={{ minHeight }} role="status" aria-live="polite">
            <div className="staff-heartbeat-loader">
                <HeartPulse size={48} className="staff-pulse-icon" />
                <p className="staff-loader-message">{message}</p>
            </div>
        </div>
    );
};

export default StaffPageLoader;
