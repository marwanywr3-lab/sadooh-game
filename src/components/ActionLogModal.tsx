import {t,fmt,tr} from '../i18n/translate';
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
        aria-label={t("سجل أحداث المباراة")}
      >
        <div className="modal-card__header">
          <h2> {" "+t("سجل أحداث المباراة")+""}</h2>
          <button type="button" className="btn-icon-close" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="modal-card__body log-list">
          {tr(logs.map((entry) => (
            <div key={entry.id} className={`log-item log-item--${entry.type}`}>
              <span className="log-item__turn">{""+t("دور #")+""}{tr(entry.turnNumber)}</span>
              <p className="log-item__text">{tr(entry.messageAr)}</p>
            </div>
          )))}
        </div>

        <div className="modal-card__footer">
          <button type="button" className="btn-primary" onClick={onClose}>
            {" "+t("إغلاق")+" "}</button>
        </div>
      </div>
    </div>
  );
};
