const crypto = require('crypto');

class InMemoryOperatorWorkspaceRepository {
  constructor({ machines = defaultMachines() } = {}) {
    this.machines = new Map(machines.map((machine) => [machine.id, Object.freeze(machine)]));
    this.sessions = new Map();
    this.actions = [];
    this.idempotency = new Map();
  }

  listMachines(operatorId) {
    return [...this.machines.values()].filter((machine) => machine.assignedOperatorIds.includes(operatorId));
  }

  findMachine(machineId) { return this.machines.get(machineId) || null; }
  findSession(sessionId) { return this.sessions.get(sessionId) || null; }

  saveSession(session) {
    const saved = Object.freeze(structuredClone(session));
    this.sessions.set(saved.id, saved);
    return saved;
  }

  appendAction(action) {
    const saved = Object.freeze(structuredClone(action));
    this.actions.push(saved);
    return saved;
  }

  listActions({ operatorId, machineId, limit = 100 } = {}) {
    return this.actions
      .filter((action) => (!operatorId || action.operatorId === operatorId) && (!machineId || action.machineId === machineId))
      .slice(-limit)
      .reverse();
  }

  async idempotent(scope, key, input, callback) {
    const hash = crypto.createHash('sha256').update(stable(input)).digest('hex');
    const composite = `${scope}:${key}`;
    const previous = this.idempotency.get(composite);
    if (previous) {
      if (previous.hash !== hash) throw Object.assign(new Error('Ключ идемпотентности использован с другими данными.'), { statusCode: 409, code: 'OPERATOR_WORKSPACE_IDEMPOTENCY_CONFLICT' });
      return previous.result;
    }
    const result = await callback();
    this.idempotency.set(composite, { hash, result });
    return result;
  }
}

function stable(value) {
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.keys(value).sort().map((key) => `${key}:${stable(value[key])}`).join(',')}}`;
  return JSON.stringify(value);
}

function defaultMachines() {
  return [
    {
      id: 'machine_demo_1', code: 'SI-TOM-001', name: 'Автомат на проспекте Ленина',
      address: 'Томск, проспект Ленина, 80', status: 'Требует обслуживания',
      assignedOperatorIds: ['operator_demo'], syrupLines: ['Клубника', 'Шоколад'],
      lastServiceAt: '2026-07-23T08:30:00.000Z',
      consumables: [
        { itemId: 'cup_200_ml', name: 'Стаканчик 200 мл', unit: 'шт.', level: 24 },
        { itemId: 'mix_vanilla', name: 'Смесь ванильная', unit: 'г', level: 1850 },
        { itemId: 'syrup_strawberry', name: 'Сироп клубничный', unit: 'мл', level: 620 },
      ],
    },
    {
      id: 'machine_demo_2', code: 'SI-TOM-002', name: 'Автомат в ТЦ «Лето»',
      address: 'Томск, улица Нахимова, 8', status: 'Готов к работе',
      assignedOperatorIds: ['operator_demo'], syrupLines: [],
      lastServiceAt: '2026-07-24T05:15:00.000Z',
      consumables: [
        { itemId: 'cup_200_ml', name: 'Стаканчик 200 мл', unit: 'шт.', level: 86 },
        { itemId: 'mix_vanilla', name: 'Смесь ванильная', unit: 'г', level: 4100 },
      ],
    },
  ];
}

module.exports = { InMemoryOperatorWorkspaceRepository };
