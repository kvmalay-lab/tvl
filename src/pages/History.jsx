import React, { useState } from 'react';
import { useWorkoutHistory } from '../hooks/useWorkoutHistory';
import { Calendar, Repeat, Activity, Clock } from 'lucide-react';

const History = () => {
  const { history, getTodaySessions, getWeekSessions, getMonthSessions } = useWorkoutHistory();
  const [activeTab, setActiveTab] = useState('all'); // 'all', 'today', 'week', 'month'

  const getFilteredData = () => {
      switch (activeTab) {
          case 'today': return getTodaySessions();
          case 'week': return getWeekSessions();
          case 'month': return getMonthSessions();
          default: return history;
      }
  };

  const filteredHistory = getFilteredData();

  // Calculate quick stats for the view
  const totalReps = filteredHistory.reduce((acc, s) => acc + (s.reps || 0), 0);
  const totalSets = filteredHistory.length;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold text-white mb-2">Workout History</h2>
        <p className="text-gray-400">View your past training sessions and performance.</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-4 border-b border-gray-700 pb-1">
          {['all', 'today', 'week', 'month'].map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-2 text-sm font-medium transition-colors ${
                    activeTab === tab
                    ? 'text-indigo-400 border-b-2 border-indigo-400'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                  {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </button>
          ))}
      </div>

      {/* Summary for current view */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-gray-800 p-4 rounded-lg border border-gray-700">
              <p className="text-gray-400 text-xs uppercase">Workouts</p>
              <p className="text-2xl font-bold text-white">{totalSets}</p>
          </div>
          <div className="bg-gray-800 p-4 rounded-lg border border-gray-700">
              <p className="text-gray-400 text-xs uppercase">Total Reps</p>
              <p className="text-2xl font-bold text-white">{totalReps}</p>
          </div>
      </div>

      <div className="bg-gray-800 rounded-xl border border-gray-700 shadow-lg overflow-hidden">
        {filteredHistory.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            No workouts found for this period.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-gray-750 border-b border-gray-700">
                  <th className="p-4 text-gray-400 font-medium">Date</th>
                  <th className="p-4 text-gray-400 font-medium">Exercise</th>
                  <th className="p-4 text-gray-400 font-medium text-right">Reps</th>
                  <th className="p-4 text-gray-400 font-medium text-right">Accuracy</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-700">
                {filteredHistory.map((session, index) => (
                  <tr key={session.id || index} className="hover:bg-gray-750 transition-colors">
                    <td className="p-4 text-white">
                        <div className="flex flex-col">
                            <span className="flex items-center gap-2">
                                <Calendar className="w-3 h-3 text-gray-500" />
                                {new Date(session.date).toLocaleDateString()}
                            </span>
                            <span className="flex items-center gap-2 text-xs text-gray-500 mt-1">
                                <Clock className="w-3 h-3" />
                                {new Date(session.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                        </div>
                    </td>
                    <td className="p-4 text-white font-medium">
                      <div className="flex items-center gap-3">
                          <Activity className="w-4 h-4 text-indigo-400" />
                          {session.exercise ? (session.exercise.charAt(0).toUpperCase() + session.exercise.slice(1)) : 'Unknown'}
                      </div>
                    </td>
                    <td className="p-4 text-white text-right font-mono">
                        <div className="flex items-center justify-end gap-2">
                             {session.reps}
                             <Repeat className="w-4 h-4 text-gray-500" />
                        </div>
                    </td>
                    <td className="p-4 text-white text-right">
                        <span className={`inline-block px-2 py-1 rounded text-xs ${
                            (session.accuracy || session.avgConf) >= 80 ? 'bg-green-500/20 text-green-400' :
                            (session.accuracy || session.avgConf) >= 50 ? 'bg-yellow-500/20 text-yellow-400' :
                            'bg-red-500/20 text-red-400'
                        }`}>
                            {session.accuracy || session.avgConf || '-'}%
                        </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default History;
