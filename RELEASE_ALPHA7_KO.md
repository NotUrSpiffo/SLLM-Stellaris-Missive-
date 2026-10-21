# 알파 7 — 2026-10-18 (빌드 직전 단계까지 완료, 설치기 미생성)

## 상태
- 버전 0.1.0-alpha.7 로 올림: package.json·package-lock.json(실행 앱·payload), tester-mod/descriptor.mod, sllm_probe_connection.txt HELLO version(payload·실행 앱·문서\mod\sllm_missive·sllm_missive_tester), 문서\mod\sllm_missive·sllm_missive_tester descriptor.mod, installer/setup.nsi APP_VERSION, 문서 README_KO·ALPHA_SETUP_KO/EN·RELEASE_NOTES_KO/EN.
- 연결 규격 5 그대로(올리면 구버전 모드에서 모든 명령이 막힘). 모드 파일은 바뀜 → 창작마당 재업로드 필요.
- 실행 앱(바탕화면\새 폴더\app\SLLM-Tester) = payload\app: src·ui·tester-mod·example·tools 파일 목록·크기 일치 확인. 맞추면서 실행 앱에 QA 세션 변경 10개를 반영(src galnews·mail·planets·radio, ui environment-ui·i18n-ui·index.html, tester-mod events/sllm_probe_mail·on_actions/sllm_probe_mail_on_actions·scripted_effects/sllm_probe_planets). 설치기 도구 2단계에서 해시로 다시 확인됨.
- 설치기(EXE)는 아직 만들지 않음 → 사용자가 `설치기_만들기.bat` 실행(버전은 이미 맞춰 둠). ui/assets/rooms 배경 그림(약 60MB)이 들어가서 설치기가 알파 6보다 커짐.

## 알파 6 이후 들어간 것 (CURRENT_TASKS 모든 세션 항목)
1. 집무실(홀로그램 바탕화면) 1단계 + 집무실에서 연 창 홀로그램에 붙이기(반투명)
2. 내 지도자 전원 명단 → 연락처(모드 sllm_people 이벤트)
3. 인물 1:1 통신 + 기억 + 신뢰
4. 지도자 특성 → 성격(모드 sllm_probe_leader_traits 생성 파일)
5. 개인 서신(인물이 먼저 보내는 편지, 부탁·특성 「지도자의 신임」)
6. 작별·추모관(사망·해임 이벤트, 비석·비문·작별 편지)
7. 정책 퀘스트(집무실 「정책」, 내부/외부, 목표 2개 5/10/20%, 기간 1~3년, 불이익·붕괴·유산·연장)
8. 언론 인터뷰 「정부 발표」 칙령(칙령 묶음 10개, 확인 카드, 반대 가치관 관계·항의 서신)
9. 함대 사령부 청문회 장면(브리핑실/심문실)
10. 종속국 채널 = 외교 공문실 + 청원·요구 실제 이행(자원·연구 지원, 종주국 거절 관계 −60)
11. 장면 배경 그림(집무실·만찬장·의회장·연설 무대·총독실·함대 브리핑실/심문실)
12. 애드온 언어 팩 구조 + 코드 안 한/영 쌍 번역(시험용 중국어 팩은 배포에 넣지 않음, 개발 폴더 language_packs 에만)
13. 영어 화면에 남은 한글 정리(창작마당 goldenfreddycl 제보)
14. QA 수정: 총독 주민 0(pop_amount), 백지평화를 패배로 묘사(war_sq 새 사건)

## 검사
- 격리 빌드(최신 payload src·ui·tester-mod): tsc 통과(electron 스텁 경고만), selftest PASS 2014 / FAIL 1.
  - FAIL 1 = A-22 예시 폴더 그림(격리 환경에 example/backgrounds PNG 없음). 실제 PC 에서는 통과해야 함.
- 화면 헤드리스 확인(한/영): 집무실 정책(메인·마법사 1~3단계·선언문), 언론 인터뷰 정부 발표 칸·확인 카드.

## 창작마당
- 폴더: dist/workshop_0.1.0-alpha.7/sllm_missive (122개 = tester-mod 와 같은 내용 + 창작마당 descriptor, remote_file_id 3819625112, version 0.1.0-alpha.7)
- 업로드 원본: 문서\Paradox Interactive\Stellaris\mod\sllm_missive (같은 파일 목록·크기·버전 확인). 업로드는 사용자가 직접.
- 변경 글: dist/workshop_0.1.0-alpha.7/창작마당_변경사항_0.1.0-alpha.7.txt (개발 폴더 최상위에도 한 부)
- 참고: 업로드 원본 폴더에 옛 `창작마당_변경사항_alpha5.txt` 가 아직 남아 있음(지우려면 사용자가 직접). 문서\mod\sllm_missive.mod 는 0바이트(다른 세션·사용자가 비운 것으로 보임, 손대지 않음).

## 미검수(게임 안에서 확인할 것)
- 집무실: 지도자 명단(has_skill·is_councilor·leader_class), 특성 읽기(has_trait 756개 3개월 1회), on_leader_death/fired 의 From·sllm_lid, 서신 부탁 add_trait·에너지 차감.
- 정책: 측정 명령 POLICYM/C/O 값, 선포 수정자 2개, 실패 불이익(안정도/관계), 유산, 1·3년 기간.
- 칙령: EDICTX 줄·has_ethic(광신 포함)·관계 수정자 표시·항의 서신, 수정자 기간.
- 종속국: has_resource·overlord 범위 add_resource/add_opinion_modifier.
- 현상 유지 평화(on_status_quo) 알림, 총독 주민 수(pop_amount).
- 실제 Windows 설치·덮어쓰기·제거.
