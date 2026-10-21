# Security Policy / 보안 정책

## Reporting a vulnerability / 취약점 제보

**Please do not post vulnerabilities in public GitHub issues or in public Discord channels.**
Public details can be abused before a fix is released.

1. Join the SLLM Discord: <https://discord.gg/AHAafadwgd>
2. **Send a direct message to the server owner** (or, if you cannot find them, post in a channel only that you have a security issue and ask for a private conversation, **without any details**).
3. Include what you can: what you found, the SLLM version, how to reproduce it, and what could go wrong.

**Response time:** we will reply **within one day (24 hours)** at the latest.
After that we will tell you whether we can reproduce it, how we plan to fix it, and roughly when. If you wish, we will credit you in the release notes once it is fixed.

---

**공개 GitHub 이슈나 공개 디스코드 채널에 취약점을 올리지 말아 주세요.**
고쳐지기 전에 내용이 알려지면 악용될 수 있습니다.

1. SLLM 디스코드에 들어옵니다: <https://discord.gg/AHAafadwgd>
2. **서버 주인에게 DM**을 보내 주세요. DM이 어렵다면 공개 채널에는 **세부 내용 없이** "보안 문제를 발견했으니 비공개로 대화하고 싶다"고만 남겨 주세요.
3. 가능한 범위에서 적어 주세요: 발견한 내용, SLLM 버전, 재현 방법, 일어날 수 있는 문제.

**답변 시간:** **늦어도 하루(24시간) 안에** 답변드립니다.
이후 재현 여부, 수정 계획, 대략적인 시기를 알려 드립니다. 원하시면 수정된 뒤 릴리스 노트에 제보자로 기록합니다.

## What we consider in scope / 제보 대상

- The game bridge DLL (`command-bridge.dll`) and `bridge-client.exe`
- The installer and its PowerShell scripts (`installer/`)
- App update verification (signature and hash checks, `src/app-update-core.ts`)
- Storage of API keys or other secrets
- Any way for a mod, letter, AI reply, imported file or save game to run code, write outside its folders, or send data it should not

Not in scope: Windows or antivirus warnings about the unsigned installer (explained in the README), problems in Stellaris itself, and AI provider behaviour.

## Supported versions / 지원 버전

Only the **latest release** receives security fixes. Please update before reporting.
최신 릴리스만 보안 수정을 받습니다. 제보 전에 최신 버전으로 업데이트해 주세요.

## Our promise / 약속

- We will not take action against people who report in good faith and do not harm other users or access data that is not theirs.
- 선의로 제보하고 다른 사용자에게 피해를 주거나 남의 데이터에 접근하지 않은 분께 불이익을 주지 않습니다.
