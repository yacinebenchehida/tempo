//! Native side of Tempo: data file storage, the menu-bar timer, idle detection.
//! All the app logic lives in the web front end; this file only does what a
//! browser cannot.

use std::{fs, path::PathBuf, sync::Mutex};
use tauri::{
    image::Image,
    menu::{Menu, MenuItem, PredefinedMenuItem},
    tray::{TrayIcon, TrayIconBuilder},
    AppHandle, Emitter, Manager, WindowEvent, Wry,
};

const DATA_FILE: &str = "tempo-data.json";
const BACKUPS_KEPT: usize = 30;

struct TrayState {
    tray: Mutex<Option<TrayIcon<Wry>>>,
    task: Mutex<Option<MenuItem<Wry>>>,
    toggle: Mutex<Option<MenuItem<Wry>>>,
    stop: Mutex<Option<MenuItem<Wry>>>,
    open: Mutex<Option<MenuItem<Wry>>>,
    quit: Mutex<Option<MenuItem<Wry>>>,
    last_color: Mutex<String>,
}

// ---------- storage ----------

fn data_dir(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    Ok(dir)
}

#[tauri::command]
fn load_data(app: AppHandle) -> Result<Option<String>, String> {
    let p = data_dir(&app)?.join(DATA_FILE);
    if !p.exists() {
        return Ok(None);
    }
    fs::read_to_string(&p).map(Some).map_err(|e| e.to_string())
}

#[tauri::command]
fn save_data(app: AppHandle, json: String) -> Result<(), String> {
    let dir = data_dir(&app)?;
    let path = dir.join(DATA_FILE);
    let tmp = dir.join(format!("{DATA_FILE}.tmp"));
    // Write to a temporary file first, then swap, so a crash never leaves a half-written file.
    fs::write(&tmp, json.as_bytes()).map_err(|e| e.to_string())?;
    fs::rename(&tmp, &path).map_err(|e| e.to_string())?;

    // One backup per day, the last 30 days kept.
    let bdir = dir.join("backups");
    if fs::create_dir_all(&bdir).is_ok() {
        let today = chrono::Local::now().format("%Y-%m-%d").to_string();
        let backup = bdir.join(format!("tempo-{today}.json"));
        if !backup.exists() {
            let _ = fs::copy(&path, &backup);
            prune_backups(&bdir);
        }
    }
    Ok(())
}

fn prune_backups(dir: &PathBuf) {
    if let Ok(rd) = fs::read_dir(dir) {
        let mut files: Vec<PathBuf> = rd
            .filter_map(|e| e.ok().map(|e| e.path()))
            .filter(|p| p.extension().map(|x| x == "json").unwrap_or(false))
            .collect();
        files.sort();
        if files.len() > BACKUPS_KEPT {
            for f in &files[..files.len() - BACKUPS_KEPT] {
                let _ = fs::remove_file(f);
            }
        }
    }
}

#[tauri::command]
fn data_location(app: AppHandle) -> Result<String, String> {
    Ok(data_dir(&app)?.join(DATA_FILE).to_string_lossy().to_string())
}

#[tauri::command]
fn export_file(app: AppHandle, name: String, contents: String) -> Result<String, String> {
    let dir = app
        .path()
        .download_dir()
        .or_else(|_| app.path().home_dir())
        .map_err(|e| e.to_string())?;
    let safe: String = name
        .chars()
        .map(|c| if c.is_alphanumeric() || c == '-' || c == '_' || c == '.' { c } else { '_' })
        .collect();
    let path = dir.join(safe);
    fs::write(&path, contents.as_bytes()).map_err(|e| e.to_string())?;
    Ok(path.to_string_lossy().to_string())
}

// ---------- idle detection ----------

/// Seconds since the last keyboard or mouse input (macOS and Windows). 0 elsewhere.
#[tauri::command]
fn idle_seconds() -> u64 {
    #[cfg(target_os = "macos")]
    {
        if let Ok(out) = std::process::Command::new("/usr/sbin/ioreg")
            .args(["-c", "IOHIDSystem", "-d", "4"])
            .output()
        {
            let text = String::from_utf8_lossy(&out.stdout);
            for line in text.lines() {
                if line.contains("\"HIDIdleTime\"") {
                    if let Some(v) = line.rsplit('=').next() {
                        if let Ok(ns) = v.trim().parse::<u64>() {
                            return ns / 1_000_000_000;
                        }
                    }
                }
            }
        }
        0
    }
    #[cfg(target_os = "windows")]
    {
        use windows_sys::Win32::System::SystemInformation::GetTickCount;
        use windows_sys::Win32::UI::Input::KeyboardAndMouse::{GetLastInputInfo, LASTINPUTINFO};
        let mut info = LASTINPUTINFO { cbSize: std::mem::size_of::<LASTINPUTINFO>() as u32, dwTime: 0 };
        // SAFETY: plain Win32 calls with a correctly sized struct.
        unsafe {
            if GetLastInputInfo(&mut info) != 0 {
                return (GetTickCount().wrapping_sub(info.dwTime) / 1000) as u64;
            }
        }
        0
    }
    #[cfg(not(any(target_os = "macos", target_os = "windows")))]
    {
        0
    }
}

// ---------- menu bar ----------

fn parse_hex(hex: &str) -> Option<(u8, u8, u8)> {
    let h = hex.trim_start_matches('#');
    if h.len() != 6 {
        return None;
    }
    let p = |i: usize| u8::from_str_radix(&h[i..i + 2], 16).ok();
    Some((p(0)?, p(2)?, p(4)?))
}

/// A dot in the project's colour while a timer runs; an outline ring otherwise.
fn dot_icon(color: Option<&str>) -> Image<'static> {
    let size: u32 = 36;
    let mut buf = vec![0u8; (size * size * 4) as usize];
    let rgb = color.and_then(parse_hex);
    // macOS tints the outline ring itself (template icon); elsewhere use a mid grey
    // that shows on both light and dark taskbars.
    let idle_rgb = if cfg!(target_os = "macos") { (0, 0, 0) } else { (138, 144, 156) };
    let (r, g, b) = rgb.unwrap_or(idle_rgb);
    let filled = rgb.is_some();
    let c = size as f32 / 2.0;
    let rad = 11.0_f32;
    let ring = 3.4_f32;
    for y in 0..size {
        for x in 0..size {
            let dx = x as f32 + 0.5 - c;
            let dy = y as f32 + 0.5 - c;
            let d = (dx * dx + dy * dy).sqrt();
            let outer = (rad + 0.5 - d).clamp(0.0, 1.0);
            let a = if filled {
                outer
            } else {
                outer.min((d - (rad - ring) + 0.5).clamp(0.0, 1.0))
            };
            let i = ((y * size + x) * 4) as usize;
            buf[i] = r;
            buf[i + 1] = g;
            buf[i + 2] = b;
            buf[i + 3] = (a * 255.0) as u8;
        }
    }
    Image::new_owned(buf, size, size)
}

#[tauri::command]
fn set_tray(
    state: tauri::State<TrayState>,
    title: String,
    color: Option<String>,
    task: String,
    toggle: String,
    stop: String,
    open: String,
    quit: String,
    can_stop: bool,
) -> Result<(), String> {
    if let Some(tray) = state.tray.lock().unwrap().as_ref() {
        let _ = tray.set_title(if title.is_empty() { None } else { Some(title.as_str()) });
        let key = color.clone().unwrap_or_default();
        let mut last = state.last_color.lock().unwrap();
        if *last != key {
            let _ = tray.set_icon(Some(dot_icon(color.as_deref())));
            let _ = tray.set_icon_as_template(color.is_none());
            *last = key;
        }
        // Windows has no text next to tray icons, so the tooltip carries the time too.
        let tip = if title.is_empty() { task.clone() } else { format!("{title} · {task}") };
        let _ = tray.set_tooltip(Some(tip.as_str()));
    }
    if let Some(i) = state.task.lock().unwrap().as_ref() {
        let _ = i.set_text(&task);
    }
    if let Some(i) = state.toggle.lock().unwrap().as_ref() {
        let _ = i.set_text(&toggle);
    }
    if let Some(i) = state.stop.lock().unwrap().as_ref() {
        let _ = i.set_enabled(can_stop);
        let _ = i.set_text(&stop);
    }
    if let Some(i) = state.open.lock().unwrap().as_ref() {
        let _ = i.set_text(&open);
    }
    if let Some(i) = state.quit.lock().unwrap().as_ref() {
        let _ = i.set_text(&quit);
    }
    Ok(())
}

fn show_main(app: &AppHandle) {
    if let Some(w) = app.get_webview_window("main") {
        let _ = w.show();
        let _ = w.unminimize();
        let _ = w.set_focus();
    }
}

fn build_tray(app: &AppHandle) -> tauri::Result<()> {
    let task = MenuItem::with_id(app, "task", "No timer running", false, None::<&str>)?;
    let toggle = MenuItem::with_id(app, "toggle", "Start", true, None::<&str>)?;
    let stop = MenuItem::with_id(app, "stop", "Stop & save", false, None::<&str>)?;
    let open = MenuItem::with_id(app, "open", "Open Tempo", true, None::<&str>)?;
    let quit = MenuItem::with_id(app, "quit", "Quit Tempo", true, None::<&str>)?;
    let sep1 = PredefinedMenuItem::separator(app)?;
    let sep2 = PredefinedMenuItem::separator(app)?;
    let menu = Menu::with_items(app, &[&task, &sep1, &toggle, &stop, &sep2, &open, &quit])?;

    let tray = TrayIconBuilder::with_id("tempo")
        .icon(dot_icon(None))
        .icon_as_template(true)
        .tooltip("Tempo")
        .menu(&menu)
        .show_menu_on_left_click(true)
        .on_menu_event(|app, event| match event.id.as_ref() {
            "toggle" => {
                let _ = app.emit("tray", "toggle");
            }
            "stop" => {
                let _ = app.emit("tray", "stop");
            }
            "open" => show_main(app),
            "quit" => app.exit(0),
            _ => {}
        })
        .build(app)?;

    let st = app.state::<TrayState>();
    *st.tray.lock().unwrap() = Some(tray);
    *st.task.lock().unwrap() = Some(task);
    *st.toggle.lock().unwrap() = Some(toggle);
    *st.stop.lock().unwrap() = Some(stop);
    *st.open.lock().unwrap() = Some(open);
    *st.quit.lock().unwrap() = Some(quit);
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let app = tauri::Builder::default()
        .plugin(tauri_plugin_notification::init())
        .manage(TrayState {
            tray: Mutex::new(None),
            task: Mutex::new(None),
            toggle: Mutex::new(None),
            stop: Mutex::new(None),
            open: Mutex::new(None),
            quit: Mutex::new(None),
            last_color: Mutex::new("<unset>".into()),
        })
        .setup(|app| {
            build_tray(app.handle())?;
            Ok(())
        })
        .on_window_event(|window, event| {
            // Closing the window only hides it: the timer keeps running in the menu bar.
            if let WindowEvent::CloseRequested { api, .. } = event {
                api.prevent_close();
                let _ = window.hide();
            }
        })
        .invoke_handler(tauri::generate_handler![
            load_data,
            save_data,
            data_location,
            export_file,
            idle_seconds,
            set_tray
        ])
        .build(tauri::generate_context!())
        .expect("error while building Tempo");

    app.run(|_app, _event| {
        #[cfg(target_os = "macos")]
        if let tauri::RunEvent::Reopen { .. } = _event {
            show_main(_app);
        }
    });
}
