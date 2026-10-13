const App = (() => {
  const DOW_ORDER = [1,2,3,4,5,6,0]; // Mon..Sun
  const DOW_LABEL = { 1:'M',2:'T',3:'W',4:'T',5:'F',6:'S',0:'S' };
  const PATTERN_ICON = { squat:'◧', hinge:'◩', lunge:'◪', pushH:'▲', pushV:'▴', pull:'◂', core:'●', carry:'➜', cardio:'✦' };
  const PHASE_ICON = { rest:'○', transition:'➜', warmup:'✦', cooldown:'✦' };
  const PHASE_LABEL = { work:'WORK', rest:'REST', warmup:'WARM-UP', cooldown:'COOL-DOWN', transition:'GET READY' };
  const CAP_TEST_MAX_SEC = 600; // safety ceiling for an open-ended "hold as long as you can"
  const RING_R = 52;
  const RING_CIRC = 2 * Math.PI * RING_R;

  // ---------------- TUTORIAL CONTENT ----------------
  // Every chapter covers one area of the app. Auto-plays end to end on first
  // open (skippable chapter by chapter); replayable any time from its own tab.
  //
  // Rather than static screenshots (which drift out of sync with the real UI
  // and can't show interactive bits like buttons mid-press), each step names
  // a `scene` (a TUTORIAL_SCENES entry that puts the real, live app into the
  // right state) and a `target` (one or more CSS selectors, scoped to the
  // real DOM) to spotlight: everything else gets blurred/dimmed, so the
  // clear cutout *is* the feature being described. `target: null` (or
  // omitted) means "show the whole screen, nothing blurred" — used when a
  // step is about the screen broadly rather than one control on it.
  const TUTORIAL_CHAPTERS = [
    { id:'home', title:'Your Daily Workout', icon:'◧', scene:'home', steps:[
      { title:'Home is your starting point', target:'.hero', body:"Today's workout is already built for you — matched to your schedule, your equipment, and how far you've progressed. Just tap Start." },
      { title:'Streak & stats', target:'#screen-home .stat-strip', body:'The numbers up top track your streak and total sessions, so you can see your consistency build over time.' },
    ]},
    { id:'player', title:'During a Workout', scene:'player-timer', icon:'▲', steps:[
      { title:'Timer or reps', target:'#playerTimerBlock', body:'Each move shows a video and step-by-step instructions. It\'s either a countdown timer (for holds and timed moves) or a spot to log your reps — and weight, if it needs one.' },
      { title:'Sets vs. Rounds', scene:'player-sets', target:'#playerSetIndicator', body:'"Set 2 of 4" means the same move again, with rest in between. "Round 2 of 5" means a circuit — you\'ll do a few different moves, then come back to this one again in the next round.' },
      { title:'Made a mistake?', scene:'player-sets', target:'#playerBackBtn', body:'Tap the back arrow (top-left) to go back a step — all the way through the workout if you need to, set by set, exercise by exercise.' },
      { title:'Want to move on?', scene:'player-skip', target:'#playerSkipExerciseBtn', body:'"Skip this exercise" jumps past every remaining set of the current move, straight to the next one.' },
    ]},
    { id:'rest', title:'Rest Screens', icon:'○', scene:'player-rest', steps:[
      { title:'Between sets & rounds', target:['#playerMedia', '.timer-ring-wrap'], body:"A short rest automatically counts down between sets of the same move, and before each new circuit round — with a preview of what's coming up next so you always know what to expect." },
    ]},
    { id:'like-media', title:'Liking Moves & Media', icon:'➜', scene:'player-like', steps:[
      { title:'The heart button', target:'.player-icon-btns', body:'Tap the heart on a move you like and it\'ll show up in your plan more often.' },
      { title:'Always muted', target:'#playerMedia', body:'Every video is muted — no music ever plays — and loops quietly so it never just freezes mid-demo.' },
    ]},
    { id:'weighin', title:'Weigh-Ins', icon:'●', scene:'home-weighin', steps:[
      { title:'Once a week, not every workout', target:'#homeWeighInBanner', body:'You\'ll be asked to log your weight once a week (Wednesday by default — change the day and time any time in Settings), not after every single workout, so your trend stays accurate.' },
      { title:'kg or lbs — your call', target:'#homeWeighInUnitsToggle', body:'Wherever you enter a weight — your weigh-in, a weighted set, your starting weight — there\'s a small kg/lbs switch right next to the field. It remembers your choice.' },
    ]},
    { id:'progress', title:'Progress Tab', icon:'✦', scene:'progress', steps:[
      { title:'Trend & consistency', target:['#progressTrendCard', '#progressConsistencyCard', '#progressMilestones'], body:'See your weight trend, how consistent you\'ve been over the last few weeks, and badges you unlock along the way.' },
      { title:'Units here are separate', scene:'settings', target:'#setUnitsToggle', body:'The kg/lbs choice for this tab\'s trend and projection text is set in Settings, on its own — separate from the switches next to each input field.' },
    ]},
    { id:'settings', title:'Settings', icon:'◂', scene:'settings', steps:[
      { title:'Make it yours', target:null, body:'Set your weekly schedule, the equipment you have on hand, prayer-time-based reminders, cycle-aware pacing, your weigh-in day/time, and more — all here.' },
    ]},
    { id:'quran', title:"Qur'an Player", icon:'◪', scene:'quran', steps:[
      { title:'Listen any time', target:'#screen-quran .card', body:"Pick a reciter, a surah, and how you'd like it repeated, right from the Qur'an tab." },
    ]},
  ];

  // Puts the real, live app into the state each chapter needs — same screens
  // and (for the player) a harmless, non-persisted demo session — so the
  // tutorial is always showing the actual current UI, never a stale picture
  // of it. Safe to call repeatedly; none of these write anything to Store
  // except home-weighin's forced preview, which never touches real storage.
  let tutorialRealSession = null; // stashes a genuine in-progress workout, if any, while a player-* scene borrows `session`
  function ensureTutorialDemoSession() {
    if (session && !session.isTutorialDemo) { tutorialRealSession = session; }
    if (!session || !session.isTutorialDemo) {
      const workout = {
        type: 'strength', estMinutes: 20, warmup: [], cooldown: [],
        blocks: [
          { exerciseId:'plank', name:'Forearm Plank', pattern:'core', sets:3, timeBased:true, duration:30, workSec:30, restSec:20, images:[], video:'pvIjsG5Svck', reps:null },
          { exerciseId:'bodyweight_squat', name:'Bodyweight Squat', pattern:'squat', sets:3, reps:'10-12', timeBased:false, restSec:20, workSec:40, images:[], video:'l83R5PblSMA' },
        ],
      };
      session = { workout, steps: buildSteps(workout), idx: 0, feedback: null, startedAt: Date.now(), isTutorialDemo: true };
    }
  }
  function tutorialDemoStep(idx) {
    ensureTutorialDemoSession();
    showScreen('screen-player');
    session.idx = idx;
    renderStep();
    clearInterval(timerId); timerId = null; // static preview — never actually ticking during the tutorial
  }
  function restoreRealSessionIfAny() {
    if (tutorialRealSession) { session = tutorialRealSession; tutorialRealSession = null; }
    else if (session && session.isTutorialDemo) { session = null; }
  }
  const TUTORIAL_SCENES = {
    home: () => { restoreRealSessionIfAny(); goto('home'); }, // renderHome() already redraws the real weigh-in banner
    'home-weighin': () => {
      restoreRealSessionIfAny();
      goto('home');
      // Force-preview the "due" banner for the demo, without touching real
      // storage — this is a separate state object, never passed to Store.set.
      const fake = structuredClone(Store.get());
      fake.lastWeighInWeekKey = 'tutorial-preview';
      renderWeighInBanner(fake, 'home');
    },
    progress: () => { restoreRealSessionIfAny(); goto('progress'); },
    settings: () => { restoreRealSessionIfAny(); goto('settings'); },
    quran: () => { restoreRealSessionIfAny(); goto('quran'); },
    'player-timer': () => tutorialDemoStep(0),
    'player-sets': () => tutorialDemoStep(2),
    'player-skip': () => tutorialDemoStep(0),
    'player-rest': () => tutorialDemoStep(1),
    'player-like': () => {
      tutorialDemoStep(0);
      $('playerLikeBtn').classList.add('on');
    },
  };

  // --- Weight units: everything is stored/computed in kg. There are two
  // independent unit preferences:
  //   settings.units      — how the Progress tab displays trend/projection text.
  //                          Changed only from Settings.
  //   settings.entryUnits — how any weight *input* field (onboarding starting
  //                          weight, the weekly weigh-in, a weighted set) shows
  //                          and accepts values. Changed via the small kg/lbs
  //                          chip pair next to each such field, and remembered
  //                          for next time.
  // Both ever only affect display/input — storage is always kg. ---
  const KG_PER_LB = 0.45359237;
  function units() { return (Store.get().settings.units === 'lbs') ? 'lbs' : 'kg'; }
  function unitLabel() { return units(); }
  function kgToDisplay(kg) {
    if (kg == null || isNaN(kg)) return kg;
    return units() === 'lbs' ? kg / KG_PER_LB : kg;
  }
  function displayToKg(val) {
    if (val == null || isNaN(val)) return val;
    return units() === 'lbs' ? val * KG_PER_LB : val;
  }
  // Rounds for display: whole-ish numbers for lbs (coarser unit), one decimal for kg.
  function fmtWeight(kg, decimals) {
    if (kg == null || isNaN(kg)) return '';
    const v = kgToDisplay(kg);
    const d = (decimals != null) ? decimals : (units() === 'lbs' ? 0 : 1);
    return (Math.round(v * Math.pow(10, d)) / Math.pow(10, d)).toString();
  }

  function entryUnits() { return (Store.get().settings.entryUnits === 'lbs') ? 'lbs' : 'kg'; }
  function entryUnitLabel() { return entryUnits(); }
  function entryKgToDisplay(kg) {
    if (kg == null || isNaN(kg)) return kg;
    return entryUnits() === 'lbs' ? kg / KG_PER_LB : kg;
  }
  function entryDisplayToKg(val) {
    if (val == null || isNaN(val)) return val;
    return entryUnits() === 'lbs' ? val * KG_PER_LB : val;
  }
  function fmtEntryWeight(kg, decimals) {
    if (kg == null || isNaN(kg)) return '';
    const v = entryKgToDisplay(kg);
    const d = (decimals != null) ? decimals : (entryUnits() === 'lbs' ? 0 : 1);
    return (Math.round(v * Math.pow(10, d)) / Math.pow(10, d)).toString();
  }

  // Switches the persisted entry-unit preference and live-refreshes whichever
  // weight-entry field(s) are currently on screen (onboarding, weigh-in banner,
  // feedback, or the in-workout set-weight field) so the switch takes effect
  // instantly without losing anything she's already typed in other fields.
  function setEntryUnits(u) {
    const normalized = (u === 'lbs') ? 'lbs' : 'kg';
    Store.set(s => { s.settings.entryUnits = normalized; return s; });
    document.querySelectorAll('.chip-wrap[id$="UnitsToggle"]').forEach(wrap => {
      Array.from(wrap.children).forEach(c => c.classList.toggle('on', c.dataset.id === normalized));
    });
    const obLabel = $('obStartWeightLabel');
    if (obLabel) obLabel.firstChild.textContent = `Starting weight (${normalized})`;
    const fbLabel = $('feedbackWeighInLabel');
    if (fbLabel) fbLabel.firstChild.textContent = `Weigh in today? (${normalized})`;
    const entryLbl = $('entryWeightLabel');
    if (entryLbl && session) entryLbl.textContent = `Weight (${normalized})`;
    if (session) {
      const step = session.steps[session.idx];
      if (step && step.phase === 'work' && step.trackWeight) {
        $('entryWeightInput').value = (step.suggestedWeightKg != null) ? fmtEntryWeight(step.suggestedWeightKg) : $('entryWeightInput').value;
      }
    }
    ['home','p'].forEach(prefix => {
      const input = $(prefix + 'WeighInInput');
      if (input) input.placeholder = normalized;
    });
  }

  // Drives the circular progress ring around the countdown: `fraction` is how much
  // of the ring should still be lit (1 = full circle, 0 = empty).
  function updateRing(fraction) {
    const el = $('playerRingFill');
    if (!el) return;
    const f = Math.max(0, Math.min(1, fraction));
    el.style.strokeDasharray = String(RING_CIRC);
    el.style.strokeDashoffset = String(RING_CIRC * (1 - f));
  }

  let session = null;   // active player session
  let timerId = null;
  let obDaysSel = [1,2,3,4,5];
  let setDaysSel = [];
  let setWeighInDaySel = 6;
  let quranQueue = [];
  let quranIdx = 0;

  const ICON_FLAME = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2c1 3-2 4.5-2 7.5a4 4 0 008 0c0-1-.3-2-1-3 1.5.5 3 2.5 3 5.5a6 6 0 11-12 0c0-3 1.5-5 2-6.5C10.5 4.5 11 3 12 2z"/></svg>';
  const ICON_STAR = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l2.6 5.6 6.1.7-4.5 4.2 1.2 6-5.4-3-5.4 3 1.2-6-4.5-4.2 6.1-.7z"/></svg>';
  const MILESTONES = [
    { id:'first', icon:'1', label:'First session', check: s => s.progress.totalSessions >= 1 },
    { id:'five', icon:'5', label:'5 sessions', check: s => s.progress.totalSessions >= 5 },
    { id:'ten', icon:'10', label:'10 sessions', check: s => s.progress.totalSessions >= 10 },
    { id:'streak7', icon:ICON_FLAME, label:'7-day streak', check: s => s.progress.longestStreak >= 7 },
    { id:'allrounder', icon:ICON_STAR, label:'Tried every pattern', check: s => {
      const patterns = new Set(s.history.flatMap(h => h.exerciseIds.map(id => (EXERCISES.find(e=>e.id===id)||{}).pattern)));
      return ['squat','hinge','lunge','pushH','pushV','pull','core','cardio'].every(p => patterns.has(p));
    } },
    { id:'twentyfive', icon:'25', label:'25 sessions', check: s => s.progress.totalSessions >= 25 },
  ];

  function $(id) { return document.getElementById(id); }
  function fmtTime(sec) {
    sec = Math.max(0, Math.round(sec));
    const m = Math.floor(sec / 60), s = sec % 60;
    return String(m).padStart(2,'0') + ':' + String(s).padStart(2,'0');
  }
  function escapeHtml(s) {
    return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }
  function lookupMovement(id) {
    if (!id) return null;
    return Generator.byId(id) || WARMUPS.find(w => w.id === id) || COOLDOWNS.find(c => c.id === id) || null;
  }

  // ---------------- SOUND / VIBRATION ON TIMER FINISH ----------------
  function playFinishSound() {
    const settings = Store.get().settings;
    if (settings.vibrateOnFinish && navigator.vibrate) {
      try { navigator.vibrate([120, 60, 120]); } catch (e) {}
    }
    if (!settings.soundOnFinish) return;
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const chime = (freq, delay, dur) => {
        setTimeout(() => {
          const o = ctx.createOscillator(), g = ctx.createGain();
          o.type = 'sine'; o.frequency.value = freq;
          o.connect(g); g.connect(ctx.destination);
          g.gain.setValueAtTime(0.0001, ctx.currentTime);
          g.gain.exponentialRampToValueAtTime(0.3, ctx.currentTime + 0.02);
          g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + dur);
          o.start(); o.stop(ctx.currentTime + dur + 0.05);
        }, delay);
      };
      chime(880, 0, 0.45);
      chime(1175, 170, 0.4);
    } catch (e) { console.warn('finish sound failed', e); }
  }

  // ---------------- INIT ----------------
  function init() {
    const state = Store.get();
    $('topDate').textContent = new Date().toLocaleDateString(undefined, { weekday:'long', month:'short', day:'numeric' });

    if (!state.onboarded) {
      $('onboard').style.display = 'flex';
      renderDayGrid('obDays', obDaysSel, (d) => { obDaysSel = d; });
      showOnboardStep(1);
    } else {
      $('mainApp').style.display = 'block';
      $('tabbar').style.display = 'block';
      ensurePendingWorkout();
      renderHome();
      Notify.refreshSchedule(Store.get());
    }

    $('qAudio').addEventListener('ended', quranNext);

    // So a tapped notification (or its action button) actually does something,
    // instead of just appearing and vanishing (item #9).
    Notify.onAction((event) => {
      const extra = event && event.notification && event.notification.extra;
      if (!extra) return;
      const actionId = event.actionId;
      if (extra.kind === 'checkin') {
        if (actionId === 'later') {
          const at = new Date(Date.now() + 30 * 60000);
          const hhmm = String(at.getHours()).padStart(2,'0') + ':' + String(at.getMinutes()).padStart(2,'0');
          Notify.scheduleTodayReminder(hhmm);
        } else {
          goto('home');
        }
      } else if (extra.kind === 'weighin') {
        if (actionId !== 'later') goto('progress');
      }
    });

    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        ensurePendingWorkout();
        if ($('screen-home').classList.contains('active')) renderHome();
        Notify.refreshSchedule(Store.get());
      }
    });
  }

  // ---------------- ONBOARDING ----------------
  function showOnboardStep(n) {
    document.querySelectorAll('.onboard-step').forEach(el => el.classList.toggle('active', +el.dataset.step === n));
    const dots = $('onboardDots'); dots.innerHTML = '';
    for (let i=1;i<=4;i++) { const d=document.createElement('div'); if (i<=n) d.classList.add('on'); dots.appendChild(d); }
    if (n === 4) {
      const wrap = $('obUnitsToggle');
      if (wrap) Array.from(wrap.children).forEach(c => c.classList.toggle('on', c.dataset.id === entryUnits()));
      const lbl = $('obStartWeightLabel');
      if (lbl) lbl.firstChild.textContent = `Starting weight (${entryUnitLabel()})`;
    }
  }

  function onboardNext(from) {
    if (from === 1) {
      const name = $('obName').value.trim();
      Store.set(s => { s.profile.name = name; return s; });
    }
    if (from === 2) {
      Store.set(s => {
        s.settings.preferredDays = obDaysSel.slice();
        s.settings.weeklyTarget = +$('obTarget').value;
        return s;
      });
    }
    showOnboardStep(from + 1);
  }

  function finishOnboarding() {
    const startWeightRaw = parseFloat($('obStartWeight').value);
    const startWeightKg = entryDisplayToKg(startWeightRaw);
    Store.set(s => {
      s.settings.alarmEnabled = $('obAlarmToggle').classList.contains('on');
      s.settings.alarmTime = $('obAlarmTime').value || '17:30';
      s.onboarded = true;
      s.onboardedAt = new Date().toISOString();
      if (!isNaN(startWeightKg) && startWeightKg > 0) {
        s.startingWeightKg = startWeightKg;
        Progress.logWeight(s, startWeightKg);
      }
      return s;
    });
    $('onboard').style.display = 'none';
    $('mainApp').style.display = 'block';
    $('tabbar').style.display = 'block';
    ensurePendingWorkout();
    renderHome();
    Notify.ensurePermission().then(() => Notify.refreshSchedule(Store.get()));
    startTutorialAll();
  }

  function toggleSwitch(el) { el.classList.toggle('on'); }

  function setUnits(u) {
    Array.from($('setUnitsToggle').children).forEach(c => c.classList.toggle('on', c.dataset.id === u));
  }

  function renderDayGrid(containerId, selected, onChange) {
    const el = $(containerId); el.innerHTML = '';
    DOW_ORDER.forEach(d => {
      const btn = document.createElement('div');
      btn.className = 'day-chip' + (selected.includes(d) ? ' on' : '');
      btn.textContent = DOW_LABEL[d];
      btn.onclick = () => {
        const i = selected.indexOf(d);
        if (i >= 0) selected.splice(i,1); else selected.push(d);
        btn.classList.toggle('on');
        if (onChange) onChange(selected);
      };
      el.appendChild(btn);
    });
  }

  // Single-select variant (weekly weigh-in day picker).
  function renderSingleDayGrid(containerId, getSelected, onChange) {
    const el = $(containerId); el.innerHTML = '';
    DOW_ORDER.forEach(d => {
      const btn = document.createElement('div');
      btn.className = 'day-chip' + (getSelected() === d ? ' on' : '');
      btn.textContent = DOW_LABEL[d];
      btn.onclick = () => { onChange(d); renderSingleDayGrid(containerId, getSelected, onChange); };
      el.appendChild(btn);
    });
  }

  // ---------------- NAV ----------------
  function goto(tab) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t.dataset.tab === tab));
    $('screen-' + tab).classList.add('active');
    if (tab === 'home') renderHome();
    if (tab === 'progress') renderProgress();
    if (tab === 'settings') renderSettings();
    if (tab === 'quran') renderQuranScreen();
    if (tab === 'tutorial') renderTutorialScreen();
  }

  function showScreen(id) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    $(id).classList.add('active');
    window.scrollTo(0, 0);
  }

  // ---------------- HOME ----------------
  function ensurePendingWorkout() {
    const state = Store.get();
    if (!state.pendingWorkout) {
      const w = Generator.generate(state);
      Store.set(s => { s.pendingWorkout = w; return s; });
    }
  }

  function reroll() {
    Store.set(s => { s.pendingWorkout = Generator.generate(s); return s; });
    renderHome();
  }

  function renderHome() {
    const state = Store.get();
    const msg = Progress.morningMessage(state, state.profile.name);
    $('homeHeadline').textContent = msg.title;
    $('homeSub').textContent = msg.body;

    $('statStreak').textContent = state.progress.streak;
    $('statTotal').textContent = state.progress.totalSessions;
    $('statTier').textContent = state.progress.difficultyTier.toFixed(1);

    // week dots Mon..Sun
    const dots = $('weekDots'); dots.innerHTML = '';
    const start = Progress.startOfWeek();
    const todayStr = new Date().toDateString();
    const doneDates = new Set(state.history.map(h => new Date(h.date).toDateString()));
    DOW_ORDER.forEach((dow, i) => {
      const d = new Date(start); d.setDate(start.getDate() + i);
      const isToday = d.toDateString() === todayStr;
      const isDone = doneDates.has(d.toDateString());
      const isPreferred = state.settings.preferredDays.includes(dow);
      const el = document.createElement('div');
      el.className = 'dot' + (isDone ? ' done' : '') + (isToday ? ' today' : '') + (!isPreferred && !isDone ? ' rest' : '');
      el.textContent = isDone ? '✓' : DOW_LABEL[dow];
      dots.appendChild(el);
    });

    renderPlanPreview(state.pendingWorkout);
    renderTimePickCard(state);
    renderWeighInBanner(state, 'home');
  }

  function renderTimePickCard(state) {
    const el = $('timePickCard');
    const todayKey = Prayer.ymd(new Date());
    const alreadyDoneToday = state.history.some(h => new Date(h.date).toDateString() === new Date().toDateString());
    if (alreadyDoneToday) { el.innerHTML = ''; el.style.display = 'none'; return; }
    el.style.display = 'block';

    const picked = state.plannedTime && state.plannedTime.date === todayKey ? state.plannedTime.time : null;
    if (picked) {
      const [h,m] = picked.split(':').map(Number);
      const label = new Date(2000,0,1,h,m).toLocaleTimeString(undefined,{hour:'numeric',minute:'2-digit'});
      el.innerHTML = `
        <div style="display:flex;align-items:center;justify-content:space-between">
          <div><div class="t-label" style="font-weight:600">Reminder set for ${label}</div><div class="t-sub">We'll nudge you then.</div></div>
          <button class="link" onclick="App.clearTodayTime()">Change</button>
        </div>`;
    } else {
      el.innerHTML = `
        <div class="t-label" style="font-weight:600;margin-bottom:8px">What time works today?</div>
        <div style="display:flex;gap:8px">
          <input type="time" id="todayTimeInput" style="flex:1">
          <button class="btn btn-primary btn-sm" onclick="App.setTodayTime()">Remind me</button>
        </div>`;
    }
  }

  function setTodayTime() {
    const val = $('todayTimeInput').value;
    if (!val) return;
    const todayKey = Prayer.ymd(new Date());
    Store.set(s => { s.plannedTime = { date: todayKey, time: val }; return s; });
    Notify.scheduleTodayReminder(val);
    renderHome();
  }

  function clearTodayTime() {
    Store.set(s => { s.plannedTime = null; return s; });
    Notify.cancelTodayReminder();
    renderHome();
  }

  // Shared by Home and Progress — shows due/overdue/upcoming weigh-in status with a
  // quick-log field right there, and keeps nagging (quietly, in-app) until it's done.
  function renderWeighInBanner(state, prefix) {
    const el = $(prefix + 'WeighInBanner');
    if (!el) return;
    const status = Progress.weighInStatus(state);
    if (status.done) { el.style.display = 'none'; return; }
    el.style.display = 'flex';
    let label;
    if (status.status === 'upcoming') {
      label = `Weigh-in in ${status.daysUntil} day${status.daysUntil === 1 ? '' : 's'}`;
    } else if (status.overdueDays > 0) {
      label = `Weigh-in overdue by ${status.overdueDays} day${status.overdueDays === 1 ? '' : 's'}`;
    } else {
      label = "Weigh-in day";
    }
    el.style.flexDirection = 'column';
    el.style.alignItems = 'stretch';
    el.innerHTML = `
      <div><div class="t-label" style="font-weight:600">${label}</div><div class="t-sub">Same day and time keeps your trend accurate.</div></div>
      <div style="display:flex;gap:8px;align-items:center;margin-top:10px">
        <input type="number" step="0.1" id="${prefix}WeighInInput" placeholder="${entryUnitLabel()}" style="flex:1;min-width:0">
        <div class="chip-wrap" id="${prefix}WeighInUnitsToggle" style="flex-wrap:nowrap">
          <div class="chip" data-id="kg" onclick="App.setEntryUnits('kg')">kg</div>
          <div class="chip" data-id="lbs" onclick="App.setEntryUnits('lbs')">lbs</div>
        </div>
        <button class="btn btn-primary btn-sm" onclick="App.logWeighIn('${prefix}')">Log</button>
      </div>`;
    Array.from($(prefix + 'WeighInUnitsToggle').children).forEach(c => c.classList.toggle('on', c.dataset.id === entryUnits()));
  }

  function logWeighIn(prefix) {
    const v = parseFloat($(prefix + 'WeighInInput').value);
    if (isNaN(v) || v <= 0) return;
    Store.set(s => Progress.logWeight(s, entryDisplayToKg(v)));
    Notify.refreshSchedule(Store.get());
    renderHome();
    if ($('screen-progress').classList.contains('active')) renderProgress();
  }

  function renderPlanPreview(workout) {
    const el = $('planPreview'); el.innerHTML = '';
    if (!workout) return;
    const isCircuit = workout.type === 'circuit';
    const items = [
      ...workout.warmup.map(w => ({ id: w.id, name: w.name, meta: 'Warm-up · ' + w.duration + 's', icon: '○', images: w.images, video: w.video })),
      ...workout.blocks.map(b => ({
        id: b.exerciseId, name: b.name,
        meta: b.sets + (isCircuit ? ' rounds · ' : ' sets · ') + (b.timeBased ? b.duration + 's' : b.reps),
        icon: PATTERN_ICON[b.pattern] || '●',
        images: b.images,
        video: b.video,
      })),
      ...workout.cooldown.map(c => ({ id: c.id, name: c.name, meta: 'Cool-down · ' + c.duration + 's', icon: '○', images: c.images, video: c.video })),
    ];
    items.forEach(it => {
      const row = document.createElement('div');
      row.className = 'plan-item';
      row.style.cursor = 'pointer';
      const thumbSrc = it.video ? `https://i.ytimg.com/vi/${it.video}/hqdefault.jpg` : (it.images && it.images.length ? it.images[0] : null);
      const tag = thumbSrc
        ? `<div class="tag img"><img src="${thumbSrc}" alt="" loading="lazy"></div>`
        : `<div class="tag">${it.icon}</div>`;
      row.innerHTML = `${tag}<div><div class="name">${escapeHtml(it.name)}</div><div class="meta">${it.meta}</div></div>`;
      row.onclick = () => openExerciseDetail(it.id);
      el.appendChild(row);
    });
  }

  function markManualComplete() {
    if (!confirm("Log today as a completed session? Great for a hike, a class, or anything off-plan.")) return;
    const state = Store.get();
    const manualWorkout = { id: 'manual_' + Date.now(), type: 'manual', blocks: [], estMinutes: state.settings.sessionMinutes };
    Store.set(s => { Progress.recordCompletion(s, manualWorkout, 'good'); s.pendingWorkout = Generator.generate(s); return s; });
    Notify.refreshSchedule(Store.get());
    renderHome();
  }

  // ---------------- EXERCISE DETAIL MODAL ----------------
  function renderDetailMedia(ex) {
    const wrap = $('detailMedia');
    if (ex.video) {
      wrap.classList.remove('placeholder');
      wrap.innerHTML = `<iframe src="https://www.youtube.com/embed/${ex.video}?rel=0&modestbranding=1&mute=1&loop=1&playlist=${ex.video}" title="${escapeHtml(ex.name)}" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen loading="lazy"></iframe>`;
    } else if (ex.images && ex.images.length) {
      wrap.classList.remove('placeholder');
      wrap.innerHTML = `<img src="${ex.images[0]}" alt="${escapeHtml(ex.name)}">`;
    } else {
      const icon = PATTERN_ICON[ex.pattern] || '●';
      wrap.classList.add('placeholder');
      wrap.innerHTML = `<div class="media-placeholder-icon">${icon}</div>`;
    }
  }

  function openExerciseDetail(id) {
    const ex = lookupMovement(id);
    if (!ex) return;
    $('detailTitle').textContent = ex.name;
    renderDetailMedia(ex);
    $('detailCue').textContent = ex.cue || '';
    const list = $('detailSteps'); list.innerHTML = '';
    (ex.steps || []).forEach(s => { const li = document.createElement('li'); li.textContent = s; list.appendChild(li); });

    const isRealExercise = EXERCISES.some(e => e.id === ex.id);
    $('detailPrefRow').style.display = isRealExercise ? 'flex' : 'none';
    $('detailAltRow').style.display = 'none';
    $('detailLadderRow').style.display = 'none';

    if (isRealExercise) {
      const state = Store.get();
      const pref = state.exercisePrefs[ex.id] || {};
      const likeBtn = $('detailLikeBtn');
      likeBtn.classList.toggle('on', !!pref.liked);
      likeBtn.onclick = () => { Store.set(s => Progress.toggleLiked(s, ex.id)); openExerciseDetail(id); };

      if (ex.ladder) {
        // Ladder members get the richer multi-step "Easier alternatives" picker
        // instead of the old single on/off toggle below.
        $('detailLadderRow').style.display = 'flex';
        $('detailLadderBtn').onclick = () => openLadderModal(ex.ladder);
      } else if (ex.altId) {
        const alt = Generator.byId(ex.altId);
        $('detailAltRow').style.display = 'flex';
        $('detailAltLabel').textContent = alt ? `Use easier version (${alt.name}) next time` : 'Use easier version next time';
        const altToggle = $('detailAltToggle');
        altToggle.classList.toggle('on', !!pref.useAlt);
        altToggle.onclick = () => {
          const cur = !!(Store.get().exercisePrefs[ex.id] || {}).useAlt;
          Store.set(s => Progress.setUseAlt(s, ex.id, !cur));
          openExerciseDetail(id);
        };
      }
    }
    $('exerciseDetail').style.display = 'flex';
  }

  // ---------- Build-up ladders ("Easier alternatives") ----------
  function ladderThumbHtml(ex) {
    if (ex.video) return `<img src="https://i.ytimg.com/vi/${ex.video}/default.jpg" alt="">`;
    const icon = PATTERN_ICON[ex.pattern] || '●';
    return `<div class="ladder-rung-icon">${icon}</div>`;
  }

  function openLadderModal(ladderId) {
    const rungIds = LADDERS[ladderId] || [];
    const rungs = rungIds.map(id => Generator.byId(id)).filter(Boolean);
    if (!rungs.length) return;
    const state = Store.get();
    const haveEquipment = (state.settings.equipment || []);
    // When she hasn't opted in yet, default-highlight the easiest rung she can
    // actually DO with her equipment, not necessarily the literal first rung.
    const defaultRung = rungs.find(r => (r.equipment || []).some(eq => haveEquipment.includes(eq))) || rungs[0];
    const activeId = Progress.currentLadderRungId(state, ladderId, defaultRung.id);
    $('ladderModalTitle').textContent = `${rungs[rungs.length - 1].name} — build-up steps`;
    const list = $('ladderRungList');
    list.innerHTML = '';
    rungs.forEach(r => {
      const isActive = r.id === activeId;
      const eligible = (r.equipment || []).some(eq => haveEquipment.includes(eq));
      const hint = r.timeBased ? `${r.duration}s hold` : (r.reps ? `${r.reps} reps` : '');
      const row = document.createElement('div');
      row.className = 'ladder-rung' + (isActive ? ' active' : '') + (eligible ? '' : ' disabled');
      row.innerHTML = `
        <div class="ladder-rung-thumb">${ladderThumbHtml(r)}</div>
        <div class="ladder-rung-info">
          <div class="ladder-rung-name">${escapeHtml(r.name)}</div>
          <div class="ladder-rung-hint">${escapeHtml(eligible ? hint : `needs ${r.equipment.join('/')} — not in your equipment`)}</div>
        </div>
        ${isActive ? '<span class="ladder-rung-badge">Current</span>' : ''}
      `;
      if (eligible) row.onclick = () => selectLadderRung(ladderId, r.id, rungs);
      else row.onclick = () => showToast(`You'll need ${r.equipment.join(' or ')} enabled in Settings to use this one.`);
      list.appendChild(row);
    });
    $('ladderModal').style.display = 'flex';
  }

  // Note: this only changes the rung used the NEXT time this move is generated into
  // a workout — it deliberately never touches the in-progress session (session.steps
  // was already built from whatever rung was active when the workout started), so
  // picking a new rung mid-set never disrupts a running timer or a half-typed rep
  // entry on the step she's currently doing.
  function selectLadderRung(ladderId, rungId, rungs) {
    Store.set(s => Progress.setLadderRung(s, ladderId, rungId));
    closeLadderModal();
    const picked = (rungs || []).find(r => r.id === rungId);
    showToast(picked ? `Starting with ${picked.name} next time this move comes up.` : 'Got it — applies next time this move comes up.');
  }

  function closeLadderModal() { $('ladderModal').style.display = 'none'; }

  function openLadderModalForCurrentStep() {
    if (!session) return;
    const step = session.steps[session.idx];
    if (!step || !step.exerciseId) return;
    const exDef = Generator.byId(step.exerciseId);
    if (!exDef || !exDef.ladder) return;
    openLadderModal(exDef.ladder);
  }

  function closeExerciseDetail() { $('exerciseDetail').style.display = 'none'; }

  let toastTimer = null;
  function showToast(msg) {
    const el = $('toast');
    if (!el) return;
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('show'), 2200);
  }

  function toggleCurrentLiked() {
    const step = session && session.steps[session.idx];
    if (!step || !step.exerciseId) return;
    Store.set(s => Progress.toggleLiked(s, step.exerciseId));
    const liked = !!(Store.get().exercisePrefs[step.exerciseId] || {}).liked;
    $('playerLikeBtn').classList.toggle('on', liked);
    showToast(liked ? 'Added to favorites — you\'ll see this move more often' : 'Removed from favorites');
  }

  // ---------------- PLAYER ----------------
  // Builds the full step-by-step sequence. 'work' steps that are timeBased (true
  // holds like planks/wall-sits) still get a running timer; every other 'work' step
  // (reps, or reps+weight) carries no timer at all — the player shows a reps/weight
  // entry form and a "Finished Set" button instead (item #15/#16).
  function buildSteps(workout) {
    const steps = [];

    function workStep(block, setIndex, totalSets) {
      return {
        phase:'work', name:block.name, cue:block.cue, pattern:block.pattern,
        images: block.images || [], video: block.video || null, steps: block.steps || [],
        timeBased: block.timeBased, duration: block.workSec,
        isCapabilityTest: !!block.isCapabilityTest,
        reps: block.reps, repTarget: block.repTarget,
        trackWeight: block.trackWeight, suggestedWeightKg: block.suggestedWeightKg,
        overloadNote: block.overloadNote,
        setIndex, totalSets, exerciseId: block.exerciseId,
      };
    }

    // No "Get ready" interstitial between moves — it was an extra screen with
    // nothing to actually do, so one exercise now leads straight into the next.
    // The real breathing room (between sets of the same move, and before the
    // next circuit round) still gets its own Rest step.
    workout.warmup.forEach((w) => {
      steps.push({ phase:'warmup', name:w.name, cue:w.cue, images:w.images||[], video:w.video||null, steps:w.steps||[], timeBased:true, duration:w.duration, exerciseId:w.id });
    });

    if (workout.type === 'circuit' && workout.blocks.length) {
      const rounds = workout.blocks[0].sets;
      for (let r = 1; r <= rounds; r++) {
        workout.blocks.forEach((block, i) => {
          steps.push(workStep(block, r, rounds));
          const lastInRound = i === workout.blocks.length - 1;
          if (lastInRound && r < rounds) {
            const upNext = workout.blocks[0];
            steps.push({ phase:'rest', name:'Rest before next round', nextName: upNext.name, cue:'Shake it out, sip some water — next round starts soon.', images: upNext.images||[], video: upNext.video||null, pattern: upNext.pattern, timeBased:true, duration: block.restSec });
          }
        });
      }
    } else {
      workout.blocks.forEach((block) => {
        for (let s=1; s<=block.sets; s++) {
          steps.push(workStep(block, s, block.sets));
          if (s < block.sets) steps.push({ phase:'rest', name:'Rest', nextName: block.name, cue:'Catch your breath, shake it out.', images: block.images||[], video: block.video||null, pattern: block.pattern, timeBased:true, duration: block.restSec });
        }
      });
    }

    workout.cooldown.forEach((c) => {
      steps.push({ phase:'cooldown', name:c.name, cue:c.cue, images:c.images||[], video:c.video||null, steps:c.steps||[], timeBased:true, duration:c.duration, exerciseId:c.id });
    });

    return steps;
  }

  function startWorkout() {
    const state = Store.get();
    const workout = state.pendingWorkout || Generator.generate(state);
    session = { workout, steps: buildSteps(workout), idx: 0, feedback: null, startedAt: Date.now() };
    showScreen('screen-player');
    renderStep();
  }

  function renderStep() {
    clearInterval(timerId); timerId = null;
    const step = session.steps[session.idx];
    if (!step) return finishWorkout();

    $('playerProgress').style.width = Math.round((session.idx / session.steps.length) * 100) + '%';
    $('playerPhase').textContent = PHASE_LABEL[step.phase] || step.phase.toUpperCase();
    $('playerName').textContent = step.name;
    $('playerBackBtn').style.visibility = session.idx > 0 ? 'visible' : 'hidden';

    const setIndicator = $('playerSetIndicator');
    if (step.phase === 'work' && step.totalSets > 1) {
      const isCircuit = session.workout.type === 'circuit';
      const noun = isCircuit ? 'Round' : 'Set';
      // Rounds are easy to misread as "nothing happened" the first time, since the
      // player visibly moves to a *different* exercise between rounds of the same
      // one — spell it out just once, on the first round.
      const hint = (isCircuit && step.setIndex === 1) ? ` — you'll repeat this each round` : '';
      setIndicator.textContent = `${noun} ${step.setIndex} of ${step.totalSets}${hint}`;
      setIndicator.style.display = '';
    } else {
      setIndicator.style.display = 'none';
    }

    const likeBtn = $('playerLikeBtn');
    if (step.phase === 'work' && step.exerciseId && EXERCISES.some(e => e.id === step.exerciseId)) {
      likeBtn.style.display = 'inline-flex';
      const liked = !!(Store.get().exercisePrefs[step.exerciseId] || {}).liked;
      likeBtn.classList.toggle('on', liked);
    } else {
      likeBtn.style.display = 'none';
    }

    const ladderBtn = $('playerLadderBtn');
    const stepExDef = step.phase === 'work' && step.exerciseId ? Generator.byId(step.exerciseId) : null;
    ladderBtn.style.display = (stepExDef && stepExDef.ladder) ? '' : 'none';

    renderExerciseMedia(step);
    renderExerciseInstructions(step);

    const isEntryMode = step.phase === 'work' && !step.timeBased;
    $('playerTimerBlock').style.display = isEntryMode ? 'none' : 'flex';
    $('playerEntryBlock').style.display = isEntryMode ? 'flex' : 'none';

    // Set pips (which set of the exercise this is) show in both modes.
    const pipsTargets = [$('playerPips'), $('playerPipsEntry')];
    pipsTargets.forEach(pips => {
      if (!pips) return;
      pips.innerHTML = '';
      if (step.phase === 'work') {
        for (let i=1;i<=step.totalSets;i++) {
          const s = document.createElement('span');
          if (i < step.setIndex) s.classList.add('done');
          pips.appendChild(s);
        }
      }
    });

    if (isEntryMode) {
      renderEntryForm(step);
    } else {
      const skipExBtn = $('playerSkipExerciseBtn');
      if (skipExBtn) skipExBtn.style.display = (step.phase === 'work' && step.exerciseId) ? '' : 'none';
      session.remaining = step.isCapabilityTest ? 0 : step.duration;
      session.countUp = !!step.isCapabilityTest;
      session.total = session.countUp ? CAP_TEST_MAX_SEC : step.duration;
      $('playerTimer').textContent = fmtTime(session.remaining);
      $('playerSub').textContent = subLabel(step);
      updateRing(session.countUp ? session.remaining / session.total : 1);
      if (step.phase === 'rest' || step.phase === 'transition') {
        // Nothing to "get ready" for here — rest and changeovers just flow automatically.
        $('playerSkipBtn').style.display = '';
        startTimer();
      } else {
        $('playerActionBtn').textContent = 'Start';
        $('playerSkipBtn').style.display = '';
        session.running = false;
      }
    }
  }

  function subLabel(step) {
    if (step.phase === 'rest') return 'resting — catch your breath';
    if (step.phase === 'transition') return step.nextName ? `next up: ${step.nextName}` : 'get into position';
    if (step.phase === 'work' && step.isCapabilityTest) return 'first time on this one — hold as long as you comfortably can';
    if (step.phase === 'work') return `set ${step.setIndex} of ${step.totalSets}`;
    return 'tap start when ready';
  }

  function renderEntryForm(step) {
    $('entryExerciseNote').textContent = step.overloadNote
      || (step.reps ? `Aim for ${step.reps} reps.` : 'Enter how many reps you completed.');
    $('entryWeightRow').style.display = step.trackWeight ? 'flex' : 'none';
    const lbl = $('entryWeightLabel');
    if (lbl) lbl.textContent = `Weight (${entryUnitLabel()})`;
    const toggle = $('entryUnitsToggle');
    if (toggle) Array.from(toggle.children).forEach(c => c.classList.toggle('on', c.dataset.id === entryUnits()));
    $('entryWeightInput').value = (step.suggestedWeightKg != null) ? fmtEntryWeight(step.suggestedWeightKg) : '';
    $('entryRepsInput').value = '';
    $('entryRepsInput').placeholder = step.repTarget ? `${step.repTarget} reps` : (step.reps || 'reps');
    $('entryWarning').style.display = 'none';
  }

  function finishSet() {
    const step = session.steps[session.idx];
    const repsRaw = $('entryRepsInput').value;
    const weightRaw = $('entryWeightInput').value;
    const repsVal = parseInt(repsRaw, 10);
    const warn = $('entryWarning');
    // Don't let her accidentally advance with nothing logged — flag it and stay put.
    if (repsRaw.trim() === '' || isNaN(repsVal) || repsVal < 0) {
      warn.textContent = "Enter how many reps you completed before finishing the set.";
      warn.style.display = 'block';
      return;
    }
    if (step.trackWeight && (weightRaw.trim() === '' || isNaN(parseFloat(weightRaw)))) {
      warn.textContent = `Enter the weight you used (in ${entryUnitLabel()}) before finishing the set.`;
      warn.style.display = 'block';
      return;
    }
    warn.style.display = 'none';
    const kgVal = step.trackWeight ? entryDisplayToKg(parseFloat(weightRaw)) : null;
    Store.set(s => {
      s = Progress.recordSetPerformance(s, step.exerciseId, kgVal, repsVal);
      const exDef = Generator.byId(step.exerciseId);
      if (exDef && exDef.ladder) s = Progress.recordLadderAttempt(s, exDef, { reps: repsVal });
      return s;
    });
    advance();
  }

  // Jumps past every remaining set/rest of the exercise she's currently on, landing
  // on the next genuinely different exercise (or section) — a full "skip" rather
  // than just the Skip button's single-step nudge.
  function skipExercise() {
    if (!session) return;
    clearInterval(timerId); timerId = null;
    const step = session.steps[session.idx];
    const exId = step.exerciseId;
    let i = session.idx + 1;
    while (i < session.steps.length) {
      const s = session.steps[i];
      if (s.phase === 'transition') break;
      if (s.phase === 'work' && s.exerciseId !== exId) break;
      i++;
    }
    session.idx = i;
    renderStep();
  }

  // Rest and transition steps have no video/entry form of their own — they're just
  // time passing. Rather than leave the media box blank (which read as a dead,
  // broken screen), show a dimmed preview of whatever's coming up next with a
  // gently pulsing accent so there's always something alive on screen to look at.
  function renderRestMedia(step) {
    const wrap = $('playerMedia');
    const thumb = step.video ? `https://i.ytimg.com/vi/${step.video}/hqdefault.jpg` : (step.images && step.images[0]);
    const eyebrow = step.phase === 'rest' ? 'Resting' : 'Get ready';
    const caption = step.nextName ? `Up next: ${escapeHtml(step.nextName)}` : '';
    const overlay = `<div class="media-rest-overlay"><div class="media-rest-pulse"></div><span class="media-rest-eyebrow">${eyebrow}</span>${caption ? `<span class="media-rest-next">${caption}</span>` : ''}</div>`;
    if (thumb) {
      wrap.classList.remove('placeholder');
      wrap.innerHTML = `<img src="${thumb}" alt="" class="media-rest-bg">${overlay}`;
    } else {
      wrap.classList.add('placeholder');
      wrap.innerHTML = overlay;
    }
    session.mediaImages = null;
  }

  function renderExerciseMedia(step) {
    const wrap = $('playerMedia');
    if (step.phase === 'rest' || step.phase === 'transition') { renderRestMedia(step); return; }
    if (step.video) {
      wrap.classList.remove('placeholder');
      wrap.innerHTML = `<iframe src="https://www.youtube.com/embed/${step.video}?rel=0&modestbranding=1&mute=1&loop=1&playlist=${step.video}" title="${escapeHtml(step.name)}" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen loading="lazy"></iframe>`;
      session.mediaImages = null;
      return;
    }
    const images = step.images || [];
    if (images.length) {
      wrap.classList.remove('placeholder');
      wrap.innerHTML = `<img id="playerMediaImg" src="${images[0]}" alt="${escapeHtml(step.name)}">` +
        (images.length > 1
          ? `<div class="media-toggle">
               <button class="on" onclick="App.setMediaFrame(0)">Start</button>
               <button onclick="App.setMediaFrame(1)">Finish</button>
             </div>`
          : '');
      session.mediaImages = images;
    } else {
      const icon = PATTERN_ICON[step.pattern] || PHASE_ICON[step.phase] || '●';
      wrap.classList.add('placeholder');
      wrap.innerHTML = `<div class="media-placeholder-icon">${icon}</div>`;
      session.mediaImages = null;
    }
  }

  function setMediaFrame(i) {
    if (!session || !session.mediaImages) return;
    const img = $('playerMediaImg');
    if (img) img.src = session.mediaImages[i];
    document.querySelectorAll('#playerMedia .media-toggle button').forEach((b, idx) => b.classList.toggle('on', idx === i));
  }

  function renderExerciseInstructions(step) {
    const el = $('playerCue');
    const howto = step.steps && step.steps.length ? step.steps : null;
    let html = step.cue ? `<p class="cue-line">${escapeHtml(step.cue)}</p>` : '';
    if (howto && (step.phase === 'work' || step.phase === 'warmup' || step.phase === 'cooldown')) {
      html += '<ol class="howto-list">' + howto.map(s => `<li>${escapeHtml(s)}</li>`).join('') + '</ol>';
    }
    el.innerHTML = html || '<p>Move at your own pace, focus on good form.</p>';
  }

  function startTimer() {
    session.running = true;
    $('playerActionBtn').textContent = session.countUp ? "I'm done" : 'Pause';
    $('playerSub').textContent = session.countUp
      ? 'go as long as you can, then tap "I\'m done"'
      : (session.steps[session.idx].phase === 'rest' ? 'resting — catch your breath'
         : session.steps[session.idx].phase === 'transition' ? subLabel(session.steps[session.idx])
         : 'in progress…');
    timerId = setInterval(() => {
      if (session.countUp) {
        session.remaining += 1;
        $('playerTimer').textContent = fmtTime(session.remaining);
        updateRing(session.remaining / session.total);
        if (session.remaining >= CAP_TEST_MAX_SEC) finishTimedStep(true);
      } else {
        session.remaining -= 1;
        $('playerTimer').textContent = fmtTime(session.remaining);
        updateRing(session.remaining / session.total);
        if (session.remaining <= 0) finishTimedStep(true);
      }
    }, 1000);
  }

  function pauseTimer() {
    clearInterval(timerId); timerId = null;
    session.running = false;
    $('playerActionBtn').textContent = 'Resume';
    $('playerSub').textContent = 'paused — tap resume';
  }

  function playerAction() {
    const step = session.steps[session.idx];
    if (step.isCapabilityTest && session.running) { finishTimedStep(true); return; }
    if (session.running) pauseTimer(); else startTimer();
  }

  // Ends the current timed step. `natural` = it ran its full course (countdown hit
  // zero, or she tapped "I'm done" on a capability test) vs. a plain early Skip.
  // Either way, a genuinely time-based work step's actual elapsed time is recorded
  // for progressive overload on holds (item #18); only a natural finish plays the
  // completion sound (item #13).
  function finishTimedStep(natural) {
    clearInterval(timerId); timerId = null;
    const step = session.steps[session.idx];
    if (step && step.phase === 'work' && step.timeBased) {
      const elapsed = step.isCapabilityTest ? session.remaining : (step.duration - Math.max(0, session.remaining));
      Store.set(s => {
        s = Progress.recordHoldPerformance(s, step.exerciseId, elapsed);
        const exDef = Generator.byId(step.exerciseId);
        if (exDef && exDef.ladder) s = Progress.recordLadderAttempt(s, exDef, { holdSec: elapsed });
        return s;
      });
    }
    if (natural) playFinishSound();
    advance();
  }

  function playerSkip() { finishTimedStep(false); }

  function advance() {
    clearInterval(timerId); timerId = null;
    session.idx += 1;
    renderStep();
  }

  // Lets her backtrack through the whole workout, one set/exercise at a time,
  // to redo or change something. A rest step is never a landing spot on its own —
  // it's just automatic waiting, not something she "did" — so when the step right
  // behind us is an inter-set rest for the *same* exercise, we hop straight past it
  // onto the previous set. That makes Set 3/4 -> Back land on Set 2/4, then 1/4,
  // and only then (once there's no earlier set of this exercise) onto the rest or
  // transition that came before it. Re-renders fresh, same as landing on any step
  // normally, rather than trying to restore exact elapsed time.
  function playerBack() {
    if (!session || session.idx <= 0) return;
    clearInterval(timerId); timerId = null;
    let i = session.idx - 1;
    while (
      i > 0 &&
      session.steps[i].phase === 'rest' &&
      session.steps[i - 1].phase === 'work' &&
      session.steps[i + 1] && session.steps[i + 1].phase === 'work' &&
      session.steps[i - 1].exerciseId === session.steps[i + 1].exerciseId
    ) {
      i--;
    }
    session.idx = i;
    renderStep();
  }

  function exitPlayer() {
    clearInterval(timerId); timerId = null;
    session = null;
    goto('home');
  }

  function finishWorkout() {
    const mins = Math.round((Date.now() - session.startedAt) / 60000);
    $('feedbackSummary').textContent = `${session.workout.blocks.length} exercises · about ${mins || session.workout.estMinutes} min`;
    document.querySelectorAll('#feedbackOptions button').forEach(b => b.classList.remove('selected'));
    $('feedbackWeight').value = '';
    $('feedbackWeight').placeholder = entryUnitLabel();
    const fbLabel = $('feedbackWeighInLabel');
    if (fbLabel) fbLabel.firstChild.textContent = `Weigh in today? (${entryUnitLabel()})`;
    const fbToggle = $('feedbackUnitsToggle');
    if (fbToggle) Array.from(fbToggle.children).forEach(c => c.classList.toggle('on', c.dataset.id === entryUnits()));
    // Weigh-in is a once-a-week thing, not an every-workout prompt — only surface
    // this card when she's actually due (same rule as the Home/Progress banner).
    const due = !Progress.weighInStatus(Store.get()).done;
    $('feedbackWeighInCard').style.display = due ? '' : 'none';
    showScreen('screen-feedback');
  }

  function pickFeedback(v) {
    session.feedback = v;
    document.querySelectorAll('#feedbackOptions button').forEach(b => b.classList.toggle('selected', b.dataset.v === v));
  }

  function submitFeedback() {
    const weightVal = parseFloat($('feedbackWeight').value);
    Store.set(s => {
      Progress.recordCompletion(s, session.workout, session.feedback || 'good');
      if (!isNaN(weightVal) && weightVal > 0) Progress.logWeight(s, entryDisplayToKg(weightVal));
      s.pendingWorkout = Generator.generate(s);
      return s;
    });
    session = null;
    Notify.refreshSchedule(Store.get());
    goto('home');
  }

  // ---------------- PROGRESS ----------------
  function renderProgress() {
    const state = Store.get();
    $('pStreak').textContent = state.progress.streak;
    $('pLongest').textContent = state.progress.longestStreak;
    $('pTotal').textContent = state.progress.totalSessions;

    renderWeighInBanner(state, 'p');
    const qw = $('quickWeight');
    if (qw) qw.placeholder = `Log today's weight (${unitLabel()})`;

    drawSparkline(state.weightLog);
    const trend = Progress.weightTrend(state);
    $('weightDelta').textContent = trend
      ? `${fmtWeight(trend.first)} ${unitLabel()} → ${fmtWeight(trend.last)} ${unitLabel()} (${trend.delta > 0 ? '+' : ''}${fmtWeight(trend.delta)} ${unitLabel()} over ${trend.weeks}w)`
      : 'Log your weight a couple of times to see a trend.';

    renderConsistency(state);
    renderExpectedProgress(state);

    const grid = $('badgeGrid'); grid.innerHTML = '';
    MILESTONES.forEach(m => {
      const unlocked = m.check(state);
      const el = document.createElement('div');
      el.className = 'badge' + (unlocked ? ' unlocked' : '');
      el.innerHTML = `<div class="ic">${m.icon}</div><div class="bl">${m.label}</div>`;
      grid.appendChild(el);
    });

    const list = $('historyList'); list.innerHTML = '';
    const recent = [...state.history].reverse().slice(0, 12);
    if (recent.length === 0) {
      list.innerHTML = '<div class="plan-item"><div class="meta">No sessions yet — your first one will show up here.</div></div>';
    }
    recent.forEach(h => {
      const row = document.createElement('div');
      row.className = 'history-row';
      const d = new Date(h.date);
      row.innerHTML = `<span class="d">${d.toLocaleDateString(undefined,{month:'short',day:'numeric'})}</span><span class="pill">${h.type}</span><span>${h.exerciseIds.length} moves</span><span>${h.feedback}</span>`;
      list.appendChild(row);
    });
  }

  function renderConsistency(state) {
    const stats = Progress.consistencyStats(state);
    const wrap = $('consistencyBars'); wrap.innerHTML = '';
    const max = Math.max(stats.target, ...stats.perWeek.map(w => w.count), 1);
    stats.perWeek.forEach(w => {
      const bar = document.createElement('div');
      bar.className = 'cbar';
      const pct = Math.max(3, Math.round((w.count / max) * 100));
      bar.innerHTML = `<div class="cbar-track"><div class="cbar-fill" style="height:${w.count ? pct : 0}%"></div></div><div class="cbar-label">${w.count}</div>`;
      wrap.appendChild(bar);
    });
    $('consistencyRate').textContent = `${stats.avgPerWeek}/wk avg over the last 4 weeks · ${stats.rate}% of your ${stats.target}-session target`;
  }

  function renderExpectedProgress(state) {
    const exp = Progress.expectedProgress(state);
    const el = $('expectedProgressText');
    if (exp.projectedWeight == null) {
      el.textContent = 'Log your weight a few times to see a projection based on how consistently you train.';
      return;
    }
    const dir = exp.kgPerWeekTrend < 0 ? 'down' : (exp.kgPerWeekTrend > 0 ? 'up' : 'flat');
    const u = unitLabel();
    el.textContent = `At your current consistency (${exp.avgPerWeek}/wk, ${exp.consistencyRate}% of target), you're trending ${dir} about ${fmtWeight(Math.abs(exp.kgPerWeekTrend))}${u}/week — projected ~${fmtWeight(exp.projectedWeight)}${u} in ${exp.weeksAhead} weeks if that keeps up.`;
  }

  function drawSparkline(log) {
    const canvas = $('weightChart');
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const w = canvas.clientWidth || 320, h = 90;
    canvas.width = w * dpr; canvas.height = h * dpr;
    ctx.setTransform(dpr,0,0,dpr,0,0);
    ctx.clearRect(0,0,w,h);
    const style = getComputedStyle(document.body);
    const accent = style.getPropertyValue('--accent-strong').trim() || '#F2A85C';
    const faint = style.getPropertyValue('--card-border').trim() || '#332C24';

    // baseline grid
    ctx.strokeStyle = faint; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(0, h-18); ctx.lineTo(w, h-18); ctx.stroke();

    if (!log || log.length < 2) {
      ctx.fillStyle = faint; ctx.font = '12px sans-serif';
      ctx.fillText('No data yet', 4, h/2);
      return;
    }
    const sorted = [...log].sort((a,b)=> new Date(a.date)-new Date(b.date));
    const kgs = sorted.map(p => p.kg);
    const min = Math.min(...kgs), max = Math.max(...kgs);
    const pad = 14;
    const range = (max - min) || 1;
    const stepX = (w - pad*2) / (sorted.length - 1);

    ctx.beginPath();
    sorted.forEach((p, i) => {
      const x = pad + i*stepX;
      const y = pad + (1 - (p.kg - min) / range) * (h - pad*2 - 10);
      if (i === 0) ctx.moveTo(x,y); else ctx.lineTo(x,y);
    });
    ctx.strokeStyle = accent; ctx.lineWidth = 2.5; ctx.lineJoin='round'; ctx.stroke();

    sorted.forEach((p, i) => {
      const x = pad + i*stepX;
      const y = pad + (1 - (p.kg - min) / range) * (h - pad*2 - 10);
      ctx.beginPath(); ctx.arc(x,y,3,0,Math.PI*2); ctx.fillStyle = accent; ctx.fill();
    });
  }

  function quickLogWeight() {
    const v = parseFloat($('quickWeight').value);
    if (isNaN(v) || v <= 0) return;
    Store.set(s => Progress.logWeight(s, displayToKg(v)));
    $('quickWeight').value = '';
    Notify.refreshSchedule(Store.get());
    renderProgress();
  }

  // ---------------- QUR'AN PLAYER ----------------
  function renderQuranScreen() {
    const state = Store.get();
    const rSel = $('qReciter');
    if (!rSel.options.length) {
      Quran.RECITERS.forEach(r => { const o = document.createElement('option'); o.value = r.id; o.textContent = r.name; rSel.appendChild(o); });
    }
    rSel.value = state.quranPrefs.reciterId;
    const sSel = $('qSurah');
    if (!sSel.options.length) {
      Quran.SURAHS.forEach(s => { const o = document.createElement('option'); o.value = s.number; o.textContent = `${s.number}. ${s.englishName}`; sSel.appendChild(o); });
    }
    sSel.value = state.quranPrefs.surahNum;
    $('qStartAyah').value = state.quranPrefs.startAyah;
    $('qEndAyah').value = state.quranPrefs.endAyah;
    $('qRepeatMode').value = state.quranPrefs.repeatMode;
    $('qRepeatCount').value = state.quranPrefs.repeatCount;
    updateQuranHint();
  }

  function updateQuranHint() {
    const reciter = Quran.reciterById($('qReciter').value);
    const surah = Quran.surahByNumber(+$('qSurah').value);
    $('qStartAyah').max = surah.ayahs;
    $('qEndAyah').max = surah.ayahs;
    const surahOnly = reciter.granularity === 'surah';
    $('qStartAyah').disabled = surahOnly;
    $('qEndAyah').disabled = surahOnly;
    $('qRepeatMode').disabled = surahOnly;
    $('qHint').textContent = surahOnly
      ? `${reciter.name} streams full surahs only — ayah range isn't available for this reciter.`
      : `${surah.englishName} has ${surah.ayahs} ayahs.`;
  }

  function quranPlay() {
    const prefs = {
      reciterId: $('qReciter').value,
      surahNum: +$('qSurah').value,
      startAyah: +$('qStartAyah').value || 1,
      endAyah: +$('qEndAyah').value || Quran.surahByNumber(+$('qSurah').value).ayahs,
      repeatMode: $('qRepeatMode').value,
      repeatCount: +$('qRepeatCount').value || 1,
    };
    Store.set(s => { s.quranPrefs = prefs; return s; });
    quranQueue = Quran.buildQueue(prefs);
    quranIdx = 0;
    if (!quranQueue.length) return;
    $('qNowPlaying').style.display = 'block';
    playQuranTrack();
  }

  function playQuranTrack() {
    const track = quranQueue[quranIdx];
    const audio = $('qAudio');
    if (!track) { $('qNowLabel').textContent = 'Done'; $('qNowSub').textContent = ''; audio.pause(); return; }
    audio.src = track.url;
    audio.play().catch(e => console.warn('quran audio play failed', e));
    $('qNowLabel').textContent = track.label;
    $('qNowSub').textContent = `Track ${quranIdx + 1} of ${quranQueue.length}`;
    $('qPlayPauseBtn').textContent = 'Pause';
  }

  function quranTogglePlay() {
    const audio = $('qAudio');
    if (!quranQueue.length) return;
    if (audio.paused) { audio.play(); $('qPlayPauseBtn').textContent = 'Pause'; }
    else { audio.pause(); $('qPlayPauseBtn').textContent = 'Play'; }
  }

  function quranNext() { if (quranIdx < quranQueue.length - 1) { quranIdx++; playQuranTrack(); } }
  function quranPrev() { if (quranIdx > 0) { quranIdx--; playQuranTrack(); } }

  // ---------------- SETTINGS ----------------
  function renderSettings() {
    const state = Store.get();
    $('setName').value = state.profile.name || '';
    $('setTarget').value = String(state.settings.weeklyTarget);
    $('setReminderTime').value = state.settings.reminderTime;
    $('setAlarmTime').value = state.settings.alarmTime;
    $('setAlarmToggle').classList.toggle('on', state.settings.alarmEnabled);
    $('setFajrToggle').classList.toggle('on', state.settings.useFajrSchedule);
    $('setPrayerCity').value = state.settings.prayer.city;
    $('setPrayerCountry').value = state.settings.prayer.country;
    $('setFajrOffset').value = state.settings.fajrOffsetMinutes;
    $('setCycleToggle').classList.toggle('on', state.settings.cycleMode);
    $('setCycleTime').value = state.settings.cycleTime;
    $('setPauseToggle').classList.toggle('on', state.settings.pauseMode);
    $('setSoundToggle').classList.toggle('on', state.settings.soundOnFinish);
    $('setVibrateToggle').classList.toggle('on', state.settings.vibrateOnFinish);
    $('setWeighInTime').value = state.settings.weighInTime;
    Array.from($('setUnitsToggle').children).forEach(c => {
      c.classList.toggle('on', c.dataset.id === (state.settings.units || 'kg'));
    });
    renderSettingsVisibility();

    setDaysSel = state.settings.preferredDays.slice();
    renderDayGrid('setDays', setDaysSel, (d) => { setDaysSel = d; });

    setWeighInDaySel = state.settings.weighInDay;
    renderSingleDayGrid('setWeighInDay', () => setWeighInDaySel, (d) => { setWeighInDaySel = d; });

    const equipAll = [
      ['bodyweight','Bodyweight'], ['dumbbell','Dumbbells'], ['bench','Bench'],
      ['plate','Plates'], ['curlbar','Curl bar'], ['table','Coffee table'], ['treadmill','Treadmill'],
    ];
    const wrap = $('setEquipment'); wrap.innerHTML = '';
    equipAll.forEach(([id,label]) => {
      const chip = document.createElement('div');
      chip.className = 'chip' + (state.settings.equipment.includes(id) ? ' on' : '');
      chip.textContent = label;
      chip.onclick = () => {
        chip.classList.toggle('on');
      };
      chip.dataset.id = id;
      wrap.appendChild(chip);
    });

    const exWrap = $('setExclusions'); exWrap.innerHTML = '';
    [...EXERCISES].sort((a,b) => a.name.localeCompare(b.name)).forEach(ex => {
      const chip = document.createElement('div');
      const excluded = state.settings.excludedExerciseIds.includes(ex.id);
      chip.className = 'chip' + (excluded ? ' excluded' : '');
      chip.textContent = ex.name;
      chip.dataset.id = ex.id;
      chip.onclick = () => chip.classList.toggle('excluded');
      exWrap.appendChild(chip);
    });

    $('aboutLine').textContent = `Bidayah Fitness · v${APP_VERSION} (build ${APP_BUILD})`;
    $('updateStatus').textContent = '';
    refreshNotifStatusLine();
  }

  function renderSettingsVisibility() {
    const fajrOn = $('setFajrToggle').classList.contains('on');
    $('fajrFields').style.display = fajrOn ? 'flex' : 'none';
    $('manualTimeField').style.display = fajrOn ? 'none' : 'flex';
    // always visible (not just when cycle mode is on) so the default is easy to find and change
    $('cycleTimeField').style.display = 'flex';
  }

  function saveSettings() {
    const equipIds = Array.from($('setEquipment').children)
      .filter(c => c.classList.contains('on')).map(c => c.dataset.id);
    const excludedIds = Array.from($('setExclusions').children)
      .filter(c => c.classList.contains('excluded')).map(c => c.dataset.id);
    Store.set(s => {
      s.profile.name = $('setName').value.trim();
      s.settings.weeklyTarget = +$('setTarget').value;
      s.settings.preferredDays = setDaysSel.slice();
      s.settings.reminderTime = $('setReminderTime').value;
      s.settings.alarmTime = $('setAlarmTime').value;
      s.settings.alarmEnabled = $('setAlarmToggle').classList.contains('on');
      s.settings.useFajrSchedule = $('setFajrToggle').classList.contains('on');
      s.settings.prayer.city = $('setPrayerCity').value.trim() || 'Red Deer';
      s.settings.prayer.country = $('setPrayerCountry').value.trim() || 'Canada';
      s.settings.fajrOffsetMinutes = +$('setFajrOffset').value || 30;
      s.settings.cycleMode = $('setCycleToggle').classList.contains('on');
      s.settings.cycleTime = $('setCycleTime').value || '11:00';
      s.settings.equipment = equipIds.length ? equipIds : ['bodyweight'];
      s.settings.excludedExerciseIds = excludedIds;
      s.settings.weighInDay = setWeighInDaySel;
      s.settings.weighInTime = $('setWeighInTime').value || '08:00';
      const unitsChip = Array.from($('setUnitsToggle').children).find(c => c.classList.contains('on'));
      s.settings.units = unitsChip ? unitsChip.dataset.id : 'kg';
      s.settings.pauseMode = $('setPauseToggle').classList.contains('on');
      s.settings.soundOnFinish = $('setSoundToggle').classList.contains('on');
      s.settings.vibrateOnFinish = $('setVibrateToggle').classList.contains('on');
      s.pendingWorkout = Generator.generate(s);
      return s;
    });
    Notify.refreshSchedule(Store.get());
    goto('home');
  }

  async function fixNotifications() {
    const ok = await Notify.ensurePermission();
    if (!ok) {
      $('notifStatusLine').textContent = "Notification permission denied — enable it for Bidayah in your phone's app settings.";
      return;
    }
    const exact = await Notify.checkExactAlarm();
    if (exact === 'denied' || exact === 'unknown') {
      await Notify.openExactAlarmSettings();
      $('notifStatusLine').textContent = 'Opened system settings — turn on "Allow setting alarms and reminders" for Bidayah, then come back here.';
    } else {
      Notify.refreshSchedule(Store.get());
      $('notifStatusLine').textContent = 'Looks good — reminders rescheduled.';
    }
    setTimeout(refreshNotifStatusLine, 800);
  }

  async function refreshNotifStatusLine() {
    const el = $('notifStatusLine');
    if (!el) return;
    const st = await Notify.getStatus();
    if (!st.supported) { el.textContent = 'Notifications only run on the installed app, not this preview.'; return; }
    el.textContent = `Permission: ${st.display} · Exact alarms: ${st.exactAlarm} · ${st.pendingCount} reminder${st.pendingCount === 1 ? '' : 's'} scheduled.`;
  }

  // Streams the APK straight to disk with Filesystem.downloadFile instead of
  // fetching it, converting the whole thing to one base64 string, and pushing that
  // through the native bridge in a single call — that giant-string approach is what
  // silently failed once the app (with all its exercise photos) grew past ~30MB.
  async function downloadAndInstall(url, buildNum, status) {
    const Filesystem = window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.Filesystem;
    const FileOpener = window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.FileOpener;
    if (!Filesystem || !FileOpener) {
      status.textContent = 'Opening the download page…';
      window.open(url, '_blank');
      return;
    }
    const fileName = `bidayah-update-${buildNum}.apk`;
    status.textContent = 'Downloading update…';

    let listener = null;
    try {
      if (Filesystem.addListener) {
        listener = await Filesystem.addListener('progress', (p) => {
          if (!p) return;
          if (p.contentLength) {
            status.textContent = `Downloading update… ${Math.min(100, Math.round((p.bytes / p.contentLength) * 100))}%`;
          } else {
            status.textContent = `Downloading update… ${(p.bytes / 1048576).toFixed(1)} MB`;
          }
        });
      }
      const result = await Filesystem.downloadFile({ url, path: fileName, directory: 'CACHE', progress: true });
      status.textContent = 'Opening installer…';
      const filePath = result.path || (result.uri || '');
      await FileOpener.open({ filePath, contentType: 'application/vnd.android.package-archive' });
      status.textContent = "Tap Install when Android asks, then reopen Bidayah.";
    } finally {
      if (listener && listener.remove) listener.remove();
    }
  }

  async function checkForUpdates() {
    const btn = $('updateBtn'), status = $('updateStatus');
    btn.disabled = true; btn.textContent = 'Checking…';
    status.textContent = '';

    let remoteBuild, asset;
    try {
      const res = await fetch(`https://api.github.com/repos/${UPDATE_REPO}/releases/latest`, { cache: 'no-store' });
      if (!res.ok) throw new Error('not reachable');
      const data = await res.json();
      remoteBuild = parseInt((data.tag_name || '').replace('build-', ''), 10) || 0;
      asset = (data.assets || []).find(a => a.name.endsWith('.apk'));
    } catch (e) {
      console.warn('update check failed', e);
      status.textContent = "Couldn't check for updates — check your connection and try again.";
      btn.disabled = false; btn.textContent = 'Check for updates';
      return;
    }

    if (remoteBuild <= APP_BUILD) {
      status.textContent = "You're on the latest version.";
      btn.disabled = false; btn.textContent = 'Check for updates';
      return;
    }
    if (!asset) {
      status.textContent = `Build ${remoteBuild} is available, but no APK was attached.`;
      btn.disabled = false; btn.textContent = 'Check for updates';
      return;
    }
    if (!confirm(`Build ${remoteBuild} is available (you're on ${APP_BUILD}). Download and install now?`)) {
      status.textContent = `Build ${remoteBuild} available — check again when you're ready.`;
      btn.disabled = false; btn.textContent = 'Check for updates';
      return;
    }

    try {
      await downloadAndInstall(asset.browser_download_url, remoteBuild, status);
    } catch (e) {
      console.warn('update download/install failed', e);
      status.textContent = "Download or install failed — check your connection and free storage, then try again.";
    } finally {
      btn.disabled = false; btn.textContent = 'Check for updates';
    }
  }

  function resetAll() {
    if (!confirm('Reset all data? This clears your history, streak, and settings.')) return;
    Store.reset();
    location.reload();
  }

  // ---------------- TUTORIAL ----------------
  // One small state machine drives both the first-run auto-play (every chapter,
  // chapter-skippable) and manually opening a single chapter from its own tab.
  let tutorial = null; // { chapterIds, chapterIdx, stepIdx, auto }

  function renderTutorialScreen() {
    const state = Store.get();
    const wrap = $('tutorialChapterList'); if (!wrap) return;
    wrap.innerHTML = '';
    TUTORIAL_CHAPTERS.forEach(ch => {
      const seen = !!state.tutorialChaptersSeen[ch.id];
      const row = document.createElement('div');
      row.className = 'tut-chapter-row';
      row.innerHTML = `
        <div class="tut-chapter-icon">${ch.icon}</div>
        <div class="tut-chapter-meta">
          <div class="t-label" style="font-weight:600">${escapeHtml(ch.title)}</div>
          <div class="t-sub">${ch.steps.length} ${ch.steps.length === 1 ? 'topic' : 'topics'}${seen ? ' · watched' : ''}</div>
        </div>
        <button class="btn btn-ghost btn-sm" onclick="App.startTutorialChapter('${ch.id}')">${seen ? 'Replay' : 'Watch'}</button>`;
      wrap.appendChild(row);
    });
  }

  function startTutorialChapter(chapterId) {
    const idx = TUTORIAL_CHAPTERS.findIndex(c => c.id === chapterId);
    if (idx < 0) return;
    tutorial = { chapterIds: [TUTORIAL_CHAPTERS[idx].id], chapterIdx: 0, stepIdx: 0, auto: false };
    openTutorialOverlay();
  }

  // Auto-plays every chapter in order, right after onboarding finishes. Safe to
  // call any time — it's a no-op once she's already been through it (she can
  // still replay any chapter on her own from the Tutorial tab).
  function startTutorialAll() {
    if (Store.get().tutorialSeen) return;
    tutorial = { chapterIds: TUTORIAL_CHAPTERS.map(c => c.id), chapterIdx: 0, stepIdx: 0, auto: true };
    openTutorialOverlay();
  }

  // "Replay from the start" on the Tutorial tab — walks through every chapter
  // in order, same as the first-run sequence, but manually (not gated by
  // tutorialSeen) so it always runs when she taps it.
  function replayTutorialFromStart() {
    tutorial = { chapterIds: TUTORIAL_CHAPTERS.map(c => c.id), chapterIdx: 0, stepIdx: 0, auto: false };
    openTutorialOverlay();
  }

  function currentTutorialChapter() {
    return TUTORIAL_CHAPTERS.find(c => c.id === tutorial.chapterIds[tutorial.chapterIdx]);
  }

  function openTutorialOverlay() {
    $('tutOverlayRoot').style.display = 'block';
    window.addEventListener('resize', onTutorialResize);
    renderTutorialOverlay();
  }

  function onTutorialResize() {
    if (tutorial) positionTutorialSpotlight(tutorialCurrentTarget);
  }

  // The tutorial no longer shows static pictures of the app — it puts the
  // real, live screen into the right state (via the step's `scene`) and
  // spotlights the actual control being described, blurring the rest.
  let tutorialCurrentTarget = null;
  function renderTutorialOverlay() {
    if (!tutorial) return;
    const ch = currentTutorialChapter();
    const step = ch.steps[tutorial.stepIdx];

    const sceneFn = TUTORIAL_SCENES[step.scene || ch.scene];
    if (sceneFn) sceneFn();

    $('tutStepTitle').textContent = step.title;
    $('tutStepBody').textContent = step.body;

    const dots = $('tutStepDots'); dots.innerHTML = '';
    ch.steps.forEach((_, i) => {
      const d = document.createElement('span');
      if (i === tutorial.stepIdx) d.classList.add('on');
      dots.appendChild(d);
    });

    $('tutBackBtn').style.visibility = (tutorial.stepIdx > 0 || tutorial.chapterIdx > 0) ? 'visible' : 'hidden';
    const isLastStepOfChapter = tutorial.stepIdx === ch.steps.length - 1;
    const isLastChapter = tutorial.chapterIdx === tutorial.chapterIds.length - 1;
    $('tutNextBtn').textContent = (isLastStepOfChapter && isLastChapter) ? 'Done' : (isLastStepOfChapter ? 'Next chapter' : 'Next');
    // Skipping a single chapter only makes sense mid-sequence — hide it otherwise.
    $('tutSkipChapterBtn').style.display = (tutorial.chapterIds.length > 1 && !isLastChapter) ? '' : 'none';
    $('tutProgressLabel').textContent = tutorial.chapterIds.length > 1
      ? `${ch.title} · ${tutorial.chapterIdx + 1} of ${tutorial.chapterIds.length}` : ch.title;

    // Let the scene's DOM changes (screen swap, scrollIntoView) settle before
    // measuring anything — one frame is enough since nothing here animates in.
    tutorialCurrentTarget = step.target !== undefined ? step.target : ch.target;
    requestAnimationFrame(() => requestAnimationFrame(() => positionTutorialSpotlight(tutorialCurrentTarget)));
  }

  function positionTutorialSpotlight(target) {
    const masks = { top:$('tutMaskTop'), bottom:$('tutMaskBottom'), left:$('tutMaskLeft'), right:$('tutMaskRight') };
    const ring = $('tutSpotRing'), block = $('tutSpotBlock');
    const hideSpotlight = () => {
      Object.values(masks).forEach(m => m.style.display = 'none');
      ring.style.display = 'none';
      block.style.display = 'none';
      positionTutorialCallout(null);
    };
    if (!target) return hideSpotlight();

    const selectors = Array.isArray(target) ? target : [target];
    const els = selectors.map(s => document.querySelector(s)).filter(Boolean);
    if (!els.length) return hideSpotlight();

    els[0].scrollIntoView({ block:'center', behavior:'instant' });

    const rects = els.map(e => e.getBoundingClientRect());
    const pad = 8;
    const vw = window.innerWidth, vh = window.innerHeight;
    const box = {
      left: Math.max(0, Math.min(...rects.map(r => r.left)) - pad),
      top: Math.max(0, Math.min(...rects.map(r => r.top)) - pad),
      right: Math.min(vw, Math.max(...rects.map(r => r.right)) + pad),
      bottom: Math.min(vh, Math.max(...rects.map(r => r.bottom)) + pad),
    };
    if (box.right <= box.left || box.bottom <= box.top) return hideSpotlight();

    const showMasks = () => {
      masks.top.style.cssText = `display:block;left:0;top:0;width:${vw}px;height:${box.top}px`;
      masks.bottom.style.cssText = `display:block;left:0;top:${box.bottom}px;width:${vw}px;height:${Math.max(0, vh - box.bottom)}px`;
      masks.left.style.cssText = `display:block;left:0;top:${box.top}px;width:${box.left}px;height:${box.bottom - box.top}px`;
      masks.right.style.cssText = `display:block;left:${box.right}px;top:${box.top}px;width:${Math.max(0, vw - box.right)}px;height:${box.bottom - box.top}px`;
      ring.style.cssText = `display:block;left:${box.left}px;top:${box.top}px;width:${box.right - box.left}px;height:${box.bottom - box.top}px`;
      block.style.cssText = `display:block;left:${box.left}px;top:${box.top}px;width:${box.right - box.left}px;height:${box.bottom - box.top}px`;
    };
    showMasks();
    const fits = positionTutorialCallout(box);
    if (!fits) {
      // The caption genuinely can't sit near this spotlight without being
      // cramped into a tiny scrolling box (a target that fills most of the
      // screen, usually) — better to skip the blur for this one step than
      // force her to scroll a two-line window to read it.
      hideSpotlight();
    }
  }

  // Positions the caption card relative to a spotlight box, never letting it
  // overlap the clear/spotlighted area. Returns false if there just isn't a
  // reasonable amount of room on either side — the caller then skips the
  // blur entirely for this step rather than cramming the caption into a tiny
  // scrolling window (which is confusing and easy to miss).
  const TUT_CALLOUT_MIN_USABLE = 100;
  function positionTutorialCallout(box) {
    const callout = $('tutCallout');
    callout.style.maxHeight = '';
    callout.style.overflowY = '';
    const vh = window.innerHeight;
    const gap = 14;
    const edgeMargin = 10;
    if (!box) { callout.style.top = ''; callout.style.bottom = '18px'; return true; }
    // Try sitting right below the spotlighted area first (measuring its real,
    // current height — title/body are already set by this point).
    callout.style.bottom = '';
    callout.style.top = (box.bottom + gap) + 'px';
    const spaceBelow = vh - (box.bottom + gap) - edgeMargin;
    if (callout.offsetHeight <= spaceBelow) return true;
    // Doesn't fit below — try sitting just above it instead, growing upward
    // from there so its real height (unknown until rendered) never matters.
    callout.style.top = '';
    callout.style.bottom = Math.max(14, vh - box.top + gap) + 'px';
    const spaceAbove = box.top - gap - edgeMargin;
    if (callout.offsetHeight <= spaceAbove) return true;
    // Neither side has full room for the card. If one side at least has a
    // reasonable amount of space, sit there with a small internal scroll
    // (a couple of lines of body text, at most) rather than overlap the
    // spotlight. If not, tell the caller to give up on blurring this step.
    const best = Math.max(spaceBelow, spaceAbove);
    if (best < TUT_CALLOUT_MIN_USABLE) return false;
    if (spaceBelow >= spaceAbove) {
      callout.style.bottom = '';
      callout.style.top = (box.bottom + gap) + 'px';
      callout.style.maxHeight = spaceBelow + 'px';
    } else {
      callout.style.top = '';
      callout.style.bottom = Math.max(14, vh - box.top + gap) + 'px';
      callout.style.maxHeight = spaceAbove + 'px';
    }
    callout.style.overflowY = 'auto';
    return true;
  }

  function markChapterSeen(chapterId) {
    Store.set(s => { s.tutorialChaptersSeen[chapterId] = true; return s; });
  }

  function tutorialNext() {
    if (!tutorial) return;
    const ch = currentTutorialChapter();
    if (tutorial.stepIdx < ch.steps.length - 1) {
      tutorial.stepIdx += 1;
      renderTutorialOverlay();
      return;
    }
    markChapterSeen(ch.id);
    if (tutorial.chapterIdx < tutorial.chapterIds.length - 1) {
      tutorial.chapterIdx += 1;
      tutorial.stepIdx = 0;
      renderTutorialOverlay();
    } else {
      endTutorial();
    }
  }

  function tutorialBack() {
    if (!tutorial) return;
    if (tutorial.stepIdx > 0) {
      tutorial.stepIdx -= 1;
      renderTutorialOverlay();
    } else if (tutorial.chapterIdx > 0) {
      tutorial.chapterIdx -= 1;
      tutorial.stepIdx = currentTutorialChapter().steps.length - 1;
      renderTutorialOverlay();
    }
  }

  // Skips the rest of the *current chapter*, moving straight to the next
  // chapter (or ending, if it was the last one) — available any time more
  // than one chapter is queued up, whether auto-playing or manually replayed.
  function tutorialSkipChapter() {
    if (!tutorial || tutorial.chapterIds.length <= 1) return;
    if (tutorial.chapterIdx < tutorial.chapterIds.length - 1) {
      tutorial.chapterIdx += 1;
      tutorial.stepIdx = 0;
      renderTutorialOverlay();
    } else {
      endTutorial();
    }
  }

  function endTutorial() {
    const wasAuto = tutorial && tutorial.auto;
    tutorial = null;
    window.removeEventListener('resize', onTutorialResize);
    $('tutOverlayRoot').style.display = 'none';
    restoreRealSessionIfAny();
    Store.set(s => { s.tutorialSeen = true; return s; });
    if (wasAuto) { goto('home'); } else { goto('tutorial'); }
  }

  return {
    init, onboardNext, finishOnboarding, toggleSwitch, goto,
    startWorkout, reroll, playerAction, playerSkip, playerBack, exitPlayer, setMediaFrame, finishSet,
    pickFeedback, submitFeedback, quickLogWeight, saveSettings, resetAll, setUnits, setEntryUnits, skipExercise,
    markManualComplete, checkForUpdates,
    setTodayTime, clearTodayTime, renderSettingsVisibility, logWeighIn,
    openExerciseDetail, closeExerciseDetail, toggleCurrentLiked,
    openLadderModal, closeLadderModal, selectLadderRung, openLadderModalForCurrentStep,
    updateQuranHint, quranPlay, quranTogglePlay, quranNext, quranPrev,
    fixNotifications,
    renderTutorialScreen, startTutorialChapter, startTutorialAll, replayTutorialFromStart,
    tutorialNext, tutorialBack, tutorialSkipChapter, endTutorial,
  };
})();

document.addEventListener('DOMContentLoaded', App.init);
