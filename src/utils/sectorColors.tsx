import React, { useState, useEffect } from "react";

export const predefinedColors = [
  { name: "Azul", class: "bg-emerald-100 text-blue-800", hex: "#dbeafe", textHex: "#1e40af" },
  { name: "Verde", class: "bg-emerald-100 text-emerald-800", hex: "#d1fae5", textHex: "#065f46" },
  { name: "Roxo", class: "bg-purple-100 text-purple-800", hex: "#f3e8ff", textHex: "#6b21a8" },
  { name: "Amarelo", class: "bg-amber-100 text-amber-800", hex: "#fef3c7", textHex: "#92400e" },
  { name: "Rosa", class: "bg-pink-100 text-pink-800", hex: "#fce7f3", textHex: "#9d174d" },
  { name: "Ciano", class: "bg-cyan-100 text-cyan-800", hex: "#cffafe", textHex: "#155e75" },
  { name: "Vermelho", class: "bg-rose-100 text-rose-800", hex: "#ffe4e6", textHex: "#9f1239" },
  { name: "Índigo", class: "bg-emerald-100 text-indigo-800", hex: "#e0e7ff", textHex: "#3730a3" },
  { name: "Teal", class: "bg-teal-100 text-teal-800", hex: "#ccfbf1", textHex: "#115e59" },
  { name: "Fúcsia", class: "bg-fuchsia-100 text-fuchsia-800", hex: "#fae8ff", textHex: "#86198f" },
  { name: "Laranja", class: "bg-orange-100 text-orange-800", hex: "#ffedd5", textHex: "#9a3412" },
  { name: "Cinza", class: "bg-gray-100 text-gray-800", hex: "#f3f4f6", textHex: "#1f2937" },
];

let globalSectorColors: Record<string, string> = {};

export function setGlobalSectorColors(colors: Record<string, string>) {
  globalSectorColors = colors;
}

export function getSectorColor(sector: string): string {
  if (!sector) return "bg-gray-100 text-gray-800";
  
  if (globalSectorColors[sector]) {
    return globalSectorColors[sector];
  }

  let hash = 0;
  for (let i = 0; i < sector.length; i++) {
    hash = sector.charCodeAt(i) + ((hash << 5) - hash);
  }
  
  const index = Math.abs(hash) % predefinedColors.length;
  return predefinedColors[index].class;
}

export function SectorBadge({ sector, className = "" }: { sector: string, className?: string }) {
  const colorClass = getSectorColor(sector);
  
  // Check if it's a hex color (custom color)
  const isHex = colorClass.startsWith('#');
  
  if (isHex) {
    return (
      <span 
        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${className}`}
        style={{ backgroundColor: colorClass, color: '#fff' }}
      >
        {sector}
      </span>
    );
  }

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${colorClass} ${className}`}>
      {sector}
    </span>
  );
}
