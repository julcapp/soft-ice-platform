'use strict';
const DEFINITIONS = [
  ['purchase_percent','Бонусы за завершённую покупку','%',5,'demo','Подтверждены оплата и выдача; предоплата и подарки исключены.','legacy/server.py: LOYALTY_RATE_PERCENT'],
  ['referral_invitee','Друг: первая самостоятельная покупка','бонусов',50,'demo','Один раз после первой самостоятельной завершённой покупки.','legacy/server.py: REFERRAL_INVITEE_BONUS'],
  ['referral_inviter','Пригласивший: покупка друга','бонусов',50,'demo','Один раз на реферальную связь; без самоприглашений.','legacy/server.py: REFERRAL_INVITER_BONUS'],
  ['milestone_count','Количество активных друзей для награды','друзей',3,'demo','Первый порог, награда однократная.','legacy/server.py: REFERRAL_MILESTONE_SIZE'],
  ['milestone_bonus','Награда за активных друзей','бонусов',100,'demo','Однократно пригласившему после достижения порога.','legacy/server.py: REFERRAL_MILESTONE_BONUS'],
  ['fiftieth_count','Подарочная покупка по счётчику','покупок',50,'existing','Действующий отдельный механизм: клиент + аппарат. Эта таблица его пока не переключает.','FiftiethPurchaseGiftResolver.js'],
  ['welcome_bonus','Награда за регистрацию','бонусов',null,'draft','Один раз после регистрации и подтверждения телефона; новые регистрации после включения версии.','WelcomeBonusService.js'],
  ['birthday_bonus','День рождения','бонусов',null,'draft','Один раз за календарный год в указанную дату рождения по времени Томска; подтверждённый активный профиль.','BONUS_DOMAIN.md'],
  ['photo_bonus','Фото с Тимошей','бонусов',null,'draft','После подтверждения публикации; отдельный PhotoReward engine.','BonusRewardEngine.js'],
  ['club_discount','Клубная скидка','%',null,'draft','Ставка и совмещение требуют уточнения.','Аудит 15.10.2026'],
  ['club_initial_topup','Первоначальное пополнение клубного счёта','₽',150,'draft','Деньги зачисляются на клубный денежный счёт. Пополнение предусмотрено для всех участников, включая приглашённых по реферальной ссылке. Оплата только через Mini App. Тестовое пополнение в @exgorod_bot учитывается отдельно от реального денежного остатка.','Решение владельца 16.10.2026'],
];
const INITIAL_RULES = DEFINITIONS.map(([key,label,unit,value,mode,condition,source]) => ({key,label,unit,value,mode,condition,source}));
const ENGINE_KEYS = new Set(['purchase_percent','referral_invitee','referral_inviter','milestone_count','milestone_bonus','welcome_bonus','birthday_bonus','photo_bonus','club_initial_topup']);
function problem(code, message, statusCode=400) { return Object.assign(new Error(message), {code,statusCode}); }
function validateRules(input) {
  if (!Array.isArray(input) || input.length < INITIAL_RULES.length || input.length > 100) throw problem('BENEFIT_RULES_INVALID','Требуется полный набор условий.');
  const seen = new Set();
  const normalized = input.map(row => {
    if (!row || typeof row !== 'object') throw problem('BENEFIT_RULE_UNKNOWN','Некорректное правило.');
    let def = INITIAL_RULES.find(x => x.key === row.key);
    if (!def && /^custom_[a-z0-9_]{1,64}$/.test(row.key || '')) {
      if (!['draft','off'].includes(row.mode)) throw problem('BENEFIT_NOT_READY','Новому правилу требуется серверный обработчик; пока доступны черновик и выключено.');
      if (typeof row.label !== 'string' || !row.label.trim() || row.label.length > 160 || typeof row.condition !== 'string' || !row.condition.trim() || row.condition.length > 2000 || !['₽','%','бонусов','покупок','друзей','дней','раз'].includes(row.unit)) throw problem('BENEFIT_RULE_INVALID','Заполните название, единицу и условия нового правила.');
      def = {key:row.key,label:row.label.trim(),condition:row.condition.trim(),unit:row.unit,source:'Правило администратора; серверный обработчик не подключён'};
    }
    if (!def || seen.has(row.key)) throw problem('BENEFIT_RULE_UNKNOWN','Неизвестное или повторное правило.');
    seen.add(row.key);
    if (!['demo','draft','live','existing','off'].includes(row.mode)) throw problem('BENEFIT_MODE_INVALID','Неизвестный режим.');
    if (row.mode === 'existing' && row.key !== 'fiftieth_count') throw problem('BENEFIT_MODE_INVALID','Отдельный механизм указан только для подарочной покупки.');
    const value = row.value === null || row.value === '' ? null : Number(row.value);
    if (value !== null && (!Number.isFinite(value) || value < 0 || value > (def.unit === '%' ? 100 : 1000000) || (def.unit !== '%' && !Number.isInteger(value)) || (def.unit === '%' && Math.abs(value * 100 - Math.round(value * 100)) > 0.000001))) throw problem('BENEFIT_VALUE_INVALID',`Недопустимое значение: ${def.label}`);
    if (row.mode === 'live' && (!ENGINE_KEYS.has(row.key) || value === null || (row.key === 'milestone_count' && value < 1))) throw problem('BENEFIT_NOT_READY',`Для боевого начисления правило не готово: ${def.label}`);
    if (row.key === 'fiftieth_count' && (value !== 50 || row.mode !== 'existing')) throw problem('BENEFIT_EXISTING_READ_ONLY','Счётчик подарка управляется действующим механизмом; изменение требует его интеграции.');
    return {...def,value,mode:row.mode};
  });
  if (INITIAL_RULES.some(row=>!seen.has(row.key))) throw problem('BENEFIT_RULES_INVALID','Требуется полный набор системных условий.');
  const byKey = Object.fromEntries(normalized.map(row => [row.key,row]));
  const referralLive = ['referral_invitee','referral_inviter'].map(key => byKey[key].mode === 'live');
  if (referralLive[0] !== referralLive[1]) throw problem('BENEFIT_REFERRAL_PAIR','Для боевой реферальной программы включите обе стороны.');
  for (const key of ['referral_invitee','referral_inviter','milestone_bonus','welcome_bonus','birthday_bonus','photo_bonus','club_initial_topup']) if(byKey[key].mode === 'live' && byKey[key].value < 1) throw problem('BENEFIT_VALUE_INVALID','Боевая награда должна быть больше нуля.');
  if (byKey.milestone_bonus.mode === 'live' && (byKey.milestone_count.mode !== 'live' || !referralLive.every(Boolean))) throw problem('BENEFIT_MILESTONE_DEPENDENCY','Для награды за друзей включите порог и реферальные награды обеим сторонам.');
  return normalized;
}
function calculatePurchase(amount, percent) {
  // Prices are rounded to kopecks before multiplying; awards remain whole bonus units.
  const kopecks = Math.round(Number(amount) * 100), basisPoints = Math.round(Number(percent) * 100);
  if (!Number.isSafeInteger(kopecks) || kopecks < 0 || !Number.isSafeInteger(basisPoints) || basisPoints < 0 || basisPoints > 10000) throw problem('BENEFIT_AMOUNT_INVALID','Некорректная сумма для расчёта.');
  return Math.floor((kopecks * basisPoints) / 1000000);
}
module.exports={INITIAL_RULES,ENGINE_KEYS,validateRules,calculatePurchase,problem};
