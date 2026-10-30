import React from 'react';

export function AppHeader({ unreadCount = 0, onNotifications }) {
  return (
    <header className="app-header">
      <div>
        <p className="eyebrow">Soft ICE Platform</p>
        <h1>У Тимоши</h1>
      </div>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
        <button type="button" onClick={onNotifications} aria-label={`Уведомления: непрочитанных ${unreadCount}`} style={{ position: 'relative' }}>
          🔔
          {unreadCount > 0 && <span aria-label="Непрочитанные уведомления" style={{ position: 'absolute', top: -8, right: -8, minWidth: 20, height: 20, borderRadius: 10, padding: '0 5px', fontSize: 12, display: 'grid', placeItems: 'center', background: 'currentColor', color: 'Canvas' }}>{unreadCount > 99 ? '99+' : unreadCount}</span>}
        </button>
        <div className="avatar" aria-label="Тимоша">🍦</div>
      </div>
    </header>
  );
}
