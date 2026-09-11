import React from 'react';
import { useAdminAuth } from './AdminAuthGate';
import { StatusBadge } from './components';

const roleLabels = {
  PLATFORM_OWNER: 'Владелец платформы',
  ADMIN: 'Администратор',
  MANAGER: 'Менеджер',
  OPERATOR: 'Оператор',
};

export function AccountSecurityPage() {
  const auth = useAdminAuth();
  const user = auth?.user || {};
  const roles = user.roles || [];

  return <div className="dashboard">
    <section className="card">
      <div className="card-heading">
        <div>
          <h2>Личный кабинет владельца</h2>
          <p style={{ margin: '6px 0 0' }}>Учётная запись, безопасность, подтверждения и административные сессии.</p>
        </div>
        <StatusBadge status={user.status || 'ACTIVE'} />
      </div>
    </section>

    <section className="statistics" aria-label="Сведения об учётной записи">
      <article className="card statistic-card"><p>Имя</p><strong>{user.display_name || user.displayName || '—'}</strong></article>
      <article className="card statistic-card"><p>Логин</p><strong>{user.login || '—'}</strong></article>
      <article className="card statistic-card"><p>Роль</p><strong>{roles.map((role) => roleLabels[role] || role).join(', ') || '—'}</strong></article>
      <article className="card statistic-card"><p>Состояние сессии</p><strong>Активна</strong><small>Вход выполнен через защищённую административную сессию</small></article>
    </section>

    <section className="tables" style={{ alignItems: 'start' }}>
      <section className="card">
        <div className="card-heading"><h2>Безопасность</h2></div>
        <p>Пароль: от 6 до 12 символов. Смена пароля будет подтверждаться одноразовым кодом через MAX или электронную почту.</p>
        <p><strong>После подтверждённой смены пароля:</strong> остальные административные сессии будут завершены.</p>
        <button className="text-button" type="button" disabled title="Подключаем подтверждение MAX / email следующим этапом">Сменить пароль</button>
      </section>

      <section className="card">
        <div className="card-heading"><h2>Каналы подтверждения</h2></div>
        <p>MAX — основной канал безопасности.</p>
        <p>Электронная почта — резервный канал.</p>
        <p style={{ marginBottom: 0 }}>До подтверждения канала операции смены и восстановления пароля не будут разрешены.</p>
      </section>

      <section className="card">
        <div className="card-heading"><h2>Активные сессии</h2></div>
        <p>Текущая сессия активна. Сервер уже хранит идентификатор сессии, IP, браузер, время создания и последнее обращение.</p>
        <p style={{ marginBottom: 0 }}>Просмотр всех сессий и команда «Завершить другие сессии» подключаются к этому разделу следующим этапом.</p>
      </section>

      <section className="card">
        <div className="card-heading"><h2>Действия</h2></div>
        <p>Выход завершит текущую административную сессию и запишет событие в журнал аудита.</p>
        <button type="button" className="text-button" onClick={() => auth?.logout?.()}>Выйти из личного кабинета</button>
      </section>
    </section>
  </div>;
}
