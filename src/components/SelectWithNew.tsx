import React, { useState, useEffect } from 'react';

interface SelectWithNewProps {
  name: string;
  value: string;
  options: string[];
  onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => void;
  placeholder?: string;
  className?: string;
  required?: boolean;
}

export function SelectWithNew({
  name,
  value,
  options,
  onChange,
  placeholder = "Selecione...",
  className = "w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 placeholder:text-gray-400",
  required = false
}: SelectWithNewProps) {
  const [isNew, setIsNew] = useState(false);

  useEffect(() => {
    if (value && !options.includes(value) && value !== 'new') {
      setIsNew(true);
    } else if (options.includes(value)) {
      setIsNew(false);
    }
  }, [value, options]);

  const handleSelectChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    if (e.target.value === 'new') {
      setIsNew(true);
      // Trigger onChange with empty value so the input starts empty
      const event = {
        target: { name, value: '' }
      } as React.ChangeEvent<HTMLInputElement>;
      onChange(event);
    } else {
      setIsNew(false);
      onChange(e);
    }
  };

  return (
    <div className="space-y-2">
      {!isNew ? (
        <select
          name={name}
          value={value || ""}
          onChange={handleSelectChange}
          className={className}
          required={required}
        >
          <option value="">{placeholder}</option>
          {options.map(opt => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
          <option value="new">+ Adicionar novo...</option>
        </select>
      ) : (
        <div className="flex gap-2">
          <input
            type="text"
            name={name}
            value={value === 'new' ? '' : value}
            onChange={onChange}
            className={className}
            placeholder="Digite o novo valor..."
            required={required}
            autoFocus
          />
          <button
            type="button"
            onClick={() => {
              setIsNew(false);
              const event = {
                target: { name, value: '' }
              } as React.ChangeEvent<HTMLSelectElement>;
              onChange(event);
            }}
            className="px-3 py-2 text-sm text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg"
          >
            Voltar
          </button>
        </div>
      )}
    </div>
  );
}
