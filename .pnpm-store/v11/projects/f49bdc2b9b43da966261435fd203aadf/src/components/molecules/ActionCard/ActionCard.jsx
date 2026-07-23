import React from 'react';

export function ActionCard({ icon, title, description, badge, onClick }) {
  return <button className="action-card" onClick={onClick} type="button"><span className="action-icon">{icon}</span><span className="action-content"><span className="action-title">{title}</span><span className="action-description">{description}</span></span><span className="badge">{badge || '›'}</span></button>;
}
