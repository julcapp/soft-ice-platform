class FinancialReadinessService {
  constructor({ prisma, paymentAdapter, env = process.env }) {
    if (!prisma) throw new Error('prisma is required');
    this.prisma = prisma;
    this.paymentAdapter = paymentAdapter;
    this.env = env;
  }

  async get() {
    const checks = [];
    checks.push(check('YOOKASSA_CREDENTIALS', Boolean(this.paymentAdapter?.isConfigured?.()), 'BLOCKED', 'ЮKassa credentials', 'Настройте YOOKASSA_SHOP_ID и YOOKASSA_SECRET_KEY.'));
    checks.push(check('RECEIPT_VAT', Boolean(this.paymentAdapter?.isReceiptConfigured?.()), 'BLOCKED', 'Фискальная конфигурация', 'Укажите подтверждённый YOOKASSA_RECEIPT_VAT_CODE до включения чеков.'));
    checks.push(check('PAYMENT_WEBHOOK', truthy(this.env.YOOKASSA_PAYMENT_WEBHOOK_VERIFIED), 'BLOCKED', 'Webhook платежей', 'Подтвердите регистрацию и реальную доставку payment.* webhook.'));
    checks.push(check('REFUND_WEBHOOK', truthy(this.env.YOOKASSA_REFUND_WEBHOOK_VERIFIED), 'BLOCKED', 'Webhook возвратов', 'Подтвердите регистрацию и реальную доставку refund.succeeded webhook.'));
    checks.push(check('EMAIL_DELIVERY', truthy(this.env.EMAIL_DELIVERY_VERIFIED), 'DEGRADED', 'Доставка email', 'Проверьте реальную доставку чеков/сервисных сообщений через email-provider.'));
    checks.push(check('SETTLEMENT_REGISTRY', truthy(this.env.YOOKASSA_SETTLEMENT_REGISTRY_ENABLED), 'DEGRADED', 'Сверка реестров ЮKassa', 'Подключите ежедневную сверку комиссии и НДС из реестра ЮKassa.'));
    const imapConfigured = Boolean(this.env.YOOKASSA_REPORT_IMAP_USER && this.env.YOOKASSA_REPORT_IMAP_APP_PASSWORD && (this.env.YOOKASSA_REPORT_IMAP_FOLDER || 'юкасса отчеты'));
    checks.push(check('YOOKASSA_REPORT_IMAP', imapConfigured, 'DEGRADED', 'Автоматический импорт реестров из Яндекс Почты', 'Укажите YOOKASSA_REPORT_IMAP_USER и отдельный пароль приложения; папка: «юкасса отчеты».'));

    try {
      const rows = await this.prisma.$queryRawUnsafe(`SELECT
        to_regclass('public."PaymentReceipt"') IS NOT NULL AS receipts,
        to_regclass('public."PaymentRefund"') IS NOT NULL AS refunds,
        to_regclass('public."PaymentProviderCost"') IS NOT NULL AS costs,
        to_regclass('public."YooKassaDailyReport"') IS NOT NULL AS daily_reports,
        to_regclass('public."YooKassaReconciliationIssue"') IS NOT NULL AS reconciliation_issues`);
      const row = rows[0] || {};
      checks.push(check('PAYMENT_LEDGER_TABLES', Boolean(row.receipts && row.refunds && row.costs && row.daily_reports && row.reconciliation_issues), 'BLOCKED', 'Финансовые ledger-таблицы', 'Примените migrations PaymentReceipt / PaymentRefund / PaymentProviderCost / YooKassaDailyReport.'));
    } catch (error) {
      checks.push({ code: 'PAYMENT_LEDGER_TABLES', status: 'BLOCKED', title: 'Финансовые ledger-таблицы', detail: 'Не удалось проверить PostgreSQL.', errorCode: error.code || error.message });
    }

    try {
      const provisional = await this.prisma.$queryRawUnsafe(`SELECT COUNT(*)::int AS count FROM "PaymentProviderCost" WHERE "isFinal"=FALSE`);
      const count = Number(provisional[0]?.count || 0);
      checks.push({ code: 'PROVISIONAL_PROVIDER_COSTS', status: count ? 'DEGRADED' : 'READY', title: 'Сверка комиссий', detail: count ? `Ожидают сверки с реестром ЮKassa: ${count}` : 'Все зафиксированные комиссии сверены.', count });
    } catch (error) {
      checks.push({ code: 'PROVISIONAL_PROVIDER_COSTS', status: 'DEGRADED', title: 'Сверка комиссий', detail: 'Нет данных о статусе сверки.' });
    }

    try {
      const issues = await this.prisma.$queryRawUnsafe(`SELECT COUNT(*)::int AS count FROM "YooKassaReconciliationIssue" WHERE "status"='OPEN'`);
      const count = Number(issues[0]?.count || 0);
      checks.push({ code: 'OPEN_RECONCILIATION_ISSUES', status: count ? 'DEGRADED' : 'READY', title: 'Расхождения с реестрами ЮKassa', detail: count ? `Открытых расхождений: ${count}` : 'Открытых расхождений нет.', count });
    } catch {
      checks.push({ code: 'OPEN_RECONCILIATION_ISSUES', status: 'DEGRADED', title: 'Расхождения с реестрами ЮKassa', detail: 'Не удалось проверить очередь расхождений.' });
    }

    const status = checks.some((item) => item.status === 'BLOCKED') ? 'BLOCKED' : checks.some((item) => item.status === 'DEGRADED') ? 'DEGRADED' : 'READY';
    return {
      status,
      checks,
      policy: {
        customerPaymentSurchargeEnabled: false,
        automaticRefundFeeDeductionEnabled: false,
        note: 'Комиссии платёжного провайдера учитываются как расходы проекта и не удерживаются с клиента автоматически.',
      },
    };
  }
}

function check(code, ok, failureStatus, title, failureDetail) {
  return { code, status: ok ? 'READY' : failureStatus, title, detail: ok ? 'Настроено и подтверждено конфигурацией.' : failureDetail };
}
function truthy(value) { return ['1', 'true', 'yes', 'on'].includes(String(value || '').trim().toLowerCase()); }
module.exports = { FinancialReadinessService, truthy };
