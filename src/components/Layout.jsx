import React from 'react';
import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Play, History, Dumbbell } from 'lucide-react';

const Layout = ({ children }) => {
  return (
    <div className="flex h-screen bg-gray-900 text-white">
      {/* Sidebar */}
      <aside className="w-64 bg-gray-800 border-r border-gray-700 flex flex-col">
        <div className="p-6 flex items-center gap-3 border-b border-gray-700">
          <div className="p-2 bg-indigo-600 rounded-lg">
            <Dumbbell className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-xl font-bold tracking-tight">FitTracker AI</h1>
        </div>

        <nav className="flex-1 p-4 space-y-2">
          <NavLink
            to="/"
            className={({ isActive }) =>
              `flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                isActive
                  ? 'bg-indigo-600 text-white'
                  : 'text-gray-400 hover:bg-gray-700 hover:text-white'
              }`
            }
          >
            <LayoutDashboard className="w-5 h-5" />
            <span className="font-medium">Dashboard</span>
          </NavLink>

          <NavLink
            to="/workout"
            className={({ isActive }) =>
              `flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                isActive
                  ? 'bg-indigo-600 text-white'
                  : 'text-gray-400 hover:bg-gray-700 hover:text-white'
              }`
            }
          >
            <Play className="w-5 h-5" />
            <span className="font-medium">Start Workout</span>
          </NavLink>

          <NavLink
            to="/history"
            className={({ isActive }) =>
              `flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                isActive
                  ? 'bg-indigo-600 text-white'
                  : 'text-gray-400 hover:bg-gray-700 hover:text-white'
              }`
            }
          >
            <History className="w-5 h-5" />
            <span className="font-medium">History</span>
          </NavLink>
        </nav>

        <div className="p-4 border-t border-gray-700">
          <div className="text-xs text-gray-500 text-center">
            &copy; {new Date().getFullYear()} FitTracker AI
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto bg-gray-900 p-8">
        {children}
      </main>
    </div>
  );
};

export default Layout;
