'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const {createTapGate} = require('../prototype-v0.9/service-access.js');
test('service login appears only on third rapid tap',()=>{
 let now=1000;const gate=createTapGate({clock:()=>now});
 assert.equal(gate.tap(),false);now+=200;
 assert.equal(gate.tap(),false);now+=200;
 assert.equal(gate.tap(),true);now+=200;
 assert.equal(gate.tap(),false);
});
test('slow taps do not accumulate',()=>{
 let now=1000;const gate=createTapGate({clock:()=>now});
 assert.equal(gate.tap(),false);now+=1300;
 assert.equal(gate.tap(),false);now+=1300;
 assert.equal(gate.tap(),false);
});
test('background or cancel resets sequence',()=>{
 let now=1000;const gate=createTapGate({clock:()=>now});
 gate.tap();gate.tap();gate.reset();assert.equal(gate.tap(),false);
});
test('clock rollback fails closed',()=>{
 let now=5000;const gate=createTapGate({clock:()=>now});
 gate.tap();now=4500;assert.equal(gate.tap(),false);
});
