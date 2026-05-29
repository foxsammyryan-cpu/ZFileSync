use globset::{Glob, GlobSet, GlobSetBuilder};
use std::path::Path;

pub struct IgnoreSet {
    set: GlobSet,
}

impl IgnoreSet {
    pub fn new(patterns: &[String]) -> Self {
        let mut builder = GlobSetBuilder::new();
        let defaults = ["node_modules", ".git", "*.tmp", "*.swp", "*.lock", "~*"];
        for pat in defaults.iter().copied().chain(patterns.iter().map(|s| s.as_str())) {
            if let Ok(g) = Glob::new(pat) {
                builder.add(g);
            }
        }
        let set = builder.build().unwrap_or_else(|_| GlobSet::empty());
        Self { set }
    }

    pub fn is_ignored(&self, rel_path: &Path) -> bool {
        if self.set.is_match(rel_path) {
            return true;
        }

        for component in rel_path.components() {
            let s = component.as_os_str().to_string_lossy();
            if self.set.is_match(Path::new(s.as_ref())) {
                return true;
            }
        }
        false
    }
}
