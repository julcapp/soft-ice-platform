class EventCenterRuntime {
  constructor({ service }) { this.service = service; }
  ingest(event) { return this.service.ingestion.ingest(event); }
  list(filters, context) { return this.service.query.list(filters, context); }
  get(eventId, context) { return this.service.query.get(eventId, context); }
  correlation(id, context) { return this.service.query.correlation(id, context); }
  statistics(filters, context) { this.service.query.scopedFilters(filters, context); return this.service.repository.statistics(filters); }
}
module.exports = { EventCenterRuntime };
