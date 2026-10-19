import React from 'react';
import { GameLogEntry } from '../types/game';

interface ActionLogModalProps {
  isOpen: boolean;
  logs: GameLogEntry[];
  onClose: () => void;
}

export const ActionLogModal: React.FC<ActionLogModalProps> = ({
  isOpen,
  logs,
  onClose,
}) => {
  if (!isOpen) return null;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal-card"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="سجل أحداث المباراة"
      >
        <div className="modal-card__header">
          <h2>📜 سجل أحداث المباراة</h2>
          <button type="button" className="btn-icon-close" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="modal-card__body log-list">
          {logs.map((entry) => (
            <div key={entry.id} className={`log-item log-item--${entry.type}`}>
              <span className="log-item__turn">دور #{entry.turnNumber}</span>
              <p className="log-item__text">{entry.messageAr}</p>
            </div>
          ))}
        </div>

        <div className="modal-card__footer">
          <button type="button" className="btn-primary" onClick={onClose}>
            إغلاق
          </button>
        </div>
      </div>
    </div>
  );
};
