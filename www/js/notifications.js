// Local notification scheduling: morning check-ins (Fajr-relative, cycle-aware, or
// manual), an evening "alarm" nudge, a one-off reminder for the time she picks each
// day, and a persistent weekly weigh-in nag. Also diagnoses and fixes the most likely
// real cause of "notifications just don't fire" on Android 13+: the separate,
// user-grantable exact-alarm permission that sits beside the ordinary notification
// permission and silently no-ops scheduled alarms when it's off.
const Notify = (() => {
  const CHECKIN_BASE_ID = 1000; // + day offset (0..13)
  const ALARM_BASE_ID = 2000;
  const TODAY_PICK_ID = 3000;
  const WEIGHIN_BASE_ID = 4000; // + escalation day offset (0..7)

  const CHECKIN_ACTION_TYPE = 'BIDAYAH_CHECKIN';
  const WEIGHIN_ACTION_TYPE = 'BIDAYAH_WEIGHIN';

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
      await LN.createChannel({
        id: 'bidayah-weighin', name: 'Weigh-in reminders',
        description: 'Keeps reminding you until this week\'s weigh-in is logged',
        importance: 4, visibility: 1, vibration: true,
      });
    } catch (e) { /* channels are Android-only; fine to ignore elsewhere */ }
  }

  // Android 13+ (API 33) ships a second, separate "exact alarms" permission
  // (SCHEDULE_EXACT_ALARM / Alarms & reminders in system settings) beside the
  // ordinary notification permission. A phone can show "notifications: allowed" and
  // still silently never fire a single scheduled alarm if this one is off — which
  // matches a reminder that worked once, then stopped, with nothing in the UI to
  // explain why. We surface + fix this directly rather than leaving it a mystery.
  async function checkExactAlarm() {
    const LN = plugin();
    if (!LN || !LN.checkExactNotificationSetting) return 'unsupported';
    try {
      const res = await LN.checkExactNotificationSetting();
      return res.exact_alarm || res.value || 'unknown';
    } catch (e) { return 'unsupported'; }
  }

  async function openExactAlarmSettings() {
    const LN = plugin();
    if (!LN || !LN.changeExactNotificationSetting) return false;
    try { await LN.changeExactNotificationSetting(); return true; }
    catch (e) { console.warn('openExactAlarmSettings failed', e); return false; }
  }

  async function registerActions() {
    const LN = plugin();
    if (!LN || !LN.registerActionTypes) return;
    try {
      await LN.registerActionTypes({
        types: [
          { id: CHECKIN_ACTION_TYPE, actions: [
            { id: 'start_now', title: "I've got time" },
            { id: 'later', title: 'Remind me later' },
          ] },
          { id: WEIGHIN_ACTION_TYPE, actions: [
            { id: 'log_now', title: 'Log my weight' },
            { id: 'later', title: 'Remind me later' },
          ] },
        ],
      });
    } catch (e) { /* no-op on platforms without action type support */ }
  }

  // Lets app.js react when a notification is tapped, or one of its action buttons is
  // pressed — instead of the notification just appearing and then vanishing with
  // nothing she could do about it (item #9). Returns an unsubscribe function.
  function onAction(handler) {
    const LN = plugin();
    if (!LN || !LN.addListener) return () => {};
    const sub = LN.addListener('localNotificationActionPerformed', (event) => {
      try { handler(event); } catch (e) { console.warn('notification action handler failed', e); }
    });
    return () => { if (sub && sub.remove) sub.remove(); };
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
    const target = Progress.effectiveWeeklyTarget(state, futureDate);
    return Math.max(target - doneInThatWeek, 0);
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
    await registerActions();

    let fajrDays = {};
    if (state.settings.useFajrSchedule && !state.settings.cycleMode) {
      try { fajrDays = await Prayer.refresh(state); } catch (e) { console.warn('prayer refresh failed', e); }
    }

    try {
      const pending = await LN.getPending();
      const ours = pending.notifications.filter(n => n.id >= 1000 && n.id < 5000).map(n => ({ id: n.id }));
      if (ours.length) await LN.cancel({ notifications: ours });
    } catch (e) { console.warn('cancel pending failed', e); }

    // Paused program: clear everything and stop here (item #20 — pause for rest/injury weeks).
    if (state.settings.pauseMode) return;

    const checkins = [];
    const alarms = [];

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
        smallIcon: 'ic_stat_bidayah', actionTypeId: CHECKIN_ACTION_TYPE,
        extra: { kind: 'checkin', dayOffset: i },
      });

      if (state.settings.alarmEnabled) {
        const alarmAt = dateAt(i, state.settings.alarmTime);
        if (alarmAt > new Date()) {
          const line = ALARM_LINES[(i + (state.profile.name || '').length) % ALARM_LINES.length];
          alarms.push({
            id: ALARM_BASE_ID + i, title: 'Bidayah Fitness', body: line,
            schedule: { at: alarmAt }, channelId: 'bidayah-alarm',
            smallIcon: 'ic_stat_bidayah', actionTypeId: CHECKIN_ACTION_TYPE,
            extra: { kind: 'checkin', dayOffset: i },
          });
        }
      }
    }

    const weighins = buildWeighInNotifications(state);

    try {
      if (checkins.length) await LN.schedule({ notifications: checkins });
      if (alarms.length) await LN.schedule({ notifications: alarms });
      if (weighins.length) await LN.schedule({ notifications: weighins });
    } catch (e) { console.warn('schedule failed', e); }
  }

  // Weekly weigh-in, same day/time every week, that keeps reminding her until she
  // actually logs it (item #19) — schedules the due day itself plus up to 6 more days
  // of escalating nags if it still isn't logged, rather than firing once and giving up.
  function buildWeighInNotifications(state) {
    const status = Progress.weighInStatus(state);
    if (status.done) return [];
    const out = [];
    const [h, m] = (state.settings.weighInTime || '08:00').split(':').map(Number);
    for (let i = 0; i <= 6; i++) {
      const d = new Date(status.targetDate);
      d.setDate(d.getDate() + i);
      d.setHours(h, m, 0, 0);
      if (d < new Date()) continue;
      const body = i === 0
        ? "Weigh-in day — logging it keeps your trend and progress graphs accurate."
        : `Still haven't logged this week's weigh-in (${i} day${i>1?'s':''} overdue) — takes 10 seconds.`;
      out.push({
        id: WEIGHIN_BASE_ID + i, title: 'Weekly weigh-in', body,
        schedule: { at: d }, channelId: 'bidayah-weighin',
        smallIcon: 'ic_stat_bidayah', actionTypeId: WEIGHIN_ACTION_TYPE,
        extra: { kind: 'weighin' },
      });
    }
    return out;
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
        actionTypeId: CHECKIN_ACTION_TYPE, extra: { kind: 'checkin' },
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

  // Diagnostic snapshot for a "Notifications" panel in Settings, so a silent-failure
  // mode (permission granted but exact alarms blocked, or nothing actually pending)
  // is visible instead of a mystery.
  async function getStatus() {
    const LN = plugin();
    if (!LN) return { supported: false };
    let display = 'unknown', exactAlarm = 'unsupported', pendingCount = 0;
    try { display = (await LN.checkPermissions()).display; } catch (e) {}
    try { exactAlarm = await checkExactAlarm(); } catch (e) {}
    try { pendingCount = (await LN.getPending()).notifications.length; } catch (e) {}
    return { supported: true, display, exactAlarm, pendingCount };
  }

  return {
    ensurePermission, refreshSchedule, scheduleTodayReminder, cancelTodayReminder, notifyNow,
    checkExactAlarm, openExactAlarmSettings, onAction, getStatus,
  };
})();
