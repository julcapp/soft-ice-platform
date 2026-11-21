'use strict';
const https = require('node:https');
const fs = require('node:fs');
const { randomUUID } = require('node:crypto');
const fail = (code, message) => Object.assign(new Error(message), { code, statusCode: 503 });
class SberQrTransport {
  constructor({ env = process.env, requestImpl = https.request } = {}) { this.env = env; this.requestImpl = requestImpl; }
  isConfigured() { return ['SBER_QR_CLIENT_ID','SBER_QR_CLIENT_SECRET','SBER_QR_CERT_PATH','SBER_QR_KEY_PATH','SBER_QR_CA_PATH'].every(k => Boolean(this.env[k])); }
  async post(path, body, headers = {}, form = false) {
    if (!this.isConfigured()) throw fail('SBER_QR_NOT_CONFIGURED', 'Шлюз Сбербанка ещё не настроен.');
    if (!/^\/prod\/(?:tokens\/v3\/oauth|qr\/order\/v3\/(?:creation|status|revocation|cancel|registry))$/.test(path)) throw fail('SBER_QR_PATH_INVALID', 'Недопустимый метод Сбербанка.');
    const bytes = form ? new URLSearchParams(body).toString() : JSON.stringify(body);
    const e = this.env;
    let tls;
    try { tls = { cert: fs.readFileSync(e.SBER_QR_CERT_PATH), key: fs.readFileSync(e.SBER_QR_KEY_PATH), ca: fs.readFileSync(e.SBER_QR_CA_PATH), passphrase: e.SBER_QR_KEY_PASSPHRASE }; }
    catch { throw fail('SBER_QR_CERTIFICATE_UNAVAILABLE', 'Сертификат шлюза Сбербанка недоступен.'); }
    return new Promise((resolve, reject) => {
      let total = 0, timer;
      const req = this.requestImpl({ hostname:'mc.api.sberbank.ru', port:443, path, method:'POST', ...tls, rejectUnauthorized:true, minVersion:'TLSv1.2', headers:{ Accept:'application/json','Content-Type':form ? 'application/x-www-form-urlencoded' : 'application/json','Content-Length':Buffer.byteLength(bytes), ...headers } }, res => {
        const chunks=[];res.on('data',chunk=>{total+=chunk.length;if(total>1048576) req.destroy(fail('SBER_QR_RESPONSE_TOO_LARGE','Некорректный ответ банка.'));else chunks.push(chunk);});
        res.on('error',()=>reject(fail('SBER_QR_NETWORK_ERROR','Ответ банка прервался. Проверяем этот же платёж.')));
        res.on('end',()=>{clearTimeout(timer);if(res.statusCode!==200)return reject(fail('SBER_QR_BANK_UNAVAILABLE','Банк пока не подтвердил результат запроса.'));try{resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));}catch{reject(fail('SBER_QR_RESPONSE_INVALID','Некорректный ответ банка.'));}});
      });
      timer=setTimeout(()=>req.destroy(fail('SBER_QR_TIMEOUT','Банк не ответил вовремя. Повторная оплата не требуется.')),10000);
      req.on('error',()=>{clearTimeout(timer);reject(fail('SBER_QR_NETWORK_ERROR','Связь с банком прервалась. Проверяем этот же платёж.'));});
      req.end(bytes);
    });
  }
  async request(operation, body) {
    const scopes={creation:'create',status:'status',revocation:'revoke',cancel:'cancel',registry:'registry'};
    if(!scopes[operation])throw fail('SBER_QR_OPERATION_INVALID','Недопустимая операция.');
    const scope=operation==='registry'?'auth://qr/order.registry':`https://api.sberbank.ru/qr/order.${scopes[operation]}`;
    const token=await this.post('/prod/tokens/v3/oauth',{grant_type:'client_credentials',scope},{RqUID:randomUUID().replaceAll('-',''),'X-IBM-Client-ID':this.env.SBER_QR_CLIENT_ID,Authorization:'Basic '+Buffer.from(this.env.SBER_QR_CLIENT_ID+':'+this.env.SBER_QR_CLIENT_SECRET).toString('base64')},true);
    if(typeof token.access_token!=='string'||!token.access_token||/[\r\n]/.test(token.access_token))throw fail('SBER_QR_TOKEN_INVALID','Авторизация в банке не подтверждена.');
    return this.post('/prod/qr/order/v3/'+operation,body,{RqUID:body.rq_uid||body.rqUid,Authorization:'Bearer '+token.access_token});
  }
}
module.exports={SberQrTransport,fail};
