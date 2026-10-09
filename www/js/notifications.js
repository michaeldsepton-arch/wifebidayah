// Local notification scheduling: morning check-ins (Fajr-relative or manual),
// an evening "alarm" nudge, and a one-off reminder for the time she picks each day.
const Notify = (() => {
  const CHECKIN_BASE_ID = 1000; // + day offset (0..13)
  const ALARM_BASE_ID = 2000;
  const TODAY_PICK_ID = 3000;

  function plugin() {
    return window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.LocalNotifications;
  }

  async function ensurePermission() {
    const LN = plugin();
    if (!LN) return false;
    try {
      const perm = await LN.checkPermissions();
      if (perm.display === 'granted') return true;
      const req = await LN.requestPermissions();
      return req.display === 'granted';
    } catch (e) { console.warn('Notification permission check failed', e); return false; }
  }

  async function ensureChannel() {
    const LN = plugin();
    if (!LN || !LN.createChannel) return;
    try {
      await LN.createChannel({
        id: 'bidayah-reminders', name: 'Workout reminders',
        description: 'Daily workout nudges from Bidayah Fitness',
        importance: 4, visibility: 1, vibration: true,
      });
      await LN.createChannel({
        id: 'bidayah-alarm', name: 'Workout alarm',
        description: "Last-call reminder if today's session is still open",
        importance: 5, visibility: 1, vibration: true,
      });
    } catch (e) { /* channels are Android-only; fine to ignore elsewhere */ }
  }

  const ALARM_LINES = [
    "Still time for 30 minutes today — want to knock it out?",
    "Evening check-in: today's session is still open if you've got half an hour.",
    "No pressure, just a nudge — your workout is still waiting for you today.",
    "Quick 30? Tonight still counts toward this week.",
  ];

  function dateAt(daysFromNow, hhmm) {
    const [h, m] = hhmm.split(':').map(Number);
    const d = new Date();
    d.setDate(d.getDate() + daysFromNow);
    d.setHours(h, m, 0, 0);
    return d;
  }

  function projectedRemaining(state, futureDate) {
    const start = Progress.startOfWeek(futureDate);
    const doneInThatWeek = state.history.filter(h => {
      const hd = new Date(h.date);
      return hd >= start && hd <= futureDate;
    }).length;
    return Math.max(state.settings.weeklyTarget - doneInThatWeek, 0);
  }

  // Resolves the morning check-in time for a given future date: cycle override first,
  // then Fajr + offset (if enabled and known), then the manual fallback time.
  function resolveMorningTime(state, date, fajrDays) {
    if (state.settings.cycleMode) return state.settings.cycleTime;
    if (state.settings.useFajrSchedule) {
      const fajr = Prayer.fajrFor(date, fajrDays);
      if (fajr) return Prayer.addMinutes(fajr, state.settings.fajrOffsetMinutes);
    }
    return state.settings.reminderTime;
  }

  async function refreshSchedule(state) {
    const LN = plugin();
    if (!LN) return; // running in a plain browser preview — no-op
    const ok = await ensurePermission();
    if (!ok) return;
    await ensureChannel();

    let fajrDays = {};
    if (state.settings.useFajrSchedule && !state.settings.cycleMode) {
      try { fajrDays = await Prayer.refresh(state); } catch (e) { console.warn('prayer refresh failed', e); }
    }

    try {
      const pending = await LN.getPending();
      const ours = pending.notifications.filter(n => n.id >= 1000 && n.id < 3000).map(n => ({ id: n.id }));
      if (ours.length) await LN.cancel({ notifications: ours });
    } catch (e) { console.warn('cancel pending failed', e); }

    const checkins = [];
    const alarms = [];
    const name = state.profile.name || '';

    for (let i = 0; i < 14; i++) {
      const d = new Date(); d.setDate(d.getDate() + i);
      const dow = d.getDay();
      if (!state.settings.preferredDays.includes(dow)) continue;

      const timeStr = resolveMorningTime(state, d, fajrDays);
      const fireAt = dateAt(i, timeStr);
      if (fireAt < new Date()) continue;
      const remaining = projectedRemaining(state, fireAt);
      const msg = remaining === 0
        ? { title: "You're on track 🎉", body: "This week's sessions are covered — today's optional." }
        : { title: "Got 30 min today?", body: `${remaining} session${remaining > 1 ? 's' : ''} left this week — tap to pick a time that works today.` };

      checkins.push({
        id: CHECKIN_BASE_ID + i, title: msg.title, body: msg.body,
        schedule: { at: fireAt }, channelId: 'bidayah-reminders',
        smallIcon: 'ic_stat_bidayah',
      });

      if (state.settings.alarmEnabled) {
        const alarmAt = dateAt(i, state.settings.alarmTime);
        if (alarmAt > new Date()) {
          const line = ALARM_LINES[(i + name.length) % ALARM_LINES.length];
          alarms.push({
            id: ALARM_BASE_ID + i, title: 'Bidayah Fitness', body: line,
            schedule: { at: alarmAt }, channelId: 'bidayah-alarm',
            smallIcon: 'ic_stat_bidayah',
          });
        }
      }
    }

    try {
      if (checkins.length) await LN.schedule({ notifications: checkins });
      if (alarms.length) await LN.schedule({ notifications: alarms });
    } catch (e) { console.warn('schedule failed', e); }
  }

  // Schedules (or replaces) the single reminder for the time she picked today.
  async function scheduleTodayReminder(hhmm) {
    const LN = plugin();
    if (!LN) return;
    const ok = await ensurePermission();
    if (!ok) return;
    await ensureChannel();
    try { await LN.cancel({ notifications: [{ id: TODAY_PICK_ID }] }); } catch (e) {}
    const [h, m] = hhmm.split(':').map(Number);
    const at = new Date(); at.setHours(h, m, 0, 0);
    if (at < new Date()) return; // picked a time already past today — nothing to schedule
    try {
      await LN.schedule({ notifications: [{
        id: TODAY_PICK_ID, title: 'Workout time ⏰',
        body: "You picked this time for today — ready for your 30 minutes?",
        schedule: { at }, channelId: 'bidayah-alarm', smallIcon: 'ic_stat_bidayah',
      }] });
    } catch (e) { console.warn('scheduleTodayReminder failed', e); }
  }

  async function cancelTodayReminder() {
    const LN = plugin();
    if (!LN) return;
    try { await LN.cancel({ notifications: [{ id: TODAY_PICK_ID }] }); } catch (e) {}
  }

  async function notifyNow(title, body) {
    const LN = plugin();
    if (!LN) return;
    const ok = await ensurePermission();
    if (!ok) return;
    try {
      await LN.schedule({ notifications: [{ id: Math.floor(Math.random()*100000)+5000, title, body, schedule: { at: new Date(Date.now()+1000) }, channelId: 'bidayah-reminders' }] });
    } catch (e) { console.warn('notifyNow failed', e); }
  }

  return { ensurePermission, refreshSchedule, scheduleTodayReminder, cancelTodayReminder, notifyNow };
})();
