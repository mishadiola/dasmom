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
    errorTitle = 'Unable to load page',
    onRetry = null,
    minHeight = '60vh',
    className = '',
    iconSize = 48
}) => {
    if (error) {
        return (
            <div className={`staff-loader-container staff-loader-error ${className}`.trim()} style={{ minHeight }} role="alert">
                <div className="staff-loader-card">
                    <AlertCircle size={44} className="staff-loader-error-icon" />
                    <h3>{errorTitle}</h3>
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
        <div className={`staff-loader-container ${className}`.trim()} style={{ minHeight }} role="status" aria-live="polite">
            <div className="staff-heartbeat-loader">
                <HeartPulse size={iconSize} className="staff-pulse-icon" />
                <p className="staff-loader-message">{message}</p>
            </div>
        </div>
    );
};

export default StaffPageLoader;
