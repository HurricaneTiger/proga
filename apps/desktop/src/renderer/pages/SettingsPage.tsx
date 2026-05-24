import React, { useState } from 'react';
import { Save, Check } from 'lucide-react';
import { Card } from '../components/Card';
import { Button } from '../components/Button';
import { useSettings, RelayMode } from '../hooks/useIpc';

function isValidRelayUrl(url: string): boolean {
  if (!url.trim()) return false;
  return /^(wss?|https?):\/\/.+/i.test(url.trim());
}

export function SettingsPage() {
  const { settings, updateSettings } = useSettings();
  const [relayMode, setRelayMode] = useState<RelayMode>(settings.relayMode);
  const [customRelayUrl, setCustomRelayUrl] = useState(settings.customRelayUrl);
  const [localPort, setLocalPort] = useState(String(settings.localPort));
  const [saved, setSaved] = useState(false);
  const [urlError, setUrlError] = useState('');

  const handleSave = () => {
    if (relayMode === 'custom' && !isValidRelayUrl(customRelayUrl)) {
      setUrlError('URL должен начинаться с ws://, wss://, http:// или https://');
      return;
    }
    setUrlError('');
    const portNum = parseInt(localPort, 10) || 25565;
    updateSettings({ relayMode, customRelayUrl, localPort: portNum });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);

    if (window.electronAPI) {
      window.electronAPI.updateSettings({ relayMode, customRelayUrl, localPort: portNum });
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6 animate-fade-in">
      <h1 className="text-2xl font-bold">Настройки</h1>

      <Card>
        <div className="space-y-4">
          <div>
            <label className="text-sm text-gray-400 block mb-2">
              Режим relay-сервера
            </label>
            <div className="space-y-2">
              <label className="flex items-start gap-3 cursor-pointer p-3 rounded-lg border border-dark-600 hover:border-primary-500 transition-colors duration-200"
                style={{ borderColor: relayMode === 'public' ? 'rgb(var(--color-primary-500, 139 92 246))' : undefined }}>
                <input
                  type="radio"
                  name="relayMode"
                  value="public"
                  checked={relayMode === 'public'}
                  onChange={() => setRelayMode('public')}
                  className="mt-1"
                />
                <div>
                  <span className="text-white font-medium">Публичный сервер (интернет)</span>
                  <p className="text-xs text-gray-500 mt-0.5">
                    wss://mc-lan-tunnel.onrender.com - бесплатный relay для игры через интернет
                  </p>
                </div>
              </label>

              <label className="flex items-start gap-3 cursor-pointer p-3 rounded-lg border border-dark-600 hover:border-primary-500 transition-colors duration-200"
                style={{ borderColor: relayMode === 'local' ? 'rgb(var(--color-primary-500, 139 92 246))' : undefined }}>
                <input
                  type="radio"
                  name="relayMode"
                  value="local"
                  checked={relayMode === 'local'}
                  onChange={() => setRelayMode('local')}
                  className="mt-1"
                />
                <div>
                  <span className="text-white font-medium">Локальный (только LAN)</span>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Встроенный relay на localhost:3000 - для игры в одной локальной сети
                  </p>
                </div>
              </label>

              <label className="flex items-start gap-3 cursor-pointer p-3 rounded-lg border border-dark-600 hover:border-primary-500 transition-colors duration-200"
                style={{ borderColor: relayMode === 'custom' ? 'rgb(var(--color-primary-500, 139 92 246))' : undefined }}>
                <input
                  type="radio"
                  name="relayMode"
                  value="custom"
                  checked={relayMode === 'custom'}
                  onChange={() => setRelayMode('custom')}
                  className="mt-1"
                />
                <div className="flex-1">
                  <span className="text-white font-medium">Свой сервер</span>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Укажите адрес своего relay-сервера
                  </p>
                </div>
              </label>
            </div>

            {relayMode === 'custom' && (
              <div className="mt-3">
                <input
                  type="text"
                  value={customRelayUrl}
                  onChange={(e) => {
                    setCustomRelayUrl(e.target.value);
                    setUrlError('');
                  }}
                  className="w-full bg-dark-700 border border-dark-600 rounded-lg px-4 py-2 text-white placeholder-gray-500 outline-none focus:border-primary-500 transition-colors duration-200"
                  placeholder="wss://your-server.com/ws"
                />
                {urlError && (
                  <p className="text-xs text-red-400 mt-1">{urlError}</p>
                )}
              </div>
            )}
          </div>

          <div>
            <label className="text-sm text-gray-400 block mb-1">
              Предпочтительный локальный порт (для клиента)
            </label>
            <input
              type="text"
              value={localPort}
              onChange={(e) => setLocalPort(e.target.value.replace(/\D/g, ''))}
              className="w-full bg-dark-700 border border-dark-600 rounded-lg px-4 py-2 text-white placeholder-gray-500 outline-none focus:border-primary-500 transition-colors duration-200"
              placeholder="25565"
            />
            <p className="text-xs text-gray-500 mt-1">
              Порт, на котором клиент будет слушать подключения от Minecraft
            </p>
          </div>
        </div>
      </Card>

      <Button onClick={handleSave}>
        <span className="flex items-center gap-1.5">
          {saved ? <Check size={14} /> : <Save size={14} />}
          {saved ? 'Сохранено!' : 'Сохранить'}
        </span>
      </Button>
    </div>
  );
}
