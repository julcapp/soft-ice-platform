class OutboxAdminService {
  constructor({repository,auditRepository}){this.repository=repository;this.auditRepository=auditRepository;}
  scope(context){return context.roles?.includes('PLATFORM_OWNER')?{platform:true}:{organizationId:context.organizationId};}
  list(filters,context){return this.repository.list(filters,this.scope(context));}
  counts(context){return this.repository.counts(this.scope(context));}
  async retry(eventId,context){if(!context.roles?.some((r)=>['PLATFORM_OWNER','ADMIN'].includes(r)))throw forbidden();const event=await this.repository.retryDeadLetter(eventId,this.scope(context));await this.auditRepository.record({eventType:'OUTBOX_ADMIN_RETRY',subjectType:'ADMIN',subjectId:context.actorId,targetType:'TRANSACTIONAL_OUTBOX_EVENT',targetId:event.eventId,action:'RETRY_DEAD_LETTER',decision:'ALLOWED',reasonCode:'EXPLICIT_ADMIN_ACTION',correlationId:context.correlationId,metadata:{organizationId:event.organizationId,eventType:event.eventType}});return event;}
}
function forbidden(){return Object.assign(new Error('Недостаточно прав для повторного запуска outbox event.'),{code:'OUTBOX_ADMIN_RETRY_FORBIDDEN',statusCode:403});}
module.exports={OutboxAdminService};
