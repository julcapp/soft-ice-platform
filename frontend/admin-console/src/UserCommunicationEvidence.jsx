import React from 'react';
import { StatusBadge } from './components';

const dateTime = (value) => value ? new Date(value).toLocaleString('ru-RU') : '—';

export function UserCommunicationEvidence({ card }) {
  const communication = card?.communication || {};
  const verification = communication.emailVerification;
  const consent = communication.marketingEmailConsent;
  const consentStatus = consent ? (consent.isGranted && !consent.revokedAt ? 'ACTIVE' : 'REVOKED') : 'NOT_SET';
  const verificationStatus = verification?.status || (card?.email ? 'NOT_VERIFIED' : 'NOT_SET');

  return <section className="card" aria-label="Профиль и согласия пользователя">
    <div className="card-heading">
      <div><h2>Профиль и согласия</h2><p style={{ margin: '6px 0 0' }}>Read-only доказательный слой. Юридические факты согласия из административной карточки не редактируются.</p></div>
      <StatusBadge status={verificationStatus === 'VERIFIED' ? 'VERIFIED' : 'ATTENTION'} />
    </div>
    <div className="statistics">
      <div><strong>Дата рождения</strong><p>{card?.birthday ? new Date(card.birthday).toLocaleDateString('ru-RU') : 'Не заполнена'}</p></div>
      <div><strong>Email</strong><p>{card?.email || 'Не заполнен'}</p></div>
      <div><strong>Верификация email</strong><p><StatusBadge status={verificationStatus} /></p><small>Подтверждён: {dateTime(verification?.verifiedAt)} · истекает: {dateTime(verification?.expiresAt)}</small></div>
      <div><strong>Непрочитанные сообщения</strong><p>{Number(communication.unreadNotifications || 0)}</p></div>
    </div>
    <div className="table-scroll" style={{ marginTop: 12 }}><table><tbody>
      <tr><th>Рассылка</th><td><StatusBadge status={consentStatus} /></td></tr>
      <tr><th>Версия правил</th><td>{consent?.rulesVersion || '—'}</td></tr>
      <tr><th>Правила</th><td>{consent?.rulesUrl ? <a href={consent.rulesUrl} target="_blank" rel="noreferrer">Открыть редакцию</a> : '—'}</td></tr>
      <tr><th>Канал решения</th><td>{consent?.sourceChannel || '—'}</td></tr>
      <tr><th>Согласие дано</th><td>{dateTime(consent?.grantedAt)}</td></tr>
      <tr><th>Согласие отозвано</th><td>{dateTime(consent?.revokedAt)}</td></tr>
      <tr><th>Последнее решение</th><td>{dateTime(consent?.createdAt)}</td></tr>
      <tr><th>Correlation ID</th><td>{consent?.correlationId || '—'}</td></tr>
    </tbody></table></div>
  </section>;
}
