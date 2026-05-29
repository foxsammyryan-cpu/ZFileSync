use std::{
    collections::HashMap,
    path::{Path, PathBuf},
};
use walkdir::WalkDir;

use super::{
    apply::{copy_file, delete_path, hash_file, mtime_ms},
    ignore::IgnoreSet,
};
use crate::db::{self, DbSnapshot};
use uuid::Uuid;

#[derive(Debug)]
struct FileEntry {
    abs: PathBuf,
    mtime: i64,
    hash: Option<String>,
}

fn scan(root: &Path, ignore: &IgnoreSet) -> HashMap<PathBuf, FileEntry> {
    let mut map = HashMap::new();
    if !root.exists() || !root.is_dir() {
        return map;
    }
    for entry in WalkDir::new(root).follow_links(false).into_iter().flatten() {
        if entry.file_type().is_dir() {
            continue;
        }
        let rel = match entry.path().strip_prefix(root) {
            Ok(r) => r.to_owned(),
            Err(_) => continue,
        };
        if ignore.is_ignored(&rel) {
            continue;
        }
        let abs = entry.path().to_owned();
        let mtime = mtime_ms(&abs).unwrap_or(0);
        map.insert(rel, FileEntry { abs, mtime, hash: None });
    }
    map
}

fn get_hash(entry: &mut FileEntry) -> &str {
    if entry.hash.is_none() {
        entry.hash = hash_file(&entry.abs);
    }
    entry.hash.as_deref().unwrap_or("")
}

fn files_differ(a: &mut FileEntry, b: &mut FileEntry) -> bool {
    if a.mtime != b.mtime {
        return get_hash(a) != get_hash(b);
    }
    false
}

pub struct ReconcileResult {
    pub copied: usize,
    pub deleted: usize,
    pub conflicts: Vec<PathBuf>,
    pub errors: Vec<(String, String)>,
}

impl ReconcileResult {
    fn new() -> Self {
        Self { copied: 0, deleted: 0, conflicts: vec![], errors: vec![] }
    }
}


pub fn reconcile_one_way_file(
    source: &Path,
    dest: &Path,
    conn: &rusqlite::Connection,
    pair_id: Uuid,
) -> ReconcileResult {
    let mut result = ReconcileResult::new();
    if !source.is_file() {
        result.errors.push((source.display().to_string(), "source file not found".into()));
        return result;
    }
    let src_hash = hash_file(source).unwrap_or_default();
    let src_mtime = mtime_ms(source).unwrap_or(0);

    let need_copy = if dest.exists() {
        let d_hash = hash_file(dest).unwrap_or_default();
        d_hash != src_hash
    } else {
        true
    };

    if need_copy {
        match copy_file(source, dest) {
            Ok(()) => {
                let _ = db::upsert_snapshot(conn, pair_id, "", &src_hash, src_mtime);
                result.copied += 1;
            }
            Err(e) => result.errors.push((dest.display().to_string(), e.to_string())),
        }
    }
    result
}

pub fn reconcile_two_way_file(
    source: &Path,
    dest: &Path,
    conn: &rusqlite::Connection,
    pair_id: Uuid,
) -> ReconcileResult {
    let mut result = ReconcileResult::new();
    let s_exists = source.is_file();
    let d_exists = dest.is_file();


    let snap = db::load_snapshots(conn, pair_id)
        .unwrap_or_default()
        .into_iter()
        .find(|s| s.rel_path.is_empty());
    let snap_hash = snap.map(|s| s.hash).unwrap_or_default();

    match (s_exists, d_exists) {
        (true, true) => {
            let s_hash = hash_file(source).unwrap_or_default();
            let d_hash = hash_file(dest).unwrap_or_default();
            let s_changed = s_hash != snap_hash;
            let d_changed = d_hash != snap_hash;
            if s_hash == d_hash {

                let m = mtime_ms(source).unwrap_or(0);
                let _ = db::upsert_snapshot(conn, pair_id, "", &s_hash, m);
            } else if s_changed && !d_changed {
                match copy_file(source, dest) {
                    Ok(()) => {
                        let m = mtime_ms(source).unwrap_or(0);
                        let _ = db::upsert_snapshot(conn, pair_id, "", &s_hash, m);
                        result.copied += 1;
                    }
                    Err(e) => result.errors.push((dest.display().to_string(), e.to_string())),
                }
            } else if d_changed && !s_changed {
                match copy_file(dest, source) {
                    Ok(()) => {
                        let m = mtime_ms(dest).unwrap_or(0);
                        let _ = db::upsert_snapshot(conn, pair_id, "", &d_hash, m);
                        result.copied += 1;
                    }
                    Err(e) => result.errors.push((source.display().to_string(), e.to_string())),
                }
            } else if s_changed && d_changed {
                result.conflicts.push(PathBuf::new());
            }
        }
        (true, false) => match copy_file(source, dest) {
            Ok(()) => {
                let h = hash_file(source).unwrap_or_default();
                let m = mtime_ms(source).unwrap_or(0);
                let _ = db::upsert_snapshot(conn, pair_id, "", &h, m);
                result.copied += 1;
            }
            Err(e) => result.errors.push((dest.display().to_string(), e.to_string())),
        },
        (false, true) => match copy_file(dest, source) {
            Ok(()) => {
                let h = hash_file(dest).unwrap_or_default();
                let m = mtime_ms(dest).unwrap_or(0);
                let _ = db::upsert_snapshot(conn, pair_id, "", &h, m);
                result.copied += 1;
            }
            Err(e) => result.errors.push((source.display().to_string(), e.to_string())),
        },
        (false, false) => {}
    }
    result
}


pub fn reconcile_one_way(
    source: &Path,
    dest: &Path,
    ignore: &IgnoreSet,
    conn: &rusqlite::Connection,
    pair_id: Uuid,
) -> ReconcileResult {
    let mut src_map = scan(source, ignore);
    let mut dst_map = scan(dest, ignore);
    let mut result = ReconcileResult::new();

    let src_keys: Vec<PathBuf> = src_map.keys().cloned().collect();
    for rel in src_keys {
        let src_entry = src_map.get_mut(&rel).unwrap();
        let dst_abs = dest.join(&rel);
        let rel_str = rel.to_string_lossy().to_string();

        let need_copy = match dst_map.get_mut(&rel) {
            Some(dst_entry) => files_differ(src_entry, dst_entry),
            None => true,
        };

        if need_copy {
            match copy_file(&src_entry.abs, &dst_abs) {
                Ok(()) => {
                    let mtime = mtime_ms(&src_entry.abs).unwrap_or(0);
                    let h = get_hash(src_entry).to_string();
                    let _ = db::upsert_snapshot(conn, pair_id, &rel_str, &h, mtime);
                    result.copied += 1;
                }
                Err(e) => result.errors.push((dst_abs.display().to_string(), e.to_string())),
            }
        }
    }

    let dst_keys: Vec<PathBuf> = dst_map.keys().cloned().collect();
    for rel in dst_keys {
        if !src_map.contains_key(&rel) {
            let dst_entry = dst_map.get(&rel).unwrap();
            let rel_str = rel.to_string_lossy().to_string();
            match delete_path(&dst_entry.abs) {
                Ok(()) => {
                    let _ = db::delete_snapshot(conn, pair_id, &rel_str);
                    result.deleted += 1;
                }
                Err(e) => result.errors.push((dst_entry.abs.display().to_string(), e.to_string())),
            }
        }
    }

    result
}

pub fn reconcile_two_way(
    source: &Path,
    dest: &Path,
    ignore: &IgnoreSet,
    conn: &rusqlite::Connection,
    pair_id: Uuid,
) -> ReconcileResult {
    let mut src_map = scan(source, ignore);
    let mut dst_map = scan(dest, ignore);
    let snapshots: HashMap<PathBuf, DbSnapshot> = db::load_snapshots(conn, pair_id)
        .unwrap_or_default()
        .into_iter()
        .map(|s| (PathBuf::from(&s.rel_path), s))
        .collect();

    let mut result = ReconcileResult::new();

    let all_keys: std::collections::HashSet<PathBuf> = src_map
        .keys()
        .chain(dst_map.keys())
        .cloned()
        .collect();

    for rel in all_keys {
        let snap = snapshots.get(&rel);
        let rel_str = rel.to_string_lossy().to_string();
        let snap_hash = snap.map(|sn| sn.hash.as_str()).unwrap_or("");

        match (src_map.get_mut(&rel), dst_map.get_mut(&rel)) {
            (Some(s), Some(d)) => {
                let s_hash = get_hash(s).to_string();
                let d_hash = get_hash(d).to_string();
                if s_hash == d_hash {
                    let _ = db::upsert_snapshot(conn, pair_id, &rel_str, &s_hash, s.mtime);
                    continue;
                }
                let s_changed = s_hash != snap_hash;
                let d_changed = d_hash != snap_hash;
                if s_changed && !d_changed {
                    match copy_file(&s.abs, &dest.join(&rel)) {
                        Ok(()) => {
                            let _ = db::upsert_snapshot(conn, pair_id, &rel_str, &s_hash, s.mtime);
                            result.copied += 1;
                        }
                        Err(e) => result.errors.push((dest.join(&rel).display().to_string(), e.to_string())),
                    }
                } else if d_changed && !s_changed {
                    match copy_file(&d.abs, &source.join(&rel)) {
                        Ok(()) => {
                            let _ = db::upsert_snapshot(conn, pair_id, &rel_str, &d_hash, d.mtime);
                            result.copied += 1;
                        }
                        Err(e) => result.errors.push((source.join(&rel).display().to_string(), e.to_string())),
                    }
                } else {
                    result.conflicts.push(rel);
                }
            }
            (Some(s), None) => {
                let s_hash = get_hash(s).to_string();
                if snap.is_none() || s_hash != snap_hash {
                    match copy_file(&s.abs, &dest.join(&rel)) {
                        Ok(()) => {
                            let _ = db::upsert_snapshot(conn, pair_id, &rel_str, &s_hash, s.mtime);
                            result.copied += 1;
                        }
                        Err(e) => result.errors.push((dest.join(&rel).display().to_string(), e.to_string())),
                    }
                } else {
                    match delete_path(&s.abs) {
                        Ok(()) => {
                            let _ = db::delete_snapshot(conn, pair_id, &rel_str);
                            result.deleted += 1;
                        }
                        Err(e) => result.errors.push((s.abs.display().to_string(), e.to_string())),
                    }
                }
            }
            (None, Some(d)) => {
                let d_hash = get_hash(d).to_string();
                if snap.is_none() || d_hash != snap_hash {
                    match copy_file(&d.abs, &source.join(&rel)) {
                        Ok(()) => {
                            let _ = db::upsert_snapshot(conn, pair_id, &rel_str, &d_hash, d.mtime);
                            result.copied += 1;
                        }
                        Err(e) => result.errors.push((source.join(&rel).display().to_string(), e.to_string())),
                    }
                } else {
                    match delete_path(&d.abs) {
                        Ok(()) => {
                            let _ = db::delete_snapshot(conn, pair_id, &rel_str);
                            result.deleted += 1;
                        }
                        Err(e) => result.errors.push((d.abs.display().to_string(), e.to_string())),
                    }
                }
            }
            (None, None) => {}
        }
    }

    result
}
