# SLLM 모드 호환 파일 v1

## 사용 위치

설정 → 개발자 모드 → 모드 호환성에서 진단, 자료 다시 읽기, 호환 파일 폴더 열기를 사용할 수 있습니다. 폴더는 앱의 사용자 데이터 아래에 생성되므로 배포된 앱에서도 사용할 수 있습니다. 바탕화면이나 개발자의 Documents 폴더를 고정 경로로 사용하지 않습니다.

폴더에 들어 있는 `example.json.disabled`를 복사해 `my-mod.json`으로 바꾸고 편집하세요. `.disabled` 파일은 적용되지 않습니다. 저장 후 ‘모드 자료 다시 읽기’를 누르세요. JSON 파일에는 주석을 넣지 마세요.

모더는 자신의 모드에 `sllm/compatibility/고유이름.json`을 포함할 수도 있습니다. 활성 모드의 파일이 먼저 적용되고 사용자 호환 폴더의 파일이 나중에 적용됩니다. JSON 데이터만 읽으며 파일 안의 코드나 명령은 실행하지 않습니다.

## 자동으로 읽는 정보

- 기본 게임과 활성 모드의 깃발 문양·배경·색상. 같은 경로의 파일은 뒤쪽 모드가 우선하며 `replace_path`를 반영합니다.
- 폴더형 모드와 일반 ZIP 압축 모드를 읽습니다. 압축 파일은 512MB, 개별 자료는 32MB 제한이 있습니다. 지원하지 않는 압축은 진단에 표시됩니다.
- `common/ethics`의 가치관 ID와 한국어/영어 이름·설명. 설명이 없으면 임의로 의미를 만들어 넣지 않습니다.
- `prescripted_countries`와 번역 파일의 제국 설명. 세이브의 건국 종족 전기, 사용자 제국 설계 전기도 기존 경로로 사용합니다.
- 세이브에서 실제 채택한 가치관을 읽습니다. 외교 단말기 연결과 연설 시작 때는 설치된 가치관 ID를 대상으로 게임에 직접 조회도 요청합니다. 실패하면 저장된 정보로 돌아갑니다. 새 조회는 LLM 호출이 아닙니다.
- 대화·편지·의회·연설에 실제 채택 목록의 설명을 전달합니다. 이름과 긴 설명을 잘라 전달하므로 모드 전체 텍스트가 매번 프롬프트에 들어가지 않습니다.

최근 세이브의 SLLM 세이브 번호가 현재 플레이와 다르면 그 세이브의 깃발·전기·가치관은 사용하지 않습니다. 현재 게임을 저장한 뒤 확인하세요. 저장 형식과 직접 조회는 실제 게임에서 검수해야 합니다.

연설의 기본 분위기 계산은 기존 기본 윤리 점수표를 유지합니다. 모드 가치관의 설명은 군중의 AI 반응에 반영되지만, 새 가치관의 별도 수치 보너스를 자동 생성하지 않습니다.

## 호환 파일 예시

```json
{
  "version": 1,
  "id": "my_mod",
  "name": "내 모드 호환",
  "matchModIds": ["창작마당_번호"],
  "ethics": {
    "ethic_ecologist": {
      "name": "생태주의",
      "description": "생태계 보전과 지속 가능한 개발을 중시한다.",
      "behavior": "환경 파괴에 비판적이며 장기적인 공존을 선호한다."
    }
  },
  "countryTypes": {
    "my_contactable_country": {
      "contact": true,
      "actions": false,
      "description": "대화는 가능하지만 조약·자원·호감 변경은 하지 않는다."
    },
    "my_battle_dummy": { "contact": false }
  },
  "empires": {
    "실제 게임에 표시되는 제국 이름": {
      "lore": "이 제국에만 적용할 배경 설명",
      "flag": "images/my-flag.png"
    }
  },
  "events": {
    "major_event": {
      "title": "모드의 주요 사건 발생",
      "description": "확인된 사건에 대한 짧은 설명"
    }
  }
}
```

- `matchModIds`: 하나라도 현재 활성 모드의 `remote_file_id`와 일치해야 적용합니다. 비워 두면 공통 설정으로 적용됩니다. 로컬 모드 ID는 진단 화면의 `id`를 사용하세요.
- `ethics`: 실제 정의 파일의 ID를 사용합니다. 설명 보충용 ID만 추가했다고 게임에 해당 가치관이 생기지는 않습니다. 직접 조회에는 실제 설치 정의에서 발견한 ID만 사용합니다.
- `countryTypes`: 기본값은 일반·몰락·각성 제국만 연락 허용입니다. 새로운 유형은 명시적으로 허용하세요. 실제 통신이 열린 국가만 발견하며, 접촉하지 않은 국가를 강제로 노출하지 않습니다.
- 추가 유형의 `actions`는 기본 false입니다. true일 때만 외교 대화에서 발생하는 제안·호감 변경을 허용합니다. 개발자용 직접 실행 도구는 별개입니다. 게임 효과 자체가 해당 유형을 지원하는지는 인게임에서 확인해야 합니다.
- `empires`: 정확한 표시 이름을 사용합니다. 동명이국은 이 방식으로 구분하지 못하므로 진단 후 고유 이름을 사용하는 것이 좋습니다. 사용자 설명은 자동 전기보다 우선합니다.
- `flag`: 호환 JSON 옆 폴더를 기준으로 한 상대 경로의 PNG/JPEG, 최대 5MB입니다. 모드 압축 내부의 사용자 대체 PNG는 지원하지 않으며 사용자 호환 폴더에서 지정하세요. 기본 DDS 검색과는 별개입니다.
- 편집 내용을 다시 읽으면 실시간 가치관 캐시는 지웁니다. 연락처에서 다시 연결하거나 연설을 시작하면 새 조회를 요청합니다.

## 실제 사건 전달 API

호환 JSON의 `events`는 사건의 의미를 정의합니다. 그것만으로 게임에서 사건이 발생했다고 기록하지 않습니다. 실제 발생 지점에서 다음 효과를 호출하는 별도 연동 패치가 필요합니다.

```text
# Scope: 사건을 알게 된 인간 플레이어 국가
sllm_probe_compat_event = {
 PACK = my_mod
 EVENT = major_event
 WHERE = unknown
}
```

효과는 세이브 번호·게임 날짜·사건 번호를 포함한 `SLLM:COMPAT_EVENT`를 기록합니다. 현재 세이브와 일치하고 활성 호환 파일에 정의된 사건만 연대기·라디오로 전달합니다. 같은 세션에서 같은 사건 신호의 중복을 걸러내고 연대기도 고유 번호로 저장합니다.

사건을 모르는 플레이어에게까지 전달하거나, 설치 여부만으로 위기가 발생했다고 기록하지 마세요. 이 효과는 실제 사건의 결과를 변경하지 않고 로그만 남깁니다. 매개변수에는 따옴표·줄바꿈·`/;/` 등을 포함하지 않은 짧은 식별자를 사용하세요.

## 기가스트럭처

기가스트럭처가 활성화되면 내장 사건 전달 파일을 읽습니다. `gigastructures.json.disabled`는 이를 사용자 호환 폴더에서 보충할 때 쓸 수 있는 예시이며 창작마당 ID 1121692237에 연결되어 있습니다. 전용 위기 국가를 일괄 연락 가능하게 만들지 않습니다. 실제 국가 유형을 진단에서 확인하고 필요한 유형만 허용하세요.

일반 거대구조물 신호 수집은 기존 `on_megastructure_built` 경로를 유지합니다. 단계별 업그레이드 수집은 추가하지 않았습니다. 이 게임 신호가 특정 구조물에서 건설 기지와 최종 완공 중 무엇을 나타내는지는 게임에서 확인해야 합니다. 최종 완공이 별도 모드 이벤트로만 확인되는 구조물은 그 실제 완공 이벤트에서 위 전달 API를 호출하세요. 같은 완공을 공통 신호와 별도 패치 양쪽에서 중복 전달하지 마세요.

이 파일은 기가스트럭처 고유 위기 이벤트를 이미 자동 감지한다는 뜻이 아닙니다. 고유 사건의 실제 발생 지점을 연결하는 패치는 해당 모드 버전에 맞춰 별도로 검수해야 합니다. 기본 가치관·깃발·설명 검색은 별도 기가스트럭처 패치 없이 공통 수집기로 처리합니다.

## 게임 PC에서 검수할 것

1. 진단의 활성 모드 ID·순서가 런처와 같은지 확인.
2. 모드 전용 깃발의 실제 파일 출처와 앱 그림을 비교. 누락·부분 렌더링·DDS 오류·색상 누락 확인.
3. 현재 게임을 저장하고, 채택한 모드 가치관과 진단의 IDs를 비교.
4. 단말기 연결 후 `ETHIC_BEGIN`/`ETHIC`/`ETHIC_END` 수신 및 live 표시 확인. `error.log`의 알 수 없는 가치관·스크립트 오류도 확인.
5. 기본 국가와 허용한 모드 국가의 연락 가능 여부를 확인. `actions=false`일 때 게임 행동이 생성되지 않는지 확인.
6. 실제 완공 또는 고유 사건 후에만 연대기·라디오에 나타나는지 확인.
7. 세이브를 바꾸고 이전 세이브의 정보가 사용되지 않는지 확인.

## English summary

Open Settings → Developer mode → Mod compatibility. Local JSON packs live in the application's user-data compatibility folder. Rename a `.json.disabled` example to `.json`, edit it, then reload mod data. Mod authors may ship unique JSON files under `sllm/compatibility/` in their mod.

Packs provide descriptions for ethic IDs, explicit country contact/action policies, exact-name empire lore/PNG overrides, and event descriptions. `matchModIds` limits a pack to an active Workshop ID (or the ID shown by diagnostics). Extra country types default to blocked; explicitly enabled types default to dialogue only. Data files never execute scripts.

Ethics adoption comes from a matching save or a live, read-only console query. Definitions alone do not prove adoption. Event definitions alone do not prove occurrence: a game-side integration patch must call `sllm_probe_compat_event` in the informed human player's country scope when the event actually happens. This is not a complete Gigastructures crisis integration. Upgrade-stage collection is intentionally not added. Verify final-completion behavior in the actual game.
