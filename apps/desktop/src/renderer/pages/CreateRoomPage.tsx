import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { InviteCodeDisplay } from '../components/InviteCodeDisplay';
import { Button } from '../components/Button';
import { ErrorMessage } from '../components/ErrorMessage';
import { useSettings, getEffectiveRelayUrl } from '../hooks/useIpc';

export function CreateRoomPage() {
  const navigate = useNavigate();
  const { settings } = useSettings();
  const [inviteCode, setInviteCode] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const createRoom = async () => {
      try {
        if (window.electronAPI) {
          const relayUrl = getEffectiveRelayUrl(settings);
          const result = await window.electronAPI.createRoom(relayUrl);
          if (result.success && result.inviteCode) {
            setInviteCode(result.inviteCode);
          } else {
            setError(result.error || 'Не удалось создать комнату');
          }
        } else {
          // Demo mode without Electron
          setTimeout(() => {
            setInviteCode('ABC123');
          }, 1000);
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Неизвестная ошибка');
      } finally {
        setLoading(false);
      }
    };

    createRoom();
  }, [settings.relayMode, settings.customRelayUrl]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 animate-fade-in">
        <Loader2 size={48} className="text-primary-400 animate-spin" />
        <p className="text-gray-400">Создание комнаты...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 animate-fade-in">
        <ErrorMessage message={error} />
        <Button variant="secondary" onClick={() => navigate('/')}>
          Назад
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center h-full gap-8 animate-fade-in">
      <div className="text-center space-y-2">
        <h1 className="text-2xl font-bold">Комната создана!</h1>
        <p className="text-gray-400">Отправь этот код другу для подключения</p>
      </div>

      {inviteCode && <InviteCodeDisplay code={inviteCode} />}

      <div className="text-center text-sm text-gray-500 max-w-md">
        <p>Твой друг должен ввести этот код в приложении, чтобы подключиться к комнате.</p>
      </div>

      <Button onClick={() => navigate('/room/host')}>
        Далее
      </Button>
    </div>
  );
}
