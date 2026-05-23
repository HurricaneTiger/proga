import React from 'react';
import { useNavigate } from 'react-router-dom';
import { PlusCircle, LogIn, Gamepad2 } from 'lucide-react';
import { Card } from '../components/Card';
import { StatusBadge } from '../components/StatusBadge';
import { useHealth } from '../hooks/useIpc';

export function MainPage() {
  const navigate = useNavigate();
  const { relayConnected } = useHealth();

  return (
    <div className="flex flex-col items-center justify-center h-full gap-8 animate-fade-in">
      <div className="text-center space-y-3">
        <div className="flex items-center justify-center gap-3">
          <Gamepad2 size={40} className="text-primary-400" />
          <h1 className="text-4xl font-bold bg-gradient-to-r from-primary-400 to-accent-500 bg-clip-text text-transparent">
            MC LAN Tunnel
          </h1>
        </div>
        <p className="text-gray-400 text-lg">
          Играй с друзьями в Minecraft через интернет
        </p>
      </div>

      <div className="flex gap-6">
        <Card hoverable className="w-64 text-center" onClick={() => navigate('/create')}>
          <PlusCircle size={48} className="mx-auto mb-4 text-primary-400" />
          <h2 className="text-xl font-semibold mb-2">Создать комнату</h2>
          <p className="text-gray-400 text-sm">
            Создай комнату и пригласи друзей
          </p>
        </Card>

        <Card hoverable className="w-64 text-center" onClick={() => navigate('/join')}>
          <LogIn size={48} className="mx-auto mb-4 text-accent-400" />
          <h2 className="text-xl font-semibold mb-2">Подключиться к комнате</h2>
          <p className="text-gray-400 text-sm">
            Введи код приглашения от друга
          </p>
        </Card>
      </div>

      <div className="absolute bottom-6 left-1/2 -translate-x-1/2">
        <StatusBadge
          status={relayConnected ? 'online' : 'offline'}
          text={relayConnected ? 'Сервер доступен' : 'Сервер недоступен'}
        />
      </div>
    </div>
  );
}
