import React from'react';
import{describe,it,expect}from'vitest';
import{renderToStaticMarkup}from'react-dom/server';
import{PaymentsPage}from'./Payments';
describe('Платежи',()=>{it('не содержит финансовых command-кнопок',()=>{const html=renderToStaticMarkup(<PaymentsPage client={async()=>[]}/>);expect(html).not.toContain('Отменить платёж');expect(html).not.toContain('Выполнить возврат');});});
