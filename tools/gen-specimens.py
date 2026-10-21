# 대보관소 표본 표·모드 읽기 효과 만들기(알파 6 수집품 1단계).
# 쓰는 법: python gen-specimens.py <스텔라리스 게임 폴더> <앱 폴더>
#  - <앱>/src/specimens-data.ts : 표본 258종(키·분류·희귀도·한/영 이름)
#  - <앱>/tester-mod/common/scripted_effects/sllm_probe_archive.txt : 보유 표본·분류별 전시 수 로그
import sys, os, re, glob, json
game, app = sys.argv[1], sys.argv[2]
src = open(os.path.join(game, 'common', 'specimens', 'specimens.txt'), encoding='utf-8-sig').read()
items, depth, cur = [], 0, None
for line in src.split('\n'):
    t = line.split('#')[0]
    m = re.match(r'^([a-z0-9_]+)\s*=\s*\{', t)
    if depth == 0 and m:
        cur = {'key': m.group(1)}; items.append(cur)
    if cur is not None:
        mt = re.search(r'\btype\s*=\s*([a-z_]+)', t)
        if mt and depth == 1: cur['type'] = mt.group(1)
        mr = re.search(r'RARITY\s*=\s*([a-z_]+)', t)
        if mr: cur['rarity'] = mr.group(1)
    depth += t.count('{') - t.count('}')
def loc(lang):
    d = {}
    for p in sorted(glob.glob(os.path.join(game, 'localisation', lang, '*.yml'))):
        for line in open(p, encoding='utf-8-sig', errors='replace'):
            m = re.match(r'^\s+([A-Za-z0-9_.]+):\d*\s+"(.*)"\s*$', line)
            if m and m.group(1) not in d: d[m.group(1)] = m.group(2)
    return d
ko, en = loc('korean'), loc('english')
def res(s, d, depth=0, ph='○○'):
    # [EVENT_TARGET_0.GetName] 처럼 게임이 그때그때 채우는 이름은 알 수 없으므로 자리 표시(○○ / …)로 둔다
    s = re.sub(r'\$([A-Za-z0-9_]+)\$', lambda m: res(d.get(m.group(1), ''), d, depth + 1, ph) if depth < 4 else '', s)
    s = re.sub(r'\[[^\]]*\]', ph, re.sub(r'§.|£\w+£', '', s)).replace('\\n', ' ')
    return re.sub(r'\s+', ' ', s).strip()
rows = []
for i in items:
    assert i.get('type') in ('xeno_geology', 'aesthetic_wonder', 'historical_item') and i.get('rarity') in ('common', 'rare', 'epic', 'exceptional'), i
    k = i['key']; a = res(ko.get(k, ''), ko); b = res(en.get(k, ''), en, ph='…')
    rows.append([k, i['type'], i['rarity'], a or b or k, b or k])
ts = ['// 자동 생성(tools/gen-specimens.py, 게임 common/specimens/specimens.txt + 현지화). 손으로 고치지 말 것.',
      '// [키, 분류, 희귀도, 한국어 이름, 영어 이름]',
      'export type SpecimenRow = [string, \'xeno_geology\' | \'aesthetic_wonder\' | \'historical_item\', \'common\' | \'rare\' | \'epic\' | \'exceptional\', string, string];',
      'export const SPECIMENS: SpecimenRow[] = [']
ts += ['  ' + json.dumps(r, ensure_ascii=False) + ',' for r in rows]
ts += ['];', '']
open(os.path.join(app, 'src', 'specimens-data.ts'), 'w', encoding='utf-8', newline='\n').write('\n'.join(ts))
LOG = 'req=\\\\[This.sllm_out_req]/;/sid=\\\\[This.sllm_save_id]'
mod = ['# SLLM 대보관소 표본 읽기(알파 6 수집품 1단계, tools/gen-specimens.py 로 자동 생성 — 손으로 고치지 말 것).',
       '# 플레이어 국가 범위. 게임 규칙은 바꾸지 않고 로그만 남긴다: 보유 표본 키(has_specimen)와 분류별 전시 중 개수(count_exhibit, 1~30 단계).',
       '# 개별 표본의 전시 여부를 묻는 트리거는 바닐라에 없어 분류별 개수만 읽는다.',
       'sllm_probe_archive = {',
       '\tsllm_probe_init_vars = yes',
       '\tset_variable = { which = sllm_out_req value = $REQ$ }',
       '\tset_variable = { which = sllm_ar_n value = 0 }',
       f'\tlog = "SLLM:ARCHIVE_BEGIN/;/{LOG}/;/date=\\\\[GetDate]"']
for r in rows:
    mod.append(f'\tif = {{ limit = {{ has_specimen = {r[0]} }} change_variable = {{ which = sllm_ar_n value = 1 }} log = "SLLM:ARCHIVE/;/k={r[0]}/;/{LOG}" }}')
for cat in ('xeno_geology', 'aesthetic_wonder', 'historical_item'):
    mod.append(f'\tset_variable = {{ which = sllm_ar_ex value = 0 }}')
    for n in range(1, 31):
        mod.append(f'\tif = {{ limit = {{ count_exhibit = {{ limit = {{ is_exhibit_active = yes is_specimen_category = {cat} }} count >= {n} }} }} set_variable = {{ which = sllm_ar_ex value = {n} }} }}')
    mod.append(f'\tlog = "SLLM:ARCHIVE_EXH/;/cat={cat}/;/n=\\\\[This.sllm_ar_ex]/;/{LOG}"')
mod.append(f'\tlog = "SLLM:ARCHIVE_END/;/{LOG}/;/count=\\\\[This.sllm_ar_n]"')
mod.append('}')
open(os.path.join(app, 'tester-mod', 'common', 'scripted_effects', 'sllm_probe_archive.txt'), 'w', encoding='utf-8', newline='\n').write('\n'.join(mod) + '\n')
print('specimens', len(rows))
