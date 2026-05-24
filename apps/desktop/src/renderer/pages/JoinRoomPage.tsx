import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { Button } from '../components/Button';
import { ErrorMessage } from '../components/ErrorMessage';
import { useSettings, getEffectiveRelayUrl } from '../hooks/useIpc';

export function JoinRoomPage() {
  const navigate = useNavigate();
  const { settings } = useSettings();
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
    setCode(value);
    setError('');
  };

  const handleJoin = async () => {
    if (code.length !== 6) {
      setError('Код должен содержать 6 символов');
      return;
    }

    setLoading(true);
    setError('');

    try {
      if (window.electronAPI) {
        const relayUrl = getEffectiveRelayUrl(settings);
        const result = await window.electronAPI.joinRoom(relayUrl, code);
        if (result.success) {
          navigate('/room/client');
        } else {
          setError(result.error || 'Не удалось подключиться к комнате');
        }
      } else {
        // Demo mode
        setTimeout(() => {
          navigate('/room/client');
        }, 1000);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Неизвестная ошибка');
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && code.length === 6) {
      handleJoin();
    }
  };

  return (
    <div className="flex flex-col items-center justify-center h-full gap-6 animate-fade-in">
      <div className="text-center space-y-2">
        <h1 className="text-2xl font-bold">Подключиться к комнате</h1>
        <p className="text-gray-400">Введи код приглашения от друга</p>
      </div>

      <div className="flex flex-col items-center gap-4">
        <input
          type="text"
          value={code}
          onChange={handleCodeChange}
          onKeyDown={handleKeyDown}
          placeholder="XXXXXX"
          maxLength={6}
          className="font-mono text-3xl tracking-[0.4em] text-center w-72 bg-dark-700 border border-dark-600 rounded-xl px-6 py-4 text-white placeholder-gray-600 outline-none focus:border-primary-500 transition-colors duration-200"
          autoFocus
        />
        <p className="text-gray-500 text-sm">
          6 символов (буквы и цифры)
        </p>
      </div>

      {error && <ErrorMessage message={error} />}

      <div className="flex gap-3">
        <Button variant="secondary" onClick={() => navigate('/')}>
          Назад
        </Button>
        <Button
          onClick={handleJoin}
          disabled={code.length !== 6 || loading}
        >
          {loading ? (
            <span className="flex items-center gap-2">
              <Loader2 size={16} className="animate-spin" />
              Подключение...
            </span>
          ) : (
            'Подключиться'
          )}
        </Button>
      </div>
    </div>
  );
}
