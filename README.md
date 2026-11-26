# Tempo

A small, pretty Mac app to organise tasks and track the time you spend on them.

- **Board**: projects → tasks → subtasks, in four columns (To do, This week, In progress, Done). Drag cards between columns. Each task has a priority (P1–P3), a difficulty (●○○ to ●●●), a due date, a time estimate and notes.
- **Timers**: one click on ▶ starts timing a task. Stopwatch or Pomodoro (25 / 5 / 15 minutes, adjustable). Only one task is timed at a time; starting another switches over.
- **Menu bar**: a dot in the project's colour and the running time sit in the Mac menu bar, with Pause / Stop / Open in its menu. Closing the window keeps the timer running there.
- **Away detection**: if you leave the Mac while a timer runs, Tempo asks on your return whether to keep or remove that time.
- **Calendar**: tasks on their due dates (drag to reschedule), the time logged each day, and a day panel where you can add or correct time by hand.
- **Summaries**: week, month and year views with a doughnut chart per project, stacked hours per day or month, estimated vs actual time, time of day, a project table and a short written review. Export everything as CSV.
- **Projects**: as many as you like, each with its own colour and animal mascot. Archive old ones to keep their history.

## Install

1. Open the **[latest release](../../releases/tag/latest)** and download **Tempo.dmg**.
2. Open it and drag **Tempo** into **Applications**.
3. The first time only: the app isn't signed with a paid Apple developer certificate, so macOS blocks it. Open **Terminal** and run:

   ```
   xattr -cr /Applications/Tempo.app
   ```

   Then open Tempo normally. (Alternative: try to open it once, then go to System Settings → Privacy & Security and click **Open Anyway**.)
4. Allow notifications when asked. They are used for Pomodoro breaks, away time and due-date reminders.

To update, download the new Tempo.dmg and replace the app. Your data is kept.

## Your data

Everything stays on your Mac, in one file:

```
~/Library/Application Support/com.tempo.desktop/tempo-data.json
```

A copy is made every day in the `backups` folder next to it (the last 30 days are kept). Settings → *Save a backup copy* writes one to Downloads.

## Building it yourself

Every push to `main` builds the app on GitHub (see *Actions*) and replaces the `latest` release. To build locally on a Mac you need Node 22 and Rust:

```
npm install
npx tauri dev      # run with live reload
npx tauri build    # make Tempo.app and Tempo.dmg
```

`npm run dev` runs the interface in a normal browser (data kept in the browser; no menu bar).

Made with Tauri 2, Svelte 5 and TypeScript.
