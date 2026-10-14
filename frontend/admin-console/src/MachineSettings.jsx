import React, { useEffect, useState } from 'react';
import { getMachineSettings, saveMachineSetting } from './api/machineSettingsClient';
import { ErrorState, Skeleton, StatusBadge } from './components';

const sourceLabel = {
  BROWSER_MEDIA_DEVICE: 'Веб-камера через браузер',
  ANDROID_NATIVE_CAMERA: 'Камера Android / WebView',
  USB_SCANNER: 'USB QR-сканер',
};

export function MachineSettingsPanel({ machineId }) {
  const [state, setState] = useState({ status: 'loading', data: null, error: null });
  const [saving, setSaving] = useState(null);
  const [notice, setNotice] = useState('');

  const load = ({ signal } = {}) => {
    setState((current) => ({ ...current, status: current.data ? 'ready' : 'loading', error: null }));
    return getMachineSettings(machineId, { signal })
      .then((data) => setState({ status: 'ready', data, error: null }))
      .catch((error) => {
        if (error.name !== 'AbortError') setState({ status: 'error', data: null, error });
      });
  };

  useEffect(() => {
    const controller = new AbortController();
    load({ signal: controller.signal });
    return () => controller.abort();
  }, [machineId]);

  if (state.status === 'loading') return <Skeleton />;
  if (state.status === 'error') return <ErrorState />;

  const data = state.data;
  const setCamera = (patch) => setState((current) => ({ ...current, data: { ...current.data, cameraQr: { ...current.data.cameraQr, ...patch } } }));
  const setScan = (patch) => setState((current) => ({ ...current, data: { ...current.data, startupHardwareScan: { ...current.data.startupHardwareScan, ...patch } } }));

  const save = async (key, value) => {
    setSaving(key);
    setNotice('');
    try {
      const next = await saveMachineSetting(machineId, key, value);
      setState({ status: 'ready', data: next, error: null });
      setNotice('Настройки сохранены.');
    } catch (error) {
      setNotice(error.message || 'Не удалось сохранить настройки.');
    } finally {
      setSaving(null);
    }
  };

  return <div className="dashboard machine-settings-page">
    <section className="card machine-settings-intro">
      <div>
        <strong>Настройка аппарата</strong>
        <p>Параметры периферии и политика автодиагностики. Настройки сохраняются в PostgreSQL и аудируются.</p>
      </div>
      <StatusBadge status="ACTIVE" />
    </section>

    <div className="machine-settings-grid">
      <section className="card machine-setting-card">
        <div className="card-heading">
          <div><p className="eyebrow">Получение заказа</p><h2>Камера для QR-кода</h2></div>
          <StatusBadge status={data.cameraQr.enabled ? 'ACTIVE' : 'DISABLED'} />
        </div>

        <label className="setting-toggle">
          <input type="checkbox" checked={Boolean(data.cameraQr.enabled)} onChange={(e) => setCamera({ enabled: e.target.checked })} />
          <span><strong>Использовать камеру / сканер для получения заказа</strong><small>Ручной 6-значный код остаётся резервным способом.</small></span>
        </label>

        <label className="setting-field">
          <span>Источник QR</span>
          <select value={data.cameraQr.source} onChange={(e) => setCamera({ source: e.target.value })}>
            <option value="BROWSER_MEDIA_DEVICE">Веб-камера через браузер</option>
            <option value="ANDROID_NATIVE_CAMERA">Камера Android / WebView</option>
            <option value="USB_SCANNER">USB QR-сканер</option>
          </select>
          <small>{sourceLabel[data.cameraQr.source]}</small>
        </label>

        <label className="setting-field">
          <span>Предпочитаемая камера</span>
          <select value={data.cameraQr.preferredFacingMode} onChange={(e) => setCamera({ preferredFacingMode: e.target.value })}>
            <option value="environment">Основная / внешняя</option>
            <option value="user">Фронтальная</option>
          </select>
        </label>

        <label className="setting-toggle">
          <input type="checkbox" checked={Boolean(data.cameraQr.autoScan)} onChange={(e) => setCamera({ autoScan: e.target.checked })} />
          <span><strong>Автоматически ловить QR в кадре</strong><small>После распознавания отдельная кнопка подтверждения не требуется.</small></span>
        </label>

        <label className="setting-toggle">
          <input type="checkbox" checked={Boolean(data.cameraQr.fallbackManualCode)} onChange={(e) => setCamera({ fallbackManualCode: e.target.checked })} />
          <span><strong>Разрешить ручной код</strong><small>6 цифр остаются резервом при проблеме камеры.</small></span>
        </label>

        <dl className="identity-list compact">
          <dt>Назначение</dt><dd>Получение предоплаченного заказа</dd>
          <dt>Формат QR</dt><dd>{data.cameraQr.qrFormat || 'UTP1'}</dd>
          <dt>Обновлено</dt><dd>{data.cameraQr.updatedAt ? new Date(data.cameraQr.updatedAt).toLocaleString('ru-RU') : 'Ещё не сохранялось'}</dd>
        </dl>

        <button className="text-button setting-save" type="button" disabled={saving === 'camera_qr'} onClick={() => save('camera_qr', data.cameraQr)}>
          {saving === 'camera_qr' ? 'Сохраняем…' : 'Сохранить настройки камеры'}
        </button>
      </section>

      <section className="card machine-setting-card">
        <div className="card-heading">
          <div><p className="eyebrow">Диагностика запуска</p><h2>Сканирование инфраструктуры</h2></div>
          <StatusBadge status={data.startupHardwareScan.enabled ? 'ACTIVE' : 'DISABLED'} />
        </div>
        <p>При запуске edge-agent должен проверить подключённое оборудование и отправить фактический отчёт в платформу.</p>

        <label className="setting-toggle"><input type="checkbox" checked={Boolean(data.startupHardwareScan.enabled)} onChange={(e) => setScan({ enabled: e.target.checked })} /><span><strong>Автодиагностика при запуске</strong></span></label>
        <label className="setting-toggle"><input type="checkbox" checked={Boolean(data.startupHardwareScan.scanCamera)} onChange={(e) => setScan({ scanCamera: e.target.checked })} /><span><strong>Камеры</strong><small>USB / Android / браузерные media devices.</small></span></label>
        <label className="setting-toggle"><input type="checkbox" checked={Boolean(data.startupHardwareScan.scanQrScanner)} onChange={(e) => setScan({ scanQrScanner: e.target.checked })} /><span><strong>QR-сканеры</strong><small>USB HID / serial / native scanner.</small></span></label>
        <label className="setting-toggle"><input type="checkbox" checked={Boolean(data.startupHardwareScan.scanPos)} onChange={(e) => setScan({ scanPos: e.target.checked })} /><span><strong>POS-терминал</strong></span></label>
        <label className="setting-toggle"><input type="checkbox" checked={Boolean(data.startupHardwareScan.scanMdb)} onChange={(e) => setScan({ scanMdb: e.target.checked })} /><span><strong>MDB-контур</strong></span></label>
        <label className="setting-toggle"><input type="checkbox" checked={Boolean(data.startupHardwareScan.scanNetwork)} onChange={(e) => setScan({ scanNetwork: e.target.checked })} /><span><strong>Сеть и доступность API</strong></span></label>

        <button className="text-button setting-save" type="button" disabled={saving === 'startup_hardware_scan'} onClick={() => save('startup_hardware_scan', data.startupHardwareScan)}>
          {saving === 'startup_hardware_scan' ? 'Сохраняем…' : 'Сохранить политику запуска'}
        </button>
      </section>
    </div>

    <section className="card hardware-inventory-card">
      <div className="card-heading"><h2>Фактически обнаруженное оборудование</h2><StatusBadge status={data.hardwareInventory ? 'ACTIVE' : 'UNKNOWN'} /></div>
      {data.hardwareInventory
        ? <HardwareInventory inventory={data.hardwareInventory} updatedAt={data.hardwareInventoryUpdatedAt} />
        : <div className="empty-state compact"><strong>Отчёт edge-agent ещё не поступал</strong><p>После внедрения стартового hardware scan здесь появятся камеры, QR-сканер, POS, MDB и сетевые интерфейсы, реально найденные на аппарате.</p></div>}
    </section>

    {notice ? <p className="settings-notice" role="status">{notice}</p> : null}
  </div>;
}

function HardwareInventory({ inventory, updatedAt }) {
  const devices = Array.isArray(inventory.devices) ? inventory.devices : [];
  return <>
    <p>Последний отчёт: {updatedAt ? new Date(updatedAt).toLocaleString('ru-RU') : '—'}</p>
    {devices.length ? <div className="settings-device-list">{devices.map((device, index) => <article key={device.id || index} className="settings-device"><strong>{device.name || device.type || 'Устройство'}</strong><span>{device.status || 'UNKNOWN'}</span><small>{[device.vendor, device.model, device.driver].filter(Boolean).join(' · ') || 'Детали не переданы'}</small></article>)}</div> : <p>Устройства в отчёте отсутствуют.</p>}
  </>;
}
