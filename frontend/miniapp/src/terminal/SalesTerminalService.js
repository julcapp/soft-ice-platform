import { catalogService } from '../domain/catalog/index.js';
import { configurationService } from '../domain/configuration/index.js';
import { pricingService } from '../domain/pricing/index.js';
import { recipeService } from '../domain/recipe/index.js';
import { SALES_CHANNELS } from './salesChannelData.js';

const TERMINAL_PRODUCT_ID = 'product_soft_ice_vanilla_cup';

export class SalesTerminalService {
  getCatalogView() {
    const product = catalogService.getProductById(TERMINAL_PRODUCT_ID);
    const flavor = catalogService.getFlavorById(product.defaultFlavor);

    return {
      product,
      flavor,
      syrups: product.allowedSyrups.map((id) => catalogService.getSyrupById(id)),
      toppings: product.allowedToppings.map((id) => catalogService.getToppingById(id)),
    };
  }

  createOrderPreview({ syrupId, toppingId }) {
    const product = catalogService.getProductById(TERMINAL_PRODUCT_ID);
    const configuration = configurationService.buildConfiguration({
      productId: product.id,
      flavorId: product.defaultFlavor,
      sizeId: 'size_cup_standard',
      syrupId,
      toppingId,
      extras: [],
    });
    const recipe = recipeService.buildRecipe(configuration);
    const pricing = pricingService.calculatePricing(product, configuration, recipe);

    return { product, configuration, recipe, pricing };
  }

  createPaymentIntent({ channelId, methodId, orderPreview, quote }) {
    if (!quote?.id || quote.finalAmount == null) {
      throw new Error('Server pricing quote is required before payment.');
    }
    const channel = SALES_CHANNELS.find(({ id }) => id === channelId);
    const sequence = String(Date.now()).slice(-4);

    return {
      id: `payment_demo_${Date.now()}`,
      orderId: `SI-${sequence}`,
      saleCode: `${sequence.slice(0, 2)}-${sequence.slice(2)}`,
      channelId,
      fulfillment: channel.fulfillment,
      methodId,
      amount: Number(quote.finalAmount),
      currency: quote.currency || orderPreview.pricing.currency,
      pricingQuoteId: quote.id,
      campaignId: quote.campaignId || null,
      giftAmount: Number(quote.giftAmount || 0),
      promotionDiscountAmount: Number(quote.promotionDiscountAmount || 0),
      paymentRequired: Boolean(quote.paymentRequired),
      status: 'pending',
    };
  }

  applyDemoPaymentConfirmation(intent) {
    return {
      ...intent,
      status: 'succeeded',
      confirmedBy: 'demo_payment_runtime_event',
      confirmedAt: new Date().toISOString(),
    };
  }
}

export const salesTerminalService = new SalesTerminalService();
