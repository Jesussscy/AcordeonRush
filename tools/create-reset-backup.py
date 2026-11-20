"""Preserve the project, including ignored local assets, before a computer reset."""
from pathlib import Path
import hashlib, json, subprocess, sys, zipfile

ROOT = Path(__file__).resolve().parents[1]
DEST = ROOT / 'backups' / 'reset-2026-11-20'
ARCHIVE = DEST / 'AcordeonRush-full-project.zip'
EXCLUDED = {'.git', 'node_modules', 'backups', '__pycache__'}

def digest(data):
    return hashlib.sha256(data).hexdigest()

def verify():
    with zipfile.ZipFile(ARCHIVE) as archive:
        assert archive.testzip() is None
        manifest = json.loads(archive.read('BACKUP-MANIFEST.json'))
        names = archive.namelist()
        assert len(names) == len(set(names))
        for item in manifest['files']:
            data = archive.read('AcordeonRush/' + item['path'])
            assert len(data) == item['bytes'] and digest(data) == item['sha256'], item['path']
    print(json.dumps({'verified_files': len(manifest['files']), 'archive_bytes': ARCHIVE.stat().st_size, 'sha256': digest(ARCHIVE.read_bytes())}))

if '--verify' in sys.argv:
    verify()
    raise SystemExit(0)

DEST.mkdir(parents=True, exist_ok=True)
commit = subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=ROOT, text=True).strip()
manifest = {'project': 'AcordeonRush', 'backup_date': '2026-11-20', 'source_commit': commit,
            'excluded_directory_names': sorted(EXCLUDED),
            'scope': 'All project files, including ignored files; browser-only storage and files outside the project are not included.',
            'files': []}
paths = sorted(p for p in ROOT.rglob('*') if p.is_file() and not any(part in EXCLUDED for part in p.relative_to(ROOT).parts))
with zipfile.ZipFile(ARCHIVE, 'w', zipfile.ZIP_DEFLATED, compresslevel=6) as archive:
    for path in paths:
        data = path.read_bytes()
        relative = path.relative_to(ROOT).as_posix()
        manifest['files'].append({'path': relative, 'bytes': len(data), 'sha256': digest(data)})
        archive.writestr('AcordeonRush/' + relative, data)
    archive.writestr('BACKUP-MANIFEST.json', json.dumps(manifest, indent=2, ensure_ascii=False))
(DEST / 'manifest.json').write_text(json.dumps(manifest, indent=2, ensure_ascii=False), encoding='utf8')
subprocess.run(['git', 'bundle', 'create', str(DEST / 'history.bundle'), '--all'], cwd=ROOT, check=True)
subprocess.run(['git', 'bundle', 'verify', str(DEST / 'history.bundle')], cwd=ROOT, check=True)
checks = {p.name: digest(p.read_bytes()) for p in [ARCHIVE, DEST / 'history.bundle', DEST / 'manifest.json']}
(DEST / 'SHA256SUMS.json').write_text(json.dumps(checks, indent=2), encoding='utf8')
verify()
