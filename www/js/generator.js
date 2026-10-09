// Workout generation: picks a fresh, non-repeating, difficulty-scaled 30-min session.
const Generator = (() => {

  function daysSince(dateStr) {
    if (!dateStr) return 999;
    const ms = Date.now() - new Date(dateStr).getTime();
    return ms / 86400000;
  }

  function byId(id) { return EXERCISES.find(e => e.id === id); }

  function eligible(state, patterns, excludeIds) {
    const s = state.settings;
    return EXERCISES.filter(e =>
      patterns.includes(e.pattern) &&
      e.equipment.some(eq => s.equipment.includes(eq)) &&
      !s.excludedExerciseIds.includes(e.id) &&
      !s.excludedPatterns.includes(e.pattern) &&
      !excludeIds.has(e.id)
    );
  }

  // Pick the best candidate: favors long-unused exercises, light tier matching, a little randomness.
  function pickExercise(state, patterns, excludeIds, minGapDays) {
    let pool = eligible(state, patterns, excludeIds).filter(e =>
      daysSince(state.exerciseRecency[e.id]) >= minGapDays
    );
    if (pool.length === 0) pool = eligible(state, patterns, excludeIds); // relax recency
    if (pool.length === 0) pool = EXERCISES.filter(e => patterns.includes(e.pattern)); // last resort, ignore equipment/exclude
    if (pool.length === 0) return null;

    const targetTier = state.progress.difficultyTier;
    let best = null, bestScore = -Infinity;
    for (const ex of pool) {
      const recency = Math.min(daysSince(state.exerciseRecency[ex.id]), 60);
      const tierDiff = Math.abs(ex.tier - targetTier);
      const score = recency * 2 - tierDiff * 4 + Math.random() * 6;
      if (score > bestScore) { bestScore = score; best = ex; }
    }
    return best;
  }

  function pickSessionType(state) {
    const recentTypes = state.history.slice(-2).map(h => h.type);
    const bothSame = recentTypes.length === 2 && recentTypes[0] === recentTypes[1];
    if (bothSame) return recentTypes[0] === 'strength' ? 'circuit' : 'strength';
    return Math.random() < 0.6 ? 'strength' : 'circuit';
  }

  function tierBand(tier) {
    if (tier < 1.5) return { sets: 2, restSec: 45 };
    if (tier < 2.5) return { sets: 3, restSec: 35 };
    return { sets: 4, restSec: 25 };
  }

  function pickFew(list, n) {
    const copy = [...list];
    const out = [];
    while (out.length < n && copy.length) {
      out.push(copy.splice(Math.floor(Math.random() * copy.length), 1)[0]);
    }
    return out;
  }

  function buildStrengthWorkout(state) {
    const n = state.progress.totalSessions;
    const used = new Set();
    const { sets, restSec } = tierBand(state.progress.difficultyTier);

    const slots = [
      { patterns: n % 2 === 0 ? ['squat'] : ['lunge'] },
      { patterns: ['hinge', 'lunge'] },
      { patterns: n % 2 === 0 ? ['pushH'] : ['pushV'] },
      { patterns: ['pull'] },
      { patterns: ['core'] },
      { patterns: ['core', 'carry'] },
    ];

    const blocks = [];
    for (const slot of slots) {
      const ex = pickExercise(state, slot.patterns, used, 10);
      if (!ex) continue;
      used.add(ex.id);
      blocks.push(makeBlock(ex, sets, restSec, state.progress.difficultyTier));
    }
    return { type: 'strength', sets, restSec, blocks };
  }

  function buildCircuitWorkout(state) {
    const used = new Set();
    const rounds = state.progress.difficultyTier < 1.5 ? 2 : state.progress.difficultyTier < 2.5 ? 3 : 3;
    const patternPlan = ['cardio', 'squat', 'core', 'pushH', 'cardio', 'pull'];
    const blocks = [];
    for (const p of patternPlan) {
      const ex = pickExercise(state, [p], used, 7);
      if (!ex) continue;
      used.add(ex.id);
      blocks.push(makeBlock(ex, rounds, 20, state.progress.difficultyTier, true));
    }
    return { type: 'circuit', sets: rounds, restSec: 20, blocks };
  }

  function makeBlock(ex, sets, restSec, tier, circuitStyle) {
    let reps = ex.reps;
    let duration = ex.duration;
    if (tier >= 2.5) {
      if (ex.timeBased) duration = Math.round(ex.duration * 1.25);
    }
    return {
      exerciseId: ex.id,
      name: ex.name,
      cue: ex.cue,
      pattern: ex.pattern,
      focus: ex.focus,
      equipment: ex.equipment,
      timeBased: !!ex.timeBased,
      reps: reps || null,
      duration: duration || (circuitStyle ? 35 : null),
      sets,
      restSec,
    };
  }

  function estimateMinutes(workout, warmup, cooldown) {
    const warmSec = warmup.reduce((a, w) => a + w.duration + 10, 0);
    const coolSec = cooldown.reduce((a, c) => a + c.duration + 10, 0);
    const mainSec = workout.blocks.reduce((a, b) => {
      const workSec = b.timeBased ? b.duration : 35; // ~35s estimate per reps-based set
      return a + b.sets * (workSec + b.restSec);
    }, 0);
    return Math.round((warmSec + mainSec + coolSec) / 60);
  }

  function generate(state) {
    const type = pickSessionType(state);
    const workout = type === 'strength' ? buildStrengthWorkout(state) : buildCircuitWorkout(state);
    const warmup = pickFew(WARMUPS, 2);
    const cooldown = pickFew(COOLDOWNS, 2);
    const estMinutes = estimateMinutes(workout, warmup, cooldown);

    return {
      id: 'w_' + Date.now(),
      createdAt: new Date().toISOString(),
      type: workout.type,
      sets: workout.sets,
      restSec: workout.restSec,
      warmup, cooldown,
      blocks: workout.blocks,
      estMinutes,
      difficultyTier: Math.round(state.progress.difficultyTier * 10) / 10,
    };
  }

  return { generate };
})();
