import React from 'react';
import { MonitorSmartphone, Download, X } from 'lucide-react';

const InstallAppModal = ({ isOpen, onInstall, onClose, isDesktop = false }) => {
  if (!isOpen) return null;

  return (
    <div className="system-modal-overlay" onClick={onClose}>
      <div className="system-modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="system-modal-icon success">
          {isDesktop ? <MonitorSmartphone size={28} /> : <Download size={28} />}
        </div>
        <h2 className="system-modal-title">{isDesktop ? 'Use the app on your computer' : 'Install DasMom+'}</h2>
        <p className="system-modal-text">
          {isDesktop
            ? 'Open the app in Chrome and use the install option in the browser menu for a faster, cleaner experience on your desktop.'
            : 'Install DasMom+ on your device to access your schedule and reminders quickly, even when the app is closed.'}
        </p>
        <div className="system-modal-actions">
          {!isDesktop && <button className="system-btn-confirm" onClick={onInstall}>Install app</button>}
          {isDesktop && <button className="system-btn-confirm" onClick={onClose}>Close</button>}
          <button className="system-btn-cancel" onClick={onClose}>{isDesktop ? 'Learn more later' : 'Not now'}</button>
        </div>
      </div>
    </div>
  );
};

export default InstallAppModal;
