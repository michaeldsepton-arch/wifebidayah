// Exercise database.
// pattern: squat | hinge | lunge | pushH | pushV | pull | core | carry | cardio
// tier: 1 (easiest) -> 3 (hardest) — used for progressive difficulty scaling
// equipment: bodyweight | dumbbell | bench | plate | curlbar | table | treadmill
// timeBased: true -> duration (sec) instead of reps

const EXERCISES = [
  // ---------- SQUAT ----------
  { id:'bw_squat', name:'Bodyweight Squat', pattern:'squat', focus:['legs','glutes'], equipment:['bodyweight'], tier:1, reps:'12-15', cue:'Feet shoulder-width, sit back like sitting in a chair, chest up.' },
  { id:'goblet_squat', name:'Goblet Squat', pattern:'squat', focus:['legs','glutes'], equipment:['dumbbell'], tier:2, reps:'10-12', cue:'Hold one dumbbell vertically at your chest, squat down, drive through heels.' },
  { id:'sumo_squat', name:'Sumo Squat', pattern:'squat', focus:['legs','glutes'], equipment:['dumbbell'], tier:2, reps:'10-12', cue:'Wide stance, toes out, dumbbell hanging between legs, squat straight down.' },
  { id:'pulse_squat', name:'Pulse Squat', pattern:'squat', focus:['legs','glutes'], equipment:['bodyweight'], tier:3, reps:'15-20', cue:'Lower to a squat and pulse 2 inches up and down before standing.' },
  { id:'squat_press', name:'Squat to Shoulder Press', pattern:'squat', focus:['legs','shoulders'], equipment:['dumbbell'], tier:3, reps:'10-12', cue:'Squat down holding dumbbells at shoulders, as you stand press them overhead.' },
  { id:'wall_sit', name:'Wall Sit', pattern:'squat', focus:['legs'], equipment:['bodyweight'], tier:2, timeBased:true, duration:30, cue:'Back flat against a wall, thighs parallel to floor, hold.' },

  // ---------- HINGE ----------
  { id:'glute_bridge', name:'Glute Bridge', pattern:'hinge', focus:['glutes','core'], equipment:['bodyweight'], tier:1, reps:'12-15', cue:'Lie on back, knees bent, drive hips up squeezing glutes at the top.' },
  { id:'db_rdl', name:'Dumbbell Romanian Deadlift', pattern:'hinge', focus:['legs','glutes'], equipment:['dumbbell'], tier:2, reps:'10-12', cue:'Soft knees, hinge at hips lowering dumbbells along shins, feel the hamstring stretch.' },
  { id:'single_leg_glute_bridge', name:'Single-Leg Glute Bridge', pattern:'hinge', focus:['glutes','core'], equipment:['bodyweight'], tier:2, reps:'10 per side', cue:'One foot planted, other leg extended, drive hips up through the planted heel.' },
  { id:'weighted_bridge', name:'Weighted Glute Bridge', pattern:'hinge', focus:['glutes'], equipment:['dumbbell'], tier:3, reps:'12-15', cue:'Rest a dumbbell on your hips, bridge up and squeeze at the top.' },
  { id:'good_morning', name:'Dumbbell Good Morning', pattern:'hinge', focus:['legs','glutes'], equipment:['dumbbell'], tier:3, reps:'10-12', cue:'Dumbbell across upper back, hinge forward keeping back flat, return to standing.' },

  // ---------- LUNGE ----------
  { id:'bw_lunge', name:'Bodyweight Lunge', pattern:'lunge', focus:['legs','glutes'], equipment:['bodyweight'], tier:1, reps:'10 per side', cue:'Step forward, drop back knee toward floor, push back to start.' },
  { id:'db_reverse_lunge', name:'Dumbbell Reverse Lunge', pattern:'lunge', focus:['legs','glutes'], equipment:['dumbbell'], tier:2, reps:'10 per side', cue:'Step backward into a lunge holding dumbbells at your sides.' },
  { id:'step_up', name:'Step-Up (bench)', pattern:'lunge', focus:['legs','glutes'], equipment:['bench'], tier:2, reps:'10 per side', cue:'Step fully onto the bench, drive through the lead foot, step down with control.' },
  { id:'db_step_up', name:'Weighted Step-Up (bench)', pattern:'lunge', focus:['legs','glutes'], equipment:['bench','dumbbell'], tier:3, reps:'10 per side', cue:'Same as step-up, holding a dumbbell in each hand.' },
  { id:'curtsy_lunge', name:'Curtsy Lunge', pattern:'lunge', focus:['legs','glutes'], equipment:['bodyweight'], tier:2, reps:'10 per side', cue:'Step one leg behind and across, lower into a curtsy, return to standing.' },
  { id:'lateral_lunge', name:'Lateral Lunge', pattern:'lunge', focus:['legs','glutes'], equipment:['bodyweight'], tier:2, reps:'10 per side', cue:'Step wide to one side, sit back into that hip, other leg stays straight.' },
  { id:'bulgarian_split_squat', name:'Bulgarian Split Squat (bench)', pattern:'lunge', focus:['legs','glutes'], equipment:['bench'], tier:3, reps:'8-10 per side', cue:'Rear foot up on the bench, lower straight down on the front leg.' },

  // ---------- PUSH (horizontal) ----------
  { id:'knee_pushup', name:'Knee Push-Up', pattern:'pushH', focus:['chest','arms'], equipment:['bodyweight'], tier:1, reps:'8-12', cue:'Knees down, hands under shoulders, lower chest to floor, press up.' },
  { id:'pushup', name:'Push-Up', pattern:'pushH', focus:['chest','arms'], equipment:['bodyweight'], tier:2, reps:'8-12', cue:'Straight line head to heels, lower chest to floor, press up.' },
  { id:'incline_pushup', name:'Incline Push-Up (coffee table)', pattern:'pushH', focus:['chest','arms'], equipment:['table'], tier:1, reps:'10-12', cue:'Hands on the coffee table, body straight, lower and press up — easier angle.' },
  { id:'decline_pushup', name:'Decline Push-Up (bench)', pattern:'pushH', focus:['chest','shoulders'], equipment:['bench'], tier:3, reps:'8-10', cue:'Feet up on the bench, hands on floor, lower chest toward the ground.' },
  { id:'db_chest_press', name:'Dumbbell Floor Chest Press', pattern:'pushH', focus:['chest','arms'], equipment:['dumbbell'], tier:2, reps:'10-12', cue:'Lie on floor, press dumbbells straight up over your chest.' },
  { id:'db_bench_press', name:'Dumbbell Bench Press', pattern:'pushH', focus:['chest','arms'], equipment:['dumbbell','bench'], tier:3, reps:'10-12', cue:'Lie on the bench, press dumbbells up over your chest, lower with control.' },
  { id:'db_fly', name:'Dumbbell Floor Fly', pattern:'pushH', focus:['chest'], equipment:['dumbbell'], tier:2, reps:'10-12', cue:'Arms slightly bent, open wide then bring dumbbells together over chest.' },

  // ---------- PUSH (vertical) ----------
  { id:'pike_pushup', name:'Pike Push-Up', pattern:'pushV', focus:['shoulders','arms'], equipment:['bodyweight'], tier:3, reps:'8-10', cue:'Hips high in a pike, lower the top of your head toward the floor.' },
  { id:'db_shoulder_press', name:'Dumbbell Shoulder Press', pattern:'pushV', focus:['shoulders'], equipment:['dumbbell'], tier:2, reps:'10-12', cue:'Press dumbbells from shoulder height straight overhead.' },
  { id:'db_lateral_raise', name:'Dumbbell Lateral Raise', pattern:'pushV', focus:['shoulders'], equipment:['dumbbell'], tier:2, reps:'12-15', cue:'Light weight, raise arms out to the sides to shoulder height.' },
  { id:'db_front_raise', name:'Dumbbell Front Raise', pattern:'pushV', focus:['shoulders'], equipment:['dumbbell'], tier:2, reps:'12-15', cue:'Raise dumbbells straight in front to shoulder height, control the descent.' },
  { id:'arnold_press', name:'Arnold Press', pattern:'pushV', focus:['shoulders'], equipment:['dumbbell'], tier:3, reps:'10-12', cue:'Start palms facing you, rotate and press overhead, reverse on the way down.' },

  // ---------- PULL ----------
  { id:'db_bent_row', name:'Dumbbell Bent-Over Row', pattern:'pull', focus:['back','arms'], equipment:['dumbbell'], tier:2, reps:'10-12', cue:'Hinge forward, flat back, row dumbbells to your ribs, squeeze shoulder blades.' },
  { id:'db_single_row', name:'Single-Arm Row (bench)', pattern:'pull', focus:['back','arms'], equipment:['dumbbell','bench'], tier:2, reps:'10 per side', cue:'One knee and hand on the bench, row the dumbbell to your hip.' },
  { id:'reverse_fly', name:'Dumbbell Reverse Fly', pattern:'pull', focus:['back','shoulders'], equipment:['dumbbell'], tier:2, reps:'12-15', cue:'Hinge forward, raise dumbbells out to the sides, squeeze shoulder blades together.' },
  { id:'superman', name:'Superman Hold', pattern:'pull', focus:['back','core'], equipment:['bodyweight'], tier:1, timeBased:true, duration:25, cue:'Lie face down, lift arms, chest and legs off the floor together, hold.' },
  { id:'bar_hang', name:'Dead Hang (pull-up bar)', pattern:'pull', focus:['back','arms'], equipment:['bodyweight'], tier:2, timeBased:true, duration:20, cue:'Hang from the bar with arms straight, shoulders engaged — builds grip and back without needing a pull-up.' },
  { id:'curlbar_row', name:'Curl Bar Bent-Over Row', pattern:'pull', focus:['back','arms'], equipment:['curlbar'], tier:3, reps:'10-12', cue:'Hinge forward, flat back, row the bar to your waist.' },

  // ---------- ARMS (biceps/triceps direct) ----------
  { id:'curlbar_curl', name:'Curl Bar Bicep Curl', pattern:'pull', focus:['arms'], equipment:['curlbar'], tier:2, reps:'10-12', cue:'Elbows pinned to your sides, curl the bar up, squeeze, lower slowly.' },
  { id:'db_hammer_curl', name:'Dumbbell Hammer Curl', pattern:'pull', focus:['arms'], equipment:['dumbbell'], tier:2, reps:'10-12', cue:'Palms facing each other, curl straight up without rotating the wrist.' },
  { id:'bench_dip', name:'Bench Tricep Dip', pattern:'pushH', focus:['arms'], equipment:['bench'], tier:2, reps:'10-12', cue:'Hands on bench behind you, lower hips straight down, press back up.' },
  { id:'db_overhead_tricep', name:'Dumbbell Overhead Tricep Extension', pattern:'pushV', focus:['arms'], equipment:['dumbbell'], tier:2, reps:'10-12', cue:'One dumbbell held with both hands overhead, lower behind your head, extend back up.' },
  { id:'db_kickback', name:'Dumbbell Tricep Kickback', pattern:'pushH', focus:['arms'], equipment:['dumbbell'], tier:2, reps:'10-12', cue:'Hinge forward, elbow pinned high, extend the forearm straight back.' },

  // ---------- CORE ----------
  { id:'plank', name:'Forearm Plank', pattern:'core', focus:['core'], equipment:['bodyweight'], tier:1, timeBased:true, duration:30, cue:'Forearms down, straight line head to heels, brace your abs.' },
  { id:'side_plank', name:'Side Plank', pattern:'core', focus:['core'], equipment:['bodyweight'], tier:2, timeBased:true, duration:20, cue:'Stack feet, prop up on one forearm, lift hips into a straight line. Both sides.' },
  { id:'bicycle_crunch', name:'Bicycle Crunch', pattern:'core', focus:['core'], equipment:['bodyweight'], tier:2, reps:'20 total', cue:'Opposite elbow to opposite knee, slow and controlled, exhale on each twist.' },
  { id:'dead_bug', name:'Dead Bug', pattern:'core', focus:['core'], equipment:['bodyweight'], tier:1, reps:'10 per side', cue:'Lower back pressed flat, extend opposite arm and leg, return, switch sides.' },
  { id:'plate_russian_twist', name:'Weighted Russian Twist', pattern:'core', focus:['core'], equipment:['plate'], tier:2, reps:'16 total', cue:'Lean back slightly, feet off floor if possible, twist the plate side to side.' },
  { id:'mountain_climber', name:'Mountain Climbers', pattern:'core', focus:['core','cardio'], equipment:['bodyweight'], tier:2, timeBased:true, duration:30, cue:'Plank position, drive knees to chest quickly, keep hips level.' },
  { id:'leg_raise', name:'Lying Leg Raise', pattern:'core', focus:['core'], equipment:['bodyweight'], tier:2, reps:'12-15', cue:'Lower back pressed down, raise straight legs to vertical, lower slowly without touching the floor.' },
  { id:'plank_shoulder_tap', name:'Plank Shoulder Taps', pattern:'core', focus:['core'], equipment:['bodyweight'], tier:2, reps:'16 total', cue:'High plank, tap opposite shoulder with each hand, keep hips still.' },
  { id:'hollow_hold', name:'Hollow Body Hold', pattern:'core', focus:['core'], equipment:['bodyweight'], tier:3, timeBased:true, duration:20, cue:'Lower back pressed to floor, arms and legs extended and lifted, hold the dish shape.' },

  // ---------- CARDIO / FULL BODY / CARRY ----------
  { id:'jumping_jacks', name:'Jumping Jacks', pattern:'cardio', focus:['cardio'], equipment:['bodyweight'], tier:1, timeBased:true, duration:30, cue:'Classic jacks — keep a light, quick rhythm.' },
  { id:'high_knees', name:'High Knees', pattern:'cardio', focus:['cardio','legs'], equipment:['bodyweight'], tier:2, timeBased:true, duration:30, cue:'Drive knees up to hip height quickly, pump your arms.' },
  { id:'squat_jump', name:'Squat Jump', pattern:'cardio', focus:['legs','cardio'], equipment:['bodyweight'], tier:3, reps:'10-12', cue:'Squat down then explode straight up, land soft.' },
  { id:'burpee_no_pushup', name:'Burpee (no push-up)', pattern:'cardio', focus:['cardio','legs'], equipment:['bodyweight'], tier:3, reps:'8-10', cue:'Squat, kick feet back to plank, jump feet in, stand and jump up.' },
  { id:'treadmill_interval', name:'Treadmill Interval', pattern:'cardio', focus:['cardio'], equipment:['treadmill'], tier:2, timeBased:true, duration:60, cue:'Alternate 30s brisk walk/jog with 30s faster pace, repeat.' },
  { id:'treadmill_incline_walk', name:'Treadmill Incline Walk', pattern:'cardio', focus:['cardio','legs'], equipment:['treadmill'], tier:1, timeBased:true, duration:90, cue:'Raise the incline, walk at a pace you can hold while talking in short sentences.' },
  { id:'db_farmer_carry', name:"Farmer's Carry", pattern:'carry', focus:['core','arms'], equipment:['dumbbell'], tier:2, timeBased:true, duration:30, cue:'A dumbbell in each hand, walk tall with shoulders back for the full time.' },
  { id:'plate_overhead_carry', name:'Overhead Plate Carry', pattern:'carry', focus:['core','shoulders'], equipment:['plate'], tier:3, timeBased:true, duration:20, cue:'Press the plate overhead and walk slowly, keep your core braced.' },
  { id:'table_tricep_dip', name:'Coffee Table Tricep Dip', pattern:'pushH', focus:['arms'], equipment:['table'], tier:1, reps:'10-12', cue:'Hands on the table edge behind you, lower hips straight down and press up.' },
  { id:'step_up_cardio', name:'Fast Step-Ups (coffee table)', pattern:'cardio', focus:['legs','cardio'], equipment:['table'], tier:2, timeBased:true, duration:30, cue:'Step up and down on the coffee table at a quick, steady pace.' },
];

// Warm-up and cool-down pools (always bodyweight, low intensity, time-based)
const WARMUPS = [
  { id:'w_march', name:'March in Place', duration:30, cue:'Easy marching, swing your arms, get your heart rate up gently.' },
  { id:'w_arm_circle', name:'Arm Circles', duration:20, cue:'Small to big circles forward, then backward.' },
  { id:'w_bodyweight_squat', name:'Bodyweight Squats', duration:30, cue:'Slow, controlled squats to open up the hips and knees.' },
  { id:'w_cat_cow', name:'Cat-Cow', duration:30, cue:'On hands and knees, alternate arching and rounding your spine.' },
  { id:'w_leg_swing', name:'Leg Swings', duration:20, cue:'Hold something steady, swing each leg forward and back, then side to side.' },
  { id:'w_jacks_slow', name:'Slow Jumping Jacks', duration:30, cue:'Half-pace jacks to ease into it.' },
];
const COOLDOWNS = [
  { id:'c_quad_stretch', name:'Quad Stretch', duration:25, cue:'Stand tall, pull one heel to your glute, hold, switch sides.' },
  { id:'c_hamstring_stretch', name:'Hamstring Stretch', duration:25, cue:'Hinge forward with a soft bend in the knees, reach toward your toes.' },
  { id:'c_chest_stretch', name:'Chest Opener', duration:20, cue:'Clasp hands behind your back, lift your chest, pull shoulders back.' },
  { id:'c_child_pose', name:"Child's Pose", duration:30, cue:'Sit back onto your heels, arms stretched forward, relax your back.' },
  { id:'c_calf_stretch', name:'Calf Stretch', duration:20, cue:'Step one foot back, press the heel down, lean into the wall gently.' },
  { id:'c_deep_breath', name:'Deep Breathing', duration:30, cue:'Slow breaths in through the nose, out through the mouth, let your heart rate settle.' },
];

if (typeof module !== 'undefined') module.exports = { EXERCISES, WARMUPS, COOLDOWNS };
