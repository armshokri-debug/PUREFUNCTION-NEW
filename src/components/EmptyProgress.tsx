import React from 'react';
import { LineChart } from 'lucide-react';

/** Shown instead of charts until there is real data to chart. */
export const EmptyProgress: React.FC<{ title: string; text: string; children?: React.ReactNode }> = ({
  title,
  text,
  children
}) => (
  <div className="max-w-md mx-auto text-center py-16 px-4">
    <div className="w-14 h-14 rounded-2xl bg-[#FEF3C7] flex items-center justify-center mx-auto mb-4">
      <LineChart className="w-6 h-6 text-[#B45309]" />
    </div>
    <h2 className="text-xl font-bold text-[#111827] mb-1">{title}</h2>
    <p className="text-sm text-gray-500">{text}</p>
    {children}
  </div>
);
