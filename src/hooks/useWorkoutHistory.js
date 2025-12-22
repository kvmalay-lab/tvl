import { useState, useEffect, useCallback } from 'react';

const STORAGE_KEY = 'workout_history';

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
    setHistory((prevHistory) => {
      const newHistory = [session, ...prevHistory];
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

  // Get data for the last 7 days chart
  const getLast7DaysData = useCallback(() => {
    const last7Days = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateString = date.toLocaleDateString('en-US', { weekday: 'short' }); // e.g., "Mon"
      // Also need a comparison string for filtering
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

  return {
    history,
    saveSession,
    getStats,
    getLast7DaysData,
  };
};
