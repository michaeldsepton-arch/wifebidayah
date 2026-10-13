// Weekly scheduling intelligence, difficulty progression, weigh-in tracking and
// per-exercise progressive overload (weights/reps and time-based holds).
const Progress = (() => {

  const REP_TARGET_LO = 6;
  const REP_TARGET_HI = 10;

  function startOfWeek(d = new Date()) {
    const date = new Date(d);
    const day = date.getDay(); // 0 Sun .. 6 Sat
    const diff = (day === 0 ? -6 : 1) - day; // Monday as start
    date.setDate(date.getDate() + diff);
    date.setHours(0,0,0,0);
    return date;
  }

  function stripTime(d) { const c = new Date(d); c.setHours(0,0,0,0); return c; }

  function isoWeekKey(d = new Date()) {
    return startOfWeek(d).toISOString().slice(0, 10); // the Monday date, stable per-week key
  }

  function sessionsThisWeek(state) {
    const start = startOfWeek();
    return state.history.filter(h => new Date(h.date) >= start).length;
  }

  // The full weekly target, unless `forDate` falls in the week she started using the
  // app — then it's capped to however many preferred days are actually left in that
  // first, partial week, so she's never chased for sessions she never had time for.
  function effectiveWeeklyTarget(state, forDate = new Date()) {
    const target = state.settings.weeklyTarget;
    if (!state.onboardedAt) return target;
    const onboardedDate = stripTime(state.onboardedAt);
    const weekStart = startOfWeek(forDate);
    if (startOfWeek(onboardedDate).getTime() !== weekStart.getTime()) return target;

    let count = 0;
    for (let i = 0; i < 7; i++) {
      const d = new Date(weekStart); d.setDate(weekStart.getDate() + i);
      if (d < onboardedDate) continue;
      if (state.settings.preferredDays.includes(d.getDay())) count++;
    }
    return Math.max(1, Math.min(target, count || target));
  }

  // Separates how many PREFERRED days are left this week from how many days are left
  // AT ALL (including off-days) — this is the fix for the "2 sessions left, 1 day
  // left" bug: the old code only ever looked at calendar days left, so it could tell
  // her to do two sessions in a single remaining day. `stillPossible` is the honest
  // ceiling (even using every remaining day, preferred or not); `onTrack` additionally
  // checks whether she can still hit it using only her usual preferred days.
  function weekProgress(state) {
    const done = sessionsThisWeek(state);
    const target = effectiveWeeklyTarget(state, new Date());
    const start = startOfWeek();
    const today = stripTime(new Date());
    const remaining = Math.max(target - done, 0);

    let anyDaysLeft = 0, preferredDaysLeft = 0;
    for (let i = 0; i < 7; i++) {
      const d = new Date(start); d.setDate(start.getDate() + i);
      if (d < today) continue;
      anyDaysLeft++;
      if (state.settings.preferredDays.includes(d.getDay())) preferredDaysLeft++;
    }

    const stillPossible = remaining <= anyDaysLeft;
    const onTrack = remaining <= preferredDaysLeft;
    return { done, target, remaining, anyDaysLeft, preferredDaysLeft, onTrack, stillPossible };
  }

  // The "intuitive" morning nudge copy. Never claims an impossible combination (more
  // sessions left than days left to fit them in) — when the week's target is already
  // out of reach it says so plainly and reframes around just today, instead of
  // pretending today alone can cover several missed sessions.
  function morningMessage(state) {
    if (state.settings.pauseMode) {
      return { title: 'Program paused', body: "You've paused your routine — no pressure this week. Resume any time from Settings." };
    }
    const wp = weekProgress(state);
    if (wp.remaining === 0) {
      return { title: `You're done for the week 🎉`, body: `${wp.done}/${wp.target} sessions complete. Today's a free day — rest or move just for fun.` };
    }
    if (!wp.stillPossible) {
      return { title: `Let's grab today's session`, body: `This week's ${wp.target}-session target is out of reach now — no all-or-nothing here. One more today still counts, and next week resets clean.` };
    }
    if (wp.remaining === 1) {
      return { title: `Today's the day`, body: `Just 1 session left to hit ${wp.target} this week — got 30 min today?` };
    }
    if (wp.remaining === wp.anyDaysLeft) {
      return { title: `Every day counts now`, body: `${wp.remaining} sessions left and exactly ${wp.anyDaysLeft} day${wp.anyDaysLeft>1?'s':''} left — today keeps you on pace.` };
    }
    if (wp.anyDaysLeft <= 2) {
      return { title: `Last call this week`, body: `${wp.remaining} to go, ${wp.anyDaysLeft} day${wp.anyDaysLeft>1?'s':''} left. Today would keep you on track.` };
    }
    return { title: `Got 30 min today?`, body: `${wp.done}/${wp.target} done this week — plenty of runway, but today works great if you're free.` };
  }

  // Called after a completed session: updates streak + totals + recency + difficulty.
  function recordCompletion(state, workout, feedback) {
    const today = new Date().toISOString();
    state.history.push({
      date: today, type: workout.type, workoutId: workout.id,
      exerciseIds: workout.blocks.map(b => b.exerciseId),
      feedback, minutes: workout.estMinutes,
    });
    workout.blocks.forEach(b => { state.exerciseRecency[b.exerciseId] = today; });

    state.progress.totalSessions += 1;

    // streak: consecutive calendar days with a session OR consecutive scheduled sessions —
    // we use "did she hit a session within 2 days of the last one" to stay forgiving of rest days.
    const last = state.history[state.history.length - 2];
    if (last) {
      const gapDays = (new Date(today) - new Date(last.date)) / 86400000;
      state.progress.streak = gapDays <= 3 ? state.progress.streak + 1 : 1;
    } else {
      state.progress.streak = 1;
    }
    state.progress.longestStreak = Math.max(state.progress.longestStreak, state.progress.streak);

    // difficulty scaling: nudge up on 'easy' or sustained consistency, nudge down on 'hard'.
    let tier = state.progress.difficultyTier;
    if (feedback === 'easy') tier += 0.15;
    else if (feedback === 'hard') tier -= 0.1;
    else tier += 0.03; // slow natural progression on steady 'good' feedback

    tier = Math.max(1, Math.min(3, tier));
    state.progress.difficultyTier = Math.round(tier * 100) / 100;

    state.pendingWorkout = null;
    return state;
  }

  function logWeight(state, kg) {
    state.weightLog.push({ date: new Date().toISOString(), kg });
    state.lastWeighInWeekKey = isoWeekKey(new Date());
    return state;
  }

  function weightTrend(state) {
    const log = [...state.weightLog].sort((a,b) => new Date(a.date) - new Date(b.date));
    if (log.length < 2) return null;
    const first = log[0], last = log[log.length - 1];
    const days = Math.max((new Date(last.date) - new Date(first.date)) / 86400000, 1);
    const weeks = Math.round((days / 7) * 10) / 10;
    return { first: first.kg, last: last.kg, delta: Math.round((last.kg - first.kg) * 10) / 10, weeks: Math.max(weeks, 0.1) };
  }

  // Resolves which day/time she's due to weigh in this week and whether it's already
  // logged, upcoming, or overdue — drives both the Home banner and the escalating
  // notification nag (item #19: keep reminding until she actually logs it).
  function weighInStatus(state, now = new Date()) {
    const start = startOfWeek(now);
    const dow = state.settings.weighInDay;
    const offset = dow === 0 ? 6 : dow - 1; // Mon=0 .. Sun=6, relative to the Monday week-start
    const targetDate = new Date(start); targetDate.setDate(start.getDate() + offset);
    const weekKey = isoWeekKey(now);
    const done = state.lastWeighInWeekKey === weekKey;
    const today = stripTime(now);
    const daysUntil = Math.round((targetDate - today) / 86400000);
    const status = done ? 'done' : (daysUntil > 0 ? 'upcoming' : 'due');
    const overdueDays = status === 'due' ? Math.max(0, -daysUntil) : 0;
    return { done, status, targetDate, daysUntil, overdueDays, weekKey };
  }

  // Rolling per-week session counts (most recent `weeks` weeks) + how consistent that
  // is against her target — feeds both the Progress screen and expectedProgress().
  function consistencyStats(state, weeks = 6) {
    const now = new Date();
    const perWeek = [];
    for (let i = weeks - 1; i >= 0; i--) {
      const wkStart = new Date(startOfWeek(now)); wkStart.setDate(wkStart.getDate() - i * 7);
      const wkEnd = new Date(wkStart); wkEnd.setDate(wkStart.getDate() + 7);
      const count = state.history.filter(h => { const d = new Date(h.date); return d >= wkStart && d < wkEnd; }).length;
      perWeek.push({ weekStart: wkStart.toISOString().slice(0, 10), count });
    }
    const target = state.settings.weeklyTarget || 4;
    const sample = perWeek.slice(-4);
    const avgPerWeek = sample.reduce((a, w) => a + w.count, 0) / (sample.length || 1);
    const rate = target ? Math.max(0, Math.min(1, avgPerWeek / target)) : 0;
    return { perWeek, avgPerWeek: Math.round(avgPerWeek * 10) / 10, target, rate: Math.round(rate * 100) };
  }

  // A simple, honest projection: takes her actual weigh-in trend rate (kg/week) and
  // shows where that puts her in `weeksAhead` weeks IF she keeps up her actual
  // consistency rate — not a flat best-case number.
  function expectedProgress(state, weeksAhead = 8) {
    const stats = consistencyStats(state);
    const trend = weightTrend(state);
    let kgPerWeek = null, projectedWeight = null;
    if (trend) {
      kgPerWeek = Math.round((trend.delta / trend.weeks) * 100) / 100;
      const sorted = [...state.weightLog].sort((a, b) => new Date(b.date) - new Date(a.date));
      if (sorted.length) {
        projectedWeight = Math.round((sorted[0].kg + kgPerWeek * weeksAhead) * 10) / 10;
      }
    }
    return { consistencyRate: stats.rate, avgPerWeek: stats.avgPerWeek, target: stats.target, kgPerWeekTrend: kgPerWeek, projectedWeight, weeksAhead };
  }

  function toggleLiked(state, exerciseId) {
    const p = state.exercisePrefs[exerciseId] || {};
    p.liked = !p.liked;
    state.exercisePrefs[exerciseId] = p;
    return state;
  }

  function setUseAlt(state, exerciseId, useAlt) {
    const p = state.exercisePrefs[exerciseId] || {};
    p.useAlt = !!useAlt;
    state.exercisePrefs[exerciseId] = p;
    return state;
  }

  // ---------- Build-up ladders (progressive bodyweight regressions) ----------
  // A ladder preference is stored under its own namespaced key (never collides with
  // a real exercise id, which never contains a colon) so it's independent of the
  // legacy single-step useAlt toggle above.
  function ladderPrefKey(ladderId) { return 'ladder:' + ladderId; }

  // Returns null when she hasn't opted into this ladder yet (no stored preference) —
  // callers decide their own fallback. resolvePreferred() in generator.js treats
  // null as "no override, leave normal rotation alone"; UI code that always needs
  // *something* to show passes its own fallback (usually the easiest rung).
  function currentLadderRungId(state, ladderId, fallbackId) {
    const pref = state.exercisePrefs[ladderPrefKey(ladderId)];
    if (pref && pref.rungId) return pref.rungId;
    return fallbackId != null ? fallbackId : null;
  }

  function setLadderRung(state, ladderId, rungId) {
    const p = state.exercisePrefs[ladderPrefKey(ladderId)] || {};
    p.rungId = rungId;
    state.exercisePrefs[ladderPrefKey(ladderId)] = p;
    return state;
  }

  function parseRepsUpper(repsStr) {
    if (!repsStr) return null;
    const m = String(repsStr).match(/(\d+)(?:-(\d+))?/);
    if (!m) return null;
    return m[2] ? +m[2] : +m[1];
  }

  // Note shown on a bodyweight (non-weighted) ladder step's entry screen. Keyed off
  // the exact rung's own performance history — which means the very first time she's
  // on a given rung (whether she just advanced into it, picked it herself, or it's
  // literally her first session) there's no history yet, so she naturally gets the
  // "first time on this step" framing with no extra bookkeeping needed.
  function suggestBodyweightReps(state, ex) {
    const perf = state.exercisePerf[ex.id];
    if (!perf || perf.lastReps == null) {
      return { note: `First time on ${ex.name} — aim for ${ex.reps || 'a comfortable number of'} reps and we'll build from there.` };
    }
    const hi = parseRepsUpper(ex.reps);
    if (hi != null && perf.lastReps >= hi) {
      return { note: `Last time: ${perf.lastReps} reps — right at the top of the range, nice work. Keep aiming for ${ex.reps} today.` };
    }
    return { note: `Last time: ${perf.lastReps} reps — aim for ${ex.reps || 'a little more'} today.` };
  }

  // Called right after a ladder-member set/hold is recorded (never for anything
  // else). Only ever moves her UP a rung, and only when she comfortably clears the
  // top of the current rung's prescribed range — moving back down is always her own
  // choice, made explicitly from the "Easier alternatives" list, never automatic.
  function recordLadderAttempt(state, ex, result) {
    if (!ex || !ex.ladder) return state;
    const rungIds = LADDERS[ex.ladder] || [];
    const idx = rungIds.indexOf(ex.id);
    if (idx < 0 || idx >= rungIds.length - 1) return state; // not in this ladder, or already at the top

    let success = false;
    if (ex.timeBased) {
      const threshold = (ex.duration || 20) * 2;
      success = result && result.holdSec != null && result.holdSec >= threshold;
    } else {
      const hi = parseRepsUpper(ex.reps);
      success = hi != null && result && result.reps != null && result.reps >= hi;
    }
    if (success) setLadderRung(state, ex.ladder, rungIds[idx + 1]);
    return state;
  }

  // ---------- Progressive overload: weighted / rep-based exercises ----------
  // Target band is 6-10 reps. Below it, drop weight (even next set, same session);
  // above it, add weight. Persists per-exercise so the NEXT time this move comes up
  // — whenever that is — it resumes exactly where she left off.
  function suggestNext(state, exerciseId) {
    const perf = state.exercisePerf[exerciseId];
    if (!perf || perf.lastWeightKg == null) {
      return { suggestedKg: null, note: `First time — pick a weight you can do for ${REP_TARGET_LO}-${REP_TARGET_HI} reps with good form, then log it.` };
    }
    let note;
    if (perf.lastReps < REP_TARGET_LO) {
      note = `Last time: ${perf.lastReps} reps at ${perf.lastWeightKg}kg — try a little lighter today so you can land in the ${REP_TARGET_LO}-${REP_TARGET_HI} range.`;
    } else if (perf.lastReps > REP_TARGET_HI) {
      note = `You hit ${perf.lastReps} reps at ${perf.lastWeightKg}kg last time — try a little heavier today.`;
    } else {
      note = `Last time: ${perf.lastReps} reps at ${perf.lastWeightKg}kg — aim for ${REP_TARGET_LO}-${REP_TARGET_HI} again.`;
    }
    return { suggestedKg: perf.lastWeightKg, note };
  }

  // Called the moment she taps "Finished Set" — updates immediately so the very next
  // set (same session or not) sees the fresh number via suggestNext().
  function recordSetPerformance(state, exerciseId, kg, reps) {
    const perf = state.exercisePerf[exerciseId] || { timesPerformed: 0 };
    perf.lastWeightKg = (kg === null || kg === undefined || isNaN(kg)) ? (perf.lastWeightKg ?? null) : kg;
    perf.lastReps = (reps === null || reps === undefined || isNaN(reps)) ? (perf.lastReps ?? null) : reps;
    perf.timesPerformed = (perf.timesPerformed || 0) + 1;
    state.exercisePerf[exerciseId] = perf;
    return state;
  }

  // ---------- Progressive overload: time-based holds (planks, wall sits, etc.) ----------
  // First time is a capability test — no target, just "go as long as you can" — and
  // every target after that is built from her actual best, not a flat default.
  function suggestHoldTarget(state, exerciseId, defaultDuration) {
    const perf = state.exercisePerf[exerciseId];
    if (!perf || !perf.tested) {
      return { isCapabilityTest: true, targetSec: defaultDuration, note: "First time on this one — hold as long as you comfortably can. We'll build your target from today's result." };
    }
    const best = perf.bestHoldSec || defaultDuration;
    const targetSec = Math.max(defaultDuration, Math.round(best * 1.1));
    return { isCapabilityTest: false, targetSec, note: `Your best so far: ${best}s — today's target is ${targetSec}s.` };
  }

  function recordHoldPerformance(state, exerciseId, achievedSec) {
    if (achievedSec == null || isNaN(achievedSec)) return state;
    const perf = state.exercisePerf[exerciseId] || { timesPerformed: 0 };
    perf.lastHoldSec = achievedSec;
    perf.bestHoldSec = Math.max(perf.bestHoldSec || 0, achievedSec);
    perf.tested = true;
    perf.timesPerformed = (perf.timesPerformed || 0) + 1;
    state.exercisePerf[exerciseId] = perf;
    return state;
  }

  return {
    startOfWeek, sessionsThisWeek, weekProgress, effectiveWeeklyTarget, morningMessage,
    recordCompletion, logWeight, weightTrend, isoWeekKey, weighInStatus, consistencyStats,
    expectedProgress, toggleLiked, setUseAlt, suggestNext, recordSetPerformance,
    suggestHoldTarget, recordHoldPerformance, REP_TARGET_LO, REP_TARGET_HI,
    currentLadderRungId, setLadderRung, suggestBodyweightReps, recordLadderAttempt,
  };
})();
