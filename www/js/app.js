const App = (() => {
  const DOW_ORDER = [1,2,3,4,5,6,0]; // Mon..Sun
  const DOW_LABEL = { 1:'M',2:'T',3:'W',4:'T',5:'F',6:'S',0:'S' };
  const PATTERN_ICON = { squat:'◧', hinge:'◩', lunge:'◪', pushH:'▲', pushV:'▴', pull:'◂', core:'●', carry:'➜', cardio:'✦' };

  let session = null;   // active player session
  let timerId = null;
  let obDaysSel = [1,2,3,4,5];
  let setDaysSel = [];

  function $(id) { return document.getElementById(id); }
  function fmtTime(sec) {
    sec = Math.max(0, Math.round(sec));
    const m = Math.floor(sec / 60), s = sec % 60;
    return String(m).padStart(2,'0') + ':' + String(s).padStart(2,'0');
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
    for (let i=1;i<=3;i++) { const d=document.createElement('div'); if (i<=n) d.classList.add('on'); dots.appendChild(d); }
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
    Store.set(s => {
      s.settings.reminderTime = $('obReminderTime').value || '08:00';
      s.settings.alarmEnabled = $('obAlarmToggle').classList.contains('on');
      s.settings.alarmTime = $('obAlarmTime').value || '17:30';
      s.onboarded = true;
      return s;
    });
    $('onboard').style.display = 'none';
    $('mainApp').style.display = 'block';
    $('tabbar').style.display = 'block';
    ensurePendingWorkout();
    renderHome();
    Notify.ensurePermission().then(() => Notify.refreshSchedule(Store.get()));
  }

  function toggleSwitch(el) { el.classList.toggle('on'); }

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

  // ---------------- NAV ----------------
  function goto(tab) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t.dataset.tab === tab));
    $('screen-' + tab).classList.add('active');
    if (tab === 'home') renderHome();
    if (tab === 'progress') renderProgress();
    if (tab === 'settings') renderSettings();
  }

  function showScreen(id) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    $(id).classList.add('active');
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
  }

  function renderPlanPreview(workout) {
    const el = $('planPreview'); el.innerHTML = '';
    if (!workout) return;
    const items = [
      ...workout.warmup.map(w => ({ name: w.name, meta: 'Warm-up · ' + w.duration + 's', icon: '○' })),
      ...workout.blocks.map(b => ({ name: b.name, meta: b.sets + (b.timeBased ? ' rounds · ' + b.duration + 's' : ' sets · ' + b.reps), icon: PATTERN_ICON[b.pattern] || '●' })),
      ...workout.cooldown.map(c => ({ name: c.name, meta: 'Cool-down · ' + c.duration + 's', icon: '○' })),
    ];
    items.forEach(it => {
      const row = document.createElement('div');
      row.className = 'plan-item';
      row.innerHTML = `<div class="tag">${it.icon}</div><div><div class="name">${it.name}</div><div class="meta">${it.meta}</div></div>`;
      el.appendChild(row);
    });
  }

  // ---------------- PLAYER ----------------
  function buildSteps(workout) {
    const steps = [];
    workout.warmup.forEach(w => steps.push({ phase:'warmup', name:w.name, cue:w.cue, timeBased:true, duration:w.duration }));
    workout.blocks.forEach(block => {
      for (let s=1; s<=block.sets; s++) {
        steps.push({ phase:'work', name:block.name, cue:block.cue, timeBased:block.timeBased, duration:block.duration, reps:block.reps, setIndex:s, totalSets:block.sets, exerciseId:block.exerciseId });
        if (s < block.sets) steps.push({ phase:'rest', name:'Rest', timeBased:true, duration: block.restSec });
      }
    });
    workout.cooldown.forEach(c => steps.push({ phase:'cooldown', name:c.name, cue:c.cue, timeBased:true, duration:c.duration }));
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
    $('playerPhase').textContent = step.phase === 'work' ? 'WORK' : step.phase.toUpperCase();
    $('playerName').textContent = step.name;
    $('playerCue').textContent = step.cue || (step.phase === 'rest' ? 'Catch your breath, shake it out.' : '');

    const pips = $('playerPips'); pips.innerHTML = '';
    if (step.phase === 'work') {
      for (let i=1;i<=step.totalSets;i++) {
        const s = document.createElement('span');
        if (i < step.setIndex) s.classList.add('done');
        pips.appendChild(s);
      }
    }

    if (step.timeBased) {
      session.remaining = step.duration;
      $('playerTimer').textContent = fmtTime(session.remaining);
      $('playerSub').textContent = step.phase === 'rest' ? 'resting' : 'tap start when ready';
      $('playerActionBtn').textContent = 'Start';
      session.running = false;
    } else {
      $('playerTimer').textContent = step.reps || '—';
      $('playerSub').textContent = `set ${step.setIndex} of ${step.totalSets}`;
      $('playerActionBtn').textContent = 'Done';
    }
  }

  function startTimer() {
    session.running = true;
    $('playerActionBtn').textContent = 'Pause';
    timerId = setInterval(() => {
      session.remaining -= 1;
      $('playerTimer').textContent = fmtTime(session.remaining);
      if (session.remaining <= 0) {
        clearInterval(timerId); timerId = null;
        advance();
      }
    }, 1000);
  }

  function pauseTimer() {
    clearInterval(timerId); timerId = null;
    session.running = false;
    $('playerActionBtn').textContent = 'Resume';
  }

  function playerAction() {
    const step = session.steps[session.idx];
    if (step.timeBased) {
      if (session.running) pauseTimer(); else startTimer();
    } else {
      advance();
    }
  }

  function playerSkip() { advance(); }

  function advance() {
    clearInterval(timerId); timerId = null;
    session.idx += 1;
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
      if (!isNaN(weightVal) && weightVal > 0) Progress.logWeight(s, weightVal);
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

    drawSparkline(state.weightLog);
    const trend = Progress.weightTrend(state);
    $('weightDelta').textContent = trend
      ? `${trend.first} kg → ${trend.last} kg (${trend.delta > 0 ? '+' : ''}${trend.delta} kg since you started logging)`
      : 'Log your weight a couple of times to see a trend.';

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
    Store.set(s => Progress.logWeight(s, v));
    $('quickWeight').value = '';
    renderProgress();
  }

  // ---------------- SETTINGS ----------------
  function renderSettings() {
    const state = Store.get();
    $('setName').value = state.profile.name || '';
    $('setTarget').value = String(state.settings.weeklyTarget);
    $('setReminderTime').value = state.settings.reminderTime;
    $('setAlarmTime').value = state.settings.alarmTime;
    $('setAlarmToggle').classList.toggle('on', state.settings.alarmEnabled);

    setDaysSel = state.settings.preferredDays.slice();
    renderDayGrid('setDays', setDaysSel, (d) => { setDaysSel = d; });

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
  }

  function saveSettings() {
    const equipIds = Array.from($('setEquipment').children)
      .filter(c => c.classList.contains('on')).map(c => c.dataset.id);
    Store.set(s => {
      s.profile.name = $('setName').value.trim();
      s.settings.weeklyTarget = +$('setTarget').value;
      s.settings.preferredDays = setDaysSel.slice();
      s.settings.reminderTime = $('setReminderTime').value;
      s.settings.alarmTime = $('setAlarmTime').value;
      s.settings.alarmEnabled = $('setAlarmToggle').classList.contains('on');
      s.settings.equipment = equipIds.length ? equipIds : ['bodyweight'];
      return s;
    });
    Notify.refreshSchedule(Store.get());
    goto('home');
  }

  function resetAll() {
    if (!confirm('Reset all data? This clears your history, streak, and settings.')) return;
    Store.reset();
    location.reload();
  }

  return {
    init, onboardNext, finishOnboarding, toggleSwitch, goto,
    startWorkout, reroll, playerAction, playerSkip, exitPlayer,
    pickFeedback, submitFeedback, quickLogWeight, saveSettings, resetAll,
  };
})();

document.addEventListener('DOMContentLoaded', App.init);
