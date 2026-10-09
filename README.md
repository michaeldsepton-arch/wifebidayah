# Bidayah Fitness

A personal 30-minute workout app: bodyweight + dumbbell/plate training, generated fresh
every session (no day-to-day or week-to-week repeats), with flexible weekly scheduling,
progressive difficulty, weight tracking, and local push reminders — no internet or
account needed.

## Getting the APK

Every push to `main` builds the app automatically on GitHub's servers.

1. Go to the **Actions** tab of this repo.
2. Open the latest **Build Bidayah Fitness APK** run (green check = success).
3. Under **Artifacts**, download `bidayah-fitness-apk` — it's a zip containing
   `app-debug.apk`.
4. Send that `.apk` to the phone (email, Drive, USB, etc.), open it, and allow
   "install from unknown sources" when prompted. That's it — no Play Store needed.

To trigger a fresh build without changing anything, go to **Actions → Build Bidayah
Fitness APK → Run workflow**.

## Local development

```
npm install
npx cap sync android
```

Open `android/` in Android Studio to run on a device/emulator, or build from the
command line with `cd android && ./gradlew assembleDebug`.

The entire app lives in `www/` as plain HTML/CSS/JS (no build step) — edit there,
then re-run `npx cap sync android`.
