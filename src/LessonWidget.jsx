import React from 'react';
import { getSchoolName } from './constants';

export default function LessonWidget({ currentChurch }) {
  // Only show the Sabbath School lesson widget for Adventist churches
  if (currentChurch?.denomination === 'Other') {
    return null;
  }

  return (
    <div className="glass-panel p-6 sm:p-8 rounded-3xl relative overflow-hidden mt-8 bg-gradient-to-br from-indigo-900 to-slate-900 border border-indigo-500/30">
      <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 bg-indigo-500/20 rounded-full blur-3xl"></div>
      
      <div className="relative z-10">
        <div className="flex flex-col sm:flex-row justify-between sm:items-center mb-6 gap-3">
          <h2 className="text-xl font-extrabold text-white flex items-center gap-2">
            <span className="text-2xl">📖</span>
            {getSchoolName(currentChurch)} Lesson
          </h2>
          <span className="inline-flex items-center self-start bg-indigo-500/20 text-indigo-200 text-[10px] uppercase font-bold px-3 py-1 rounded-full border border-indigo-500/30">
            Smart Widget
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          {/* English Link */}
          <a href="https://ssnet.org/lessons/" target="_blank" rel="noopener noreferrer" 
             className="block p-5 bg-white/5 border border-white/10 rounded-2xl hover:bg-white/10 transition-all group cursor-pointer">
            <h3 className="text-indigo-300 font-bold text-sm uppercase tracking-wider mb-2 group-hover:text-indigo-200 transition-colors">
              English Edition
            </h3>
            <p className="text-white font-medium mb-4">Adult Bible Study Guide (Standard Edition)</p>
            <div className="flex items-center text-indigo-400 text-sm font-bold gap-1 group-hover:gap-2 transition-all">
              Read Lesson <span aria-hidden="true">→</span>
            </div>
          </a>

          {/* French Link */}
          <a href="https://sabbath-school.adventech.io/fr/" target="_blank" rel="noopener noreferrer"
             className="block p-5 bg-white/5 border border-white/10 rounded-2xl hover:bg-white/10 transition-all group cursor-pointer">
            <h3 className="text-indigo-300 font-bold text-sm uppercase tracking-wider mb-2 group-hover:text-indigo-200 transition-colors">
              Édition Française
            </h3>
            <p className="text-white font-medium mb-4">Guide d'étude de la Bible (Adulte)</p>
            <div className="flex items-center text-indigo-400 text-sm font-bold gap-1 group-hover:gap-2 transition-all">
              Lire la leçon <span aria-hidden="true">→</span>
            </div>
          </a>
        </div>
      </div>
    </div>
  );
}
