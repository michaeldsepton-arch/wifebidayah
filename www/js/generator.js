// Workout generation: picks a fresh, non-repeating, difficulty-scaled session that
// actually totals ~30 real minutes once every step (reps or time) gets a real timer.
const Generator = (() => {

  const TRANSITION_SEC = 15; // time to change position / grab equipment between different exercises
  const WEIGHTED_EQUIPMENT = ['dumbbell', 'plate', 'curlbar'];

  function daysSince(dateStr) {
    if (!dateStr) return 999;
    const ms = Date.now() - new Date(dateStr).getTime();
    return ms / 86400000;
  }

  function byId(id) { return EXERCISES.find(e => e.id === id); }

  // If she's marked this exercise "use the easier version", swap it for its altId
  // before it ever reaches the player — liking/rotation scoring below still happens
  // on the original entry, so "liking" the hard version still works even while she's
  // building up to it on the easier one.
  //
  // Ladder members (see LADDERS in exercises.js) work the same way but are keyed by
  // the whole ladder, not the specific exercise: whichever rung pickExercise() would
  // normally have landed on for a pattern slot, if she has an active chosen rung for
  // that ladder it always resolves to HER rung instead — that's what makes "every
  // slot that would land on any push-up variant becomes her push-up progression"
  // actually work. Until she opts in (picks a rung from "Easier alternatives" for
  // the first time), there's no stored preference yet and behavior is unchanged:
  // normal tier-based rotation across all of that ladder's rungs, same as any other
  // exercise.
  function resolvePreferred(state, ex) {
    if (!ex) return ex;
    if (ex.ladder) {
      const rungId = Progress.currentLadderRungId(state, ex.ladder, null);
      if (rungId) {
        const target = byId(rungId);
        if (target) return target;
      }
      return ex;
    }
    const pref = state.exercisePrefs && state.exercisePrefs[ex.id];
    if (pref && pref.useAlt && ex.altId) {
      const alt = byId(ex.altId);
      if (alt) return alt;
    }
    return ex;
  }

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

  // Pick the best candidate: favors long-unused exercises, light tier matching, a
  // liked bonus (item #5 — liking an exercise makes it enter rotation more often),
  // and a little randomness.
  function pickExercise(state, patterns, excludeIds, minGapDays) {
    let pool = eligible(state, patterns, excludeIds).filter(e =>
      daysSince(state.exerciseRecency[e.id]) >= minGapDays
    );
    if (pool.length === 0) pool = eligible(state, patterns, excludeIds); // relax recency
    if (pool.length === 0) pool = EXERCISES.filter(e => patterns.includes(e.pattern)); // last resort, ignore equipment/exclude
    if (pool.length === 0) return null;

    const targetTier = state.progress.difficultyTier;
    const prefs = state.exercisePrefs || {};
    let best = null, bestScore = -Infinity;
    for (const ex of pool) {
      const recency = Math.min(daysSince(state.exerciseRecency[ex.id]), 60);
      const tierDiff = Math.abs(ex.tier - targetTier);
      const likedBonus = prefs[ex.id] && prefs[ex.id].liked ? 8 : 0;
      const score = recency * 2 - tierDiff * 4 + likedBonus + Math.random() * 6;
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

  // Picks cool-down stretches that actually match the muscles she just trained,
  // instead of a random pair: a leg day gets leg stretches, a chest day gets a
  // chest/shoulder stretch, and so on. Walks the distinct patterns trained today
  // (in the order they appear in the workout) and takes one matching stretch per
  // pattern, then tops up with any other matching stretch, then finally generic
  // ones (deep breathing, etc.) so she still always gets at least two.
  function pickTargetedCooldown(blocks) {
    const trained = [...new Set((blocks || []).map(b => b.pattern))];
    const used = new Set();
    const picks = [];

    for (const pattern of trained) {
      if (picks.length >= 3) break;
      const candidates = COOLDOWNS.filter(c => c.targets && c.targets.includes(pattern) && !used.has(c.id));
      if (!candidates.length) continue;
      const chosen = candidates[Math.floor(Math.random() * candidates.length)];
      used.add(chosen.id);
      picks.push(chosen);
    }

    if (picks.length < 2) {
      const moreMatched = COOLDOWNS.filter(c =>
        c.targets && c.targets.some(t => trained.includes(t)) && !used.has(c.id));
      for (const c of moreMatched) {
        if (picks.length >= 2) break;
        used.add(c.id);
        picks.push(c);
      }
    }

    if (picks.length < 2) {
      const generic = COOLDOWNS.filter(c => !used.has(c.id));
      pickFew(generic, 2 - picks.length).forEach(c => picks.push(c));
    }

    return picks.slice(0, 3);
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

  // Builds the full block the player will run: for time-based moves, resolves whether
  // this is a first-time capability test or a progressed target built from her actual
  // best; for weighted rep moves, resolves a suggested working weight from last time
  // and the 6-10 rep target band. `trackWeight` tells the player to show a weight +
  // reps entry (and a Finished Set button) instead of a countdown timer.
  function makeBlock(ex, sets, restSec, tier, tempo, state) {
    const trackWeight = !ex.timeBased && ex.equipment.some(eq => WEIGHTED_EQUIPMENT.includes(eq));
    let duration = ex.duration;
    let isCapabilityTest = false, suggestedWeightKg = null, overloadNote = null, repTarget = null;

    if (ex.timeBased) {
      if (tier >= 2.5) duration = Math.round(ex.duration * 1.25);
      const hold = Progress.suggestHoldTarget(state, ex.id, duration || ex.duration);
      isCapabilityTest = hold.isCapabilityTest;
      duration = hold.targetSec;
      overloadNote = hold.note;
    } else if (trackWeight) {
      const sug = Progress.suggestNext(state, ex.id);
      suggestedWeightKg = sug.suggestedKg;
      overloadNote = sug.note;
      repTarget = `${Progress.REP_TARGET_LO}-${Progress.REP_TARGET_HI}`;
    } else if (ex.ladder) {
      // Bodyweight build-up ladder step (push-up, plank, pull-up, etc.) — no weight
      // involved, but still worth a "last time / aim for" note so progress toward
      // the next rung is visible the same way weighted and hold-based moves show it.
      overloadNote = Progress.suggestBodyweightReps(state, ex).note;
    }

    const workSec = ex.timeBased ? (duration || ex.duration) : estimateWorkSeconds(ex, tempo);
    return {
      exerciseId: ex.id,
      name: ex.name,
      cue: ex.cue,
      images: ex.images || [],
      video: ex.video || null,
      steps: ex.steps || [],
      pattern: ex.pattern,
      focus: ex.focus,
      equipment: ex.equipment,
      altId: ex.altId || null,
      timeBased: !!ex.timeBased,
      isCapabilityTest,
      reps: ex.reps || null,
      repTarget,
      trackWeight,
      suggestedWeightKg,
      overloadNote,
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
      const picked = pickExercise(state, slot.patterns, used, 10);
      if (!picked) continue;
      used.add(picked.id);
      const ex = resolvePreferred(state, picked);
      used.add(ex.id);
      blocks.push(makeBlock(ex, band.minSets, band.restSec, state.progress.difficultyTier, band.repTempo, state));
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
      const picked = pickExercise(state, [p], used, 7);
      if (!picked) continue;
      used.add(picked.id);
      const ex = resolvePreferred(state, picked);
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

    const blocks = exList.map(ex => makeBlock(ex, rounds, restSec, state.progress.difficultyTier, band.repTempo, state));
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
    // Cool-down stretches depend on which patterns actually end up in the workout
    // (so they can be tailored to what she trained), which isn't known until the
    // workout itself is built below — use a rough average cooldown length here
    // just to size the main-set time budget, then pick the real, targeted
    // stretches afterward once the blocks exist.
    const roughCooldownSec = 50; // ~2 stretches at ~25s each, same ballpark as before
    const overheadSec = warmup.reduce((a, w) => a + w.duration, 0)
      + roughCooldownSec
      + (warmup.length + 2) * TRANSITION_SEC;
    const mainBudget = Math.max(600, targetTotalSec - overheadSec);

    const workout = type === 'strength'
      ? buildStrengthWorkout(state, band, mainBudget)
      : buildCircuitWorkout(state, band, mainBudget);

    const cooldown = pickTargetedCooldown(workout.blocks);

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

  return { generate, byId, resolvePreferred };
})();
