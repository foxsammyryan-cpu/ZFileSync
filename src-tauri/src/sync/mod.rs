pub mod apply;
pub mod ignore;
pub mod pair;
pub mod reconcile;
pub mod watcher;

use std::{
    collections::HashMap,
    sync::{
        atomic::{AtomicBool, Ordering},
        Arc, Mutex,
    },
};
use tauri::{AppHandle, Emitter};
use uuid::Uuid;

use pair::{Direction, Kind, PairStatus, SyncPair};
use watcher::spawn_watcher;

use crate::{
    db,
    events::{SyncErrorEvent, EVENT_PAIR_STATUS, EVENT_SYNC_ERROR},
};

fn now_ms() -> i64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_millis() as i64)
        .unwrap_or(0)
}

fn emit_pair_status(app: &AppHandle, pair_id: Uuid, status: &str) {
    let _ = app.emit(
        EVENT_PAIR_STATUS,
        serde_json::json!({ "pairId": pair_id.to_string(), "status": status }),
    );
}

fn emit_sync_error(app: &AppHandle, pair_id: Uuid, op: &str, path: &str, message: &str) {
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

struct ActiveEntry {
    pub pair: SyncPair,
    stop_flag: Option<Arc<AtomicBool>>,
    handle: Option<std::thread::JoinHandle<()>>,
}

pub struct SyncManager {
    entries: HashMap<Uuid, ActiveEntry>,
    pub db: Arc<Mutex<rusqlite::Connection>>,
    app: AppHandle,
}

impl SyncManager {
    pub fn new(db: Arc<Mutex<rusqlite::Connection>>, app: AppHandle) -> Self {
        Self { entries: HashMap::new(), db, app }
    }

    pub fn load_and_start_all(&mut self, pairs: Vec<SyncPair>) {
        for pair in pairs {
            if pair.status == PairStatus::Paused {
                self.entries.insert(
                    pair.id,
                    ActiveEntry { pair, stop_flag: None, handle: None },
                );
            } else {
                self.start_pair(pair);
            }
        }
    }

    pub fn add_pair(&mut self, pair: SyncPair) {
        let conn = self.db.lock().unwrap();
        let _ = db::insert_pair(&conn, &pair);
        drop(conn);
        self.start_pair(pair);
    }

    pub fn remove_pair(&mut self, id: Uuid) -> bool {
        self.stop_entry(id);
        self.entries.remove(&id);
        let conn = self.db.lock().unwrap();
        let _ = db::delete_pair(&conn, id);
        true
    }

    pub fn pause_pair(&mut self, id: Uuid) -> bool {
        self.stop_entry(id);
        if let Some(entry) = self.entries.get_mut(&id) {
            entry.pair.status = PairStatus::Paused;
            let conn = self.db.lock().unwrap();
            let _ = db::update_pair_status(&conn, id, &PairStatus::Paused);
        }
        emit_pair_status(&self.app, id, "paused");
        true
    }

    pub fn resume_pair(&mut self, id: Uuid) -> bool {
        let pair = match self.entries.get(&id) {
            Some(e) => e.pair.clone(),
            None => return false,
        };
        self.start_pair(pair);
        true
    }

    pub fn list_pairs(&self) -> Vec<SyncPair> {
        self.entries.values().map(|e| e.pair.clone()).collect()
    }

    pub fn get_pair(&self, id: Uuid) -> Option<SyncPair> {
        self.entries.get(&id).map(|e| e.pair.clone())
    }

    pub fn update_auto_resume(&mut self, id: Uuid, rel_path: String, always: bool) {
        if let Some(entry) = self.entries.get_mut(&id) {
            if always {
                entry.pair.auto_resume_paths.insert(rel_path);
            }
            let conn = self.db.lock().unwrap();
            let _ = db::update_pair_auto_resume(&conn, &entry.pair);
        }
    }

    fn start_pair(&mut self, mut pair: SyncPair) {
        let id = pair.id;


        let reconcile_errors = {
            let conn = self.db.lock().unwrap();
            let ignore = crate::sync::ignore::IgnoreSet::new(&pair.ignore);


            match pair.kind {
                Kind::File => {
                    if let Some(parent) = pair.destination.parent() {
                        if !parent.as_os_str().is_empty() && !parent.exists() {
                            let _ = std::fs::create_dir_all(parent);
                        }
                    }
                }
                Kind::Folder => {
                    if !pair.destination.exists() {
                        let _ = std::fs::create_dir_all(&pair.destination);
                    }
                }
            }

            let result = match (pair.kind.clone(), pair.direction.clone()) {
                (Kind::File, Direction::OneWay) => {
                    reconcile::reconcile_one_way_file(&pair.source, &pair.destination, &conn, id)
                }
                (Kind::File, Direction::TwoWay) => {
                    reconcile::reconcile_two_way_file(&pair.source, &pair.destination, &conn, id)
                }
                (Kind::Folder, Direction::OneWay) => {
                    if pair.source.is_dir() {
                        reconcile::reconcile_one_way(&pair.source, &pair.destination, &ignore, &conn, id)
                    } else {
                        reconcile::ReconcileResult { copied: 0, deleted: 0, conflicts: vec![], errors: vec![(pair.source.display().to_string(), "source folder missing".into())] }
                    }
                }
                (Kind::Folder, Direction::TwoWay) => {
                    reconcile::reconcile_two_way(&pair.source, &pair.destination, &ignore, &conn, id)
                }
            };
            result.errors
        };

        for (path, msg) in &reconcile_errors {
            emit_sync_error(&self.app, id, "reconcile", path, msg);
            let conn = self.db.lock().unwrap();
            let _ = db::log_event(&conn, id, "error", path, Some(msg));
        }


        let new_status = if reconcile_errors.is_empty() {
            PairStatus::Syncing
        } else {
            PairStatus::Error
        };
        pair.status = new_status.clone();
        {
            let conn = self.db.lock().unwrap();
            let _ = db::update_pair_status(&conn, id, &new_status);
        }
        emit_pair_status(
            &self.app,
            id,
            if reconcile_errors.is_empty() { "syncing" } else { "error" },
        );


        let stop_flag = Arc::new(AtomicBool::new(false));
        let handle = spawn_watcher(
            pair.clone(),
            Arc::clone(&self.db),
            self.app.clone(),
            Arc::clone(&stop_flag),
        );

        self.entries.insert(
            id,
            ActiveEntry { pair, stop_flag: Some(stop_flag), handle: Some(handle) },
        );
    }

    fn stop_entry(&mut self, id: Uuid) {
        if let Some(entry) = self.entries.get_mut(&id) {
            if let Some(flag) = entry.stop_flag.take() {
                flag.store(true, Ordering::Relaxed);
            }
            entry.handle.take();
        }
    }
}
