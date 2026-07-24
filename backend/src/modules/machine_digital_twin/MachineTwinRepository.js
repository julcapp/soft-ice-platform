class MachineTwinRepository {
  constructor() { this.snapshots = new Map(); this.events = new Map(); }
  appendSnapshot(snapshot) {
    const records = this.snapshots.get(snapshot.machineId) || [];
    if (!records.some(({ snapshotId }) => snapshotId === snapshot.snapshotId)) records.push(snapshot);
    this.snapshots.set(snapshot.machineId, records); return snapshot;
  }
  appendEvent(event) {
    const records = this.events.get(event.machineId) || [];
    if (!records.some(({ eventId }) => eventId === event.eventId)) records.push(event);
    this.events.set(event.machineId, records); return event;
  }
  listSnapshots(machineId) { return [...(this.snapshots.get(machineId) || [])].reverse(); }
  listEvents(machineId) { return [...(this.events.get(machineId) || [])].reverse(); }
}
module.exports = { MachineTwinRepository };
