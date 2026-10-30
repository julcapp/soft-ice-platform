"""Guarded additive patch for the existing deployed terminal checkout service.

The runtime source contains prior deployment fixes; never replace the whole file.
No payment request is performed by this installer.
"""
import re


def patch_terminal(source):
    if 'SBER_QR_TERMINAL_HOOK_V1' in source:
        return source
    signature = "async initiate({ machineId, quoteId, purchaseToken = null, method = 'sbp', idempotencyKey }, context = {}) {"
    allowed = "['sbp', 'test_card'].includes"
    provider = re.compile(r"provider:\s*'YOOKASSA'")
    assert source.count(signature) == 1, 'Terminal initiate signature changed'
    assert source.count(allowed) == 1, 'Terminal method validation changed'
    assert len(provider.findall(source)) == 1, 'Terminal provider mapping changed'
    gate = "\n    // SBER_QR_TERMINAL_HOOK_V1\n    if (method === 'sber_sbp') new (require('./sber/SberQrPaymentAdapter').SberQrPaymentAdapter)({prisma:require('../../common/database').getPrismaClient()}).assertReady(machineId);"
    result = source.replace(signature, signature + gate).replace(allowed, "['sbp', 'test_card', 'sber_sbp'].includes")
    return provider.sub("provider: method === 'sber_sbp' ? 'SBER_SBP' : 'YOOKASSA'", result)
