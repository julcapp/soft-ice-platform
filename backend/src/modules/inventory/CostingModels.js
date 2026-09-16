const COMMERCIAL_STATUS = Object.freeze({ DRAFT: 'DRAFT', ACTIVE: 'ACTIVE', ARCHIVED: 'ARCHIVED' });
const PRICE_LIST_STATUS = Object.freeze({ DRAFT: 'DRAFT', PUBLISHED: 'PUBLISHED', ARCHIVED: 'ARCHIVED' });
const PRICE_SCOPE = Object.freeze({ NETWORK: 'NETWORK', ORGANIZATION: 'ORGANIZATION', LOCATION: 'LOCATION', MACHINE: 'MACHINE' });

function calculateUnitCost({ packagePrice, packageQuantity }) {
  const price = Number(packagePrice);
  const quantity = Number(packageQuantity);
  if (!Number.isFinite(price) || price < 0) throw new Error('packagePrice must be a non-negative number');
  if (!Number.isFinite(quantity) || quantity <= 0) throw new Error('packageQuantity must be greater than zero');
  return price / quantity;
}

function calculateRecipeCost({ recipeItems, purchaseCostsByItemId, wastePercent = 0 }) {
  if (!Array.isArray(recipeItems) || recipeItems.length === 0) return 0;
  const waste = Number(wastePercent);
  if (!Number.isFinite(waste) || waste < 0 || waste >= 100) throw new Error('wastePercent must be in [0, 100)');

  const net = recipeItems.reduce((sum, item) => {
    const quantity = Number(item.quantity);
    const unitCost = Number(purchaseCostsByItemId[item.inventoryItemId]);
    if (!Number.isFinite(quantity) || quantity <= 0) throw new Error(`Invalid recipe quantity for ${item.inventoryItemId}`);
    if (!Number.isFinite(unitCost) || unitCost < 0) throw new Error(`Missing active purchase cost for ${item.inventoryItemId}`);
    return sum + quantity * unitCost;
  }, 0);

  return net * (1 + waste / 100);
}

function calculateMargin({ retailPrice, cost }) {
  const retail = Number(retailPrice);
  const c = Number(cost);
  if (!Number.isFinite(retail) || retail < 0 || !Number.isFinite(c) || c < 0) throw new Error('Invalid retail price or cost');
  const grossProfit = retail - c;
  return {
    grossProfit,
    marginPercent: retail === 0 ? null : (grossProfit / retail) * 100,
    markupPercent: c === 0 ? null : (grossProfit / c) * 100,
  };
}

module.exports = { COMMERCIAL_STATUS, PRICE_LIST_STATUS, PRICE_SCOPE, calculateUnitCost, calculateRecipeCost, calculateMargin };
