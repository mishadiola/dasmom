import React from 'react';
import { X, Baby, Star, Heart, CheckCircle2 } from 'lucide-react';
import '../../styles/components/BabySizeModal.css';

const BabySizeModal = ({ week, data, onClose }) => {
    return (
        <div className="bs-modal-overlay" onClick={onClose}>
            <div className="bs-modal" onClick={e => e.stopPropagation()}>
                <div className="bs-modal-header">
                    <div className="bs-header-info">
                        <h2>Week {week}: {data.name} Size</h2>
                        <p>Your baby is growing beautifully!</p>
                    </div>
                    <button className="bs-close-btn" onClick={onClose}>
                        <X size={24} />
                    </button>
                </div>

                <div className="bs-modal-body">
                    <div className="bs-main-info">
                        <div className={`bs-image-box ${data.color}`}>
                            {data.image ? (
                                <img src={data.image} alt={data.name} />
                            ) : (
                                <span className="bs-emoji-large">{data.emoji}</span>
                            )}
                        </div>
                        <div className="bs-stats-column">
                            <div className="bs-stat-card">
                                <span className="bs-stat-label">Approx. Length</span>
                                <span className="bs-stat-value">{data.length}</span>
                            </div>
                            <div className="bs-stat-card">
                                <span className="bs-stat-label">Approx. Weight</span>
                                <span className="bs-stat-value">{data.weight}</span>
                            </div>
                        </div>
                    </div>

                    <div className="bs-content-section">
                        <h3><Star size={18} /> Developmental Milestones</h3>
                        <ul className="bs-milestones-list">
                            <li><CheckCircle2 size={16} /> {data.fact}</li>
                            <li><CheckCircle2 size={16} /> Major organs are continuing to mature and function.</li>
                            <li><CheckCircle2 size={16} /> The baby is becoming more active and responsive to stimuli.</li>
                        </ul>
                    </div>

                    <div className="bs-content-section">
                        <h3><Heart size={18} /> Mommy Tips for Week {week}</h3>
                        <div className="bs-tips-box">
                            <p><strong>Nutrition:</strong> Keep up with your prenatal vitamins and stay hydrated. Focus on iron-rich foods this week.</p>
                            <p><strong>Comfort:</strong> As your baby grows, try using extra pillows for support while sleeping.</p>
                        </div>
                    </div>
                </div>

                <div className="bs-modal-footer">
                    <button className="bs-btn-primary" onClick={onClose}>
                        Got it, thanks!
                    </button>
                </div>
            </div>
        </div>
    );
};

export default BabySizeModal;
