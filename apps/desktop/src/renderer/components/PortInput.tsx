import React from 'react';

interface PortInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

export function PortInput({ value, onChange, placeholder = '25565', className = '' }: PortInputProps) {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/\D/g, '');
    const num = parseInt(val, 10);
    if (val === '' || (num >= 0 && num <= 65535)) {
      onChange(val);
    }
  };

  const isValid = value === '' || (parseInt(value, 10) >= 1 && parseInt(value, 10) <= 65535);

  return (
    <input
      type="text"
      value={value}
      onChange={handleChange}
      placeholder={placeholder}
      className={`bg-dark-700 border ${
        isValid ? 'border-dark-600 focus:border-primary-500' : 'border-danger-500'
      } rounded-lg px-4 py-2 text-white placeholder-gray-500 outline-none transition-colors duration-200 ${className}`}
    />
  );
}
