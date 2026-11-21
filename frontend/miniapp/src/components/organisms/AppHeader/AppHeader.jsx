import React from 'react';

function initials(name) {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '🍦';
  return parts.slice(0, 2).map((part) => part[0]?.toUpperCase() || '').join('');
}

export function AppHeader({ customer = null, clubAccount = null, unreadCount = 0, onNotifications, onProfile }) {
  const displayName = customer?.name || 'Гость';
  const phone = customer?.phone || null;
  const balance = Number.isFinite(Number(clubAccount?.available_balance)) ? Number(clubAccount.available_balance) : null;

  return (
    <header className="app-header">
      <button
        type="button"
        onClick={onProfile}
        style={{ display: 'flex', alignItems: 'center', gap: 12, background: 'transparent', border: 0, padding: 0, textAlign: 'left' }}
        aria-label="Открыть личный кабинет"
      >
        <div className="avatar" aria-label={displayName}>{initials(displayName)}</div>
        <div>
          <p className="eyebrow">Клуб «У Тимоши»</p>
          <strong>{displayName}</strong>
          {phone && <div style={{ fontSize: 13, opacity: 0.75 }}>{phone}</div>}
          {balance !== null && <div style={{ fontSize: 13, opacity: 0.8 }}>Бонусы: {balance}</div>}
        </div>
      </button>

      <button
        type="button"
        onClick={onNotifications}
        aria-label={`Уведомления: непрочитанных ${unreadCount}`}
        style={{ position: 'relative' }}
      >
        🔔
        {unreadCount > 0 && (
          <span
            aria-label="Непрочитанные уведомления"
            style={{
              position: 'absolute',
              top: -8,
              right: -8,
              minWidth: 20,
              height: 20,
              borderRadius: 10,
              padding: '0 5px',
              fontSize: 12,
              display: 'grid',
              placeItems: 'center',
              background: 'currentColor',
              color: 'Canvas',
            }}
          >
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>
    </header>
  );
}
