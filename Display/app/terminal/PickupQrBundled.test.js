import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { PickupQrDetector, isPickupQr } from './PickupQrDetector.js';
const matrix = JSON.parse(fs.readFileSync(new URL('./qr-test-matrix.json', import.meta.url)));
for (const [name, options] of [['без BarcodeDetector', {}], ['повёрнутый QR', {rotate:true}], ['инвертированный QR', {invert:true}], ['неработающий BarcodeDetector', {native:class { detect(){throw Error('unsupported');} }}]]) {
 test('встроенная в bundle библиотека: '+name, async()=>{
  const size=matrix.length*5,data=new Uint8ClampedArray(size*size*4);
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){
   const row=Math.floor(y/5),col=Math.floor(x/5),dark=options.rotate?matrix[matrix.length-1-col][row]:matrix[row][col];
   const value=(options.invert?!dark:dark)?0:255;data.set([value,value,value,255],(y*size+x)*4);
  }
  const document={createElement:()=>({getContext:()=>({drawImage(){},getImageData:()=>({data,width:size,height:size})})})};
  const detector=new PickupQrDetector({NativeDetector:options.native,document});
  assert.equal((await detector.detect({videoWidth:size,videoHeight:size,readyState:2}))[0].rawValue,'UTP1:local-decoder-test');
 });
}
test('принимается только QR заказа; ссылки и неполные коды отклоняются',()=>{
 assert.equal(isPickupQr('UTP1:12345678-1234-1234-1234-123456789abc:123456'),true);
 for(const value of ['https://example.com','123456','UTP1:local-decoder-test','UTP1:12345678-1234-1234-1234-123456789abc:1234567'])assert.equal(isPickupQr(value),false);
});
