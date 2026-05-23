import React from 'react';
import { CopyButton } from './CopyButton';

interface InviteCodeDisplayProps {
  code: string;
}

export function InviteCodeDisplay({ code }: InviteCodeDisplayProps) {
  return (
    <div className="flex flex-col items-center gap-3">
      <div className="font-mono text-4xl font-bold tracking-[0.3em] text-primary-400 bg-dark-700 px-8 py-4 rounded-xl border border-primary-500/30 animate-pulse-glow">
        {code}
      </div>
      <CopyButton text={code} />
    </div>
  );
}
