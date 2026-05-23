import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Info, LogOut } from 'lucide-react';
import { Card } from '../components/Card';
import { StatusBadge } from '../components/StatusBadge';
import { CopyButton } from '../components/CopyButton';
import { Button } from '../components/Button';
import { useRoom } from '../hooks/useIpc';

export function RoomClientPage() {
  const navigate = useNavigate();
  const { clientStatus } = useRoom();

  const localPort = clientStatus?.localPort || 25565;
  const localAddress = `127.0.0.1:${localPort}`;
  const hostOnline = clientStatus?.hostOnline ?? true;
  const connected = clientStatus?.connected ?? false;
  const reconnecting = clientStatus?.reconnecting ?? false;

  const handleDisconnect = async () => {
    if (window.electronAPI) {
      await window.electronAPI.stopTunnel();
    }
    navigate('/');
  };

  const connectionStatus = reconnecting
    ? 'connecting'
    : connected
      ? 'online'
      : 'offline';

  const connectionText = reconnecting
    ? 'Переподключение...'
    : connected
      ? 'Подключено'
      : 'Отключено';

  return (
    <div className="max-w-2xl mx-auto space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Подключение к комнате</h1>
        <StatusBadge status={connectionStatus} text={connectionText} />
      </div>

      {/* Host status */}
      <Card>
        <div className="flex items-center justify-between">
          <span className="text-gray-400 text-sm">Статус хоста:</span>
          <StatusBadge
            status={hostOnline ? 'online' : 'offline'}
            text={hostOnline ? 'Хост онлайн' : 'Хост отключился'}
          />
        </div>
      </Card>

      {/* Local address for Minecraft */}
      <Card>
        <h3 className="text-sm font-medium text-gray-400 mb-3">
          Адрес для подключения в Minecraft
        </h3>
        <div className="flex items-center gap-4">
          <div className="font-mono text-2xl font-bold text-success-400 bg-dark-700 px-6 py-3 rounded-lg border border-success-500/30 flex-1 text-center">
            {localAddress}
          </div>
          <CopyButton text={localAddress} />
        </div>

        <div className="flex items-start gap-2 mt-4 bg-dark-700 rounded-lg p-3">
          <Info size={16} className="text-gray-400 mt-0.5 shrink-0" />
          <p className="text-xs text-gray-400">
            Открой Minecraft &rarr; Сетевая игра &rarr; Добавить сервер &rarr; вставь этот адрес.
            Или используй Прямое подключение.
          </p>
        </div>
      </Card>

      {/* Disconnect */}
      <div className="flex justify-center">
        <Button variant="danger" onClick={handleDisconnect}>
          <span className="flex items-center gap-1.5">
            <LogOut size={14} />
            Отключиться
          </span>
        </Button>
      </div>
    </div>
  );
}
