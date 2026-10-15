import React, { createContext, useContext, useEffect, useRef, useState } from 'react';

const NavigationContext = createContext(null);
export function useBeforeNavigation(handler) {
  const context = useContext(NavigationContext);
  const latest = useRef(handler); latest.current = handler;
  useEffect(() => context?.register(() => latest.current()), [context?.register]);
}
export function useNavigation() { return useContext(NavigationContext); }
export function NavigationSaveProvider({ children, priority = false }) {
  const handlers = useRef(new Set()), running = useRef(false), accepted = useRef(window.location.hash);
  const [message, setMessage] = useState(''), [saving, setSaving] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const choice = useRef(null);
  function ask() { setConfirming(true); return new Promise((resolve) => { choice.current = resolve; }); }
  function choose(value) { const resolve = choice.current; choice.current = null; setConfirming(false); resolve?.(value); }
  const register = useRef((handler) => { handlers.current.add(handler); return () => handlers.current.delete(handler); }).current;
  async function leave(action) {
    if (running.current) return false;
    running.current = true; setSaving(true); setMessage('');
    try {
      // Check all blockers before writing anything.
      const plans = [...handlers.current].map((handler) => handler());
      for (const plan of plans) if (plan?.block) throw new Error(plan.block);
      const dirty = plans.filter((plan) => plan?.dirty);
      const decision = dirty.length ? await ask() : 'save';
      if (decision === 'cancel') return false;
      for (const plan of plans) {
        if (decision === 'discard' && plan?.dirty) { plan.discard?.(); continue; }
        if (plan?.save && await plan.save() === false) throw new Error('Не удалось сохранить изменения. Проверьте сообщение в разделе.');
      }
      action(); return true;
    } catch (error) { setMessage(error.message || 'Не удалось сохранить изменения.'); return false; }
    finally { running.current = false; setSaving(false); }
  }
  const latest = useRef(null);
  latest.current = { leave, navigate: (hash) => leave(() => { accepted.current = hash; window.location.hash = hash; }) };
  useEffect(() => {
    const click = (event) => {
      const link = event.target.closest?.('a[href^="#"]');
      if (!link || event.defaultPrevented || event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || link.hash === '#main') return;
      event.preventDefault(); if (priority) event.stopImmediatePropagation(); latest.current.navigate(link.hash);
    };
    const hashChange = (event) => {
      const target = window.location.hash;
      if (target === accepted.current) return;
      event.stopImmediatePropagation();
      history.replaceState(null, '', window.location.pathname + window.location.search + accepted.current);
      latest.current.navigate(target);
    };
    const beforeUnload = (event) => {
      if (running.current || [...handlers.current].some((handler) => { const plan = handler(); return plan?.block || plan?.save || plan?.dirty; })) { event.preventDefault(); event.returnValue = ''; }
    };
    window.addEventListener('beforeunload', beforeUnload);
    (priority ? window : document).addEventListener('click', click, true); window.addEventListener('hashchange', hashChange, true);
    return () => { window.removeEventListener('beforeunload', beforeUnload); (priority ? window : document).removeEventListener('click', click, true); window.removeEventListener('hashchange', hashChange, true); };
  }, []);
  return <NavigationContext.Provider value={{ register, leave, navigate: latest.current.navigate, saving }}>
    {confirming && <section className="card navigation-confirm" role="dialog" aria-modal="true" aria-label="Несохранённые изменения" style={{ position: 'fixed', top: '20%', left: '50%', transform: 'translateX(-50%)', width: 'min(90vw, 480px)', zIndex: 10000 }}><h2>Сохранить изменения перед переходом?</h2><p>В карточке есть несохранённые поля.</p><div className="crm-toolbar"><button onClick={() => choose('save')}>Сохранить и перейти</button><button onClick={() => choose('discard')}>Перейти без сохранения</button><button onClick={() => choose('cancel')}>Остаться</button></div></section>}
    {message && <div className="navigation-save-notice" role="alert">{message}</div>}<div inert={saving} style={{ display: 'contents' }}>{children}</div>
  </NavigationContext.Provider>;
}
export function MainMenuButton({ onReturn }) {
  const navigation = useNavigation();
  return <button type="button" className="text-button" disabled={navigation?.saving} onClick={() => {
    const action = onReturn || (() => { window.location.hash = '#dashboard'; });
    if (onReturn) navigation ? navigation.leave(action) : action();
    else navigation ? navigation.navigate('#dashboard') : action();
  }}>{navigation?.saving ? 'Сохраняем…' : 'Главное меню'}</button>;
}
