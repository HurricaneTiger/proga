import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Home, Settings, ScrollText, Gamepad2 } from 'lucide-react';

interface NavItem {
  path: string;
  icon: React.ReactNode;
  label: string;
}

const navItems: NavItem[] = [
  { path: '/', icon: <Home size={20} />, label: 'Главная' },
  { path: '/settings', icon: <Settings size={20} />, label: 'Настройки' },
  { path: '/logs', icon: <ScrollText size={20} />, label: 'Логи' },
];

export function NavBar() {
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <nav className="w-16 bg-dark-800 border-r border-dark-600 flex flex-col items-center py-4 gap-2">
      <div className="mb-4">
        <Gamepad2 size={28} className="text-primary-400" />
      </div>
      {navItems.map((item) => {
        const isActive = location.pathname === item.path;
        return (
          <button
            key={item.path}
            onClick={() => navigate(item.path)}
            title={item.label}
            className={`w-10 h-10 rounded-lg flex items-center justify-center transition-all duration-200 ${
              isActive
                ? 'bg-primary-500 text-white shadow-glow'
                : 'text-gray-400 hover:text-white hover:bg-dark-700'
            }`}
          >
            {item.icon}
          </button>
        );
      })}
    </nav>
  );
}
