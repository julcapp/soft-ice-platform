const { PHOTO_VERIFICATION_DECISIONS } = require('./constants');

const RESULT_SCHEMA = {
  type: 'object', additionalProperties: false,
  properties: {
    decision: { type: 'string', enum: ['approved', 'rejected', 'manual_review'] },
    confidence: { type: 'number', minimum: 0, maximum: 1 },
    fraudScore: { type: 'number', minimum: 0, maximum: 1 },
    reasonCode: { type: 'string' },
    checks: {
      type: 'object', additionalProperties: false,
      properties: {
        challengeRelevant: { type: 'boolean' },
        requiredSubjectsPresent: { type: 'boolean' },
        imageQualityAcceptable: { type: 'boolean' },
        screenshotSuspected: { type: 'boolean' },
        unsafeContent: { type: 'boolean' },
        captureCodeVisible: { type: 'boolean' },
        detectedCaptureCode: { type: ['string', 'null'] },
      },
      required: ['challengeRelevant', 'requiredSubjectsPresent', 'imageQualityAcceptable', 'screenshotSuspected', 'unsafeContent', 'captureCodeVisible', 'detectedCaptureCode'],
    },
  },
  required: ['decision', 'confidence', 'fraudScore', 'reasonCode', 'checks'],
};

class OpenAIVisionProvider {
  constructor({
    apiKey = process.env.OPENAI_API_KEY,
    model = process.env.PHOTO_VISION_MODEL,
    fetchImpl = global.fetch,
    mediaLoader,
    endpoint = 'https://api.openai.com/v1/responses',
  } = {}) {
    this.apiKey = apiKey || null;
    this.model = model || null;
    this.fetch = fetchImpl;
    this.mediaLoader = mediaLoader;
    this.endpoint = endpoint;
    this.name = 'openai';
  }

  async analyze(input) {
    if (!this.apiKey) throw configuredError('OPENAI_API_KEY_NOT_CONFIGURED');
    if (!this.model) throw configuredError('PHOTO_VISION_MODEL_NOT_CONFIGURED');
    if (!this.mediaLoader) throw configuredError('PHOTO_VISION_MEDIA_LOADER_NOT_CONFIGURED');

    const media = await this.mediaLoader(input.storageKey);
    if (!Buffer.isBuffer(media?.buffer)) throw configuredError('PHOTO_VISION_MEDIA_NOT_FOUND');
    const mimeType = media.mimeType || 'image/jpeg';
    const imageUrl = `data:${mimeType};base64,${media.buffer.toString('base64')}`;
    const rulesText = JSON.stringify(input.rules || {});
    const metadataText = JSON.stringify(input.metadata || {});
    const antifraudText = JSON.stringify(input.antifraud || {});

    const response = await this.fetch(this.endpoint, {
      method: 'POST',
      headers: { Authorization: `Bearer ${this.apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: this.model,
        store: false,
        input: [{
          role: 'user',
          content: [
            {
              type: 'input_text',
              text: `Проверь фотографию для фотозадания. Не принимай бизнес-решений и не начисляй награды. Правила: ${rulesText}. Технические метаданные: ${metadataText}. Антифрод-сигналы: ${antifraudText}. Отдельно проверь, виден ли на изображении штамп формата ТИМОША-XXXXXX. Если он читается, верни его дословно в detectedCaptureCode; если не читается или отсутствует, верни null. Не пытайся угадать ожидаемый код и не определяй самостоятельно, совпадает ли он с серверным challenge. Оцени только видимые признаки и верни структурированный результат.`,
            },
            { type: 'input_image', image_url: imageUrl, detail: 'high' },
          ],
        }],
        text: { format: { type: 'json_schema', name: 'photo_verification_result', strict: true, schema: RESULT_SCHEMA } },
      }),
    });

    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(body?.error?.message || `OpenAI Responses API HTTP ${response.status}`);
      error.code = body?.error?.code || 'OPENAI_VISION_REQUEST_FAILED';
      throw error;
    }
    const outputText = extractOutputText(body);
    if (!outputText) throw configuredError('OPENAI_VISION_EMPTY_OUTPUT');
    let parsed;
    try { parsed = JSON.parse(outputText); } catch { throw configuredError('OPENAI_VISION_INVALID_JSON'); }
    return {
      provider: this.name,
      model: body.model || this.model,
      decision: Object.values(PHOTO_VERIFICATION_DECISIONS).includes(parsed.decision) ? parsed.decision : PHOTO_VERIFICATION_DECISIONS.MANUAL_REVIEW,
      confidence: parsed.confidence,
      fraudScore: parsed.fraudScore,
      reasonCode: parsed.reasonCode,
      checks: parsed.checks || {},
    };
  }
}

function extractOutputText(response) {
  if (typeof response.output_text === 'string') return response.output_text;
  for (const item of response.output || []) {
    for (const content of item.content || []) if (content.type === 'output_text' && typeof content.text === 'string') return content.text;
  }
  return null;
}
function configuredError(code) { const error = new Error(code); error.code = code; return error; }
module.exports = { OpenAIVisionProvider, RESULT_SCHEMA, extractOutputText };
