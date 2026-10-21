# 비서 그림·화면 작업 결과 — 2026-10-19

- 사용자 첨부 얼굴 시트의 오른쪽 위 정면 얼굴과 태블릿 자세를 기준으로 내장 이미지 생성 도구 사용. 기존 idle/report/smile/sad/stern/think는 교체하지 않음.
- 새 투명 자세 6장: bow, worried, shy, surprised, laugh, tender. 1024×1536 허벅지 프레이밍. 실알파 확인(배경 투명, 인물 유효 불투명 픽셀).
- 이벤트 의상 5장: idle_casual, smile_casual, think_casual, idle_mourning, sad_mourning. 1024×1536 투명 PNG.
- 배경 5장: balcony, restaurant, funeral_rain, office_night, maint_bay.
- CG 7장: balcony, restaurant, mourning, retire_tv, farewell, war_night, maintenance. 국장은 인파 속 뒷모습. 통치자 얼굴은 보이지 않음.
- 가로 그림은 생성 원본 1672×941을 앱 규격 1920×1080으로 크기 정규화. 고유한 새 세부 묘사를 추가한 업스케일은 아님.
- 양쪽 ui/assets/secretary에 23장 추가. 기본 자세 12개 파일이 모두 존재하되 idle/report는 기존 동일 그림. 선택 사항인 1024×1792 전신 확장은 이번 범위에서 제외.

## 화면

- office-secretary.css에 범위 한정 스타일 추가: 하단 대화창, 지문/대사 계층, 2열 선택지, 직접 말하기와 시간 종료 안내의 내부 배치, 여운 꼬리표, 데이트 버튼, 스크롤 기록 및 회상 썸네일, 쪽지, 퇴임 카드, 금빛 알림 점.
- office-secretary.js는 표시만 변경: 이벤트 id 데이터 속성, 강제 국장 표시 준비, 배경 로드 페이드. IPC·AI·저장·이벤트 진행 규칙 유지.
- 움직임 줄이기 설정에서 애니메이션/전환 중지. 국장 진입은 홀로그램 축소 대신 어두운 페이드.
- 기존 클래스·id 및 #secScene.ev::after{display:none} 유지. 새 UI 문구 없음. 기존 L 번역 경로 유지.

## 확인

- 프로젝트 selftest: PASS 2390 / FAIL 0. JS 구문 검사 통과. 표시 변경만 있으므로 TypeScript 재빌드 불필요.
- 실제 office-secretary.js와 CSS를 격리된 모의 데이터로 렌더링. 1920×1080, 2560×1080, 900×600 × ko/en/zh-CN 총 9조합: 화면 가로 넘침 없음, 대화창 화면 안, 직접 입력 존재, 깨진 이미지 0, 콘솔 오류 0.
- 6개 이벤트 CG, 업무 화면·기록, 쪽지·퇴임 카드, 21:9 CG 캡처 확인.
- 중국어 시험 팩 로드 확인. 기존 시험 팩에 비서 문구 번역이 없어 해당 문구는 영어로 대체 표시됨(중국어 완역으로 표기하지 않음). 샘플 대사는 모의 데이터임.
- 새 이미지 23개 양쪽 앱 해시 일치. 설치기 제거 목록에 추가 파일과 하위 폴더 반영.
- 실제 게임·실제 AI 응답/이벤트 트리거는 이번 검사 대상 아님. 설치 EXE·배포 ZIP 재생성 안 함.
- 추가 실제 검수: 게임 국장 강제 진입 시점, 실제 AI 자세 선택/회상 진행, 개별 사용자 테마·배경 조합.

그림 제작 프롬프트 및 원본 경로: SECRETARY_GENERATION_PROMPTS_20261019.json. 예시: 바탕화면/새 폴더/비서_예시_20261019/비서_모아보기.html.
