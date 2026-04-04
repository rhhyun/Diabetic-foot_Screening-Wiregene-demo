# Diabetic-foot_Screening-Wiregene-demo

와이어젠의 당뇨발 조기진단 소프트웨어 역량을 외부에서 바로 확인할 수 있도록 만든 정적 데모입니다.  
GitHub Pages 같은 공개 환경에서도 `환자 문진`, `관리자 운영`, `임상 입력`, `센서 입력`, `JSON 기반 DB 백업/복원`, `규칙기반 예측 대시보드`를 함께 시연할 수 있도록 구성했습니다.

## 핵심 특징

- `index.html`: 환자 문진 공개 데모
- `admin.html`: 관리자 로그인, 연구 DB 운영, JSON 가져오기/내보내기, 예측 요약
- `clinician.html`: 임상 측정 입력
- `sensor.html`: 센서/시계열 feature 입력, CSV 업로드
- `storage.mjs`: 브라우저 `localStorage` 기반 record 저장 + 전체 DB JSON 백업/복원
- `models.mjs`: 문진 점수화, 융합 플래그, 규칙기반 예측/분석 요약

## 관리자 데모 로그인

- 관리자 ID: `wiregene-admin`
- 관리자 비밀번호: `WG-demo-2026`

주의:
- 이 로그인은 공개 데모 시연을 위한 브라우저 세션 보호입니다.
- 실제 운영 서비스용 보안 인증이 아닙니다.
- 실서비스에서는 반드시 서버 인증과 중앙 DB가 필요합니다.

## 현재 데모의 저장 방식

- 모든 연구 record는 기본적으로 각 사용자의 브라우저 `localStorage`에 저장됩니다.
- 따라서 같은 URL이라도 브라우저/기기/사용자마다 DB가 분리됩니다.
- 이 한계를 보완하기 위해 관리자 페이지에서 전체 연구 DB를 JSON으로 내보내고, 다시 가져와 병합 또는 전체 교체할 수 있게 했습니다.

## 시연 권장 흐름

1. `index.html`에서 환자 문진을 제출합니다.
2. `admin.html`에 관리자 계정으로 로그인합니다.
3. 문진 record를 검토하고 필요한 정보를 수정합니다.
4. `clinician.html`에서 임상 측정값을 같은 record에 추가합니다.
5. `sensor.html`에서 센서 feature 또는 CSV를 입력합니다.
6. 필요 시 관리자 페이지에서 전체 DB를 JSON으로 백업합니다.

## 예측 로직

- 현재 예측은 규칙기반(rule-based) 데모입니다.
- 문진, 임상, 센서, 시계열, 융합 신호를 함께 사용해 다음 항목을 요약합니다.
  - 6개월 신규 궤양
  - 6개월 재발 궤양
  - 지속성 hotspot
  - 상처 악화
  - 혈관 평가 의뢰 필요
  - 압력 분산 실패
  - 고위험군 전환 가능성

## 배포

정적 파일만으로 배포 가능하므로 GitHub Pages에 바로 올릴 수 있습니다.

- `https://<github-username>.github.io/<repo-name>/`
- `https://<github-username>.github.io/<repo-name>/admin.html`
- `https://<github-username>.github.io/<repo-name>/clinician.html`
- `https://<github-username>.github.io/<repo-name>/sensor.html`

## 실제 서비스로 확장하려면

다음 단계가 필요합니다.

- 중앙 DB(PostgreSQL, MySQL, Supabase 등)
- 서버 인증/권한 관리
- 관리자/임상/센서 입력에 대한 API
- 예측 모델 버전 관리와 결과 이력 저장
- 감사 로그와 개인정보 보호 설계
