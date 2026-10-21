#!/usr/bin/env python3
"""SLLM 자체 버프/디버프 라이브러리 생성기 (2026-10-17).
cheatinterface 모드는 사용자가 따로 설치해야 하므로 SLLM 모드 안에 같은 종류의 모디파이어를 직접 정의한다.
키는 cheatinterface 를 게임(4.5.2)에 올렸을 때 error.log 에 'Invalid modifier' 가 없던 것만 쓴다(타 모드 자원은 제외).
수치는 치트가 아니라 외교·회의 보상/제재용으로 5단계(약 5%~50%)로 낮춘다.
실행: python3 tools/gen-buffs.py  → static_modifiers / localisation(ko,en) / src/buff-catalog.ts 를 다시 쓴다.
"""
import os, json
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
UP = [0.05, 0.10, 0.20, 0.35, 0.50]
DOWN = [-0.05, -0.10, -0.20, -0.30, -0.40]
# (id, 모디파이어 키, 한글, 영문, 값 5개, 단위 'pct'|'num', 묶음, 약화(디버프)도 만들기)
E = []
def mult(i, k, ko, en, grp, deb=False, vals=UP): E.append((i, k, ko, en, vals, 'pct', grp, deb))
def cost(i, k, ko, en, grp, deb=False): E.append((i, k, ko, en, DOWN, 'pct', grp, deb))
def add(i, k, ko, en, vals, grp, deb=False): E.append((i, k, ko, en, vals, 'num', grp, deb))
# 경제
for i, k, ko, en in [('energy', 'country_energy_produces_mult', '에너지 생산', 'Energy Output'), ('minerals', 'country_minerals_produces_mult', '광물 생산', 'Minerals Output'),
    ('food', 'country_food_produces_mult', '식량 생산', 'Food Output'), ('alloys', 'country_alloys_produces_mult', '합금 생산', 'Alloys Output'),
    ('goods', 'country_consumer_goods_produces_mult', '소비재 생산', 'Consumer Goods Output'), ('unity', 'country_unity_produces_mult', '통합 생산', 'Unity Output'),
    ('influence', 'country_influence_produces_mult', '영향력 생산', 'Influence Output'), ('trade', 'country_trade_produces_mult', '교역 가치', 'Trade Value')]:
    mult(i, k, ko, en, 'economy', True)
for i, k, ko, en in [('gases', 'country_exotic_gases_produces_mult', '이국 기체 생산', 'Exotic Gases Output'), ('motes', 'country_volatile_motes_produces_mult', '휘발성 입자 생산', 'Volatile Motes Output'),
    ('crystals', 'country_rare_crystals_produces_mult', '희귀 결정 생산', 'Rare Crystals Output'), ('nanites', 'country_nanites_produces_mult', '나노 생산', 'Nanites Output'),
    ('darkmatter', 'country_sr_dark_matter_produces_mult', '암흑 물질 생산', 'Dark Matter Output'), ('zro', 'country_sr_zro_produces_mult', '조로 생산', 'Zro Output'),
    ('livingmetal', 'country_sr_living_metal_produces_mult', '살아있는 금속 생산', 'Living Metal Output'), ('artifacts', 'country_minor_artifacts_produces_mult', '소형 유물 생산', 'Minor Artifacts Output')]:
    mult(i, k, ko, en, 'economy')
add('storage', 'country_resource_max_add', '자원 저장 한도', 'Resource Storage', [2000, 5000, 10000, 25000, 50000], 'economy')
# 연구
mult('physics', 'country_physics_research_produces_mult', '물리학 연구 생산', 'Physics Research', 'research', True)
mult('society', 'country_society_research_produces_mult', '사회학 연구 생산', 'Society Research', 'research', True)
mult('engineering', 'country_engineering_research_produces_mult', '공학 연구 생산', 'Engineering Research', 'research', True)
mult('researchspeed', 'all_technology_research_speed', '기술 연구 속도', 'Research Speed', 'research')
add('techchoices', 'num_tech_alternatives_add', '연구 선택지 추가', 'Research Choices', [1, 1, 2, 2, 3], 'research')
# 국내(행성/인구) — 행성 범위(every_owned_planet 안에서 붙인다)
# pop_happiness 는 비율 값이다(0.02 = +2%). 정수(2, 5…)로 쓰면 +200%·+500% 가 되므로 'pct' 로 둔다(2026-10-17 수정).
mult('happiness', 'pop_happiness', '인구 행복', 'Pop Happiness', 'society', True, vals=[0.02, 0.05, 0.10, 0.15, 0.25])
mult('amenities', 'planet_amenities_mult', '편의 시설 산출', 'Amenities', 'society', True)
cost('housing', 'pop_housing_usage_mult', '주거 사용량', 'Housing Usage', 'society')
add('crime', 'planet_crime_add', '범죄율', 'Crime', [-5, -10, -20, -30, -45], 'society', True)
mult('jobs', 'planet_jobs_produces_mult', '일자리 생산', 'Job Output', 'society', True)
cost('jobupkeep', 'planet_jobs_upkeep_mult', '일자리 유지비', 'Job Upkeep', 'society')
cost('popupkeep', 'planet_pops_upkeep_mult', '인구 유지비', 'Pop Upkeep', 'society')
mult('popgrowth', 'logistic_growth_mult', '인구 성장 속도', 'Pop Growth', 'society', True)
mult('assembly', 'planet_pop_assembly_mult', '인구 조립 속도', 'Pop Assembly', 'society')
cost('resettle', 'pop_resettlement_cost_mult', '이주 비용', 'Resettlement Cost', 'society')
mult('ethicshift', 'pop_ethics_shift_speed_mult', '성향 변화 속도', 'Ethics Shift Speed', 'society')
mult('colonydev', 'planet_colony_development_speed_mult', '식민지 발전 속도', 'Colony Development', 'society')
# 건설
cost('bldcost', 'planet_buildings_cost_mult', '건물 비용', 'Building Cost', 'build')
cost('bldupkeep', 'planet_buildings_upkeep_mult', '건물 유지비', 'Building Upkeep', 'build', True)
cost('distcost', 'planet_districts_cost_mult', '구역 비용', 'District Cost', 'build')
cost('distupkeep', 'planet_districts_upkeep_mult', '구역 유지비', 'District Upkeep', 'build')
mult('bldspeed', 'planet_building_build_speed_mult', '건물 건설 속도', 'Building Speed', 'build')
cost('megacost', 'megastructures_cost_mult', '거대구조물 비용', 'Megastructure Cost', 'build')
mult('megaspeed', 'megastructure_build_speed_mult', '거대구조물 건설 속도', 'Megastructure Speed', 'build')
mult('terraform', 'terraform_speed_mult', '행성 개조 속도', 'Terraform Speed', 'build')
cost('sbcost', 'starbase_buildings_cost_mult', '우주 기지 건물 비용', 'Starbase Building Cost', 'build')
mult('sbspeed', 'starbase_building_build_speed_mult', '우주 기지 건설 속도', 'Starbase Build Speed', 'build')
mult('sbcap', 'country_starbase_capacity_mult', '우주 기지 용량', 'Starbase Capacity', 'build')
# 제국 운영
cost('size', 'empire_size_mult', '제국 규모 부담', 'Empire Size', 'empire', True)
cost('sizepops', 'empire_size_pops_mult', '인구에 따른 제국 규모', 'Empire Size from Pops', 'empire')
cost('sizecol', 'empire_size_colonies_mult', '식민지에 따른 제국 규모', 'Empire Size from Colonies', 'empire')
cost('edictcost', 'edicts_cost_mult', '칙령 비용', 'Edict Cost', 'empire')
add('edictfund', 'country_edict_fund_add', '칙령 기금', 'Edict Fund', [50, 100, 150, 250, 400], 'empire')
cost('tradcost', 'tradition_cost_mult', '전통 비용', 'Tradition Cost', 'empire')
cost('claimcost', 'country_claim_influence_cost_mult', '영유권 주장 비용', 'Claim Cost', 'empire')
mult('agenda', 'council_agenda_progress_speed', '의제 진행 속도', 'Agenda Speed', 'empire')
cost('agendacd', 'council_agenda_cooldown_mult', '의제 재사용 대기', 'Agenda Cooldown', 'empire')
add('approval', 'faction_approval', '파벌 지지', 'Faction Approval', [0.02, 0.05, 0.10, 0.15, 0.25], 'empire', True)
add('officials', 'country_official_cap_add', '관리 정원', 'Official Cap', [1, 2, 3, 5, 8], 'empire')
add('scientists', 'country_scientist_cap_add', '과학자 정원', 'Scientist Cap', [1, 2, 3, 5, 8], 'empire')
add('commanders', 'country_commander_cap_add', '사령관 정원', 'Commander Cap', [1, 2, 3, 5, 8], 'empire')
# 외교·첩보
mult('diploweight', 'diplo_weight_mult', '외교 비중', 'Diplomatic Weight', 'diplomacy', True)
add('envoys', 'envoys_add', '특사 수', 'Envoys', [1, 1, 2, 3, 4], 'diplomacy')
mult('relations', 'envoy_improve_relations_mult', '특사 관계 개선', 'Envoy Relations', 'diplomacy')
add('trust', 'country_trust_growth', '신뢰 성장', 'Trust Growth', [0.05, 0.10, 0.20, 0.35, 0.50], 'diplomacy')
mult('tribute', 'subject_tribute_mult', '속국 조공', 'Subject Tribute', 'diplomacy')
add('loyalty', 'monthly_loyalty_from_subjects', '속국 충성', 'Subject Loyalty', [0.05, 0.10, 0.20, 0.35, 0.50], 'diplomacy')
cost('warex', 'country_war_exhaustion_mult', '전쟁 피로', 'War Exhaustion', 'diplomacy', True)
add('decrypt', 'intel_decryption_add', '암호 해독', 'Decryption', [2, 5, 10, 15, 25], 'diplomacy')
add('encrypt', 'intel_encryption_add', '암호화(방첩)', 'Encryption', [2, 5, 10, 15, 25], 'diplomacy')
mult('opspeed', 'espionage_operation_speed_mult', '첩보 작전 속도', 'Operation Speed', 'diplomacy')
cost('opcost', 'espionage_operation_cost_mult', '첩보 작전 비용', 'Operation Cost', 'diplomacy')
mult('contactspeed', 'first_contact_speed_mult', '최초 접촉 속도', 'First Contact Speed', 'diplomacy')
# 함대
mult('shipdmg', 'ship_weapon_damage', '함선 무기 피해', 'Ship Weapon Damage', 'fleet', True)
mult('shiprate', 'ship_fire_rate_mult', '함선 발사 속도', 'Ship Fire Rate', 'fleet', True)
mult('shiprange', 'ship_weapon_range_mult', '함선 무기 사거리', 'Ship Weapon Range', 'fleet')
add('shipacc', 'ship_accuracy_add', '함선 명중', 'Ship Accuracy', [3, 5, 10, 15, 25], 'fleet')
mult('shiphull', 'ship_hull_mult', '함선 선체', 'Ship Hull', 'fleet', True)
mult('shiparmor', 'ship_armor_mult', '함선 장갑', 'Ship Armor', 'fleet', True)
mult('shipshield', 'ship_shield_mult', '함선 방어막', 'Ship Shield', 'fleet')
mult('shipevasion', 'ship_evasion_mult', '함선 회피', 'Ship Evasion', 'fleet')
mult('shipspeed', 'ship_base_speed_mult', '함선 기본 속도', 'Ship Speed', 'fleet')
mult('ftlspeed', 'ship_interstellar_speed_mult', '성간 이동 속도', 'FTL Speed', 'fleet')
mult('navalcap', 'country_naval_cap_mult', '함대 용량', 'Naval Capacity', 'fleet', True)
cost('shipupkeep', 'ships_upkeep_mult', '함선 유지비', 'Ship Upkeep', 'fleet')
cost('shipcost', 'starbase_shipyard_build_cost_mult', '함선 건조 비용', 'Ship Build Cost', 'fleet')
mult('shipexp', 'ship_experience_gain_mult', '함선 경험치', 'Ship Experience', 'fleet')
mult('shipspeedbuild', 'starbase_shipyard_build_speed_mult', '함선 건조 속도', 'Ship Build Speed', 'fleet')
# 지상군
mult('armydmg', 'army_attack_damage_mult', '지상군 공격 피해', 'Army Damage', 'army', True)
mult('armyhp', 'army_attack_health_mult', '지상군 체력', 'Army Health', 'army')
mult('armymorale', 'army_attack_morale_mult', '지상군 사기', 'Army Morale', 'army')
cost('armycost', 'armies_cost_mult', '지상군 비용', 'Army Cost', 'army')
cost('armyupkeep', 'armies_upkeep_mult', '지상군 유지비', 'Army Upkeep', 'army')
# 지도자·탐사
mult('leaderexp', 'commander_exp_gain', '사령관 경험치', 'Commander Experience', 'leader')
mult('scientistexp', 'scientist_exp_gain', '과학자 경험치', 'Scientist Experience', 'leader')
mult('officialexp', 'official_exp_gain', '관리 경험치', 'Official Experience', 'leader')
mult('lifespan', 'leader_lifespan_mult', '지도자 수명', 'Leader Lifespan', 'leader')
cost('hirecost', 'leaders_cost_mult', '지도자 고용 비용', 'Leader Hire Cost', 'leader')
cost('leaderupkeep', 'leaders_upkeep_mult', '지도자 유지비', 'Leader Upkeep', 'leader')
mult('survey', 'science_ship_survey_speed', '탐사 속도', 'Survey Speed', 'explore')
mult('anomaly', 'ship_anomaly_research_speed_mult', '이상 현상 연구 속도', 'Anomaly Research', 'explore')
mult('archaeo', 'ship_archaeological_site_excavation_speed_mult', '유적 발굴 속도', 'Excavation Speed', 'explore')

GROUPS = {'economy': '경제', 'research': '연구', 'society': '사회', 'build': '건설', 'empire': '제국 운영', 'diplomacy': '외교·첩보', 'fleet': '함대', 'army': '지상군', 'leader': '지도자', 'explore': '탐사'}
PLANET = ('planet_', 'pop_')
# 범위: 행성 범위 모디파이어는 every_owned_planet 안에서 붙여야 한다. 단, planet_building_build_speed_mult/planet_colony_* 도 행성 범위로 취급(검증 전까지 안전하게).
def scope(k): return 'planet' if k.startswith(PLANET) or k == 'logistic_growth_mult' else 'country'
def fmt(v, unit, sign=1):
    v = v * sign
    if unit == 'pct':
        return ('%+g%%' % round(v * 100, 2))
    return ('%+g' % v)
def num(v): return ('%g' % v)

def build():
    mods, ko, en, cat = [], [], [], []
    seen = set()
    for (i, k, lko, len_, vals, unit, grp, deb) in E:
        assert i not in seen, i; seen.add(i)
        entry = {'id': i, 'key': k, 'ko': lko, 'en': len_, 'unit': unit, 'group': grp, 'scope': scope(k), 'buff': [], 'debuff': []}
        for kind, sign, tag, kl, ke in [('buff', 1, 'buff', '버프', 'Buff'), ('debuff', -1, 'debuff', '디버프', 'Debuff')]:
            if kind == 'debuff' and not deb: continue
            for t, v in enumerate(vals, 1):
                val = v * sign
                name = 'sllm_%s_%s_t%d' % (tag, i, t)
                mods.append('%s = {\n\t%s = %s\n}\n' % (name, k, num(val)))
                label = '%s: %s %s' % ('SLLM 호의' if kind == 'buff' else 'SLLM 제재', lko, fmt(v, unit, sign))
                ko.append(' %s:0 "%s"\n %s_desc:0 "SLLM 연결 모드가 외교·회의 결과로 부여한 효과입니다. 기간이 끝나면 사라집니다."\n' % (name, label, name))
                en.append(' %s:0 "%s: %s %s"\n %s_desc:0 "Applied by the SLLM connection mod as a result of diplomacy or council decisions. Expires on its own."\n' % (name, 'SLLM Favor' if kind == 'buff' else 'SLLM Sanction', len_, fmt(v, unit, sign), name))
                entry[kind].append({'tier': t, 'modifier': name, 'value': val})
        cat.append(entry)
    return mods, ko, en, cat

def main():
    mods, ko, en, cat = build()
    head = '# SLLM 자체 버프/디버프 라이브러리 (tools/gen-buffs.py 로 생성 — 직접 고치지 말고 생성기를 고칠 것)\n# 이름: sllm_buff_<항목>_t1~t5 (호의), sllm_debuff_<항목>_t1~t5 (제재). 앱이 add_modifier = { modifier = … days = N } 로 붙인다.\n# 키는 cheatinterface(4.5.2 에서 Invalid modifier 가 없던 것)와 같은 바닐라 키만 쓴다 — 다른 모드 없이 동작.\n\n'
    open(os.path.join(ROOT, 'tester-mod/common/static_modifiers/sllm_buff_modifiers.txt'), 'w', encoding='utf-8').write(head + '\n'.join(mods))
    open(os.path.join(ROOT, 'tester-mod/localisation/korean/sllm_buff_l_korean.yml'), 'w', encoding='utf-8-sig').write('l_korean:\n' + ''.join(ko))
    open(os.path.join(ROOT, 'tester-mod/localisation/english/sllm_buff_l_english.yml'), 'w', encoding='utf-8-sig').write('l_english:\n' + ''.join(en))
    ts = '// 자동 생성(tools/gen-buffs.py). SLLM 자체 버프/디버프 목록 — 직접 고치지 말 것.\nexport interface BuffTier { tier: number; modifier: string; value: number }\nexport interface BuffEntry { id: string; key: string; ko: string; en: string; unit: \'pct\' | \'num\'; group: string; scope: \'country\' | \'planet\'; buff: BuffTier[]; debuff: BuffTier[] }\nexport const BUFF_GROUPS: Record<string, string> = ' + json.dumps(GROUPS, ensure_ascii=False) + ';\nexport const BUFF_CATALOG: BuffEntry[] = ' + json.dumps(cat, ensure_ascii=False, separators=(',', ':')) + ';\n'
    open(os.path.join(ROOT, 'src/buff-catalog.ts'), 'w', encoding='utf-8').write(ts)
    print(len(cat), 'entries,', len(mods), 'modifiers')
main()
