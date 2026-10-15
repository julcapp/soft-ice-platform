import React, { useState } from 'react';
export function PasswordInput(props) {
  const [visible, setVisible] = useState(false);
  const label = visible ? 'Скрыть пароль' : 'Показать пароль';
  return <span className="password-field"><input {...props} type={visible ? 'text' : 'password'} spellCheck={false} autoCapitalize="none" /><button className="password-toggle" type="button" aria-label={label} title={label} aria-pressed={visible} disabled={props.disabled} onClick={() => setVisible(!visible)}><svg aria-hidden="true" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>{visible && <path d="M3 3l18 18"/>}</svg></button></span>;
}
