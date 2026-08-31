import React from 'react';
import { BellRing, X } from 'lucide-react';

const NotificationPermissionModal = ({ isOpen, onAllow, onDismiss, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="system-modal-overlay" onClick={onClose || onDismiss}>
      <div className="system-modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="system-modal-icon info">
          <BellRing size={28} />
        </div>
        <h2 className="system-modal-title">Stay on schedule</h2>
        <p className="system-modal-text">
          We use notifications to remind you about your prenatal checkups, postpartum follow-ups, and baby vaccinations one day before each appointment at 2:00 PM.
        </p>
        <div className="system-modal-actions">
          <button className="system-btn-confirm" onClick={onAllow}>Allow notifications</button>
          <button className="system-btn-cancel" onClick={onDismiss}>Maybe later</button>
        </div>
      </div>
    </div>
  );
};

export default NotificationPermissionModal;
