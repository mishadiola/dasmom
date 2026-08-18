import React, { createContext, useContext, useState, useCallback } from 'react';
import { AlertCircle, CheckCircle2, Info, LogOut, Trash2, Archive, AlertTriangle } from 'lucide-react';
import '../styles/components/SystemModal.css';

const ModalContext = createContext(null);

export const useModal = () => {
    const context = useContext(ModalContext);
    if (!context) {
        throw new Error('useModal must be used within a ModalProvider');
    }
    return context;
};

export const ModalProvider = ({ children }) => {
    const [modalState, setModalState] = useState({
        isOpen: false,
        type: 'alert', // 'alert' or 'confirm'
        iconType: 'info', // 'info', 'warning', 'danger', 'logout', 'archive', 'delete'
        title: '',
        text: '',
        confirmText: 'OK',
        cancelText: 'Cancel',
        onConfirm: null,
        onCancel: null
    });

    const getIcon = (type) => {
        switch (type) {
            case 'warning': return <AlertTriangle size={28} />;
            case 'danger': return <AlertCircle size={28} />;
            case 'delete': return <Trash2 size={28} />;
            case 'archive': return <Archive size={28} />;
            case 'logout': return <LogOut size={28} />;
            case 'success': return <CheckCircle2 size={28} />;
            default: return <Info size={28} />;
        }
    };

    const getIconClass = (type) => {
        if (['danger', 'delete', 'logout'].includes(type)) return 'danger';
        if (['warning', 'archive'].includes(type)) return 'warning';
        if (type === 'success') return 'success';
        return 'info';
    };

    const alert = useCallback((options) => {
        return new Promise((resolve) => {
            setModalState({
                isOpen: true,
                type: 'alert',
                iconType: options.iconType || 'info',
                title: options.title || 'Notification',
                text: options.text || '',
                confirmText: options.confirmText || 'OK',
                cancelText: '',
                onConfirm: () => {
                    setModalState(s => ({ ...s, isOpen: false }));
                    resolve(true);
                },
                onCancel: () => {
                    setModalState(s => ({ ...s, isOpen: false }));
                    resolve(true);
                }
            });
        });
    }, []);

    const confirm = useCallback((options) => {
        return new Promise((resolve) => {
            setModalState({
                isOpen: true,
                type: 'confirm',
                iconType: options.iconType || 'warning',
                title: options.title || 'Confirm',
                text: options.text || '',
                confirmText: options.confirmText || 'Confirm',
                cancelText: options.cancelText || 'Cancel',
                onConfirm: () => {
                    setModalState(s => ({ ...s, isOpen: false }));
                    resolve(true);
                },
                onCancel: () => {
                    setModalState(s => ({ ...s, isOpen: false }));
                    resolve(false);
                }
            });
        });
    }, []);

    const handleBackdropClick = (e) => {
        if (modalState.type === 'alert') {
            modalState.onConfirm?.();
        } else {
            modalState.onCancel?.();
        }
    };

    return (
        <ModalContext.Provider value={{ alert, confirm }}>
            {children}
            
            {modalState.isOpen && (
                <div className="system-modal-overlay" onClick={handleBackdropClick}>
                    <div className="system-modal-card" onClick={e => e.stopPropagation()}>
                        <div className={`system-modal-icon ${getIconClass(modalState.iconType)}`}>
                            {getIcon(modalState.iconType)}
                        </div>
                        <h2 className="system-modal-title">{modalState.title}</h2>
                        <p className="system-modal-text">{modalState.text}</p>
                        <div className="system-modal-actions">
                            {modalState.type === 'confirm' && (
                                <button 
                                    className="system-btn-cancel" 
                                    onClick={() => modalState.onCancel?.()}
                                >
                                    {modalState.cancelText}
                                </button>
                            )}
                            <button 
                                className="system-btn-confirm" 
                                onClick={() => modalState.onConfirm?.()}
                            >
                                {modalState.confirmText}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </ModalContext.Provider>
    );
};
