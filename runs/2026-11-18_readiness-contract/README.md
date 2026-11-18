# DMFoot 공개 상태 확인 경로

2026-11-18 18:22 EST

공개 Vercel 운영의 계약은 `GET /api/health`입니다. 이 경로는 HTTP 200, `ok: true`, 설정된 저장소 종류를 반환합니다. 홈, 관리자·임상의·센서 HTML도 HTTP 200을 반환했습니다. 운영 계정 로그인이나 실제 Google Drive 조회는 실행하지 않았습니다. [응답 증거](production-verification.json)

`GET /api/ready`는 공개 운영 소스에 등록되지 않아 HTTP 404입니다. 현재 GitHub Production 성공 기록은 `869c77e` v0.2.1입니다. Synology 후보 v0.2.3은 초안 PR #1의 `6f1a90b`이며, 후보의 `/api/ready`는 제한된 원격 저장소 확인이 성공해야 HTTP 200을 반환합니다.

- 운영 소스의 `npm run check`, `npm run build`, 합성 원격 저장소 설정의 HTTP 경로 계약을 검증했습니다. 합성 확인 중 외부 저장소로 요청을 보내면 테스트가 실패하도록 설정했습니다.
- Synology 후보의 기존 `npm run test:readiness`가 Supabase와 Google Drive 합성 요청에서 통과했습니다.
- 검증 자료만 별도 브랜치에 기록했습니다. 기존 checkout의 특허 문서 미커밋 변경을 보존하기 위해 Git 작업트리를 분리했습니다.

## 재검증

1. 이 브랜치의 GitHub 원격을 가져와 `backup.md`와 검증 JSON을 확인합니다.
2. 현재 운영에서는 `curl --fail --silent --show-error https://dmfoot.wiregene.com/api/health` 응답의 HTTP 200과 `ok: true`를 확인합니다. Google Drive 운영 설정은 `storage.kind: remote`로 표시됩니다.
3. Synology로 운영을 이전할 때에는 후보 포트에서 `/api/ready`의 응답을 따로 확인한 뒤 운영 대상을 변경합니다.
