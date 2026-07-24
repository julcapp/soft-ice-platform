const { randomUUID } = require('crypto');
const { ApiError } = require('../../platform/errors/ApiError');
const { TARIFF_STATUSES, MachineSimCard, MachineMobilePlan, MachineConnectivitySnapshot, MachineConnectivityEvent } = require('./MachineConnectivityModels');
const ROLES = ['PLATFORM_OWNER', 'ADMIN'];
class MachineConnectivityService {
  constructor({ repository, eventPublisher, clock = () => new Date() }) { Object.assign(this, { repository, eventPublisher, clock }); }
  authorize(context, technical = false) {
    if (!context?.roles?.some((x) => ROLES.includes(x))) throw new ApiError({ statusCode: 403, code: 'MACHINE_CONNECTIVITY_FORBIDDEN', message: 'Недостаточно прав для данных SIM-карты.' });
    return !technical || context.permissions?.includes('MACHINE_CONNECTIVITY_TECHNICAL') || context.roles.includes('PLATFORM_OWNER');
  }
  getSim(machineId, context) { const technical = this.authorize(context, true); return sanitize(this.repository.getSim(machineId), technical); }
  getPlan(machineId, context) { this.authorize(context); return this.repository.getPlan(machineId); }
  history(machineId, context) { this.authorize(context); return this.repository.history(machineId); }
  connectivity(machineId, context) {
    const technical = this.authorize(context, true); const sim = sanitize(this.repository.getSim(machineId), technical); const plan = this.repository.getPlan(machineId);
    const warnings = warningsFor(sim, plan, this.clock());
    return new MachineConnectivitySnapshot({ machineId, simCard: sim, mobilePlan: plan, warnings, sourceStatus: sim?.source || plan?.source || 'UNKNOWN', verificationStatus: sim?.verificationStatus || plan?.verificationStatus || 'UNKNOWN', integrationStatus: 'BLOCKED_EXTERNAL', capturedAt: this.clock().toISOString() });
  }
  async saveSim(machineId, input, context) {
    this.authorize(context); const old = this.repository.getSim(machineId); const now = this.clock().toISOString();
    const value = new MachineSimCard({ ...(old || {}), ...input, id: old?.id || randomUUID(), machineId, source: 'MANUAL', verificationStatus: 'MANUAL', actorId: context.actorId, auditReason: required(input.auditReason), createdAt: old?.createdAt || now, updatedAt: now });
    this.repository.saveSim(value); await this.event(old ? 'MACHINE_SIM_CARD_REPLACED' : 'MACHINE_SIM_CARD_REGISTERED', machineId, value, context); return sanitize(value, true);
  }
  async savePlan(machineId, input, context) {
    this.authorize(context); const old = this.repository.getPlan(machineId); const now = this.clock().toISOString();
    const tariffStatus = String(input.tariffStatus || old?.tariffStatus || 'UNKNOWN').toUpperCase();
    if (!TARIFF_STATUSES.includes(tariffStatus)) throw new ApiError({ statusCode: 400, code: 'INVALID_TARIFF_STATUS', message: 'Недопустимый статус тарифа.' });
    const value = new MachineMobilePlan({ ...(old || {}), ...input, id: old?.id || randomUUID(), machineId, tariffStatus, source: 'MANUAL', verificationStatus: 'MANUAL', actorId: context.actorId, auditReason: required(input.auditReason), createdAt: old?.createdAt || now, updatedAt: now });
    this.repository.savePlan(value); await this.event('MACHINE_MOBILE_PLAN_CHANGED', machineId, value, context);
    for (const warning of warningsFor(this.repository.getSim(machineId), value, this.clock())) if (warning.eventType) await this.event(warning.eventType, machineId, warning, context);
    return value;
  }
  event(eventType, machineId, payload, context) {
    const value = new MachineConnectivityEvent({ id: randomUUID(), machineId, eventType, payload, occurredAt: this.clock().toISOString() }); this.repository.appendEvent(value);
    return this.eventPublisher?.publish?.({ eventType, eventVersion: 1, aggregateType: 'MACHINE', aggregateId: machineId, actorType: 'ADMINISTRATOR', actorId: context.actorId, sourceChannel: 'ADMIN_API', correlationId: context.correlationId || randomUUID(), payload, metadata: {}, occurredAt: this.clock() });
  }
}
function required(value) { if (!String(value || '').trim()) throw new ApiError({ statusCode: 400, code: 'MANUAL_AUDIT_REASON_REQUIRED', message: 'Причина ручного изменения обязательна.' }); return String(value).trim(); }
function maskPhone(value) { if (!value) return null; const digits = String(value).replace(/\D/g, ''); return digits.length >= 4 ? `+7 *** ***-${digits.slice(-4, -2)}-${digits.slice(-2)}` : '***'; }
function sanitize(sim, technical) { if (!sim) return null; return { ...sim, phoneNumber: technical ? sim.phoneNumber : maskPhone(sim.phoneNumber), iccid: technical ? sim.iccid : undefined, imsi: technical ? sim.imsi : undefined }; }
function warningsFor(sim, plan, now) {
  const result = []; if (!sim && !plan) return [{ code: 'INTEGRATION_UNAVAILABLE', label: 'Интеграция недоступна' }];
  const balance = Number(plan?.currentBalance ?? sim?.currentBalance); const threshold = Number(plan?.minimumBalanceThreshold ?? sim?.minimumBalanceThreshold);
  if (Number.isFinite(balance) && Number.isFinite(threshold) && balance < threshold) result.push({ code: 'LOW_BALANCE', label: 'Низкий баланс', eventType: 'MACHINE_MOBILE_BALANCE_LOW' });
  if (['SUSPENDED', 'BLOCKED'].includes(plan?.tariffStatus)) result.push({ code: plan.tariffStatus, label: plan.tariffStatus === 'BLOCKED' ? 'SIM-карта заблокирована' : 'Тариф приостановлен', eventType: 'MACHINE_MOBILE_PLAN_SUSPENDED' });
  if (Number(plan?.trafficRemainingMb) < Math.min(500, Number(plan?.trafficLimitMb || 0) * .1)) result.push({ code: 'LOW_TRAFFIC', label: 'Мало трафика', eventType: 'MACHINE_MOBILE_TRAFFIC_LOW' });
  if (plan?.nextChargeAt && new Date(plan.nextChargeAt) - now < 3 * 86400000) result.push({ code: 'CHARGE_SOON', label: 'Скоро списание' });
  const checked = sim?.lastCheckedAt || plan?.lastCheckedAt;
  if (!checked || now - new Date(checked) > 7 * 86400000) result.push({ code: 'STALE', label: 'Данные устарели', eventType: 'MACHINE_CONNECTIVITY_DATA_STALE' });
  return result;
}
module.exports = { MachineConnectivityService, maskPhone, warningsFor };
