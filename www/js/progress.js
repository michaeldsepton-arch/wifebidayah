// Weekly scheduling intelligence + difficulty progression.
const Progress = (() => {

  function startOfWeek(d = new Date()) {
    const date = new Date(d);
    const day = date.getDay(); // 0 Sun .. 6 Sat
    const diff = (day === 0 ? -6 : 1) - day; // Monday as start
    date.setDate(date.getDate() + diff);
    date.setHours(0,0,0,0);
    return date;
  }

  function sessionsThisWeek(state) {
    const start = startOfWeek();
    return state.history.filter(h => new Date(h.date) >= start).length;
  }

  function stripTime(d) { const c = new Date(d); c.setHours(0,0,0,0); return c; }

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

  function weekProgress(state) {
    const done = sessionsThisWeek(state);
    const target = effectiveWeeklyTarget(state, new Date());
    const start = startOfWeek();
    const today = new Date();
    const todayIdx = today.getDay() === 0 ? 7 : today.getDay(); // 1..7, Mon=1
    const daysLeftIncToday = 8 - todayIdx; // includes today
    const remaining = Math.max(target - done, 0);
    return { done, target, remaining, daysLeftIncToday, onTrack: remaining <= daysLeftIncToday };
  }

  // The "intuitive" morning nudge copy — reflects how many are left and how urgent it's getting.
  function morningMessage(state, name) {
    const who = name ? name : 'there';
    const wp = weekProgress(state);
    if (wp.remaining === 0) {
      return { title: `You're done for the week 🎉`, body: `${wp.done}/${wp.target} sessions complete. Today's a free day — rest or move just for fun.` };
    }
    if (wp.remaining >= wp.daysLeftIncToday) {
      return { title: `Today's the day`, body: `${wp.remaining} session${wp.remaining>1?'s':''} left and ${wp.daysLeftIncToday} day${wp.daysLeftIncToday>1?'s':''} to fit them in — got 30 min today?` };
    }
    if (wp.daysLeftIncToday <= 2) {
      return { title: `Last call this week`, body: `${wp.remaining} to go, only ${wp.daysLeftIncToday} day${wp.daysLeftIncToday>1?'s':''} left. Today would keep you on track.` };
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

    // bonus bump for hitting weekly target three weeks running
    tier = Math.max(1, Math.min(3, tier));
    state.progress.difficultyTier = Math.round(tier * 100) / 100;

    state.pendingWorkout = null;
    return state;
  }

  function logWeight(state, kg) {
    state.weightLog.push({ date: new Date().toISOString(), kg });
    return state;
  }

  function weightTrend(state) {
    const log = [...state.weightLog].sort((a,b) => new Date(a.date) - new Date(b.date));
    if (log.length < 2) return null;
    const first = log[0].kg, lastW = log[log.length-1].kg;
    return { first, last: lastW, delta: Math.round((lastW - first) * 10) / 10 };
  }

  return { startOfWeek, sessionsThisWeek, weekProgress, effectiveWeeklyTarget, morningMessage, recordCompletion, logWeight, weightTrend };
})();
