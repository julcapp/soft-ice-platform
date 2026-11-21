import React, { useEffect, useMemo, useState } from 'react';
import { getAdminNotifications, markAdminNotificationRead, markAllAdminNotificationsRead } from './api/adminNotificationsClient';
import { AdminOperationsDispatch } from './AdminOperationsDispatch';

const sourceLabels = {
  FINANCIAL: 'Финансы',
  PRIVATE_CHANNEL: 'Приватные каналы',
  PHOTO_PUBLICATION: 'UGC-публикации',
  MACHINE: 'Автоматы',
};

export function AdminNotificationBell() {
  const [open, setOpen] = useState(false);
  const [dispatchOpen, setDispatchOpen] = useState(false);
  const [state, setState] = useState({ status: 'loading', unreadCount: 0, items: [] });
  const load = async (signal) => {
    try {
      const data = await getAdminNotifications({ signal, limit: 100 });
      setState({ status: 'ready', unreadCount: Number(data?.unreadCount || 0), items: data?.items || [] });
    } catch (error) {
      if (error?.name !== 'AbortError') setState((current) => ({ ...current, status: 'error' }));
    }
  };
  useEffect(() => {
    const controller = new AbortController();
    load(controller.signal);
    const timer = window.setInterval(() => load(), 60000);
    return () => { controller.abort(); window.clearInterval(timer); };
  }, []);

  const unread = state.unreadCount;
  const visible = useMemo(() => state.items.slice(0, 30), [state.items]);

  async function readOne(item, navigate = false) {
    if (item.unread) {
      await markAdminNotificationRead(item.key);
      setState((current) => ({
        ...current,
        unreadCount: Math.max(0, current.unreadCount - 1),
        items: current.items.map((row) => row.key === item.key ? { ...row, unread: false, readAt: new Date().toISOString() } : row),
      }));
    }
    if (navigate && item.deepLink) {
      setOpen(false);
      window.location.hash = item.deepLink.replace(/^#/, '');
    }
  }

  async function readAll() {
    await markAllAdminNotificationsRead();
    setState((current) => ({ ...current, unreadCount: 0, items: current.items.map((row) => ({ ...row, unread: false, readAt: row.readAt || new Date().toISOString() })) }));
  }

  return <div style={{ position: 'relative' }}>
    <button className="notification" aria-label={`Уведомления администратора: ${unread} непрочитанных`} onClick={() => setOpen((value) => !value)}>
      ♢{unread > 0 && <i>{unread > 99 ? '99+' : unread}</i>}
    </button>
    {open && <div className="card" role="dialog" aria-label="Центр уведомлений администратора" style={{ position: 'absolute', right: 0, top: 'calc(100% + 10px)', width: dispatchOpen ? 'min(900px, calc(100vw - 24px))' : 'min(520px, calc(100vw - 24px))', maxHeight: '80vh', overflow: 'auto', zIndex: 30, padding: 16 }}>
      <div className="card-heading" style={{ alignItems: 'center' }}><div><h2>{dispatchOpen ? 'Операционная диспетчерская' : 'Уведомления'}</h2><p style={{ margin: '4px 0 0' }}>{dispatchOpen ? 'Инциденты, ответственные и история обработки' : 'Операционные события платформы'}</p></div><div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}><button type="button" className="text-button" onClick={() => setDispatchOpen((value) => !value)}>{dispatchOpen ? 'К уведомлениям' : 'Открыть диспетчерскую'}</button>{!dispatchOpen && unread > 0 && <button type="button" className="text-button" onClick={readAll}>Прочитать все</button>}</div></div>
      {dispatchOpen ? <AdminOperationsDispatch compact /> : <>
        {state.status === 'error' && <p>Не удалось загрузить уведомления.</p>}
        {state.status !== 'error' && visible.length === 0 && <p>Активных уведомлений нет.</p>}
        {visible.map((item) => <article key={item.key} style={{ borderTop: '1px solid var(--border-color, #ddd)', padding: '12px 0', opacity: item.unread ? 1 : 0.68 }}>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'space-between', alignItems: 'start' }}>
            <div><small>{sourceLabels[item.source] || item.source} · {item.severity}</small><strong style={{ display: 'block', marginTop: 3 }}>{item.title}</strong></div>
            {item.unread && <span aria-label="Непрочитано" title="Непрочитано">●</span>}
          </div>
          <p style={{ margin: '6px 0 8px' }}>{item.message}</p>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {item.deepLink && <button type="button" className="text-button" onClick={() => readOne(item, true)}>Открыть проблему</button>}
            {item.unread && <button type="button" className="text-button" onClick={() => readOne(item, false)}>Отметить прочитанным</button>}
          </div>
        </article>)}
      </>}
    </div>}
  </div>;
}
