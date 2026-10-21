#!/usr/bin/env python3
# 집무실 연락처 — 지도자 특성 읽기 효과 만들기(2026-10-18).
# 게임 폴더 common/traits/*.txt 에서 지도자 특성(leader_class 가 있거나 leader_trait_/trait_ruler_ 로 시작하는 것)을 모아
# tester-mod/common/scripted_effects/sllm_probe_leader_traits.txt 를 만든다. 지도자 범위에서 가진 특성마다 SLLM:LTRAIT 한 줄.
# 사용: python tools/gen-leader-traits.py "F:/SteamLibrary/steamapps/common/Stellaris"
import glob, os, re, sys

def leader_traits(game):
    keys = []
    for f in sorted(glob.glob(os.path.join(game, 'common', 'traits', '*.txt'))):
        s = re.sub(r'#[^\n]*', '', open(f, encoding='utf-8-sig', errors='replace').read())
        depth, cur, start = 0, None, 0
        for m in re.finditer(r'([A-Za-z0-9_@]+)\s*=\s*\{|\{|\}', s):
            if m.group(0).endswith('{'):
                if depth == 0 and m.group(1): cur, start = m.group(1), m.end()
                depth += 1
            else:
                depth -= 1
                if depth == 0 and cur:
                    body = s[start:m.start()]
                    if not cur.startswith('@') and ('leader_class' in body or cur.startswith('leader_trait') or cur.startswith('trait_ruler')):
                        keys.append(cur)
                    cur = None
    return sorted(set(keys))

def main():
    game = sys.argv[1] if len(sys.argv) > 1 else 'F:/SteamLibrary/steamapps/common/Stellaris'
    keys = leader_traits(game)
    mod = os.path.join(os.path.dirname(__file__), '..', 'tester-mod')
    own = leader_traits(mod)  # SLLM 이 붙이는 특성(청문회·서신)도 연락처에 보이게
    keys = sorted(set(keys) | set(own))
    out = ['# 자동 생성(tools/gen-leader-traits.py, 2026-10-18) — 직접 고치지 마세요. 바닐라 + SLLM 지도자 특성 %d개.' % len(keys),
           '# 지도자 범위에서 부른다. 가진 특성마다 SLLM:LTRAIT(lid·t) 한 줄. 다른 모드가 더한 특성은 들어 있지 않다.',
           'sllm_probe_leader_traits = {']
    for k in keys:
        out.append('\tif = { limit = { has_trait = %s } log = "SLLM:LTRAIT/;/lid=\\\\[This.sllm_lid]/;/t=%s" }' % (k, k))
    out.append('}')
    dst = os.path.join(os.path.dirname(__file__), '..', 'tester-mod', 'common', 'scripted_effects', 'sllm_probe_leader_traits.txt')
    open(dst, 'w', encoding='utf-8').write('\n'.join(out) + '\n')
    print(len(keys), 'traits ->', os.path.normpath(dst))

if __name__ == '__main__':
    main()
