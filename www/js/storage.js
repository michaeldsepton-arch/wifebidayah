// Simple localStorage-backed state. Keys are namespaced under 'wfa.'
const Store = (() => {
  const KEY = 'wfa.state.v1';

  const defaultState = {
    onboarded: false,
    profile: { name: '' },
    settings: {
      weeklyTarget: 4,              // sessions per week, flexible 3-4
      preferredDays: [1,2,3,4,5],   // Mon-Fri lean; weekend optional (0=Sun..6=Sat)
      sessionMinutes: 30,
      reminderTime: '08:00',        // morning check-in
      alarmEnabled: true,
      alarmTime: '17:30',
      equipment: ['bodyweight','dumbbell','bench','plate','curlbar','table','treadmill'],
      excludedExerciseIds: [],
      excludedPatterns: [],         // e.g. avoid certain movement patterns if needed
    },
    progress: {
      difficultyTier: 1.0,          // 1.0 - 3.0, floats, scales up with consistency
      streak: 0,
      longestStreak: 0,
      totalSessions: 0,
    },
    // history of completed sessions: { date, workoutId, exerciseIds[], feedback: 'easy'|'good'|'hard', minutes }
    history: [],
    // recency map: exerciseId -> last completed date (for rotation / no-repeat logic)
    exerciseRecency: {},
    // body weight log: [{date, kg}]
    weightLog: [],
    // currently generated-but-not-yet-done workout, so Home + Player agree
    pendingWorkout: null,
  };

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return structuredClone(defaultState);
      const parsed = JSON.parse(raw);
      // shallow-merge with defaults so new fields appear after an app update
      return deepMerge(structuredClone(defaultState), parsed);
    } catch (e) {
      console.warn('Store load failed, using defaults', e);
      return structuredClone(defaultState);
    }
  }

  function save(state) {
    try { localStorage.setItem(KEY, JSON.stringify(state)); }
    catch (e) { console.warn('Store save failed', e); }
  }

  function deepMerge(base, override) {
    for (const k in override) {
      if (override[k] && typeof override[k] === 'object' && !Array.isArray(override[k]) && base[k]) {
        base[k] = deepMerge(base[k], override[k]);
      } else {
        base[k] = override[k];
      }
    }
    return base;
  }

  let state = load();

  return {
    get: () => state,
    set: (updater) => {
      state = typeof updater === 'function' ? updater(structuredClone(state)) : updater;
      save(state);
      return state;
    },
    reset: () => { state = structuredClone(defaultState); save(state); return state; },
  };
})();
