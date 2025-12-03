import React from 'react';
import { Newspaper } from 'lucide-react';
import { NewsItem } from '../types';

interface NewsWidgetProps {
  category: string;
  color: string;
  data: NewsItem[];
  index: number;
}

const NewsWidget: React.FC<NewsWidgetProps> = ({ category, color, data, index }) => (
  <div className="flex gap-3 items-center animate-fade-in h-[70px] bg-white/5 rounded-xl p-2 border border-white/5">
    <div className={`w-1 h-full rounded-full ${color} opacity-80`} />
    <div className="w-12 h-12 rounded-lg bg-white/10 overflow-hidden relative">
       <Newspaper className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-white/20" size={16} />
       {data[index]?.img && (
        <img 
          src={data[index].img} 
          alt="" 
          className="absolute inset-0 w-full h-full object-cover opacity-80" 
          onError={(e) => (e.target as HTMLImageElement).style.display = 'none'} 
        />
       )}
    </div>
    <div className="flex-1 min-w-0">
       <div className="flex justify-between mb-1">
          <span className={`text-[10px] font-bold uppercase ${color.replace('bg-', 'text-')}`}>{category}</span>
          <span className="text-[9px] text-white/40">Agora</span>
       </div>
       <p className="text-xs font-light leading-snug line-clamp-2">{data[index]?.text || "Carregando..."}</p>
    </div>
  </div>
);

export default NewsWidget;