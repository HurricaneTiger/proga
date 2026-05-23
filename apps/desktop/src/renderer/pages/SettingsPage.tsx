import React, { useState } from 'react';
import { Save, Check } from 'lucide-react';
import { Card } from '../components/Card';
import { Button } from '../components/Button';
import { useSettings } from '../hooks/useIpc';

export function SettingsPage() {
  const { settings, updateSettings } = useSettings();
  const [relayUrl, setRelayUrl] = useState(settings.relayUrl);
  const [localPort, setLocalPort] = useState(String(settings.localPort));
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    const portNum = parseInt(localPort, 10) || 25565;
    updateSettings({ relayUrl, localPort: portNum });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);

    if (window.electronAPI) {
      window.electronAPI.updateSettings({ relayUrl, localPort: portNum });
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6 animate-fade-in">
      <h1 className="text-2xl font-bold">Настройки</h1>

      <Card>
        <div className="space-y-4">
          <div>
            <label className="text-sm text-gray-400 block mb-1">
              Адрес relay-сервера
            </label>
            <input
              type="text"
              value={relayUrl}
              onChange={(e) => setRelayUrl(e.target.value)}
              className="w-full bg-dark-700 border border-dark-600 rounded-lg px-4 py-2 text-white placeholder-gray-500 outline-none focus:border-primary-500 transition-colors duration-200"
              placeholder="http://localhost:3000"
            />
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
