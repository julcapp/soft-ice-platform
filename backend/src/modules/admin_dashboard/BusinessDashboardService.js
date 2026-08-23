const { ApiError } = require('../../platform/errors/ApiError');

const ADMIN_ROLES = new Set(['PLATFORM_OWNER', 'ADMIN']);
const CHANNELS = ['VK', 'TELEGRAM', 'MAX'];

class BusinessDashboardService {
  constructor({ prisma, privateChannelBillingService = null, paymentOperationsService = null, paymentEconomicsService = null, clock = () => new Date() }) {
    if (!prisma) throw new Error('prisma is required');
    this.prisma = prisma;
    this.privateChannelBillingService = privateChannelBillingService;
    this.paymentOperationsService = paymentOperationsService;
    this.paymentEconomicsService = paymentEconomicsService;
    this.clock = clock;
  }

  async getDashboard(securityContext, query = {}) {
    assertAdmin(securityContext);
    const range = resolveRange(query, this.clock());
    const [totalUsers, newUsers, clubMembers, newClubMembers, paidTopups, orders, referrals, subscriptions, referralActions] = await Promise.all([
      this.prisma.customer.count(),
      this.prisma.customer.count({ where: { createdAt: { gte: range.from, lt: range.toExclusive } } }),
      this.prisma.clubAccount.count({ where: { clubActive: true } }),
      this.prisma.clubAccount.count({ where: { clubActive: true, activatedAt: { gte: range.from, lt: range.toExclusive } } }),
      this.prisma.clubTopup.findMany({ where: { paidAt: { gte: range.from, lt: range.toExclusive } }, select: { amountRub: true, paidAt: true, customerId: true } }),
      this.prisma.order.findMany({ where: { paidAt: { gte: range.from, lt: range.toExclusive } }, select: { id: true, customerId: true, status: true, amount: true, amountPaidRub: true, paidAt: true, activePickupCodeHash: true } }),
      this.prisma.referral.findMany({ select: { referrerCustomerId: true, referredCustomerId: true, status: true, firstPurchaseAt: true, referralCode: true } }),
      this.prisma.customerChannelSubscription.findMany({ where: { isSubscribed: true }, select: { channelType: true, targetType: true, targetExternalId: true, customerId: true, subscribedAt: true } }),
      this.prisma.auditEvent.findMany({ where: { eventType: 'Referral.LinkAction', occurredAt: { gte: range.from, lt: range.toExclusive } }, select: { subjectId: true, action: true, metadata: true, occurredAt: true } }),
    ]);
    const privateChannel = this.privateChannelBillingService ? await this.privateChannelBillingService.stats({ from: range.from, toExclusive: range.toExclusive }) : { subscribers: null, paidPaymentsInPeriod: null, paidAmountRubInPeriod: null, forecastNext30DaysRub: null, status: 'BLOCKED', reason: 'PRIVATE_CHANNEL_BILLING_SOURCE_NOT_WIRED' };
    const financialDocuments = this.paymentOperationsService ? await this.paymentOperationsService.stats({ from: range.from, toExclusive: range.toExclusive }) : { refundsSucceeded: null, refundedAmountRub: null, receiptsCreated: null, status: 'BLOCKED' };
    const paymentEconomics = this.paymentEconomicsService ? await this.paymentEconomicsService.stats({ from: range.from, toExclusive: range.toExclusive }) : { status: 'BLOCKED', reason: 'PAYMENT_ECONOMICS_SOURCE_NOT_WIRED' };

    const paidOrders = orders.filter((order) => order.paidAt);
    const completedOrders = paidOrders.filter((order) => order.status === 'COMPLETED');
    const awaitingPickup = paidOrders.filter((order) => order.status === 'PAID' && order.activePickupCodeHash);
    const salesByDay = buildDailySeries(range, paidOrders);
    const channelStats = buildChannelStats(subscriptions);
    const activeReferrals = referrals.filter((item) => item.referredCustomerId && item.firstPurchaseAt);
    const acceptedReferrals = referrals.filter((item) => item.referredCustomerId);
    const topReferrer = await this.#topReferrer(activeReferrals, range);
    const referralActionStats = buildReferralActionStats(referralActions);

    return {
      generatedAt: this.clock().toISOString(),
      period: { from: isoDay(range.from), to: isoDay(range.toInclusive), days: range.days },
      freshness: { status: 'LIVE', source: 'POSTGRESQL_READ_MODEL', generatedAt: this.clock().toISOString(), isDemo: false },
      users: { total: totalUsers, newInPeriod: newUsers },
      club: { membersTotal: clubMembers, joinedInPeriod: newClubMembers, paidTopupsInPeriod: paidTopups.length, topupAmountRubInPeriod: sum(paidTopups, (item) => item.amountRub) },
      referrals: {
        linksDistributed: referralActions.length,
        uniqueSharers: new Set(referralActions.map((item) => item.subjectId).filter(Boolean)).size,
        actions: referralActionStats.actions,
        destinations: referralActionStats.destinations,
        acceptedTotal: acceptedReferrals.length,
        activeTotal: activeReferrals.length,
        conversionToRegistrationPct: referralActions.length ? round(acceptedReferrals.length / referralActions.length * 100, 1) : 0,
        conversionToFirstPurchasePct: acceptedReferrals.length ? round(activeReferrals.length / acceptedReferrals.length * 100, 1) : 0,
        topReferrer,
      },
      channels: channelStats,
      sales: {
        paidOrdersInPeriod: paidOrders.length,
        completedOrdersInPeriod: completedOrders.length,
        revenueRubInPeriod: sum(paidOrders, (item) => item.amountPaidRub ?? item.amount),
        awaitingPickupCount: awaitingPickup.length,
        awaitingPickupAmountRub: sum(awaitingPickup, (item) => item.amountPaidRub ?? item.amount),
        byDay: salesByDay,
      },
      financialDocuments,
      paymentEconomics,
      privateChannel,
      sourceReadiness: {
        users: 'READY', club: 'READY', referralsAccepted: 'READY', referralShares: 'READY', publicChannels: 'READY', sales: 'READY', awaitingPickup: 'READY',
        receiptsAndRefunds: this.paymentOperationsService ? 'READY' : 'BLOCKED',
        paymentEconomics: this.paymentEconomicsService ? 'READY' : 'BLOCKED',
        privateChannelBilling: privateChannel.status === 'READY' ? 'READY' : 'BLOCKED',
      },
    };
  }

  async #topReferrer(activeReferrals, range) {
    const inPeriod = activeReferrals.filter((item) => item.firstPurchaseAt >= range.from && item.firstPurchaseAt < range.toExclusive);
    if (!inPeriod.length) return null;
    const counts = new Map();
    for (const item of inPeriod) counts.set(item.referrerCustomerId, (counts.get(item.referrerCustomerId) || 0) + 1);
    const [customerId, activeReferralsCount] = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
    const customer = await this.prisma.customer.findUnique({ where: { id: customerId }, select: { id: true, name: true, telegramUsername: true, phone: true } });
    return { customerId, displayName: customer?.name || (customer?.telegramUsername ? `@${customer.telegramUsername}` : maskPhone(customer?.phone)) || customerId, activeReferrals: activeReferralsCount };
  }
}

function buildReferralActionStats(events) {
  const actions = { COPY: 0, SHARE: 0, SEND: 0 };
  const destinations = { TELEGRAM: 0, VK: 0, MAX: 0, SYSTEM_SHARE: 0, CLIPBOARD: 0, OTHER: 0 };
  for (const event of events) {
    const action = String(event.metadata?.action || event.action || '').replace('REFERRAL_LINK_', '').toUpperCase();
    const destination = String(event.metadata?.destination || 'OTHER').toUpperCase();
    if (Object.hasOwn(actions, action)) actions[action] += 1;
    if (Object.hasOwn(destinations, destination)) destinations[destination] += 1; else destinations.OTHER += 1;
  }
  return { actions, destinations };
}
function buildChannelStats(subscriptions) { const result = {}; for (const channel of CHANNELS) { const rows = subscriptions.filter((item) => String(item.channelType).toUpperCase() === channel && !isPrivateTarget(item)); result[channel] = { subscribed: new Set(rows.map((row) => row.customerId)).size }; } return result; }
function isPrivateTarget(item) { const targetType = String(item.targetType || '').toUpperCase(); return targetType.includes('PRIVATE') || targetType.includes('PAID'); }
function buildDailySeries(range, orders) { const days = new Map(); for (let cursor = new Date(range.from); cursor < range.toExclusive; cursor.setUTCDate(cursor.getUTCDate() + 1)) days.set(isoDay(cursor), { date: isoDay(cursor), purchases: 0, revenueRub: 0 }); for (const order of orders) { const row = days.get(isoDay(order.paidAt)); if (!row) continue; row.purchases += 1; row.revenueRub += Number(order.amountPaidRub ?? order.amount ?? 0); } return [...days.values()].map((row) => ({ ...row, revenueRub: round(row.revenueRub, 2) })); }
function resolveRange(query, now) { const fallbackTo = startUtcDay(now); const toInclusive = query.to ? parseDay(query.to, 'to') : fallbackTo; const from = query.from ? parseDay(query.from, 'from') : addDays(toInclusive, -29); if (from > toInclusive) throw validation('BUSINESS_DASHBOARD_PERIOD_INVALID', '`from` must not be after `to`.'); const days = Math.floor((toInclusive - from) / 86400000) + 1; if (days > 366) throw validation('BUSINESS_DASHBOARD_PERIOD_TOO_LARGE', 'Maximum reporting period is 366 days.'); return { from, toInclusive, toExclusive: addDays(toInclusive, 1), days }; }
function parseDay(value, field) { if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ''))) throw validation('BUSINESS_DASHBOARD_DATE_INVALID', `Invalid ${field} date.`); const date = new Date(`${value}T00:00:00.000Z`); if (Number.isNaN(date.getTime())) throw validation('BUSINESS_DASHBOARD_DATE_INVALID', `Invalid ${field} date.`); return date; }
function startUtcDay(value) { const date = new Date(value); return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())); }
function addDays(value, days) { const date = new Date(value); date.setUTCDate(date.getUTCDate() + days); return date; }
function isoDay(value) { return new Date(value).toISOString().slice(0, 10); }
function sum(items, getter) { return round(items.reduce((total, item) => total + Number(getter(item) || 0), 0), 2); }
function round(value, digits = 2) { const factor = 10 ** digits; return Math.round(value * factor) / factor; }
function maskPhone(phone) { const value = String(phone || ''); return value.length >= 4 ? `***${value.slice(-4)}` : null; }
function validation(code, message) { return new ApiError({ statusCode: 400, code, message, source: 'platform_service' }); }
function assertAdmin(securityContext) { const roles = Array.isArray(securityContext?.roles) ? securityContext.roles : []; if (!roles.some((role) => ADMIN_ROLES.has(role))) throw new ApiError({ statusCode: 403, code: 'ADMIN_PERMISSION_DENIED', message: 'Business dashboard access is not permitted.', source: 'platform_service' }); }

module.exports = { BusinessDashboardService, resolveRange, buildDailySeries, buildReferralActionStats };
