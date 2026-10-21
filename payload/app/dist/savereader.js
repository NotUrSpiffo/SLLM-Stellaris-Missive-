"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.readZipEntry = readZipEntry;
exports.parseSpeciesBios = parseSpeciesBios;
exports.parseFlags = parseFlags;
exports.readSaveFlags = readSaveFlags;
exports.parseRulers = parseRulers;
exports.saveRoots = saveRoots;
exports.listSaves = listSaves;
exports.findLatestSave = findLatestSave;
exports.parseSaveCountryMetadata = parseSaveCountryMetadata;
exports.parsePortraitInfo = parsePortraitInfo;
// 스텔라리스 세이브(.sav = zip)에서 제국 깃발을 읽는다. 읽기 전용. 외부 라이브러리 없이 zlib 만 쓴다.
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const zlib = __importStar(require("zlib"));
const environment_paths_1 = require("./environment-paths");
/** zip 안에서 이름이 같은 파일 하나를 풀어 문자열로 돌려준다. 없으면 null. */
/** 세이브 gamestate 를 풀 때의 상한. V8 문자열 한도(약 512MB)를 넘기면 어차피 읽을 수 없다. */
const SAVE_ENTRY_MAX = 512 * 1024 * 1024;
function readZipEntry(buf, name) {
    // 경계 검사(2026-10-18): 게임이 자동 저장을 쓰는 도중이거나 손상된 파일이면 null(예외로 매번 다시 읽지 않게).
    if (buf.length < 22)
        return null;
    // 끝 중앙 디렉터리(EOCD) 찾기
    let eocd = -1;
    for (let i = buf.length - 22; i >= Math.max(0, buf.length - 65557); i--) {
        if (buf.readUInt32LE(i) === 0x06054b50) {
            eocd = i;
            break;
        }
    }
    if (eocd < 0)
        return null;
    const count = buf.readUInt16LE(eocd + 10);
    let p = buf.readUInt32LE(eocd + 16);
    for (let n = 0; n < count; n++) {
        if (p + 46 > buf.length || buf.readUInt32LE(p) !== 0x02014b50)
            return null;
        const method = buf.readUInt16LE(p + 10);
        const csize = buf.readUInt32LE(p + 20);
        const nlen = buf.readUInt16LE(p + 28);
        const elen = buf.readUInt16LE(p + 30);
        const clen = buf.readUInt16LE(p + 32);
        const lho = buf.readUInt32LE(p + 42);
        const fname = buf.toString('utf8', p + 46, p + 46 + nlen);
        if (fname === name) {
            if (lho + 30 > buf.length)
                return null;
            const lnlen = buf.readUInt16LE(lho + 26);
            const lelen = buf.readUInt16LE(lho + 28);
            const start = lho + 30 + lnlen + lelen;
            if (start + csize > buf.length)
                return null;
            const data = buf.subarray(start, start + csize);
            if (method === 0)
                return Buffer.from(data);
            if (method === 8)
                return zlib.inflateRawSync(data, { maxOutputLength: SAVE_ENTRY_MAX });
            return null;
        }
        p += 46 + nlen + elen + clen;
    }
    return null;
}
/** gamestate 문자열에서 country={ ... } 구역만 훑어 깃발을 모은다. */
function unescapePdx(v) { return v.replace(/\\(.)/g, (_m, c) => (c === 'n' ? '\n' : c)); } // 한 번에 풀어야 '\\n'(역슬래시+n)이 줄바꿈으로 바뀌지 않는다(2026-10-18)
/** species_db 구역에서 종족 번호 -> species_bio. 전기가 없는 종족은 빠진다. */
function parseSpeciesBios(gamestate) {
    const out = {};
    const start = gamestate.search(/^species_db=\r?$/m);
    if (start < 0)
        return out;
    const lines = gamestate.slice(start).split('\n');
    let cur = '';
    for (let li = 1; li < lines.length; li++) {
        const raw = lines[li].replace(/\r$/, '');
        if (raw === '}')
            break;
        const m = /^\t(\d+)=$/.exec(raw);
        if (m) {
            cur = m[1];
            continue;
        }
        if (!cur || !raw.startsWith('\t\tspecies_bio='))
            continue;
        const q = /^\t\tspecies_bio="(.*)"\s*$/.exec(raw);
        if (q && q[1].trim())
            out[cur] = unescapePdx(q[1]).trim();
    }
    return out;
}
function parseFlags(gamestate) {
    const statsById = {}, statsByIdx = {};
    let st = {};
    const byId = {};
    const byIdx = {};
    const bioById = {};
    const bioByIdx = {};
    const bios = parseSpeciesBios(gamestate);
    let founder = '';
    const start = gamestate.search(/^country=\r?$/m);
    if (start < 0)
        return { byId, byIdx, bioById, bioByIdx, statsById, statsByIdx };
    const lines = gamestate.slice(start).split('\n');
    let curId = '';
    let flag = null;
    let inFlag = false;
    let sect = '';
    let idx = '';
    const finish = () => {
        if (curId && flag && flag.iconFile) {
            byId[curId] = flag;
            if (idx)
                byIdx[idx] = flag;
        }
        if (curId && founder && bios[founder]) {
            bioById[curId] = bios[founder];
            if (idx)
                bioByIdx[idx] = bios[founder];
        }
        if (curId && st.military !== undefined) {
            const full = { military: st.military ?? 0, economy: st.economy ?? 0, tech: st.tech ?? 0, rank: st.rank ?? 0, fleet: st.fleet ?? 0, size: st.size ?? 0, pops: st.pops ?? 0 };
            statsById[curId] = full;
            if (idx)
                statsByIdx[idx] = full;
        }
        flag = null;
        idx = '';
        founder = '';
        st = {};
    };
    for (let li = 1; li < lines.length; li++) {
        const raw = lines[li].replace(/\r$/, '');
        if (raw === '}')
            break; // country 구역 끝
        let m = /^\t(\d+)=$/.exec(raw);
        if (m) {
            finish();
            curId = m[1];
            inFlag = false;
            sect = '';
            continue;
        }
        if (!curId)
            continue;
        const t = raw.trim();
        if (!inFlag) {
            if (raw === '\t\tflag=') {
                inFlag = true;
                flag = { iconCat: '', iconFile: '', bgCat: '', bgFile: '', colors: [] };
                sect = '';
                continue;
            }
            if (raw.startsWith('\t\t') && !raw.startsWith('\t\t\t')) {
                const sv = /^\t\t(military_power|economy_power|tech_power|victory_rank|fleet_size|empire_size|num_sapient_pops)=(-?[\d.]+)$/.exec(raw);
                if (sv) {
                    const n = Number(sv[2]);
                    const k = sv[1];
                    if (k === 'military_power')
                        st.military = n;
                    else if (k === 'economy_power')
                        st.economy = n;
                    else if (k === 'tech_power')
                        st.tech = n;
                    else if (k === 'victory_rank')
                        st.rank = n;
                    else if (k === 'fleet_size')
                        st.fleet = n;
                    else if (k === 'empire_size')
                        st.size = n;
                    else
                        st.pops = n;
                }
            }
            m = /^sllm_idx=(\d+)(?:\.0+)?$/.exec(t);
            if (m && raw.startsWith('\t\t\t'))
                idx = m[1];
            m = /^founder_species_ref=(\d+)$/.exec(raw.trim());
            if (m && raw.startsWith('\t\tfounder'))
                founder = m[1];
            continue;
        }
        if (!flag)
            continue;
        if (raw === '\t\t}') {
            inFlag = false;
            sect = '';
            continue;
        }
        if (t === 'icon=') {
            sect = 'icon';
            continue;
        }
        if (t === 'background=') {
            sect = 'background';
            continue;
        }
        if (t === 'colors=') {
            sect = 'colors';
            continue;
        }
        if (t === '{' || t === '}')
            continue;
        if (sect === 'colors') {
            const c = /^"([^"]*)"$/.exec(t);
            if (c)
                flag.colors.push(c[1]);
            continue;
        }
        const kv = /^(category|file)="([^"]*)"$/.exec(t);
        if (kv) {
            if (sect === 'icon') {
                if (kv[1] === 'category')
                    flag.iconCat = kv[2];
                else
                    flag.iconFile = kv[2];
            }
            else if (sect === 'background') {
                if (kv[1] === 'category')
                    flag.bgCat = kv[2];
                else
                    flag.bgFile = kv[2];
            }
        }
    }
    finish();
    return { byId, byIdx, bioById, bioByIdx, statsById, statsByIdx };
}
function readSaveFlags(savePath) {
    const buf = fs.readFileSync(savePath);
    const gs = readZipEntry(buf, 'gamestate');
    if (!gs)
        return null;
    const text = gs.toString('utf8');
    const meta = readZipEntry(buf, 'meta')?.toString('utf8') ?? '';
    const date = /^date="([^"]*)"/m.exec(meta)?.[1] ?? '';
    const metadata = parseSaveCountryMetadata(text);
    let portraitsByIdx;
    try {
        portraitsByIdx = parsePortraitInfo(text);
    }
    catch { /* 초상화 정보는 없어도 된다 */ }
    let rulerByIdx;
    try {
        rulerByIdx = parseRulers(text);
    }
    catch { /* 통치자 정보는 없어도 된다 */ }
    return { ...parseFlags(text), ...metadata, portraitsByIdx, rulerByIdx, date };
}
/** gamestate 에서 제국마다 통치자의 초상화·성별을 읽는다. 직접 만든 통치자는 design.portrait(정확한 ID), 아니면 지도자의 portrait, 그것도 없으면 종족 초상화. */
function parseRulers(gamestate) {
    const out = {};
    const sections = (name) => {
        const start = gamestate.search(new RegExp('^' + name + '=\\r?$', 'm'));
        return start < 0 ? [] : gamestate.slice(start).split('\n');
    };
    const speciesPortrait = {};
    {
        const L = sections('species_db');
        let cur = '';
        for (let i = 1; i < L.length; i++) {
            const raw = L[i].replace(/\r$/, '');
            if (raw === '}')
                break;
            const m = /^\t(\d+)=$/.exec(raw);
            if (m) {
                cur = m[1];
                continue;
            }
            const q = /^\t\tportrait="([^"]*)"$/.exec(raw);
            if (cur && q)
                speciesPortrait[cur] = q[1];
        }
    }
    const rulerOf = {}, founderOf = {}; // 제국 번호 -> 통치자/건국 종족
    const idxOf = {}; // 제국 번호 -> 모드 번호(sllm_idx)
    {
        const L = sections('country');
        let cur = '';
        for (let i = 1; i < L.length; i++) {
            const raw = L[i].replace(/\r$/, '');
            if (raw === '}')
                break;
            const m = /^\t(\d+)=$/.exec(raw);
            if (m) {
                cur = m[1];
                continue;
            }
            if (!cur)
                continue;
            const r = /^\t\truler=(\d+)$/.exec(raw);
            if (r) {
                rulerOf[cur] = r[1];
                continue;
            }
            const f = /^\t\tfounder_species_ref=(\d+)$/.exec(raw);
            if (f) {
                founderOf[cur] = f[1];
                continue;
            }
            if (raw.startsWith('\t\t\t')) {
                const s = /^sllm_idx=(\d+)(?:\.0+)?$/.exec(raw.trim());
                if (s)
                    idxOf[cur] = s[1];
            }
        }
    }
    const wanted = new Set(Object.values(rulerOf));
    const info = {};
    {
        const L = sections('leaders');
        let cur = '', inDesign = false;
        for (let i = 1; i < L.length; i++) {
            const raw = L[i].replace(/\r$/, '');
            if (raw === '}')
                break;
            const m = /^\t(\d+)=$/.exec(raw);
            if (m) {
                cur = wanted.has(m[1]) ? m[1] : '';
                inDesign = false;
                if (cur)
                    info[cur] = { portrait: '', gender: '', cls: '', species: '', dPortrait: '', dGender: '' };
                continue;
            }
            if (!cur)
                continue;
            if (raw === '\t\tdesign=') {
                inDesign = true;
                continue;
            }
            if (inDesign) {
                if (raw === '\t\t}') {
                    inDesign = false;
                    continue;
                }
                const d = /^\t\t\t(portrait|gender)="?([^"]*)"?$/.exec(raw);
                if (d) {
                    if (d[1] === 'portrait')
                        info[cur].dPortrait = d[2];
                    else
                        info[cur].dGender = d[2];
                }
                continue;
            }
            const k = /^\t\t(portrait|gender|class|species)="?([^"]*)"?$/.exec(raw);
            if (k) {
                const v = k[2];
                if (k[1] === 'portrait')
                    info[cur].portrait = v;
                else if (k[1] === 'gender')
                    info[cur].gender = v;
                else if (k[1] === 'class')
                    info[cur].cls = v;
                else
                    info[cur].species = v;
            }
        }
    }
    const g = (v) => (v === 'female' ? 'f' : v === 'male' ? 'm' : '');
    for (const [cid, rid] of Object.entries(rulerOf)) {
        const idx = idxOf[cid], r = info[rid];
        if (!idx || !r)
            continue;
        const portrait = r.dPortrait || r.portrait || speciesPortrait[r.species] || speciesPortrait[founderOf[cid]] || '';
        if (portrait)
            out[idx] = { portrait, gender: g(r.dGender || r.gender), leaderClass: r.cls };
    }
    return out;
}
/** 세이브가 있을 만한 폴더들(스팀 클라우드 + 문서 폴더). SLLM_SAVE_DIR 로 직접 지정할 수도 있다. */
function saveRoots() { return (0, environment_paths_1.environmentSaveRoots)(); }
/** 폴더 하나(세이브 루트 또는 제국 폴더)에서 .sav 파일 경로들을 모은다. 한 단계 아래 폴더까지 본다. */
function listSaves(root) {
    const out = [];
    let ents = [];
    try {
        ents = fs.readdirSync(root, { withFileTypes: true });
    }
    catch {
        return out;
    }
    for (const e of ents) {
        const fp = path.join(root, e.name);
        if (e.isFile() && e.name.toLowerCase().endsWith('.sav'))
            out.push(fp);
        else if (e.isDirectory()) {
            try {
                for (const f of fs.readdirSync(fp))
                    if (f.toLowerCase().endsWith('.sav'))
                        out.push(path.join(fp, f));
            }
            catch { /* 건너뜀 */ }
        }
    }
    return out;
}
/** 모든 폴더에서 가장 최근에 바뀐 .sav 하나를 찾는다. */
function findLatestSave(roots = saveRoots()) {
    let best = '';
    let bestT = 0;
    for (const r of roots) {
        for (const fp of listSaves(r)) {
            try {
                const t = fs.statSync(fp).mtimeMs;
                if (t > bestT) {
                    bestT = t;
                    best = fp;
                }
            }
            catch { /* 건너뜀 */ }
        }
    }
    return best || null;
}
/** Save format uses a country-level ethos/ethics block; nested species/pop ethics are excluded. */
function parseSaveCountryMetadata(text) {
    const ethicsByIdx = {}, typesByIdx = {};
    const start = text.search(/^country=\r?$/m);
    if (start < 0)
        return { ethicsByIdx, typesByIdx, sid: '' };
    let idx = '', type = '', ids = [], section = false, sid = '';
    const finish = () => { if (idx) {
        ethicsByIdx[idx] = [...new Set(ids)];
        typesByIdx[idx] = type;
    } idx = ''; type = ''; ids = []; section = false; };
    for (const line of text.slice(start).split('\n').slice(1)) {
        const raw = line.replace(/\r$/, '');
        if (raw === '}')
            break;
        if (/^\t\d+=$/.test(raw)) {
            finish();
            continue;
        }
        const id = /^\t{3,}sllm_idx=(\d+)(?:\.0+)?$/.exec(raw);
        if (id)
            idx = id[1];
        const save = /^\t{3,}sllm_save_id=(\d+)(?:\.0+)?$/.exec(raw);
        if (save)
            sid = save[1];
        const tp = /^\t\ttype="?([A-Za-z0-9_.-]+)"?$/.exec(raw);
        if (tp)
            type = tp[1];
        if (/^\t\t(?:ethos|ethics)\s*=/.test(raw))
            section = true;
        else if (/^\t\t[^\t{]/.test(raw))
            section = false;
        if (section) {
            for (const match of raw.matchAll(/"([A-Za-z0-9_.-]+)"/g))
                if (!ids.includes(match[1]))
                    ids.push(match[1]);
        }
    }
    finish();
    return { ethicsByIdx, typesByIdx, sid };
}
function parsePortraitInfo(gs) {
    const lines = gs.split('\n'), out = {};
    const sec = (name) => lines.findIndex((l) => l.replace(/\r$/, '') === name + '=');
    // 1. 종족
    const species = {};
    let i = sec('species_db');
    if (i >= 0) {
        let cur = '';
        for (i += 2; i < lines.length; i++) {
            const l = lines[i].replace(/\r$/, '');
            if (l === '}')
                break;
            let m = /^\t(\d+)=$/.exec(l);
            if (m) {
                cur = m[1];
                species[cur] = { portrait: '', cls: '' };
                continue;
            }
            if (!cur)
                continue;
            m = /^\t\t(portrait|class|name_list)="([^"]*)"$/.exec(l);
            if (m) {
                if (m[1] === 'name_list') {
                    if (m[2])
                        species[cur].list = m[2];
                }
                else
                    species[cur][m[1] === 'portrait' ? 'portrait' : 'cls'] = m[2];
            }
        }
    }
    // 2. 나라: sllm_idx, 건국 종족, 가진 행성
    const planetOwner = new Map(), founderOf = new Map();
    i = sec('country');
    if (i >= 0) {
        let cur = '', idx = '', founder = '', inOwned = false;
        const owned = [];
        const finish = () => { if (cur && idx) {
            if (founder)
                founderOf.set(idx, founder);
            for (const p of owned)
                planetOwner.set(p, idx);
        } idx = ''; founder = ''; owned.length = 0; inOwned = false; };
        for (i += 2; i < lines.length; i++) {
            const l = lines[i].replace(/\r$/, '');
            if (l === '}')
                break;
            const m = /^\t(\d+)=$/.exec(l);
            if (m) {
                finish();
                cur = m[1];
                continue;
            }
            if (!cur)
                continue;
            if (l === '\t\towned_planets=') {
                inOwned = true;
                continue;
            }
            if (inOwned) {
                if (l === '\t\t}')
                    inOwned = false;
                else if (l.startsWith('\t\t\t'))
                    owned.push(...l.trim().split(/\s+/).filter((x) => /^\d+$/.test(x)));
                continue;
            }
            let mm = /^\t\tfounder_species_ref=(\d+)$/.exec(l);
            if (mm) {
                founder = mm[1];
                continue;
            }
            mm = /^\t\t\tsllm_idx=(\d+)(?:\.0+)?$/.exec(l);
            if (mm)
                idx = mm[1];
        }
        finish();
    }
    // 3. 인구 묶음: 행성 → 나라, 종족별 size 합
    const sizes = new Map();
    i = sec('pop_groups');
    if (i >= 0) {
        let sp = '', planet = '', size = 0, depth = 0;
        const finish = () => { const c = planetOwner.get(planet); if (c && sp && size > 0) {
            const m = sizes.get(c) ?? new Map();
            m.set(sp, (m.get(sp) ?? 0) + size);
            sizes.set(c, m);
        } sp = ''; planet = ''; size = 0; };
        for (i += 2; i < lines.length; i++) {
            const l = lines[i].replace(/\r$/, '');
            if (l === '}')
                break;
            if (/^\t\d+=$/.test(l)) {
                finish();
                depth = 1;
                continue;
            }
            if (!depth)
                continue;
            let m = /^\t\t\tspecies=(\d+)$/.exec(l);
            if (m) {
                sp = m[1];
                continue;
            }
            m = /^\t\tplanet=(\d+)$/.exec(l);
            if (m) {
                planet = m[1];
                continue;
            }
            m = /^\t\tsize=(\d+)$/.exec(l);
            if (m)
                size = Number(m[1]);
        }
        finish();
    }
    const idxs = new Set([...founderOf.keys(), ...sizes.keys()]);
    for (const idx of idxs) {
        const f = founderOf.get(idx), fs0 = f ? species[f] : undefined, m = sizes.get(idx);
        let mix = [];
        if (m) {
            const tot = [...m.values()].reduce((a, b) => a + b, 0) || 1;
            mix = [...m].map(([s, n]) => ({ portrait: species[s]?.portrait ?? '', cls: species[s]?.cls ?? '', share: n / tot, ...(species[s]?.list ? { list: species[s].list } : {}) })).filter((x) => x.portrait && x.share >= 0.05).sort((a, b) => b.share - a.share).slice(0, 4);
            const t2 = mix.reduce((a, b) => a + b.share, 0) || 1;
            mix = mix.map((x) => ({ ...x, share: Math.round((x.share / t2) * 1000) / 1000 }));
        }
        let pop;
        if (m) {
            const tot = [...m.values()].reduce((a, b) => a + b, 0) || 1;
            pop = [...m].map(([s, n]) => ({ cls: species[s]?.cls ?? '', share: Math.round((n / tot) * 10000) / 10000, ...(species[s]?.list ? { list: species[s].list } : {}) })).filter((x) => x.share > 0 && (x.cls || x.list)).sort((a, b) => b.share - a.share);
        }
        out[idx] = { founder: fs0 && fs0.portrait ? fs0 : null, mix, ...(pop && pop.length ? { pop } : {}) };
    }
    return out;
}
//# sourceMappingURL=savereader.js.map