const crypto = require('node:crypto');
const { ApiError } = require('../../platform/errors/ApiError');
const { ServiceAccessPolicy } = require('./ServiceAccessPolicy');
const { loadSharp } = require('../photo_verification/SharpImageDecoder');
const { AuditRepository } = require('../../platform/audit/AuditRepository');

const MAX_PHOTO_BYTES = 8 * 1024 * 1024;
const uuid = (id) => typeof id === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);

class ServiceVisitService {
  constructor({ prisma, storage, normalizePhoto = normalizeImage }) {
    Object.assign(this, { prisma, storage, normalizePhoto });
    this.policy = new ServiceAccessPolicy({ prisma });
  }

  async workspace(context) {
    const machines = await this.policy.machines(context);
    const visits = await this.prisma.$queryRawUnsafe(`SELECT * FROM "ServiceVisit" WHERE "machineId"=ANY($1::text[])
      AND ("adminUserId"=$2::uuid OR $3::boolean) AND ($4::text IS NULL OR "actingRole"=$4) ORDER BY "createdAt" DESC LIMIT 100`, machines.map((m) => m.id), context.subject_id, context.roles.includes('PLATFORM_OWNER'), context.active_service_role || null);
    return { machines, visits, capabilities: { technicalDiagnostics: context.roles.some((role) => ['PLATFORM_OWNER', 'SERVICE_SPECIALIST'].includes(role)) } };
  }

  async diagnostics(machineId, context) {
    if (!context.roles?.some((role) => ['PLATFORM_OWNER', 'SERVICE_SPECIALIST'].includes(role))) throw fail(403, 'SERVICE_DIAGNOSTICS_DENIED', 'Просмотр технического состояния доступен техническому специалисту.');
    await this.policy.requireMachine(machineId, context);
    const rows = await this.prisma.$queryRawUnsafe('SELECT "id","machineCode","name","status","updatedAt" FROM "Machine" WHERE "id"=$1', machineId);
    return rows[0];
  }

  async open(machineId, context) {
    await this.policy.requireMachine(machineId, context);
    try {
      return await this.prisma.$transaction(async (tx) => {
        await this.policy.requireMachine(machineId, context, tx);
        const existing = await tx.$queryRawUnsafe('SELECT * FROM "ServiceVisit" WHERE "machineId"=$1 AND "status"=\'IN_PROGRESS\' FOR UPDATE', machineId);
        if (existing[0]) {
          if (existing[0].adminUserId !== context.subject_id) throw fail(409, 'SERVICE_VISIT_BUSY', 'Аппарат уже обслуживает другой сотрудник.');
          if (context.active_service_role && existing[0].actingRole !== context.active_service_role) throw fail(409, 'SERVICE_VISIT_ROLE_MISMATCH', 'Продолжите работу в роли, в которой её начали.');
          return existing[0];
        }
        const rows = await tx.$queryRawUnsafe('INSERT INTO "ServiceVisit" ("machineId","adminUserId","actingRole") VALUES ($1,$2::uuid,$3) RETURNING *', machineId, context.subject_id, context.active_service_role || null);
        await audit(tx, context, 'Service.VisitOpened', rows[0].id, 'open_service_visit', { machine_id: machineId });
        return rows[0];
      });
    } catch (error) {
      if (error.meta?.code === '23505') throw fail(409, 'SERVICE_VISIT_BUSY', 'Аппарат уже обслуживается. Обновите список.');
      throw error;
    }
  }

  async visit(id, context, db = this.prisma, { lock = false } = {}) {
    if (!uuid(id)) throw fail(404, 'SERVICE_VISIT_NOT_FOUND', 'Обслуживание не найдено.');
    const rows = await db.$queryRawUnsafe(`SELECT * FROM "ServiceVisit" WHERE "id"=$1::uuid${lock ? ' FOR UPDATE' : ''}`, id);
    const visit = rows[0];
    if (!visit) throw fail(404, 'SERVICE_VISIT_NOT_FOUND', 'Обслуживание не найдено.');
    await this.policy.requireMachine(visit.machineId, context, db);
    if (context.active_service_role && visit.actingRole !== context.active_service_role) throw fail(403, 'SERVICE_VISIT_ROLE_MISMATCH', 'Этот отчёт относится к другой роли.');
    if (visit.adminUserId !== context.subject_id && !context.roles.includes('PLATFORM_OWNER')) throw fail(403, 'SERVICE_VISIT_DENIED', 'Обслуживание принадлежит другому сотруднику.');
    return visit;
  }

  async detail(id, context) {
    const visit = await this.visit(id, context);
    const photos = await this.prisma.$queryRawUnsafe('SELECT "id","stage","contentType","sizeBytes","createdAt","deletedAt" FROM "ServicePhoto" WHERE "visitId"=$1::uuid ORDER BY "createdAt"', id);
    return { ...visit, photos };
  }

  async addPhoto(id, { stage, buffer }, context) {
    const visit = await this.visit(id, context);
    mutable(visit);
    if (!['BEFORE', 'AFTER'].includes(stage)) throw fail(400, 'SERVICE_PHOTO_STAGE', 'Укажите фото до или после обслуживания.');
    if (!Buffer.isBuffer(buffer) || !buffer.length || buffer.length > MAX_PHOTO_BYTES) throw fail(413, 'SERVICE_PHOTO_SIZE', 'Размер фотографии должен быть не больше 8 МБ.');
    const normalized = await this.normalizePhoto(buffer);
    const saved = await this.storage.put({ customerId: visit.machineId, photoChallengeId: id, buffer: normalized, mimeType: 'image/jpeg' });
    try {
      await this.prisma.$transaction(async (tx) => {
        mutable(await this.visit(id, context, tx, { lock: true }));
        await tx.$executeRawUnsafe(`INSERT INTO "ServicePhoto" ("visitId","stage","storageKey","contentType","sizeBytes","checksumSha256") VALUES ($1::uuid,$2,$3,'image/jpeg',$4,$5)`, id, stage, saved.storageKey, normalized.length, crypto.createHash('sha256').update(normalized).digest('hex'));
        await audit(tx, context, 'Service.PhotoSaved', id, 'save_service_photo', { stage, size_bytes: normalized.length });
      });
    } catch (error) {
      await this.storage.delete(saved.storageKey);
      throw error;
    }
    return this.detail(id, context);
  }

  async photo(photoId, context) {
    if (!uuid(photoId)) throw fail(404, 'SERVICE_PHOTO_NOT_FOUND', 'Фотография не найдена.');
    const rows = await this.prisma.$queryRawUnsafe('SELECT * FROM "ServicePhoto" WHERE "id"=$1::uuid AND "deletedAt" IS NULL', photoId);
    const photo = rows[0];
    if (!photo) throw fail(404, 'SERVICE_PHOTO_NOT_FOUND', 'Фотография не найдена.');
    await this.visit(photo.visitId, context);
    try { return { buffer: await this.storage.get(photo.storageKey), contentType: photo.contentType }; }
    catch (error) { if (error.code === 'ENOENT') throw fail(410, 'SERVICE_PHOTO_REMOVED', 'Файл фотографии удалён из хранилища.'); throw error; }
  }

  async complete(id, summary, context) {
    if (typeof summary !== 'string' || !summary.trim() || summary.length > 4000) throw fail(400, 'SERVICE_SUMMARY_REQUIRED', 'Опишите выполненные работы (до 4000 символов).');
    await this.prisma.$transaction(async (tx) => {
      const visit = await this.visit(id, context, tx, { lock: true });
      if (visit.status === 'COMPLETED') return;
      const photos = await tx.$queryRawUnsafe('SELECT DISTINCT "stage" FROM "ServicePhoto" WHERE "visitId"=$1::uuid AND "deletedAt" IS NULL', id);
      if (!['BEFORE', 'AFTER'].every((stage) => photos.some((photo) => photo.stage === stage))) throw fail(409, 'SERVICE_PHOTOS_REQUIRED', 'Добавьте фотографии до и после обслуживания.');
      await tx.$executeRawUnsafe('UPDATE "ServiceVisit" SET "status"=\'COMPLETED\',"summary"=$2,"completedAt"=NOW() WHERE "id"=$1::uuid', id, summary.trim());
      await audit(tx, context, 'Service.VisitCompleted', id, 'complete_service_visit', { machine_id: visit.machineId });
    });
    return this.detail(id, context);
  }
}

async function normalizeImage(buffer) {
  try {
    return await loadSharp()(buffer, { failOn: 'warning', limitInputPixels: 40_000_000, animated: false })
      .rotate().resize({ width: 2400, height: 2400, fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 85 }).toBuffer();
  } catch (error) {
    if (error.code === 'IMAGE_DECODER_SHARP_NOT_INSTALLED') throw fail(503, 'SERVICE_PHOTO_DECODER_UNAVAILABLE', 'Обработка фотографий ещё не настроена на сервере.');
    throw fail(400, 'SERVICE_PHOTO_INVALID', 'Не удалось прочитать изображение. Выберите фотографию JPEG, PNG или WebP.');
  }
}
function mutable(visit) { if (visit.status !== 'IN_PROGRESS') throw fail(409, 'SERVICE_VISIT_COMPLETED', 'Завершённое обслуживание нельзя изменять.'); }
function audit(tx, context, eventType, targetId, action, metadata) {
  return new AuditRepository(tx).record({ eventType, subjectType: 'administrator', subjectId: context.subject_id,
    targetType: 'ServiceVisit', targetId, action, decision: 'success', authMethod: context.auth_method,
    sourceChannel: 'service_workspace', correlationId: context.correlation_id || crypto.randomUUID(), metadata: { ...metadata, acting_role: context.active_service_role || null } });
}
function fail(statusCode, code, message) { return new ApiError({ statusCode, code, message }); }
module.exports = { ServiceVisitService, normalizeImage, MAX_PHOTO_BYTES };
