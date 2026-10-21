// SLLM 앱 업데이트 묶음 만들기(2026-10-18). 설치기_만들기.bat → make-installer.ps1 이 부른다. 손으로 부를 때:
//   node tools\make-app-update.js key    <payload\app> <실행 앱>      서명 키 준비 + 공개 키를 두 앱 폴더에 넣기
//   node tools\make-app-update.js bundle <payload\app> <모드 폴더>... 모드 폴더\sllm_app_update 에 앱 파일·manifest·서명 만들기
// 개인 키: %USERPROFILE%\.sllm\update-signing-key.pem (개발 폴더 밖, 업로드·공유 금지). 잃어버리면 기존 사용자는 설치기를 한 번 다시 받아야 한다.
// 앱 쪽 확인 규칙은 payload/app/src/app-update-core.ts (UPDATE_TOP 이 같아야 함).
'use strict';
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');

const UPDATE_DIR = 'sllm_app_update';
const PUBLIC_KEY_FILE = 'update-public-key.pem';
const TOP = ['dist', 'ui', 'native', 'example', 'package.json', 'start_app.bat', 'portrait-library.pak',
  'README_KO.md', 'ALPHA_SETUP_KO.md', 'ALPHA_SETUP_EN.md', 'RELEASE_NOTES_KO.md', 'RELEASE_NOTES_EN.md'];
const keyFile = process.env.SLLM_UPDATE_KEY || path.join(os.homedir(), '.sllm', 'update-signing-key.pem');

function fail(t) { console.error('  [업데이트 묶음] ' + t); process.exit(1); }
function sha256(f) { return crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex'); }
function publicPem(priv) { return crypto.createPublicKey(priv).export({ type: 'spki', format: 'pem' }).toString(); }

function ensureKey(appDirs) {
  if (!fs.existsSync(keyFile)) {
    // 이미 공개 키가 든 앱이 있으면 새 키를 만들지 않는다(다른 PC 에서 키 없이 돌리면 기존 사용자 업데이트가 끊김).
    const had = appDirs.map((d) => path.join(d, PUBLIC_KEY_FILE)).filter((f) => fs.existsSync(f));
    if (had.length && process.env.SLLM_UPDATE_NEW_KEY !== '1') fail('이 PC 에 서명 키가 없습니다: ' + keyFile + '\n  원래 PC 의 같은 위치에서 update-signing-key.pem 을 복사해 오세요. (정말 새 키로 바꾸려면 SLLM_UPDATE_NEW_KEY=1 — 기존 사용자는 설치기를 다시 받아야 함)');
    const { privateKey } = crypto.generateKeyPairSync('ed25519');
    fs.mkdirSync(path.dirname(keyFile), { recursive: true });
    fs.writeFileSync(keyFile, privateKey.export({ type: 'pkcs8', format: 'pem' }), { mode: 0o600, flag: 'wx' });
    console.log('  새 업데이트 서명 키를 만들었습니다: ' + keyFile);
    console.log('  이 파일은 꼭 따로 백업해 두세요(공유·업로드 금지). 잃어버리면 사용자들이 설치기를 한 번 다시 받아야 합니다.');
  }
  const pub = publicPem(fs.readFileSync(keyFile, 'utf8'));
  for (const d of appDirs) {
    if (!fs.existsSync(d)) continue;
    const f = path.join(d, PUBLIC_KEY_FILE);
    if (!fs.existsSync(f) || fs.readFileSync(f, 'utf8') !== pub) { fs.writeFileSync(f, pub); console.log('  공개 키 넣음: ' + f); }
  }
}

function walk(root, rel, out) {
  const abs = path.join(root, ...rel.split('/'));
  const st = fs.statSync(abs);
  if (st.isDirectory()) { for (const n of fs.readdirSync(abs).sort()) walk(root, rel + '/' + n, out); }
  else if (st.isFile()) out.push(rel);
}

function bundle(appDir, modDirs) {
  if (!fs.existsSync(keyFile)) fail('서명 키가 없습니다: ' + keyFile + ' (먼저 key 단계를 실행하세요)');
  const priv = fs.readFileSync(keyFile, 'utf8');
  const shipped = path.join(appDir, PUBLIC_KEY_FILE);
  if (!fs.existsSync(shipped) || fs.readFileSync(shipped, 'utf8') !== publicPem(priv)) fail('앱의 ' + PUBLIC_KEY_FILE + ' 가 서명 키와 맞지 않습니다.');
  if (!fs.existsSync(path.join(appDir, 'dist', 'main.js'))) fail('dist\\main.js 가 없습니다. 빌드 뒤에 실행하세요.');
  const version = JSON.parse(fs.readFileSync(path.join(appDir, 'package.json'), 'utf8')).version;
  const files = [];
  for (const t of TOP) if (fs.existsSync(path.join(appDir, t))) walk(appDir, t, files);
  const list = files.filter((p) => !/(^|\/)\.git(\/|$)|\.sllm-new$/.test(p)).map((p) => {
    const f = path.join(appDir, ...p.split('/'));
    return { path: p, size: fs.statSync(f).size, sha256: sha256(f) };
  });
  const manifest = Buffer.from(JSON.stringify({ format: 1, app: 'sllm', version, created: new Date().toISOString(), files: list }, null, 1), 'utf8');
  const sig = crypto.sign(null, manifest, priv).toString('base64');
  let n = 0;
  for (const mod of modDirs) {
    if (!fs.existsSync(mod)) { console.log('  (건너뜀, 폴더 없음) ' + mod); continue; }
    const out = path.join(mod, UPDATE_DIR);
    fs.rmSync(out, { recursive: true, force: true });
    for (const f of list) { const dst = path.join(out, ...f.path.split('/')); fs.mkdirSync(path.dirname(dst), { recursive: true }); fs.copyFileSync(path.join(appDir, ...f.path.split('/')), dst); }
    fs.writeFileSync(path.join(out, 'manifest.json'), manifest);
    fs.writeFileSync(path.join(out, 'manifest.sig'), sig + '\n');
    const mb = list.reduce((a, f) => a + f.size, 0) / 1048576;
    console.log('  ' + out + '  (' + version + ', 파일 ' + list.length + '개, ' + mb.toFixed(1) + ' MB)'); n++;
  }
  if (!n) fail('묶음을 넣을 모드 폴더가 없습니다: ' + modDirs.join(' / '));
}

const [cmd, appDir, ...rest] = process.argv.slice(2);
if (cmd === 'key' && appDir) ensureKey([appDir, ...rest]);
else if (cmd === 'bundle' && appDir && rest.length) bundle(appDir, rest);
else if (cmd === 'check' && appDir && rest.length) { // check <키 파일> <앱 폴더>: 키가 앱의 공개 키와 짝인지(서명키_옮기기.bat)
  let pub; try { pub = publicPem(fs.readFileSync(appDir, 'utf8')); } catch { fail('서명 키 파일을 읽지 못했습니다: ' + appDir); }
  const f = path.join(rest[0], PUBLIC_KEY_FILE);
  if (!fs.existsSync(f)) { console.log('NOPUB'); process.exit(0); }
  console.log(fs.readFileSync(f, 'utf8') === pub ? 'MATCH' : 'MISMATCH');
}
else fail('사용법: node make-app-update.js key <payload\\app> [실행 앱]  |  bundle <payload\\app> <모드 폴더>...  |  check <키 파일> <앱 폴더>');
