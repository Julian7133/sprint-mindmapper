use std::fs;
use std::io;
use std::io::Write;
use std::path::{Path, PathBuf};

/// Split + validate a workspace-relative path. Only relative paths made of
/// plain segments are accepted; empty/dot/`..`/absolute/backslash paths are
/// rejected so a webview value can never name a file outside `root_dir`.
fn rel_segments(rel: &str) -> Result<Vec<String>, String> {
    let raw = rel.replace('\\', "/");
    let trimmed = raw.trim_matches('/');
    if trimmed.is_empty() || raw.starts_with('/') {
        return Err("path must be relative to the opened folder".to_string());
    }
    let mut segs = Vec::new();
    for seg in trimmed.split('/') {
        if seg.is_empty() || seg == "." || seg == ".." {
            return Err(format!("invalid path segment: {seg:?}"));
        }
        segs.push(seg.to_string());
    }
    if segs.is_empty() {
        return Err("empty path".to_string());
    }
    Ok(segs)
}

/// Canonicalize the opened root so every later containment check compares
/// against a symlink-resolved, absolute base.
fn canonical_root(root_dir: &str) -> Result<PathBuf, String> {
    fs::canonicalize(root_dir).map_err(|e| format!("folder unavailable ({root_dir}): {e}"))
}

/// Walk the directory components of `rel`, creating + canonicalizing each so a
/// symlinked directory that points outside the root is rejected. Returns the
/// canonical parent directory plus the final file/dir name.
fn resolve_parent(
    canonical_root: &Path,
    rel: &str,
    create: bool,
) -> Result<(PathBuf, String), String> {
    let segs = rel_segments(rel)?;
    let (file, dirs) = segs.split_last().ok_or_else(|| "empty path".to_string())?;
    let mut cur = canonical_root.to_path_buf();
    for d in dirs {
        let candidate = cur.join(d);
        match fs::canonicalize(&candidate) {
            Ok(real) if real.starts_with(canonical_root) => {
                cur = real;
            }
            Ok(_) => return Err("path escapes the opened folder".to_string()),
            Err(_) if create => {
                // Missing leaf dir: create it under the already-confined parent.
                fs::create_dir(&candidate).map_err(|e| format!("create dir {candidate:?}: {e}"))?;
                let real =
                    fs::canonicalize(&candidate).map_err(|e| format!("{candidate:?}: {e}"))?;
                if !real.starts_with(canonical_root) {
                    return Err("path escapes the opened folder".to_string());
                }
                cur = real;
            }
            Err(e) => return Err(format!("{candidate:?}: {e}")),
        }
    }
    Ok((cur, file.clone()))
}

/// Resolve a workspace-relative path to a concrete absolute target that is
/// guaranteed to live inside `root_dir` once fully canonicalized (this defeats
/// both directory and file symlinks that point outside the root). Missing
/// files are resolved through their (existing) canonical parent.
fn confined_target(root_dir: &str, rel: &str, create: bool) -> Result<PathBuf, String> {
    let root = canonical_root(root_dir)?;
    let (parent, file) = resolve_parent(&root, rel, create)?;
    let candidate = parent.join(&file);
    // If the target exists, resolve it fully (handles a file-level symlink
    // pointing outside) and require containment.
    match fs::canonicalize(&candidate) {
        Ok(real) if real.starts_with(&root) => Ok(real),
        Ok(_) => Err("path escapes the opened folder".to_string()),
        Err(_) => {
            if parent.starts_with(&root) {
                Ok(candidate)
            } else {
                Err("path escapes the opened folder".to_string())
            }
        }
    }
}

fn basename_of(rel: &str) -> Result<String, String> {
    Ok(rel_segments(rel)?
        .split_last()
        .ok_or_else(|| "empty path".to_string())?
        .0
        .clone())
}

/// Recursively list markdown files under `root_dir` as relative paths,
/// mirroring the browser folder backend's rules: skip hidden entries and
/// `node_modules`, include only `*.md` files that are not `.editor-draft`.
/// The root is canonicalized first so traversal never leaves the real folder.
#[tauri::command]
pub fn list_markdown(root_dir: String) -> Result<Vec<String>, String> {
    let root = canonical_root(&root_dir)?;
    let mut out = Vec::new();
    walk(&root, &root, &mut out).map_err(|e| e.to_string())?;
    out.sort();
    Ok(out)
}

fn walk(root: &Path, dir: &Path, out: &mut Vec<String>) -> io::Result<()> {
    for entry in fs::read_dir(dir)? {
        let entry = entry?;
        let path = entry.path();
        let name = entry.file_name().to_string_lossy().into_owned();

        if name.starts_with('.') || name == "node_modules" {
            continue;
        }

        let file_type = entry.file_type()?;
        if file_type.is_dir() {
            walk(root, &path, out)?;
        } else if name.to_ascii_lowercase().ends_with(".md") && !name.ends_with(".editor-draft") {
            let rel = path
                .strip_prefix(root)
                .map_err(|e| io::Error::new(io::ErrorKind::InvalidInput, e.to_string()))?
                .to_string_lossy()
                .replace('\\', "/");
            out.push(rel);
        }
    }
    Ok(())
}

#[tauri::command]
pub fn read_text_file(root_dir: String, rel_path: String) -> Result<String, String> {
    let target = confined_target(&root_dir, &rel_path, false)?;
    fs::read_to_string(&target).map_err(|e| format!("{}: {e}", target.display()))
}

/// Write `text` to `rel_path` under `root_dir` atomically: content goes to a
/// same-directory temporary file which is fsync'd and then renamed over the
/// target. This avoids torn/partial files on crash and — because `rename` does
/// not follow a symlink — cannot write through a file symlink to outside the
/// opened folder.
#[tauri::command]
pub fn write_text_file(root_dir: String, rel_path: String, text: String) -> Result<(), String> {
    let root = canonical_root(&root_dir)?;
    let (parent, _) = resolve_parent(&root, &rel_path, true)?;
    let file = basename_of(&rel_path)?;

    let tmp = parent.join(format!(
        ".{file}.{}.{}.tmp",
        std::process::id(),
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map_err(|e| e.to_string())?
            .as_nanos()
    ));

    let write_res = (|| -> io::Result<()> {
        let mut f = fs::File::create(&tmp)?;
        f.write_all(text.as_bytes())?;
        f.sync_all()?;
        drop(f);
        fs::rename(&tmp, &parent.join(&file))?;
        Ok(())
    })();

    if let Err(e) = write_res {
        let _ = fs::remove_file(&tmp);
        return Err(format!("{}: {e}", parent.join(&file).display()));
    }
    Ok(())
}

#[tauri::command]
pub fn delete_file(root_dir: String, rel_path: String) -> Result<(), String> {
    let target = confined_target(&root_dir, &rel_path, false)?;
    fs::remove_file(&target).map_err(|e| format!("{}: {e}", target.display()))
}

#[tauri::command]
pub fn path_exists(root_dir: String, rel_path: String) -> bool {
    confined_target(&root_dir, &rel_path, false).is_ok_and(|p| p.exists())
}

/// Open the generated markmap HTML for a workspace file in the OS default app.
///
/// The path is resolved through the same `confined_target` used by the other
/// fs commands (traversal + symlink escapes are rejected) and opened via the
/// opener plugin on the Rust side, so the webview needs no `open_path`
/// permission and can never ask to open an arbitrary path.
#[tauri::command]
pub fn open_markmap_in_default_app(
    app: tauri::AppHandle,
    root_dir: String,
    rel_path: String,
) -> Result<(), String> {
    use tauri_plugin_opener::OpenerExt;
    let target = confined_target(&root_dir, &rel_path, false)?;
    app.opener()
        .open_path(target.display().to_string(), None::<&str>)
        .map_err(|e| format!("open failed: {e}"))
}
