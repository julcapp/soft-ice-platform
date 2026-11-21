import React from 'react';
import { StatisticCard } from './components';
const money=value=>new Intl.NumberFormat('ru-RU',{style:'currency',currency:'RUB'}).format(Number(value||0));
export function TestClubAccount({account}) {
  if(!account)return null;
  return <section className="card" aria-label="Тестовый клубный счёт"><div className="card-heading"><div><h2>Тестовый клубный счёт</h2><p>Отдельно от реальных денег и бонусов. Пополнения и списания основаны на серверном журнале.</p></div><strong>ТЕСТ</strong></div><div className="statistics"><StatisticCard label="Доступно · тест" value={money(account.availableBalanceRub)}/><StatisticCard label="Подтверждённые пополнения" value={money(account.creditedRub)}/><StatisticCard label="Списано на покупки" value={money(account.debitedRub)}/></div></section>;
}
