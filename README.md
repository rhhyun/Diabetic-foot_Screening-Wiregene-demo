# Diabetic-foot_Screening-Wiregene-demo

Wiregene 당뇨발 위험평가 연구 문진의 공개 데모 저장소입니다.

이 저장소는 환자용 문진 화면만 포함합니다. 관리자, 의사용 측정, 센서 입력, 백엔드, DB, 배포용 서버 설정은 포함하지 않습니다.

## 포함 파일

- `index.html`
- `app.mjs`
- `models.mjs`
- `storage.mjs`
- `styles.css`

## 데모 특성

- GitHub Pages에 바로 올릴 수 있는 정적 웹 구조입니다.
- 응답 데이터는 서버로 전송되지 않습니다.
- 입력 내용은 각 사용자의 브라우저 `localStorage`에만 저장됩니다.
- 공개 테스트용이므로 실제 이름, 휴대폰 번호, 이메일 대신 예시 정보를 사용하는 것을 권장합니다.

## 배포 주소 예시

- `https://<github-username>.github.io/<repo-name>/`

## GitHub Pages 배포 방법

1. 이 폴더를 별도 공개 저장소로 업로드합니다.
2. 저장소 `Settings > Pages`에서 Source를 `GitHub Actions`로 설정합니다.
3. `main` 브랜치에 푸시하면 `.github/workflows/deploy-pages.yml`이 자동 배포합니다.

## 주의

- 이 저장소는 공개 데모용입니다.
- 연구용 실제 데이터 수집이나 관리자 기능 운영에는 사용하지 않습니다.
- 실제 운영은 비공개 백엔드와 DB가 연결된 본 저장소에서 진행합니다.
