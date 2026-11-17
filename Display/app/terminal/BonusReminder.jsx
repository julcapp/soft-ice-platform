import React from 'react';
export function BonusReminder({onPhone,onSkip,onRefresh,disabled=false}){
 return <section className="display-bonus-reminder" aria-labelledby="bonus-reminder-title">
  <span className="display-bonus-icon" aria-hidden="true">♡</span><p className="display-kicker">Клуб Тимоши</p>
  <h1 id="bonus-reminder-title">Хотите получать бонусы?</h1>
  <p>Укажите номер телефона, чтобы связать покупку с вашим профилем. Начисление бонусов зависит от правил клуба.</p>
  <p className="display-bonus-note">Ваше мороженое уже собрано — выбранный состав сохранится.</p>
  <div className="display-bonus-actions"><button className="display-primary" onClick={onPhone}>Указать номер телефона</button><button className="display-secondary" onClick={disabled?onRefresh:onSkip}>{disabled?'Обновить цену':'Продолжить без бонусов'}</button></div>
 </section>;
}
export function needsBonusReminder({buyerToken,reminderSeen}){return !buyerToken&&!reminderSeen;}
