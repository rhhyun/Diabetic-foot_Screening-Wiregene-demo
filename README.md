# Diabetic-foot_Screening-Wiregene-demo

와이어젠의 당뇨발 조기진단 소프트웨어 역량을 외부에서 바로 시연할 수 있도록 만든 데모입니다.

현재 구조는 두 가지 모드를 모두 지원합니다.

- 정적 데모 모드: 브라우저 `localStorage`에 저장
- 중앙 DB 모드: `Node API + Supabase`를 통해 중앙 저장

같은 화면을 그대로 쓰면서, API가 살아 있으면 중앙 DB를 우선 사용하고, 없으면 자동으로 브라우저 저장으로 fallback 됩니다.

## 주요 파일

- `index.html`: 환자 문진
- `admin.html`: 관리자 운영, JSON 백업/복원, 분석/예측 대시보드
- `clinician.html`: 임상 측정 입력
- `sensor.html`: 센서/시계열 feature 입력, CSV 업로드
- `storage.mjs`: API 우선 저장 계층, local fallback 포함
- `models.mjs`: 규칙기반 위험도/예측 요약
- `record-utils.mjs`: record 정규화, snapshot 생성, summary 공용 함수
- `server.mjs`: 정적 파일 + Node API 서버
- `supabase-rest.mjs`: Supabase REST 연동 계층
- `supabase-schema.sql`: Supabase 테이블 생성 SQL
- `.env.example`: 서버 환경변수 예시
- `runtime-config.js`: 프런트 API base 설정

## 관리자 로그인

- 관리자 ID: `wiregene-admin`
- 관리자 비밀번호: `WG-demo-2026`

주의:

- 현재 관리자 로그인 자체는 데모용 프런트 세션 보호입니다.
- 중앙 DB는 Node API를 통해 연결되지만, 실서비스 수준 인증/권한 체계는 별도 고도화가 필요합니다.

## 중앙 DB 구성 방법

### 1. Supabase 준비

Supabase SQL Editor에서 `supabase-schema.sql` 내용을 실행합니다.

생성되는 핵심 테이블:

- `public.research_records`

이 테이블에는 다음 정보가 저장됩니다.

- `record_id`
- `created_at`
- `updated_at`
- `patient_summary`
- `app_risk_class`
- `active_concern`
- `record_payload`

실제 상세 데이터는 `record_payload(jsonb)` 안에 전체 record JSON으로 저장됩니다.

### 2. 환경변수 설정

`.env.example`을 참고해 `.env` 파일을 만듭니다.

필수 값:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

예시:

```env
HOST=0.0.0.0
PORT=3000
SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

### 3. 서버 실행

```bash
node server.mjs
```

또는 `package.json`의 스크립트:

```bash
npm run start
```

서버가 뜨면 다음을 함께 제공합니다.

- 정적 프런트 페이지 서빙
- `/api/health`
- `/api/records`
- `/api/database/export`
- `/api/database/import`

### 4. 프런트 연결

기본값은 `runtime-config.js`에서 `/api`를 바라봅니다.

즉:

- 같은 서버에서 프런트와 API를 함께 띄우면 별도 수정 없이 중앙 DB로 연결됩니다.
- API가 없으면 자동으로 브라우저 저장으로 fallback 됩니다.

## API 구조

### Health

- `GET /api/health`

응답 예:

```json
{
  "ok": true,
  "storage": {
    "kind": "remote",
    "label": "Supabase central DB",
    "detail": "Node API + Supabase REST 연결"
  }
}
```

### Records

- `GET /api/records`
- `GET /api/records/:recordId`
- `POST /api/records`
- `PUT /api/records/:recordId`
- `DELETE /api/records/:recordId`

### DB Snapshot

- `GET /api/database/export`
- `POST /api/database/import`

## 예측 로직

현재 예측은 규칙기반 데모입니다.

다음 항목을 요약합니다.

- 6개월 신규 궤양
- 6개월 재발 궤양
- 지속성 hotspot
- 상처 악화
- 혈관 평가 의뢰 필요
- 압력 분산 실패
- 고위험군 전환 가능성

문진, 임상, 센서, 시계열, rule-fusion 신호가 많아질수록 요약이 더 정교해집니다.

## 시연 권장 흐름

1. `index.html`에서 환자 문진 제출
2. `admin.html`에서 관리자 로그인
3. record 확인 및 수정
4. `clinician.html`에서 임상 측정값 연결
5. `sensor.html`에서 센서 feature 또는 CSV 입력
6. `admin.html`에서 전체 DB 백업/복원

## 검증

문법 검사는 아래로 확인할 수 있습니다.

```bash
node --check server.mjs
node --check supabase-rest.mjs
node --check storage.mjs
node --check admin.mjs
node --check clinician.mjs
node --check sensor.mjs
node --check models.mjs
node --check auth.mjs
node --check record-utils.mjs
```

## 다음 권장 단계

- Node API 관리자 인증을 서버 세션 기반으로 고도화
- Supabase Auth 또는 병원 내부 SSO 연동
- 연구자/관리자/임상의 권한 분리
- 감사 로그 추가
- 예측 결과 이력 테이블 분리
- 업로드 이미지/센서 원본 파일 저장소 분리
