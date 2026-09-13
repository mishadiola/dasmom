import React from 'react';
import { X, Baby, Star, Heart, CheckCircle2 } from 'lucide-react';
import '../../styles/components/BabySizeModal.css';
import { useLanguage } from '../../context/LanguageContext';

const BabySizeModal = ({ week, data, onClose }) => {
    const { t } = useLanguage();
    return (
        <div className="bs-modal-overlay" onClick={onClose}>
            <div className="bs-modal" onClick={e => e.stopPropagation()}>
                <div className="bs-modal-header">
                    <div className="bs-header-info">
                        <h2>{t('baby_size_header').replace('{week}', week).replace('{name}', data.name)}</h2>
                        <p>{t('baby_size_growing')}</p>
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
                                <span className="bs-stat-label">{t('baby_size_length')}</span>
                                <span className="bs-stat-value">{data.length}</span>
                            </div>
                            <div className="bs-stat-card">
                                <span className="bs-stat-label">{t('baby_size_weight')}</span>
                                <span className="bs-stat-value">{data.weight}</span>
                            </div>
                        </div>
                    </div>

                    <div className="bs-content-section">
                        <h3><Star size={18} /> {t('baby_size_milestones')}</h3>
                        <ul className="bs-milestones-list">
                            <li><CheckCircle2 size={16} /> {data.fact}</li>
                            <li><CheckCircle2 size={16} /> {t('baby_size_milestone2')}</li>
                            <li><CheckCircle2 size={16} /> {t('baby_size_milestone3')}</li>
                        </ul>
                    </div>

                    <div className="bs-content-section">
                        <h3><Heart size={18} /> {t('baby_size_mommy_tips').replace('{week}', week)}</h3>
                        <div className="bs-tips-box">
                            <p><strong>{t('baby_size_nutrition')}</strong> {t('baby_size_nutrition_text')}</p>
                            <p><strong>{t('baby_size_comfort')}</strong> {t('baby_size_comfort_text')}</p>
                        </div>
                    </div>
                </div>

                <div className="bs-modal-footer">
                    <button className="bs-btn-primary" onClick={onClose}>
                        {t('baby_size_got_it')}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default BabySizeModal;
