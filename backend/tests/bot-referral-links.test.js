const test=require('node:test');const assert=require('node:assert/strict');
const {createBotReferralLinks}=require('../src/modules/bot_core/BotReferralLinks');
const {buildReferralSection}=require('../src/modules/referral/ReferralView');
const {toTelegramButton}=require('../src/modules/bot_core/TelegramRenderer');
const {toMaxButton}=require('../src/modules/bot_core/MaxRenderer');
const {parseStartPayload}=require('../src/modules/bot_core/DeepLinkParser');
const build=createBotReferralLinks({telegramUsername:'Exgorod_bot',maxUsername:'id7017438363_bot'});
test('channel links round-trip the same inviter code and reject missing/unsafe configuration',()=>{
 for(const ch of ['telegram','max']){const url=new URL(build('ref_ABC12',ch));assert.equal(parseStartPayload(url.searchParams.get('start')).referralCode,'ABC12');assert.equal(url.hostname,ch==='telegram'?'t.me':'max.ru');}
 assert.equal(build('bad payload','telegram'),null);assert.equal(createBotReferralLinks()('ref_ABC','telegram'),null);
});
test('sharing opens the right messenger picker and copy preserves full link',()=>{
 const urls={telegram:build('ref_ABC12','telegram'),max:build('ref_ABC12','max')};
 const view=buildReferralSection({inviteUrl:urls.telegram,inviteUrls:urls});
 const tg=new URL(view.actions[0].url);assert.equal(tg.origin+tg.pathname,'https://t.me/share/url');assert.equal(tg.searchParams.get('url'),urls.telegram);
 const max=new URL(view.actions[1].url);assert.equal(max.origin+max.pathname,'https://max.ru/:share');assert.ok(max.searchParams.get('text').endsWith(urls.max));
 const copy=view.actions.find(x=>x.type==='referral_copy');assert.equal(toTelegramButton(copy).copy_text.text,urls.telegram);assert.equal(toMaxButton(copy).payload,'action:referral_link');
});
