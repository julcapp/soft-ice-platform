'use strict';

const fs = require('node:fs');
const path = require('node:path');

const prismaDir = path.resolve(__dirname, '../prisma');
const schemaPath = path.join(prismaDir, 'schema.prisma');
const fragmentPaths = [
  path.join(prismaDir, 'promotion-engine-v1.prisma.fragment'),
  path.join(prismaDir, 'pricing-engine-v1.prisma.fragment'),
  path.join(prismaDir, 'payment-reward-v1.prisma.fragment'),
];

const relationFields = {
  Customer: [
    'promotionApplications PromotionApplication[]',
    'pricingQuotes PricingQuote[]',
    'rewardCounters CustomerMachineRewardCounter[]',
    'giftRewardReservations GiftRewardReservation[]',
  ],
  Machine: [
    'promotionApplications PromotionApplication[]',
    'promotionGroupMemberships PromotionMachineGroupMember[]',
    'pricingQuotes PricingQuote[]',
    'rewardCounters CustomerMachineRewardCounter[]',
    'giftRewardReservations GiftRewardReservation[]',
  ],
  Order: [
    'promotionApplications PromotionApplication[]',
    'pricingQuote PricingQuote?',
    'pricingSnapshot PricingSnapshot?',
    'paymentAttempts PaymentAttempt[]',
  ],
  Segment: [
    'promotionAudiences PromotionAudience[]',
  ],
  PromotionCampaign: [
    'effectiveVersionId String?',
    'effectiveVersion PromotionVersion? @relation("PromotionEffectiveVersion", fields: [effectiveVersionId], references: [id], onDelete: SetNull)',
    'pricingQuotes PricingQuote[]',
  ],
  PromotionVersion: [
    'status String @default("DRAFT")',
    'effectiveForCampaigns PromotionCampaign[] @relation("PromotionEffectiveVersion")',
    'pricingQuotes PricingQuote[]',
  ],
};

function extractModelBlocks(source) {
  const lines = source.split(/\r?\n/);
  const blocks = [];
  let current = null;
  for (const line of lines) {
    const start = line.match(/^model\s+(\w+)\s*\{/);
    if (start) {
      if (current) throw new Error(`Nested model block near ${start[1]}.`);
      current = { name: start[1], lines: [line] };
      continue;
    }
    if (current) {
      current.lines.push(line);
      if (line.trim() === '}') {
        blocks.push({ name: current.name, content: current.lines.join('\n') });
        current = null;
      }
    }
  }
  if (current) throw new Error(`Unclosed model block: ${current.name}.`);
  return blocks;
}

function modelRegex(name) {
  return new RegExp(`(^|\\n)model\\s+${name}\\s*\\{`);
}

function fieldRegex(fieldName, typeExpression) {
  return new RegExp(`(^|\\n)\\s*${fieldName}\\s+${typeExpression}(?:\\s|$)`);
}

function appendMissingModels(schema, fragment) {
  const blocks = extractModelBlocks(fragment);
  let output = schema.trimEnd();
  for (const block of blocks) {
    if (!modelRegex(block.name).test(output)) {
      output += `\n\n${block.content}`;
    }
  }
  return `${output}\n`;
}

function addRelationFields(schema, modelName, fields) {
  const lines = schema.split(/\r?\n/);
  const startIndex = lines.findIndex((line) => new RegExp(`^model\\s+${modelName}\\s*\\{`).test(line));
  if (startIndex < 0) throw new Error(`Required model ${modelName} was not found.`);
  let endIndex = startIndex + 1;
  while (endIndex < lines.length && lines[endIndex].trim() !== '}') endIndex += 1;
  if (endIndex >= lines.length) throw new Error(`Model ${modelName} is not closed.`);

  const modelLines = lines.slice(startIndex, endIndex + 1);
  const missing = fields.filter((field) => {
    const fieldName = field.trim().split(/\s+/)[0];
    return !modelLines.some((line) => new RegExp(`^\\s*${fieldName}\\s+`).test(line));
  });
  if (!missing.length) return schema;

  const insertion = missing.map((field) => `  ${field}`);
  lines.splice(endIndex, 0, ...insertion);
  return lines.join('\n');
}

function assertIntegrated(schema) {
  const orderStatus = schema.match(/enum\s+OrderStatus\s*\{([\s\S]*?)\}/);
  if (!orderStatus || !/\bGIFT_TRANSFERRED\b/.test(orderStatus[1])) {
    throw new Error('Integrated schema is missing OrderStatus.GIFT_TRANSFERRED.');
  }

  const requiredModels = [
    'PromotionCampaign', 'PromotionVersion', 'PromotionSchedule', 'PromotionMachineGroup',
    'PromotionMachineGroupMember', 'PromotionTarget', 'PromotionAudience', 'PromotionRule',
    'PromotionChannel', 'PromotionApproval', 'PromotionEvent', 'PromotionApplication',
    'PricingQuote', 'PricingSnapshot', 'PricingSnapshotItem', 'PaymentAttempt',
    'CustomerMachineRewardCounter', 'GiftRewardReservation',
  ];
  for (const name of requiredModels) {
    if (!modelRegex(name).test(schema)) throw new Error(`Integrated schema is missing model ${name}.`);
  }

  const requiredFields = [
    ['orderId', 'String\\?\\s+@unique'],
    ['giftRewardReservation', 'GiftRewardReservation\\?'],
    ['paymentAttempts', 'PaymentAttempt\\[\\]'],
    ['promotionGroupMemberships', 'PromotionMachineGroupMember\\[\\]'],
  ];
  for (const [fieldName, typeExpression] of requiredFields) {
    if (!fieldRegex(fieldName, typeExpression).test(schema)) {
      throw new Error(`Integrated schema is missing required field: ${fieldName}`);
    }
  }

  const modelFields = [
    ['PromotionCampaign', 'effectiveVersionId', 'String\\?'],
    ['PromotionCampaign', 'effectiveVersion', 'PromotionVersion\\?'],
    ['PromotionVersion', 'status', 'String\\s+@default\\("DRAFT"\\)'],
    ['PromotionVersion', 'effectiveForCampaigns', 'PromotionCampaign\\[\\]'],
  ];
  const models = new Map(extractModelBlocks(schema).map((block) => [block.name, block.content]));
  for (const [modelName, fieldName, typeExpression] of modelFields) {
    const model = models.get(modelName);
    if (!model || !fieldRegex(fieldName, typeExpression).test(model)) {
      throw new Error(`Integrated schema is missing required field: ${modelName}.${fieldName}`);
    }
  }
}

function buildIntegratedSchema() {
  let schema = fs.readFileSync(schemaPath, 'utf8');
  for (const fragmentPath of fragmentPaths) {
    schema = appendMissingModels(schema, fs.readFileSync(fragmentPath, 'utf8'));
  }
  for (const [modelName, fields] of Object.entries(relationFields)) {
    schema = addRelationFields(schema, modelName, fields);
  }
  assertIntegrated(schema);
  return schema.replace(/\n{3,}/g, '\n\n').trimEnd() + '\n';
}

function main() {
  const checkOnly = process.argv.includes('--check');
  const current = fs.readFileSync(schemaPath, 'utf8');
  const integrated = buildIntegratedSchema();
  if (checkOnly) {
    if (current !== integrated) {
      console.error('schema.prisma is not synchronized with Promotion/Pricing/Payment fragments.');
      process.exitCode = 1;
      return;
    }
    console.log('schema.prisma is synchronized.');
    return;
  }
  if (current === integrated) {
    console.log('schema.prisma is already synchronized.');
    return;
  }
  fs.writeFileSync(schemaPath, integrated);
  console.log('schema.prisma synchronized with Promotion/Pricing/Payment fragments.');
}

main();
