import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Play, Square, Info } from 'lucide-react';
import { InviteCodeDisplay } from '../components/InviteCodeDisplay';
import { PortInput } from '../components/PortInput';
import { Button } from '../components/Button';
import { StatusBadge } from '../components/StatusBadge';
import { ConnectionList } from '../components/ConnectionList';
import { ErrorMessage } from '../components/ErrorMessage';
import { Card } from '../components/Card';
import { useRoom } from '../hooks/useIpc';

export function RoomHostPage() {
  const navigate = useNavigate();
  const { hostStatus } = useRoom();
  const [port, setPort] = useState('');
  const [tunnelActive, setTunnelActive] = useState(false);
  const [error, setError] = useState('');
  const [showTooltip, setShowTooltip] = useState(false);

  const inviteCode = hostStatus?.inviteCode || 'XXXXXX';
  const clientCount = hostStatus?.clientCount || 0;

  const connections = Array.from({ length: clientCount }, (_, i) => ({
    id: String(i),
    name: `Игрок ${i + 1}`,
    status: 'online' as const,
  }));

  const handleAutoDetect = async () => {
    try {
      if (window.electronAPI) {
        const result = await window.electronAPI.autoDetectPort();
        if (result.success && result.port) {
          setPort(String(result.port));
        } else {
          setError('Не удалось найти порт автоматически. Убедитесь, что мир открыт для сети.');
        }
      }
    } catch {
      setError('Ошибка при поиске порта');
    }
  };

  const handleStartTunnel = async () => {
    const portNum = parseInt(port, 10);
    if (!portNum || portNum < 1 || portNum > 65535) {
      setError('Введите корректный порт (1-65535)');
      return;
    }

    setError('');
    try {
      if (window.electronAPI) {
        const result = await window.electronAPI.startTunnel(portNum);
        if (result.success) {
          setTunnelActive(true);
        } else {
          setError(result.error || 'Не удалось запустить туннель');
        }
      } else {
        setTunnelActive(true);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка');
    }
  };

  const handleStop = async () => {
    if (window.electronAPI) {
      await window.electronAPI.stopTunnel();
    }
    setTunnelActive(false);
    navigate('/');
  };

  useEffect(() => {
    if (hostStatus?.tunnelActive !== undefined) {
      setTunnelActive(hostStatus.tunnelActive);
    }
  }, [hostStatus?.tunnelActive]);

  return (
    <div className="max-w-2xl mx-auto space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Комната хоста</h1>
        <StatusBadge
          status={tunnelActive ? 'online' : 'offline'}
          text={tunnelActive ? 'Туннель активен' : 'Ожидание'}
        />
      </div>

      {/* Invite Code Section */}
      <Card>
        <p className="text-gray-400 text-sm mb-3">Отправь этот код другу:</p>
        <InviteCodeDisplay code={inviteCode} />
      </Card>

      {/* Connected Players */}
      <Card>
        <h3 className="text-sm font-medium text-gray-400 mb-3">
          Подключенные игроки ({clientCount})
        </h3>
        <ConnectionList connections={connections} />
      </Card>

      {/* Port & Tunnel Control */}
      <Card>
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-medium text-gray-400">Порт Minecraft LAN</h3>
            <button
              onMouseEnter={() => setShowTooltip(true)}
              onMouseLeave={() => setShowTooltip(false)}
              className="text-gray-500 hover:text-gray-300 relative"
            >
              <Info size={14} />
              {showTooltip && (
                <div className="absolute bottom-6 left-1/2 -translate-x-1/2 w-72 bg-dark-700 border border-dark-600 rounded-lg p-3 text-xs text-gray-300 z-50">
                  Открой мир в Minecraft через Esc &rarr; Открыть для сети &rarr; Начать мир по сети.
                  Потом скопируй порт из чата Minecraft и вставь сюда.
                </div>
              )}
            </button>
          </div>

          <div className="flex gap-3">
            <PortInput
              value={port}
              onChange={setPort}
              placeholder="Порт (напр. 25565)"
              className="flex-1"
            />
            <Button variant="secondary" onClick={handleAutoDetect}>
              <span className="flex items-center gap-1.5">
                <Search size={14} />
                Найти автоматически
              </span>
            </Button>
          </div>

          {error && <ErrorMessage message={error} />}

          <div className="flex gap-3">
            {!tunnelActive ? (
              <Button onClick={handleStartTunnel} disabled={!port}>
                <span className="flex items-center gap-1.5">
                  <Play size={14} />
                  Запустить туннель
                </span>
              </Button>
            ) : (
              <Button variant="danger" onClick={handleStop}>
                <span className="flex items-center gap-1.5">
                  <Square size={14} />
                  Остановить
                </span>
              </Button>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
}
