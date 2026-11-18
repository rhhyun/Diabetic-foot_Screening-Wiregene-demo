# DMFoot v0.2.4 파비콘 복구

기준 운영 소스는 GitHub `main`의 `869c77e9b275d497b16e34b2a057ff240c9a2d61` v0.2.1입니다. Vercel의 공개 `/favicon.ico`가 HTTP 404를 반환했고 네 HTML 페이지에는 명시적인 아이콘 링크가 없었습니다.

- Wiregene 표식 ICO를 16·32·48px로 추가하고 홈, 관리자, 임상의, 센서 HTML에서 상대 경로로 연결했습니다.
- Vercel 정적 빌드와 GitHub Pages의 파일 목록에 ICO를 추가했습니다. Node 로컬 서버는 표준 아이콘 MIME 형식으로 제공합니다.
- 미병합 Synology 후보가 이미 v0.2.3을 사용하므로 새 릴리스는 v0.2.4입니다.
- `npm run check`, `npm run build`, 네 HTML의 아이콘 연결, Node의 ICO HTTP 200과 MIME 형식, 이미지 크기, 패키지 버전 및 GitHub Pages 목록을 검증했습니다.
- ICO 소스와 빌드 출력의 SHA-256은 모두 `15b598cc650c4a335b8df2d86285fd86c62614965cfa80eaeb45188133492731`입니다. 기존 공개 상태 확인 경로는 `/api/health`입니다.

## 운영 배포 확인

- GitHub `main`에 v0.2.4 `715bf00dc1fa4b265eb209a20bc15538f430abae`를 게시했습니다. Vercel Production 배포 7899547555와 GitHub Pages 작업 44423239204가 모두 성공했습니다.
- Vercel과 GitHub Pages의 네 HTML 파일에서 파비콘 링크를 확인했습니다. 두 사이트의 `/favicon.ico`는 HTTP 200과 올바른 MIME 형식으로 응답했고 파일 SHA-256이 로컬 빌드와 일치했습니다.
- Vercel의 `/api/health`도 HTTP 200과 `ok: true`를 반환했습니다. 운영 계정 로그인과 실제 저장소 연결은 검증하지 않았습니다. [운영 검증 JSON](production-verification.json)

## 이어서 검증하기

1. `npm run check`와 `npm run build`를 실행합니다.
2. Vercel 배포를 확인한 뒤 `https://dmfoot.wiregene.com/favicon.ico`의 HTTP 200 및 SHA-256을 대조합니다.
3. 공개 홈의 아이콘 링크와 `/api/health`의 HTTP 200 및 `ok: true`를 확인합니다.
