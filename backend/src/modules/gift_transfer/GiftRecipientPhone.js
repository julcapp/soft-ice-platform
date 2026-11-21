'use strict';
function validateGiftRecipientPhone(value){
 if(typeof value!=='string'||!/^\+7\d{10}$/.test(value))throw Object.assign(new Error('Введите 10 цифр номера после +7.'),{code:'GIFT_PHONE_INVALID',statusCode:400});
 return value;
}
module.exports={validateGiftRecipientPhone};
