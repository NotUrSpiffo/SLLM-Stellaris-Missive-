"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseVersion = parseVersion;
exports.compareVersions = compareVersions;
exports.descriptorVersion = descriptorVersion;
exports.versionCheck = versionCheck;
/** "0.1.0-alpha.5" → [0,1,0,'alpha',5], "0.1.0-alpha.5.5" → 번호 5 + 하위 5(알파 5.1·5.5 처럼 점이 하나 더 붙는 표기). 읽을 수 없으면 null. */
function parseVersion(v) {
    const m = /^\s*v?(\d+)\.(\d+)\.(\d+)(?:-([A-Za-z]+)(?:\.?(\d+)(?:\.(\d+))?)?)?\s*$/.exec(String(v ?? ''));
    if (!m)
        return null;
    return { nums: [Number(m[1]), Number(m[2]), Number(m[3])], tag: (m[4] || '').toLowerCase(), tagNum: m[5] ? Number(m[5]) : 0, sub: m[6] ? Number(m[6]) : 0 };
}
const TAG_RANK = { alpha: 1, beta: 2, rc: 3, '': 4 }; // 정식(태그 없음)이 가장 높다
/** a<b → -1, 같음 → 0, a>b → 1. 읽을 수 없으면 null. */
function compareVersions(a, b) {
    const x = parseVersion(a), y = parseVersion(b);
    if (!x || !y)
        return null;
    for (let i = 0; i < 3; i++)
        if (x.nums[i] !== y.nums[i])
            return x.nums[i] < y.nums[i] ? -1 : 1;
    const rx = TAG_RANK[x.tag] ?? 0, ry = TAG_RANK[y.tag] ?? 0;
    if (rx !== ry)
        return rx < ry ? -1 : 1;
    if (x.tagNum !== y.tagNum)
        return x.tagNum < y.tagNum ? -1 : 1;
    if (x.sub !== y.sub)
        return x.sub < y.sub ? -1 : 1;
    return 0;
}
/** descriptor.mod 본문에서 version="…" 을 꺼낸다. */
function descriptorVersion(text) {
    const m = /^\s*version\s*=\s*"([^"]+)"/m.exec(text);
    return m ? m[1].trim() : null;
}
/** 게임이 알려 준 버전(있으면)을 먼저, 없으면 모드 폴더의 descriptor.mod 버전을 쓴다. */
function versionCheck(appVersion, runtimeVersion, fileVersion) {
    const run = runtimeVersion && runtimeVersion !== '?' ? runtimeVersion : null;
    const modVersion = run ?? fileVersion ?? null, source = run ? 'game' : fileVersion ? 'file' : null;
    const c = compareVersions(modVersion, appVersion);
    if (c === null)
        return { status: 'unknown', appVersion, modVersion, source, message: null };
    if (c === 0)
        return { status: 'same', appVersion, modVersion, source, message: null };
    if (c > 0)
        return { status: 'mod_newer', appVersion, modVersion, source, message: `연결 모드(${modVersion})가 앱(${appVersion})보다 새 버전입니다. 앱 업데이트 알림이 뜨면 「업데이트」를 눌러 주세요. 알림이 없으면 새 설치 프로그램을 받아 설치해 주세요.` };
    return { status: 'mod_older', appVersion, modVersion, source, message: `연결 모드(${modVersion})가 앱(${appVersion})보다 낮은 버전입니다. 모드를 최신으로 업데이트해 주세요.` };
}
//# sourceMappingURL=version-check.js.map