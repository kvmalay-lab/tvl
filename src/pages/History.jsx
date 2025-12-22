import React from 'react';
import { useWorkoutHistory } from '../hooks/useWorkoutHistory';
import { Calendar, Repeat, Activity } from 'lucide-react';

const History = () => {
  const { history } = useWorkoutHistory();

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold text-white mb-2">Workout History</h2>
        <p className="text-gray-400">View your past training sessions.</p>
      </div>

      <div className="bg-gray-800 rounded-xl border border-gray-700 shadow-lg overflow-hidden">
        {history.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            No workouts recorded yet. Start training!
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-gray-750 border-b border-gray-700">
                  <th className="p-4 text-gray-400 font-medium">Date</th>
                  <th className="p-4 text-gray-400 font-medium">Exercise</th>
                  <th className="p-4 text-gray-400 font-medium text-right">Reps</th>
                  <th className="p-4 text-gray-400 font-medium text-right">Confidence</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-700">
                {history.map((session, index) => (
                  <tr key={index} className="hover:bg-gray-750 transition-colors">
                    <td className="p-4 text-white flex items-center gap-3">
                        <Calendar className="w-4 h-4 text-gray-500" />
                        {new Date(session.date).toLocaleDateString()}{' '}
                        <span className="text-gray-500 text-sm">
                            {new Date(session.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                    </td>
                    <td className="p-4 text-white font-medium">
                      <div className="flex items-center gap-3">
                          <Activity className="w-4 h-4 text-indigo-400" />
                          {session.exercise.charAt(0).toUpperCase() + session.exercise.slice(1)}
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
                            session.avgConf >= 80 ? 'bg-green-500/20 text-green-400' :
                            session.avgConf >= 50 ? 'bg-yellow-500/20 text-yellow-400' :
                            'bg-red-500/20 text-red-400'
                        }`}>
                            {session.avgConf}%
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
