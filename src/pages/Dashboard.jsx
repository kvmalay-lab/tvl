import React from 'react';
import { useWorkoutHistory } from '../hooks/useWorkoutHistory';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Activity, Trophy, Zap } from 'lucide-react';

const Dashboard = () => {
  const { getStats, getLast7DaysData } = useWorkoutHistory();
  const stats = getStats();
  const chartData = getLast7DaysData();

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-3xl font-bold text-white mb-2">Welcome Back</h2>
        <p className="text-gray-400">Here&apos;s a summary of your fitness journey.</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-gray-800 p-6 rounded-xl border border-gray-700 shadow-lg">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-gray-400 font-medium">Total Workouts</h3>
            <div className="p-2 bg-blue-500/20 rounded-lg">
              <Activity className="w-6 h-6 text-blue-500" />
            </div>
          </div>
          <p className="text-4xl font-bold text-white">{stats.totalWorkouts}</p>
        </div>

        <div className="bg-gray-800 p-6 rounded-xl border border-gray-700 shadow-lg">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-gray-400 font-medium">Favorite Exercise</h3>
            <div className="p-2 bg-purple-500/20 rounded-lg">
              <Trophy className="w-6 h-6 text-purple-500" />
            </div>
          </div>
          <p className="text-2xl font-bold text-white truncate">{stats.favoriteExercise}</p>
        </div>

        <div className="bg-gray-800 p-6 rounded-xl border border-gray-700 shadow-lg">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-gray-400 font-medium">Total Reps</h3>
            <div className="p-2 bg-yellow-500/20 rounded-lg">
              <Zap className="w-6 h-6 text-yellow-500" />
            </div>
          </div>
          <p className="text-4xl font-bold text-white">{stats.totalReps}</p>
        </div>
      </div>

      {/* Chart */}
      <div className="bg-gray-800 p-6 rounded-xl border border-gray-700 shadow-lg">
        <h3 className="text-xl font-bold text-white mb-6">Reps - Last 7 Days</h3>
        <div className="h-80 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" vertical={false} />
              <XAxis
                dataKey="name"
                stroke="#9CA3AF"
                tick={{ fill: '#9CA3AF' }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                stroke="#9CA3AF"
                tick={{ fill: '#9CA3AF' }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                contentStyle={{ backgroundColor: '#1F2937', borderColor: '#374151', color: '#fff' }}
                cursor={{ fill: '#374151', opacity: 0.4 }}
              />
              <Bar
                dataKey="reps"
                fill="#6366F1"
                radius={[4, 4, 0, 0]}
                barSize={40}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
