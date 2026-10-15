import React from 'react';
import { AlertCircle, RefreshCw, Home } from 'lucide-react';
import '../../styles/components/StaffPageLoader.css';

class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error) {
        return { hasError: true, error };
    }

    componentDidCatch(error, errorInfo) {
        console.error('DASMOM ErrorBoundary caught an error:', error, errorInfo);
    }

    handleReload = () => {
        this.setState({ hasError: false, error: null });
        window.location.reload();
    };

    handleGoHome = () => {
        this.setState({ hasError: false, error: null });
        window.location.href = '/';
    };

    render() {
        if (this.state.hasError) {
            return (
                <div 
                    className="staff-loader-container staff-loader-error" 
                    style={{ minHeight: '100vh', padding: '24px', background: '#fdfbfa' }}
                    role="alert"
                >
                    <div className="staff-loader-card" style={{ maxWidth: '480px', width: '100%' }}>
                        <AlertCircle size={48} className="staff-loader-error-icon" />
                        <h2>Something went wrong</h2>
                        <p>
                            {this.state.error?.message || 'An unexpected error occurred while rendering the page.'}
                        </p>
                        <div style={{ display: 'flex', gap: '10px', marginTop: '12px', flexWrap: 'wrap', justifyContent: 'center' }}>
                            <button 
                                type="button" 
                                className="staff-loader-retry-btn" 
                                onClick={this.handleReload}
                            >
                                <RefreshCw size={15} /> Reload Page
                            </button>
                            <button 
                                type="button" 
                                className="staff-loader-retry-btn" 
                                style={{ background: '#4a3042' }}
                                onClick={this.handleGoHome}
                            >
                                <Home size={15} /> Back to Home
                            </button>
                        </div>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}

export default ErrorBoundary;
