import React from'react';import{describe,expect,it}from'vitest';import{renderToStaticMarkup}from'react-dom/server';import{TransactionalOutboxPage}from'./TransactionalOutbox';
describe('Transactional Outbox admin view',()=>{it('exports the page component',()=>{expect(typeof TransactionalOutboxPage).toBe('function');});});
