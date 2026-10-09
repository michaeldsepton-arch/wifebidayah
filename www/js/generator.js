// Workout generation: picks a fresh, non-repeating, difficulty-scaled session that
// actually totals ~30 real minutes once every step (reps or time) gets a real timer.
const Generator = (() => {

  const TRANSITION_SEC = 15; // time to change position / grab equipment between different exercises

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

  // Rest between sets, and the set-count range we're allowed to flex within to hit the
  // time budget. Higher tiers rest a little less and can take on more total sets.
  function tierBand(tier) {
    if (tier < 1.5) return { restSec: 45, minSets: 2, maxSets: 4, repTempo: 3.4 };
    if (tier < 2.5) return { restSec: 35, minSets: 3, maxSets: 5, repTempo: 3.0 };
    return { restSec: 25, minSets: 3, maxSets: 6, repTempo: 2.7 };
  }

  function pickFew(list, n) {
    const copy = [...list];
    const out = [];
    while (out.length < n && copy.length) {
      out.push(copy.splice(Math.floor(Math.random() * copy.length), 1)[0]);
    }
    return out;
  }

  // How many reps a reps string like "10-12", "10 per side" or "20 total" represents,
  // so a rep-based set can be given a believable, real running countdown.
  function parseRepsCount(repsStr) {
    if (!repsStr) return 12;
    const m = String(repsStr).match(/(\d+)(?:-(\d+))?/);
    let n = 12;
    if (m) { const lo = +m[1], hi = m[2] ? +m[2] : lo; n = (lo + hi) / 2; }
    if (/per side/i.test(repsStr)) n *= 2; // both sides = twice the reps in one set
    return n;
  }

  function estimateWorkSeconds(ex, tempo) {
    if (ex.timeBased) return ex.duration;
    return Math.max(24, Math.round(parseRepsCount(ex.reps) * tempo + 6));
  }

  function makeBlock(ex, sets, restSec, tier, tempo) {
    let duration = ex.duration;
    if (tier >= 2.5 && ex.timeBased) duration = Math.round(ex.duration * 1.25);
    const workSec = ex.timeBased ? (duration || ex.duration) : estimateWorkSeconds(ex, tempo);
    return {
      exerciseId: ex.id,
      name: ex.name,
      cue: ex.cue,
      images: ex.images || [],
      steps: ex.steps || [],
      pattern: ex.pattern,
      focus: ex.focus,
      equipment: ex.equipment,
      timeBased: !!ex.timeBased,
      reps: ex.reps || null,
      duration: duration || null,
      workSec,
      sets,
      restSec,
    };
  }

  function blockSeconds(b) {
    return b.sets * b.workSec + (b.sets - 1) * b.restSec;
  }

  // Grows sets round-robin (always topping up whichever block has the fewest so far)
  // until the main session is within reach of its time budget, capped per-tier so no
  // single move takes over the whole workout.
  function fillToBudget(blocks, targetSec, maxSets) {
    if (!blocks.length) return blocks;
    const transitionTotal = (blocks.length - 1) * TRANSITION_SEC;
    const total = () => blocks.reduce((a, b) => a + blockSeconds(b), 0) + transitionTotal;

    let guard = 80;
    while (total() < targetSec && guard-- > 0) {
      const candidates = blocks.filter(b => b.sets < maxSets);
      if (!candidates.length) break;
      candidates.sort((a, b) => a.sets - b.sets);
      candidates[0].sets += 1;
    }
    guard = 40;
    while (total() > targetSec * 1.15 && guard-- > 0) {
      const candidates = blocks.filter(b => b.sets > 2);
      if (!candidates.length) break;
      candidates.sort((a, b) => b.sets - a.sets);
      candidates[0].sets -= 1;
    }
    return blocks;
  }

  function buildStrengthWorkout(state, band, mainBudget) {
    const n = state.progress.totalSessions;
    const used = new Set();

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
      blocks.push(makeBlock(ex, band.minSets, band.restSec, state.progress.difficultyTier, band.repTempo));
    }
    fillToBudget(blocks, mainBudget, band.maxSets);
    return { type: 'strength', blocks };
  }

  // A circuit moves through all the exercises once per round with only a short
  // changeover between moves, then a real rest before the next round — not just
  // straight sets of one move at a time.
  function buildCircuitWorkout(state, band, mainBudget) {
    const used = new Set();
    const patternPlan = ['cardio', 'squat', 'core', 'pushH', 'cardio', 'pull'];
    const restSec = 20;
    const exList = [];
    for (const p of patternPlan) {
      const ex = pickExercise(state, [p], used, 7);
      if (!ex) continue;
      used.add(ex.id);
      exList.push(ex);
    }
    if (!exList.length) return { type: 'circuit', blocks: [] };

    const perExerciseSec = exList.map(ex => estimateWorkSeconds(ex, band.repTempo));
    const roundSec = perExerciseSec.reduce((a, s) => a + s, 0)
      + (exList.length - 1) * TRANSITION_SEC // changeovers within the round
      + restSec; // rest before next round
    let rounds = Math.max(2, Math.round(mainBudget / roundSec));
    rounds = Math.min(rounds, band.maxSets + 1); // circuits can run one extra round vs strength sets

    const blocks = exList.map(ex => makeBlock(ex, rounds, restSec, state.progress.difficultyTier, band.repTempo));
    return { type: 'circuit', blocks };
  }

  // Mirrors exactly how app.js's buildSteps() turns warmup/blocks/cooldown into real
  // player steps, so the number shown on Home always matches what she actually
  // experiences in the player. Keep this in sync with buildSteps() in app.js.
  function estimateMinutes(workout, warmup, cooldown) {
    let sec = 0;

    warmup.forEach((w, i) => { sec += w.duration; if (i < warmup.length - 1) sec += TRANSITION_SEC; });
    if (warmup.length && workout.blocks.length) sec += TRANSITION_SEC;

    if (workout.type === 'circuit' && workout.blocks.length) {
      const rounds = workout.blocks[0].sets;
      for (let r = 0; r < rounds; r++) {
        workout.blocks.forEach((b, i) => {
          sec += b.workSec;
          const lastInRound = i === workout.blocks.length - 1;
          if (lastInRound && r < rounds - 1) sec += b.restSec; // rest before next round
          else if (!lastInRound) sec += TRANSITION_SEC; // changeover to next move, same round
        });
      }
    } else {
      workout.blocks.forEach((b, i) => {
        sec += blockSeconds(b);
        if (i < workout.blocks.length - 1) sec += TRANSITION_SEC;
      });
    }

    if (cooldown.length && workout.blocks.length) sec += TRANSITION_SEC;
    cooldown.forEach((c, i) => { sec += c.duration; if (i < cooldown.length - 1) sec += TRANSITION_SEC; });

    return Math.round(sec / 60);
  }

  function generate(state) {
    const type = pickSessionType(state);
    const band = tierBand(state.progress.difficultyTier);
    const targetTotalSec = (state.settings.sessionMinutes || 30) * 60;

    const warmup = pickFew(WARMUPS, 2);
    const cooldown = pickFew(COOLDOWNS, 2);
    const overheadSec = warmup.reduce((a, w) => a + w.duration, 0)
      + cooldown.reduce((a, c) => a + c.duration, 0)
      + (warmup.length + cooldown.length) * TRANSITION_SEC;
    const mainBudget = Math.max(600, targetTotalSec - overheadSec);

    const workout = type === 'strength'
      ? buildStrengthWorkout(state, band, mainBudget)
      : buildCircuitWorkout(state, band, mainBudget);

    const estMinutes = estimateMinutes(workout, warmup, cooldown);

    return {
      id: 'w_' + Date.now(),
      createdAt: new Date().toISOString(),
      type: workout.type,
      transitionSec: TRANSITION_SEC,
      warmup, cooldown,
      blocks: workout.blocks,
      estMinutes,
      difficultyTier: Math.round(state.progress.difficultyTier * 10) / 10,
    };
  }

  return { generate };
})();
