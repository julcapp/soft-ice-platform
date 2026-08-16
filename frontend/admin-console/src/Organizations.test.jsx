import React from 'react';
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { OrganizationCard, OrganizationList } from './Organizations';

const data={organization:{id:'org-1',organizationType:'ООО',fullName:'ООО «У Тимоши»',shortName:'У Тимоши',inn:'7000000000',status:'ACTIVE'},units:[{id:'unit-1',name:'Эксплуатация',parentId:null},{id:'unit-2',name:'Сервис',parentId:'unit-1'}],members:[{id:'member-1',fullName:'Иван Иванов',position:'Инженер',status:'ACTIVE',roleAssignments:[{role:'SERVICE_SPECIALIST'}]}],locations:[{id:'location-1',name:'ТЦ Лето',address:'Томск',status:'ACTIVE',machineAssignments:[]}],machines:[{id:'assignment-1',machine:{name:'SI-TOM-001',status:'ONLINE'},operatorOrganization:{shortName:'У Тимоши'}}],responsibilities:[{id:'r-1',member:{fullName:'Иван Иванов'},scope:'MACHINE',assignedAt:'2026-08-16'}],events:[],metrics:{departments:2,employees:1,locations:1,machines:1,machinesOnline:1,machinesOffline:0,activeIncidents:0,machinesRequiringService:0,sales:10,revenueRub:1500,customers:2,serviceWorks:0,sources:{machine:'LIVE',orders:'LIVE',customers:'FOUNDATION_ONLY',incidents:'FOUNDATION_ONLY',maintenance:'FOUNDATION_ONLY'}}};

describe('Организация 360',()=>{
  it('показывает русскоязычный список и статус',()=>{const html=renderToStaticMarkup(<OrganizationList organizations={[data.organization]}/>); expect(html).toContain('Список организаций'); expect(html).toContain('Активно');});
  it('показывает восемь разделов и показатели обзора',()=>{const html=renderToStaticMarkup(<OrganizationCard data={data} tab="overview"/>); for(const label of ['Обзор','Структура','Сотрудники','Точки','Аппараты','Ответственные','События','Показатели','Аппараты онлайн','Активные инциденты'])expect(html).toContain(label);});
  it('честно маркирует foundation-only источники показателей',()=>{const html=renderToStaticMarkup(<OrganizationCard data={data} tab="metrics"/>); expect(html).toContain('Количество клиентов'); expect(html).toContain('Базовая реализация'); expect(html).toContain('Оборот');});
  it('показывает empty-state событий на русском языке',()=>{const html=renderToStaticMarkup(<OrganizationCard data={data} tab="events"/>); expect(html).toContain('События организации пока не поступали');});
});
