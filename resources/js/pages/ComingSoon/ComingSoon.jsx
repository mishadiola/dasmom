import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Clock } from 'lucide-react';
import '../../styles/pages/ComingSoon.css';

const ComingSoon = ({ title }) => {
    const navigate = useNavigate();

    return (
        <div className="coming-soon-container">
            <div className="coming-soon-card">
                <div className="coming-soon-icon">
                    <Clock size={40} />
                </div>
                <h1 className="coming-soon-title">
                    {title || 'Coming Soon'}
                </h1>
                <p className="coming-soon-text">
                    We're working hard to bring you this feature.<br />
                    Stay tuned for updates!
                </p>
                <button
                    className="btn btn-outline coming-soon-btn"
                    onClick={() => navigate('/dashboard')}
                >
                    Return to Dashboard
                </button>
            </div>
        </div>
    );
};

export default ComingSoon;
