import { useState, useEffect, useCallback } from 'react';

const STORAGE_KEY = 'tvl_history'; // Updated key

export const useWorkoutHistory = () => {
  const [history, setHistory] = useState([]);

  // Load history from local storage on mount
  useEffect(() => {
    const storedHistory = localStorage.getItem(STORAGE_KEY);
    if (storedHistory) {
      try {
        setHistory(JSON.parse(storedHistory));
      } catch (error) {
        console.error('Failed to parse workout history:', error);
      }
    }
  }, []);

  // Save a new workout session
  const saveSession = useCallback((session) => {
    // Generate simple ID if not present
    const newSession = {
        id: Date.now().toString(),
        ...session
    };

    setHistory((prevHistory) => {
      const newHistory = [newSession, ...prevHistory];
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newHistory));
      return newHistory;
    });
  }, []);

  // Calculate statistics
  const getStats = useCallback(() => {
    if (history.length === 0) {
      return {
        totalWorkouts: 0,
        totalReps: 0,
        favoriteExercise: 'N/A',
      };
    }

    const totalWorkouts = history.length;
    const totalReps = history.reduce((acc, session) => acc + (session.reps || 0), 0);

    const exerciseCounts = history.reduce((acc, session) => {
      const exercise = session.exercise || 'Unknown';
      acc[exercise] = (acc[exercise] || 0) + 1;
      return acc;
    }, {});

    let favoriteExercise = 'N/A';
    let maxCount = 0;
    for (const [exercise, count] of Object.entries(exerciseCounts)) {
      if (count > maxCount) {
        maxCount = count;
        favoriteExercise = exercise;
      }
    }

    return {
      totalWorkouts,
      totalReps,
      favoriteExercise: favoriteExercise.charAt(0).toUpperCase() + favoriteExercise.slice(1),
    };
  }, [history]);

  // Get data for the last 7 days chart (Dashboard)
  const getLast7DaysData = useCallback(() => {
    const last7Days = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateString = date.toLocaleDateString('en-US', { weekday: 'short' });
      const dateKey = date.toISOString().split('T')[0];

      last7Days.push({
        name: dateString,
        dateKey: dateKey,
        reps: 0,
      });
    }

    history.forEach(session => {
        if (!session.date) return;
        const sessionDate = new Date(session.date).toISOString().split('T')[0];
        const dayData = last7Days.find(d => d.dateKey === sessionDate);
        if (dayData) {
            dayData.reps += (session.reps || 0);
        }
    });

    return last7Days.map(({ name, reps }) => ({ name, reps }));
  }, [history]);

  // Helpers for History Filters
  const getTodaySessions = useCallback(() => {
      const today = new Date().toISOString().split('T')[0];
      return history.filter(s => s.date && s.date.startsWith(today));
  }, [history]);

  const getWeekSessions = useCallback(() => {
      const now = new Date();
      // Simple "last 7 days" or "current week"? Let's do last 7 days
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(now.getDate() - 7);
      return history.filter(s => new Date(s.date) >= sevenDaysAgo);
  }, [history]);

  const getMonthSessions = useCallback(() => {
      const now = new Date();
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
      return history.filter(s => new Date(s.date) >= firstDay);
  }, [history]);

  return {
    history,
    saveSession,
    getStats,
    getLast7DaysData,
    getTodaySessions,
    getWeekSessions,
    getMonthSessions
  };
};
