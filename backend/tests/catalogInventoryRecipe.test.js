const test=require('node:test');
const assert=require('node:assert/strict');
const {CatalogService}=require('../src/modules/catalog/CatalogService');

function serviceWith(items){
  return new CatalogService({
    repository:{
      findItemsBySkus:async(skus)=>items.filter((item)=>skus.includes(item.sku)),
      listInventoryItems:async()=>[],
    },
  });
}

test('system no-option item may have empty inventory recipe',async()=>{
  const service=serviceWith([{id:'c1',sku:'topping_none',active:true,systemItem:true,inventoryRecipe:[]}]);
  assert.deepEqual(await service.resolveInventoryRecipe(['topping_none']),[]);
});

test('saleable item without inventory recipe is blocked',async()=>{
  const service=serviceWith([{id:'c1',sku:'ice_cream',active:true,systemItem:false,inventoryRecipe:[]}]);
  await assert.rejects(()=>service.resolveInventoryRecipe(['ice_cream']),{code:'CATALOG_RECIPE_MISSING'});
});

test('recipe resolver aggregates same durable inventory item across selected catalog skus',async()=>{
  const inventoryItem={id:'inv_mix',sku:'mix_vanilla',name:'Смесь',baseUnit:'gram'};
  const service=serviceWith([
    {id:'c1',sku:'ice_cream',active:true,systemItem:false,inventoryRecipe:[
      {inventoryItemId:'inv_mix',ingredientType:'MIX',unit:'gram',quantity:80,inventoryItem},
    ]},
    {id:'c2',sku:'extra_mix',active:true,systemItem:false,inventoryRecipe:[
      {inventoryItemId:'inv_mix',ingredientType:'MIX',unit:'gram',quantity:20,inventoryItem},
    ]},
  ]);
  const result=await service.resolveInventoryRecipe(['ice_cream','extra_mix']);
  assert.equal(result.length,1);
  assert.equal(result[0].inventoryItemId,'inv_mix');
  assert.equal(result[0].quantity,100);
  assert.equal(result[0].unit,'gram');
});
