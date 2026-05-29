use notify::{
    event::EventKind, Config, Event, RecommendedWatcher, RecursiveMode, Watcher,
};
use std::{
    path::{Path, PathBuf},
    sync::{
        atomic::{AtomicBool, Ordering},
        Arc, Mutex,
    },
    time::Duration,
};
use tauri::{AppHandle, Emitter};
use uuid::Uuid;

use super::{
    apply::{copy_file, delete_path, hash_file, mtime_ms},
    ignore::IgnoreSet,
    pair::{Direction, Kind, SyncPair},
};
use crate::{
    db,
    events::{
        ConflictPromptEvent, RespawnPromptEvent, SyncErrorEvent, TombstoneEvent, EVENT_ACTIVITY,
        EVENT_CONFLICT_PROMPT, EVENT_PAIR_STATUS, EVENT_RESPAWN_PROMPT, EVENT_SYNC_ERROR,
        EVENT_TOMBSTONE_ADDED, EVENT_TOMBSTONE_CLEARED,
    },
};

fn now_ms() -> i64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_millis() as i64)
        .unwrap_or(0)
}

fn emit_activity(app: &AppHandle, pair_id: Uuid, kind: &str, path: &str) {
    let _ = app.emit(
        EVENT_ACTIVITY,
        serde_json::json!({
            "pairId": pair_id.to_string(),
            "kind": kind,
            "path": path,
            "ts": now_ms(),
        }),
    );
}

fn emit_pair_status(app: &AppHandle, pair_id: Uuid, status: &str) {
    let _ = app.emit(
        EVENT_PAIR_STATUS,
        serde_json::json!({ "pairId": pair_id.to_string(), "status": status }),
    );
}

fn emit_error(app: &AppHandle, pair_id: Uuid, op: &str, path: &str, message: &str) {
    let _ = app.emit(
        EVENT_SYNC_ERROR,
        SyncErrorEvent {
            pair_id: pair_id.to_string(),
            op: op.into(),
            path: path.into(),
            message: message.into(),
            ts: now_ms(),
        },
    );
}

pub fn spawn_watcher(
    pair: SyncPair,
    db_conn: Arc<Mutex<rusqlite::Connection>>,
    app: AppHandle,
    stop_flag: Arc<AtomicBool>,
) -> std::thread::JoinHandle<()> {
    std::thread::spawn(move || {
        run_watcher(pair, db_conn, app, stop_flag);
    })
}

fn run_watcher(
    pair: SyncPair,
    db_conn: Arc<Mutex<rusqlite::Connection>>,
    app: AppHandle,
    stop_flag: Arc<AtomicBool>,
) {
    let ignore = IgnoreSet::new(&pair.ignore);
    let (tx, rx) = std::sync::mpsc::channel::<Result<Event, notify::Error>>();

    let mut watcher = match RecommendedWatcher::new(tx, Config::default()) {
        Ok(w) => w,
        Err(e) => {
            let msg = format!("failed to create watcher: {e}");
            log::error!("{msg}");
            emit_error(&app, pair.id, "watch", &pair.source.display().to_string(), &msg);
            emit_pair_status(&app, pair.id, "error");
            return;
        }
    };


    let (source_watch_root, dest_watch_root, recursive) = match pair.kind {
        Kind::File => {
            let src_parent = pair
                .source
                .parent()
                .map(Path::to_path_buf)
                .unwrap_or_else(|| PathBuf::from("."));
            let dst_parent = pair
                .destination
                .parent()
                .map(Path::to_path_buf)
                .unwrap_or_else(|| PathBuf::from("."));
            (src_parent, dst_parent, RecursiveMode::NonRecursive)
        }
        Kind::Folder => (
            pair.source.clone(),
            pair.destination.clone(),
            RecursiveMode::Recursive,
        ),
    };

    if let Err(e) = watcher.watch(&source_watch_root, recursive) {
        let msg = format!("failed to watch source: {e}");
        log::error!("{msg} ({:?})", source_watch_root);
        emit_error(&app, pair.id, "watch", &source_watch_root.display().to_string(), &msg);
        emit_pair_status(&app, pair.id, "error");
        return;
    }

    if pair.direction == Direction::TwoWay {
        if let Err(e) = watcher.watch(&dest_watch_root, recursive) {
            let msg = format!("failed to watch destination: {e}");
            log::warn!("{msg} ({:?})", dest_watch_root);
            emit_error(&app, pair.id, "watch", &dest_watch_root.display().to_string(), &msg);
        }
    }

    emit_pair_status(&app, pair.id, "syncing");

    loop {
        if stop_flag.load(Ordering::Relaxed) {
            break;
        }

        match rx.recv_timeout(Duration::from_millis(100)) {
            Ok(Ok(event)) => {

                std::thread::sleep(Duration::from_millis(300));
                let mut all_paths: Vec<(PathBuf, EventKind)> = event
                    .paths
                    .into_iter()
                    .map(|p| (p, event.kind.clone()))
                    .collect();
                while let Ok(Ok(ev)) = rx.try_recv() {
                    for p in ev.paths {
                        all_paths.push((p, ev.kind.clone()));
                    }
                }
                if stop_flag.load(Ordering::Relaxed) {
                    break;
                }

                all_paths.sort_by(|a, b| a.0.cmp(&b.0));
                all_paths.dedup_by(|a, b| a.0 == b.0 && std::mem::discriminant(&a.1) == std::mem::discriminant(&b.1));

                for (abs_path, kind) in all_paths {
                    handle_fs_event(&pair, &abs_path, &ignore, &db_conn, &app, &kind);
                }
            }
            Ok(Err(e)) => log::warn!("Watcher channel error for pair {}: {e}", pair.id),
            Err(std::sync::mpsc::RecvTimeoutError::Timeout) => {}
            Err(std::sync::mpsc::RecvTimeoutError::Disconnected) => break,
        }
    }

    emit_pair_status(&app, pair.id, "idle");
}

fn handle_fs_event(
    pair: &SyncPair,
    abs_path: &Path,
    ignore: &IgnoreSet,
    db_conn: &Arc<Mutex<rusqlite::Connection>>,
    app: &AppHandle,
    kind: &EventKind,
) {
    if let Err(e) = try_handle_fs_event(pair, abs_path, ignore, db_conn, app, kind) {
        let msg = e.to_string();
        log::warn!("Sync error on {:?}: {msg}", abs_path);
        emit_error(app, pair.id, "sync", &abs_path.display().to_string(), &msg);
        let conn = db_conn.lock().unwrap();
        let _ = db::log_event(&conn, pair.id, "error", &abs_path.display().to_string(), Some(&msg));
    }
}


fn classify_event(pair: &SyncPair, abs_path: &Path) -> Option<(&'static str, PathBuf)> {
    match pair.kind {
        Kind::File => {
            if abs_path == pair.source {
                Some(("source", PathBuf::new()))
            } else if abs_path == pair.destination {
                Some(("dest", PathBuf::new()))
            } else {
                None
            }
        }
        Kind::Folder => {
            if abs_path.starts_with(&pair.source) {
                let rel = abs_path.strip_prefix(&pair.source).ok()?.to_owned();
                if rel.as_os_str().is_empty() {
                    return None;
                }
                Some(("source", rel))
            } else if abs_path.starts_with(&pair.destination) {
                let rel = abs_path.strip_prefix(&pair.destination).ok()?.to_owned();
                if rel.as_os_str().is_empty() {
                    return None;
                }
                Some(("dest", rel))
            } else {
                None
            }
        }
    }
}

fn try_handle_fs_event(
    pair: &SyncPair,
    abs_path: &Path,
    ignore: &IgnoreSet,
    db_conn: &Arc<Mutex<rusqlite::Connection>>,
    app: &AppHandle,
    kind: &EventKind,
) -> Result<(), Box<dyn std::error::Error>> {
    let (changed_side, rel_path) = match classify_event(pair, abs_path) {
        Some(v) => v,
        None => return Ok(()),
    };

    if pair.kind == Kind::Folder && ignore.is_ignored(&rel_path) {
        return Ok(());
    }

    let rel_str = rel_path.to_string_lossy().to_string();


    let (src_abs, dst_abs) = match pair.kind {
        Kind::File => {
            if changed_side == "source" {
                (pair.source.clone(), pair.destination.clone())
            } else {
                (pair.destination.clone(), pair.source.clone())
            }
        }
        Kind::Folder => {
            let src_root = if changed_side == "source" { &pair.source } else { &pair.destination };
            let dst_root = if changed_side == "source" { &pair.destination } else { &pair.source };
            (src_root.join(&rel_path), dst_root.join(&rel_path))
        }
    };


    if pair.direction == Direction::OneWay && changed_side != "source" {
        return Ok(());
    }

    match kind {
        EventKind::Remove(_) => {


            let target = if pair.kind == Kind::File {
                if changed_side == "source" { pair.destination.clone() } else { pair.source.clone() }
            } else {
                let dst_root = if changed_side == "source" { &pair.destination } else { &pair.source };
                dst_root.join(&rel_path)
            };
            do_delete(pair, &target, &rel_str, db_conn, app)?;
        }
        EventKind::Create(_) | EventKind::Modify(_) => {
            if !src_abs.exists() {
                return Ok(());
            }


            if src_abs.is_dir() {
                if pair.kind != Kind::Folder {
                    return Ok(());
                }
                let src_root = if changed_side == "source" { &pair.source } else { &pair.destination };
                let dst_root = if changed_side == "source" { &pair.destination } else { &pair.source };
                for entry in walkdir::WalkDir::new(&src_abs).follow_links(false).into_iter().flatten() {
                    if !entry.file_type().is_file() {
                        continue;
                    }
                    let abs = entry.path();
                    let inner_rel = match abs.strip_prefix(src_root) {
                        Ok(r) => r.to_path_buf(),
                        Err(_) => continue,
                    };
                    if ignore.is_ignored(&inner_rel) {
                        continue;
                    }
                    let inner_rel_str = inner_rel.to_string_lossy().to_string();
                    let inner_dst = dst_root.join(&inner_rel);
                    if let Err(e) = do_sync(pair, abs, &inner_dst, &inner_rel_str, db_conn, app) {
                        let _ = app.emit(
                            EVENT_SYNC_ERROR,
                            SyncErrorEvent {
                                pair_id: pair.id.to_string(),
                                op: "sync".into(),
                                path: inner_rel_str.clone(),
                                message: e.to_string(),
                                ts: now_ms(),
                            },
                        );
                    }
                }
                return Ok(());
            }
            if !src_abs.is_file() {
                return Ok(());
            }
            do_sync(pair, &src_abs, &dst_abs, &rel_str, db_conn, app)?;
        }
        _ => {}
    }

    Ok(())
}

fn do_delete(
    pair: &SyncPair,
    target_abs: &Path,
    rel_str: &str,
    db_conn: &Arc<Mutex<rusqlite::Connection>>,
    app: &AppHandle,
) -> Result<(), Box<dyn std::error::Error>> {
    if !target_abs.exists() {
        return Ok(());
    }
    delete_path(target_abs)?;
    let conn = db_conn.lock().unwrap();
    let _ = db::delete_snapshot(&conn, pair.id, rel_str);
    let id = db::insert_tombstone(&conn, pair.id, rel_str).unwrap_or(0);
    let _ = db::log_event(&conn, pair.id, "deleted", rel_str, None);
    drop(conn);

    emit_activity(app, pair.id, "deleted", rel_str);
    let _ = app.emit(
        EVENT_TOMBSTONE_ADDED,
        TombstoneEvent {
            id,
            pair_id: pair.id.to_string(),
            rel_path: rel_str.to_string(),
            deleted_at: now_ms(),
        },
    );
    Ok(())
}

fn do_sync(
    pair: &SyncPair,
    src_abs: &Path,
    dst_abs: &Path,
    rel_str: &str,
    db_conn: &Arc<Mutex<rusqlite::Connection>>,
    app: &AppHandle,
) -> Result<(), Box<dyn std::error::Error>> {


    {
        let conn = db_conn.lock().unwrap();
        let is_tomb = db::tombstone_exists(&conn, pair.id, rel_str).unwrap_or(false);
        if is_tomb {
            let auto = pair.auto_resume_paths.contains(rel_str);
            if auto {
                let _ = db::clear_tombstone(&conn, pair.id, rel_str);
                drop(conn);
                let _ = app.emit(
                    EVENT_TOMBSTONE_CLEARED,
                    serde_json::json!({ "pairId": pair.id.to_string(), "relPath": rel_str }),
                );
            } else {
                drop(conn);
                let _ = app.emit(
                    EVENT_RESPAWN_PROMPT,
                    RespawnPromptEvent {
                        pair_id: pair.id.to_string(),
                        rel_path: rel_str.to_string(),
                    },
                );
                return Ok(());
            }
        }
    }


    if pair.direction == Direction::TwoWay && dst_abs.exists() {
        let snap = {
            let conn = db_conn.lock().unwrap();
            db::load_snapshots(&conn, pair.id)
                .unwrap_or_default()
                .into_iter()
                .find(|s| s.rel_path == rel_str)
        };
        if let Some(snap) = snap {
            let src_hash = hash_file(src_abs).unwrap_or_default();
            let dst_hash = hash_file(dst_abs).unwrap_or_default();
            if src_hash == dst_hash {

                let mtime = mtime_ms(src_abs).unwrap_or(0);
                let conn = db_conn.lock().unwrap();
                let _ = db::upsert_snapshot(&conn, pair.id, rel_str, &src_hash, mtime);
                return Ok(());
            }
            let s_changed = src_hash != snap.hash;
            let d_changed = dst_hash != snap.hash;
            if s_changed && d_changed {
                let src_mtime = mtime_ms(src_abs).unwrap_or(0);
                let dst_mtime = mtime_ms(dst_abs).unwrap_or(0);
                let _ = app.emit(
                    EVENT_CONFLICT_PROMPT,
                    ConflictPromptEvent {
                        pair_id: pair.id.to_string(),
                        rel_path: rel_str.to_string(),
                        source_modified: src_mtime,
                        dest_modified: dst_mtime,
                    },
                );
                let conn = db_conn.lock().unwrap();
                let _ = db::log_event(&conn, pair.id, "conflict", rel_str, None);
                drop(conn);
                emit_activity(app, pair.id, "conflict", rel_str);
                return Ok(());
            }
        }
    }


    if dst_abs.exists() {
        let s = hash_file(src_abs).unwrap_or_default();
        let d = hash_file(dst_abs).unwrap_or_default();
        if !s.is_empty() && s == d {
            let mtime = mtime_ms(src_abs).unwrap_or(0);
            let conn = db_conn.lock().unwrap();
            let _ = db::upsert_snapshot(&conn, pair.id, rel_str, &s, mtime);
            return Ok(());
        }
    }

    copy_file(src_abs, dst_abs)?;
    let h = hash_file(src_abs).unwrap_or_default();
    let mtime = mtime_ms(src_abs).unwrap_or(0);
    let conn = db_conn.lock().unwrap();
    let _ = db::upsert_snapshot(&conn, pair.id, rel_str, &h, mtime);
    let _ = db::log_event(&conn, pair.id, "copied", rel_str, None);
    drop(conn);
    emit_activity(app, pair.id, "copied", rel_str);
    Ok(())
}
