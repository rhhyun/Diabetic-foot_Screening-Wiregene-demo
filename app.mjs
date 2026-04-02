import {
  buildCombinedResearchRecord,
  createInitialQuestionnaireAnswers,
} from "./models.mjs";
import { saveNewResearchRecord } from "./storage.mjs";

const STEP_TITLES = [
  "시작하기",
  "연구 설명 및 동의",
  "기본정보",
  "당뇨 정보",
  "과거 발 병력",
  "발 저림·통증",
  "혈액순환 증상",
  "현재 발 상태",
  "발 관리 습관",
  "신발·보행 습관",
  "동반질환",
  "추가 연구 참여",
  "확인 및 제출",
];

const STEP_DESCRIPTIONS = [
  "연구 목적과 데이터 구성을 먼저 확인합니다.",
  "연구용 안내와 동의 절차를 확인합니다.",
  "성별, 연령, 키와 몸무게를 입력합니다.",
  "당뇨 진단 기간과 치료 정보를 확인합니다.",
  "궤양, 절단, 입원과 진단 이력을 확인합니다.",
  "최근 3개월 기준의 저림과 통증을 묻습니다.",
  "허혈과 혈액순환 증상을 확인합니다.",
  "현재 발 상태를 확인합니다.",
  "일상적인 발 관리 습관을 확인합니다.",
  "신발과 보행 습관을 확인합니다.",
  "동반질환과 생활 위험요인을 확인합니다.",
  "추가 연구 연계 가능 여부를 확인합니다.",
  "입력 내용을 확인하고 제출합니다.",
];

const OPTIONS = {
  gender: [
    { value: "MALE", label: "남성" },
    { value: "FEMALE", label: "여성" },
  ],
  diagnosisDuration: [
    { value: "UNDER_1_YEAR", label: "1년 미만" },
    { value: "YEAR_1_TO_5", label: "1~5년" },
    { value: "YEAR_5_TO_10", label: "5~10년" },
    { value: "OVER_10_YEARS", label: "10년 이상" },
    { value: "UNKNOWN", label: "잘 모르겠음" },
  ],
  treatmentType: [
    { value: "NONE", label: "아니오" },
    { value: "ORAL_MEDICATION", label: "먹는 약" },
    { value: "INSULIN", label: "인슐린" },
    { value: "ORAL_AND_INSULIN", label: "먹는 약과 인슐린 모두" },
    { value: "UNKNOWN", label: "잘 모르겠음" },
  ],
  yesNo: [
    { value: "YES", label: "예" },
    { value: "NO", label: "아니오" },
  ],
  yesNoUnknown: [
    { value: "YES", label: "예" },
    { value: "NO", label: "아니오" },
    { value: "UNKNOWN", label: "잘 모르겠음" },
  ],
  hbA1cMode: [
    { value: "ENTER_VALUE", label: "수치를 입력할게요" },
    { value: "UNKNOWN", label: "당화혈색소는 모르겠음" },
  ],
  diagnosedConditions: [
    { value: "DIABETIC_FOOT", label: "당뇨발" },
    { value: "NEUROPATHY", label: "말초신경병증" },
    { value: "PAD", label: "말초혈관질환" },
    { value: "NONE", label: "없음" },
    { value: "UNKNOWN", label: "모르겠음" },
  ],
  frequency4: [
    { value: "NONE", label: "전혀 없음" },
    { value: "SOMETIMES", label: "가끔 있음" },
    { value: "OFTEN", label: "자주 있음" },
    { value: "ALMOST_ALWAYS", label: "거의 항상 있음" },
  ],
  nightPain: [
    { value: "NONE", label: "아니오" },
    { value: "SOMETIMES", label: "가끔" },
    { value: "OFTEN", label: "자주" },
    { value: "ALMOST_ALWAYS", label: "항상" },
  ],
  threeLevel: [
    { value: "NONE", label: "없음" },
    { value: "SOMETIMES", label: "가끔" },
    { value: "OFTEN", label: "자주" },
  ],
  footCheck: [
    { value: "DAILY", label: "매일" },
    { value: "WEEKLY_2_3", label: "주 2~3회" },
    { value: "RARELY", label: "거의 안 함" },
    { value: "NEVER", label: "전혀 안 함" },
  ],
  care: [
    { value: "ALWAYS", label: "항상" },
    { value: "SOMETIMES", label: "가끔" },
    { value: "RARELY", label: "거의 안 함" },
  ],
  barefoot: [
    { value: "NEVER", label: "없음" },
    { value: "SOMETIMES", label: "가끔" },
    { value: "OFTEN", label: "자주" },
  ],
  tightShoes: [
    { value: "NO", label: "아니오" },
    { value: "SOMETIMES", label: "가끔" },
    { value: "OFTEN", label: "자주" },
  ],
  walkingTime: [
    { value: "UNDER_30_MIN", label: "30분 미만" },
    { value: "MIN_30_TO_60", label: "30분~1시간" },
    { value: "HOUR_1_TO_2", label: "1~2시간" },
    { value: "OVER_2_HOURS", label: "2시간 이상" },
  ],
  smoking: [
    { value: "NO", label: "아니오" },
    { value: "PAST", label: "과거 흡연" },
    { value: "CURRENT", label: "현재 흡연" },
  ],
  sensorStudy: [
    { value: "YES", label: "예" },
    { value: "NO", label: "아니오" },
    { value: "LATER", label: "추후 결정" },
  ],
  presentAbsentUnknown: [
    { value: "NO", label: "없음" },
    { value: "YES", label: "있음" },
    { value: "UNKNOWN", label: "잘 모르겠음" },
  ],
};

const state = {
  stepIndex: 0,
  showIntroDetails: false,
  showPhotoPicker: false,
  validationErrors: [],
  questionnaire: createInitialQuestionnaireAnswers(),
  submission: null,
};

const root = document.querySelector("#app");

render();

root.addEventListener("click", handleClick);
root.addEventListener("input", handleInput);
root.addEventListener("change", handleChange);

async function handleClick(event) {
  const target = event.target.closest("[data-action]");
  if (!target) return;

  const { action } = target.dataset;
  if (action === "start-questionnaire") {
    state.stepIndex = 1;
    state.validationErrors = [];
  } else if (action === "toggle-intro") {
    state.showIntroDetails = !state.showIntroDetails;
  } else if (action === "next-step") {
    const errors = validateStep(state.stepIndex);
    if (errors.length) state.validationErrors = errors;
    else {
      state.validationErrors = [];
      state.stepIndex = Math.min(state.stepIndex + 1, STEP_TITLES.length - 1);
    }
  } else if (action === "prev-step") {
    state.validationErrors = [];
    state.stepIndex = Math.max(state.stepIndex - 1, 0);
  } else if (action === "jump-step") {
    state.validationErrors = [];
    state.stepIndex = Number(target.dataset.step);
  } else if (action === "toggle-consent") {
    const { field } = target.dataset;
    state.questionnaire.consent[field] = !state.questionnaire.consent[field];
    state.validationErrors = [];
  } else if (action === "set-choice") {
    updateQuestionnaireField(target.dataset.section, target.dataset.field, target.dataset.value);
  } else if (action === "toggle-condition") {
    toggleCondition(target.dataset.value);
  } else if (action === "toggle-photo-picker") {
    state.showPhotoPicker = !state.showPhotoPicker;
  } else if (action === "submit-questionnaire") {
    const invalid = findFirstInvalidStep();
    if (invalid) {
      state.stepIndex = invalid.stepIndex;
      state.validationErrors = invalid.errors;
    } else {
      state.validationErrors = [];
      const combinedRecord = buildCombinedResearchRecord({
        questionnaireAnswers: state.questionnaire,
      });
      try {
        state.submission = await saveNewResearchRecord(combinedRecord);
      } catch {
        state.validationErrors = ["저장 중 문제가 발생했습니다. 잠시 후 다시 시도해 주세요."];
      }
    }
  } else if (action === "restart") {
    resetState();
  }

  render();
}

function handleInput(event) {
  const target = event.target;
  if (!(target instanceof HTMLInputElement)) return;
  if (!target.dataset.section || !target.dataset.field) return;
  updateQuestionnaireField(target.dataset.section, target.dataset.field, target.value);
}

function handleChange(event) {
  const target = event.target;
  if (!(target instanceof HTMLInputElement)) return;
  if (target.type !== "file") return;
  state.questionnaire.currentFoot.photoFileNames = Array.from(target.files ?? []).map((file) => file.name);
  if (state.questionnaire.currentFoot.photoFileNames.length) state.showPhotoPicker = true;
  render();
}

function render() {
  root.innerHTML = state.submission ? renderCompletion() : renderQuestionnaire();
}

function renderQuestionnaire() {
  const progress = Math.round(((state.stepIndex + 1) / STEP_TITLES.length) * 100);
  return `
    <main class="app-shell">
      <aside class="side-panel">
        <section class="hero-card">
          <p class="eyebrow">Wiregene Research App</p>
          <h1><span>당뇨발 위험평가</span><span>연구 문진</span></h1>
          <p>큰 글씨와 짧은 질문으로 구성되어 있어 몇 분 안에 편하게 응답할 수 있습니다.</p>
        </section>
        <section class="progress-card">
          <p class="eyebrow tint">진행 상태</p>
          <div class="progress-track"><div class="progress-fill" style="width:${progress}%"></div></div>
          <p class="progress-copy">${state.stepIndex + 1} / ${STEP_TITLES.length} 단계</p>
        </section>
        <ol class="step-list">
          ${STEP_TITLES.map((title, index) => `
            <li>
              <button class="step-chip ${index === state.stepIndex ? "current" : index < state.stepIndex ? "done" : ""}" data-action="jump-step" data-step="${index}">
                <span>${index + 1}</span>
                <strong>${escapeHtml(title)}</strong>
              </button>
            </li>
          `).join("")}
        </ol>
        <section class="notice-card">
          문진 결과는 발 건강 상태를 살피는 참고 자료로 사용되며, 자세한 평가는 의료진이 함께 확인합니다.
        </section>
      </aside>
      <section class="main-panel">
        <header class="panel-header">
          <div class="header-top-row">
            <div class="badge-row">
              <span class="badge">IWGDF 2023/2024</span>
              <span class="badge soft">연구용 문진</span>
            </div>
            <div class="top-copyright">Copyright 2026 Wiregene Co., Ltd.</div>
          </div>
          <div class="panel-heading">
            <div>
              <p class="step-caption">${state.stepIndex + 1}. ${escapeHtml(STEP_TITLES[state.stepIndex])}</p>
              <h2>${escapeHtml(STEP_TITLES[state.stepIndex])}</h2>
              <p class="step-description">${escapeHtml(STEP_DESCRIPTIONS[state.stepIndex])}</p>
            </div>
            <div class="panel-progress">
              <span>진행률</span>
              <strong>${progress}%</strong>
            </div>
          </div>
          <div class="progress-track wide"><div class="progress-fill" style="width:${progress}%"></div></div>
          ${renderValidation()}
        </header>
        <div class="panel-body">${renderStep()}</div>
      </section>
    </main>
    ${state.stepIndex > 0 ? renderStickyFooter() : ""}
  `;
}

function renderCompletion() {
  const attention = state.submission.questionnairePayload.internalFlags.active_concerning_foot_symptom;
  return `
    <main class="completion-shell">
      <section class="completion-card">
        <div class="completion-hero">
          <div class="header-top-row">
            <p class="eyebrow">Submission Complete</p>
            <div class="top-copyright">Copyright 2026 Wiregene Co., Ltd.</div>
          </div>
          <h1>문진이 완료되었습니다</h1>
          <p>응답 내용이 안전하게 접수되었습니다. 연구팀은 더 나은 당뇨발 예방과 조기 발견 도구 개발에 이 정보를 활용합니다.</p>
        </div>
        <div class="completion-grid">
          <article class="mini-card">
            <strong>응답 내용</strong>
            <p>입력한 문진 답변이 정상적으로 저장되었습니다.</p>
          </article>
          <article class="mini-card">
            <strong>연구 활용</strong>
            <p>당뇨발 위험을 더 이르게 살피는 연구와 예측모델 개발에 활용됩니다.</p>
          </article>
          <article class="mini-card">
            <strong>다음 안내</strong>
            <p>현재 상처, 붉어짐, 심한 통증이 있으면 문진 결과와 관계없이 의료진 상담이 필요합니다.</p>
          </article>
        </div>
        <div class="summary-banner">
          응답이 저장되었습니다. 필요한 경우 연구팀이 별도로 안내드립니다.
        </div>
        <div class="alert-box ${attention ? "danger" : ""}">
          ${
            attention
              ? "현재 발에 상처, 붉어짐, 열감 또는 심한 통증이 있다면 빠르게 의료진과 상담해 주세요."
              : "문진 결과와 관계없이 현재 발에 상처나 심한 통증이 생기면 의료진 상담이 필요합니다."
          }
        </div>
        <div class="button-row">
          <button class="secondary-button" data-action="restart">처음부터 다시 입력</button>
        </div>
        <p class="copyright-line">제작: 주식회사 와이어젠 | Copyright 2026 Wiregene Co., Ltd.</p>
      </section>
    </main>
  `;
}

function resetState() {
  state.stepIndex = 0;
  state.showIntroDetails = false;
  state.showPhotoPicker = false;
  state.validationErrors = [];
  state.questionnaire = createInitialQuestionnaireAnswers();
  state.submission = null;
}

function renderStep() {
  switch (state.stepIndex) {
    case 0:
      return renderStartStep();
    case 1:
      return renderConsentStep();
    case 2:
      return renderBasicInfoStep();
    case 3:
      return renderDiabetesStep();
    case 4:
      return renderHistoryStep();
    case 5:
      return renderNeuropathyStep();
    case 6:
      return renderIschemiaStep();
    case 7:
      return renderCurrentFootStep();
    case 8:
      return renderSelfCareStep();
    case 9:
      return renderFootwearStep();
    case 10:
      return renderComorbidityStep();
    case 11:
      return renderResearchStep();
    case 12:
      return renderSummaryStep();
    default:
      return "";
  }
}

function renderStartStep() {
  return `
    <section class="intro-grid">
      <article class="start-card dark">
        <p class="eyebrow">Patient Flow</p>
        <h3>발 건강 상태를 쉽게 확인합니다</h3>
        <p>발 상태와 생활 습관에 대해 차례대로 답하면 됩니다.</p>
        <div class="button-row">
          <button class="primary-button" data-action="start-questionnaire">문진 시작하기</button>
          <button class="secondary-button inverse" data-action="toggle-intro">연구 설명 보기</button>
        </div>
      </article>
      <article class="start-card">
        <div class="mini-card"><strong>예상 시간</strong><p>약 3~5분</p></div>
        <div class="mini-card"><strong>응답 방식</strong><p>짧은 질문에 버튼으로 편하게 답하기</p></div>
        <div class="mini-card"><strong>향후 활용</strong><p>최신 인공지능 기반 예측모델 개발</p></div>
        <div class="mini-card"><strong>데모 안내</strong><p>이 공개 데모는 현재 브라우저 안에만 저장됩니다. 실제 개인정보 대신 예시 정보를 권장합니다.</p></div>
      </article>
      ${
        state.showIntroDetails
          ? `<article class="detail-card">
              <p>응답해 주신 내용은 당뇨발 위험을 더 이르게 살피고, 더 나은 예방 도구를 개발하기 위한 연구에 활용됩니다.</p>
            </article>`
          : ""
      }
    </section>
  `;
}

function renderConsentStep() {
  return `
    ${infoPanel("본 문진은 연구용 정보 수집 목적이며 현재 진단 또는 치료를 대신하지 않습니다. 발에 상처가 있거나 심한 증상이 있으면 의료진 상담이 필요합니다.", "warning")}
    ${questionCard("연구 설명을 읽고 이해하였습니까?", consentToggle("readAndUnderstood", "연구 설명을 읽고 이해하였음", state.questionnaire.consent.readAndUnderstood))}
    ${questionCard("연구 참여에 동의하십니까?", consentToggle("agreedToParticipate", "연구 참여에 동의함", state.questionnaire.consent.agreedToParticipate))}
  `;
}

function renderBasicInfoStep() {
  return `
    <section class="triple-grid">
      ${questionCard("환자 이름", textField("demographics", "fullName", state.questionnaire.demographics.fullName, "text", "예: 홍길동"))}
      ${questionCard("휴대폰 번호", textField("demographics", "phoneNumber", state.questionnaire.demographics.phoneNumber, "tel", "예: 01012345678"))}
      ${questionCard("이메일", textField("demographics", "emailAddress", state.questionnaire.demographics.emailAddress, "email", "예: wiregene@example.com"))}
    </section>
    ${questionCard("성별", choiceGrid("demographics", "gender", state.questionnaire.demographics.gender, OPTIONS.gender))}
    <section class="triple-grid">
      ${questionCard("연령", numberField("demographics", "age", state.questionnaire.demographics.age, "세", "예: 68"))}
      ${questionCard("키", numberField("demographics", "heightCm", state.questionnaire.demographics.heightCm, "cm", "예: 163"))}
      ${questionCard("몸무게", numberField("demographics", "weightKg", state.questionnaire.demographics.weightKg, "kg", "예: 61"))}
    </section>
  `;
}

function renderDiabetesStep() {
  const diabetes = state.questionnaire.diabetes;
  return `
    ${questionCard("당뇨병 진단을 받은 지 얼마나 되었습니까?", choiceGrid("diabetes", "diagnosisDuration", diabetes.diagnosisDuration, OPTIONS.diagnosisDuration, 3))}
    ${questionCard("현재 당뇨 치료를 받고 있습니까?", choiceGrid("diabetes", "treatmentType", diabetes.treatmentType, OPTIONS.treatmentType, 3))}
    ${questionCard("최근 혈당 또는 당화혈색소 수치를 알고 있습니까?", `
      ${choiceGrid("diabetes", "knowsRecentGlucoseOrHbA1c", diabetes.knowsRecentGlucoseOrHbA1c, OPTIONS.yesNo)}
      ${
        diabetes.knowsRecentGlucoseOrHbA1c === "YES"
          ? `<div class="sub-block">
              <h4>최근 당화혈색소를 알고 있다면 입력해 주세요.</h4>
              ${choiceGrid("diabetes", "hbA1cMode", diabetes.hbA1cMode, OPTIONS.hbA1cMode)}
              ${diabetes.hbA1cMode === "ENTER_VALUE" ? numberField("diabetes", "hbA1c", diabetes.hbA1c, "%", "예: 7.2", "0.1") : ""}
            </div>`
          : ""
      }
    `)}
  `;
}

function renderHistoryStep() {
  const history = state.questionnaire.history;
  return `
    ${questionCard("이전에 발에 상처나 궤양이 생긴 적이 있습니까?", choiceGrid("history", "ulcerHistory", history.ulcerHistory, OPTIONS.yesNoUnknown), "궤양은 잘 낫지 않는 발 상처를 뜻합니다.")}
    ${questionCard("발가락 또는 발의 일부를 절단한 적이 있습니까?", choiceGrid("history", "amputationHistory", history.amputationHistory, OPTIONS.yesNo))}
    ${questionCard("당뇨발로 입원하거나 시술·수술을 받은 적이 있습니까?", choiceGrid("history", "admissionOrProcedureHistory", history.admissionOrProcedureHistory, OPTIONS.yesNoUnknown))}
    ${questionCard("의사에게 아래와 같은 말을 들은 적이 있습니까?", multiSelectGrid(history.diagnosedConditions), "해당되는 항목을 모두 선택해 주세요.")}
  `;
}

function renderNeuropathyStep() {
  const neuropathy = state.questionnaire.neuropathy;
  return `
    ${infoPanel("최근 3개월 기준으로 가장 가까운 답을 선택해 주세요.", "neutral")}
    ${questionCard("발이 저리거나 감각이 둔한 느낌이 있습니까?", choiceGrid("neuropathy", "numbness", neuropathy.numbness, OPTIONS.frequency4))}
    ${questionCard("발바닥 감각이 둔해졌다고 느낀 적이 있습니까?", choiceGrid("neuropathy", "reducedSoleSensation", neuropathy.reducedSoleSensation, OPTIONS.frequency4))}
    ${questionCard("발이 화끈거리거나 타는 듯한 느낌이 있습니까?", choiceGrid("neuropathy", "burning", neuropathy.burning, OPTIONS.frequency4))}
    ${questionCard("밤에 발 통증 또는 불편감이 심해집니까?", choiceGrid("neuropathy", "nightPain", neuropathy.nightPain, OPTIONS.nightPain))}
    ${questionCard("뜨거운 바닥이나 차가운 바닥을 잘 못 느낀다고 생각합니까?", choiceGrid("neuropathy", "temperatureLoss", neuropathy.temperatureLoss, OPTIONS.yesNoUnknown))}
  `;
}

function renderIschemiaStep() {
  const ischemia = state.questionnaire.ischemia;
  return `
    ${questionCard("걸을 때 종아리나 발에 통증이 생기고 쉬면 좋아집니까?", choiceGrid("ischemia", "walkingPainRelievedByRest", ischemia.walkingPainRelievedByRest, OPTIONS.yesNoUnknown))}
    ${questionCard("쉬고 있을 때에도 발이나 발가락이 아픈 적이 있습니까?", choiceGrid("ischemia", "restPain", ischemia.restPain, OPTIONS.threeLevel))}
    ${questionCard("발이 다른 사람보다 차갑다고 느낀 적이 있습니까?", choiceGrid("ischemia", "coldFeet", ischemia.coldFeet, OPTIONS.threeLevel))}
    ${questionCard("발 상처가 생기면 잘 낫지 않는 편입니까?", choiceGrid("ischemia", "slowHealing", ischemia.slowHealing, OPTIONS.yesNoUnknown))}
    ${questionCard("의사에게 발 혈액순환이 좋지 않다고 들은 적이 있습니까?", choiceGrid("ischemia", "circulationDiagnosis", ischemia.circulationDiagnosis, OPTIONS.yesNoUnknown))}
  `;
}

function renderCurrentFootStep() {
  const foot = state.questionnaire.currentFoot;
  return `
    ${questionCard("현재 발에 상처가 있습니까?", choiceGrid("currentFoot", "wound", foot.wound, OPTIONS.presentAbsentUnknown))}
    ${questionCard("현재 발에 붉은 부위가 있습니까?", choiceGrid("currentFoot", "redness", foot.redness, OPTIONS.presentAbsentUnknown))}
    ${questionCard("현재 발이 붓거나 열이 나는 느낌이 있습니까?", choiceGrid("currentFoot", "swellingOrHeat", foot.swellingOrHeat, OPTIONS.presentAbsentUnknown))}
    ${questionCard("발바닥 또는 발가락에 굳은살, 갈라짐, 물집이 있습니까?", choiceGrid("currentFoot", "callusCrackBlister", foot.callusCrackBlister, OPTIONS.presentAbsentUnknown))}
    ${questionCard("발톱 변형 또는 발 모양 변형이 있습니까?", choiceGrid("currentFoot", "nailOrShapeDeformity", foot.nailOrShapeDeformity, OPTIONS.presentAbsentUnknown))}
    ${questionCard("발 사진 업로드", `
      <div class="upload-panel">
        <div class="button-row compact">
          <button class="secondary-button" data-action="toggle-photo-picker">${state.showPhotoPicker ? "사진 선택 영역 닫기" : "발 사진 추가하기"}</button>
          ${foot.photoFileNames.length ? `<span class="pill success">${foot.photoFileNames.length}개 파일 선택됨</span>` : ""}
        </div>
        ${
          state.showPhotoPicker
            ? `<div class="upload-box">
                <input type="file" accept="image/*" multiple />
                ${foot.photoFileNames.length ? `<div class="file-list">${escapeHtml(foot.photoFileNames.join(", "))}</div>` : ""}
              </div>`
            : ""
        }
      </div>
    `, "선택 항목입니다. 실제 연구 사진 동의는 마지막 단계에서 다시 확인합니다.", false)}
  `;
}

function renderSelfCareStep() {
  const selfCare = state.questionnaire.selfCare;
  return `
    ${questionCard("평소 매일 발 상태를 확인합니까?", choiceGrid("selfCare", "dailyCheck", selfCare.dailyCheck, OPTIONS.footCheck))}
    ${questionCard("발을 씻은 뒤 발가락 사이까지 잘 말립니까?", choiceGrid("selfCare", "dryBetweenToes", selfCare.dryBetweenToes, OPTIONS.care))}
    ${questionCard("발에 상처가 생기면 바로 확인하거나 치료를 받습니까?", choiceGrid("selfCare", "earlyActionForWounds", selfCare.earlyActionForWounds, OPTIONS.care))}
    ${questionCard("맨발로 걷는 경우가 있습니까?", choiceGrid("selfCare", "walksBarefoot", selfCare.walksBarefoot, OPTIONS.barefoot))}
  `;
}

function renderFootwearStep() {
  const footwear = state.questionnaire.footwear;
  return `
    ${questionCard("평소 발에 꽉 끼는 신발을 자주 신습니까?", choiceGrid("footwear", "tightShoes", footwear.tightShoes, OPTIONS.tightShoes))}
    ${questionCard("새 신발을 오래 신은 뒤 발이 아프거나 상처가 생긴 적이 있습니까?", choiceGrid("footwear", "newShoeInjury", footwear.newShoeInjury, OPTIONS.yesNo))}
    ${questionCard("하루 평균 걷는 시간이 얼마나 됩니까?", choiceGrid("footwear", "walkingTime", footwear.walkingTime, OPTIONS.walkingTime))}
    ${questionCard("보행 시 절뚝거리거나 한쪽 발에 더 많이 체중이 실린다고 느낍니까?", choiceGrid("footwear", "gaitImbalance", footwear.gaitImbalance, OPTIONS.yesNoUnknown))}
  `;
}

function renderComorbidityStep() {
  const comorbidity = state.questionnaire.comorbidity;
  return `
    ${questionCard("현재 흡연 중입니까?", choiceGrid("comorbidity", "smokingStatus", comorbidity.smokingStatus, OPTIONS.smoking))}
    ${questionCard("신장질환 또는 투석을 받고 있습니까?", choiceGrid("comorbidity", "kidneyDiseaseOrDialysis", comorbidity.kidneyDiseaseOrDialysis, OPTIONS.yesNoUnknown))}
    ${questionCard("눈이 잘 보이지 않아 발을 직접 확인하기 어렵습니까?", choiceGrid("comorbidity", "visionDifficulty", comorbidity.visionDifficulty, OPTIONS.yesNo))}
    ${questionCard("혼자 발 관리가 어렵습니까?", choiceGrid("comorbidity", "selfCareDifficulty", comorbidity.selfCareDifficulty, OPTIONS.yesNo))}
  `;
}

function renderResearchStep() {
  const research = state.questionnaire.research;
  return `
    ${infoPanel("문진은 환자 데이터이고, 아래 항목은 향후 추가 연구 연계 여부를 묻습니다.", "neutral")}
    ${questionCard("발 사진 촬영에 동의합니까?", choiceGrid("research", "photoConsent", research.photoConsent, OPTIONS.yesNo))}
    ${questionCard("온도, 압력, 광학센서 측정 연구에 참여 의향이 있습니까?", choiceGrid("research", "sensorStudyInterest", research.sensorStudyInterest, OPTIONS.sensorStudy))}
    ${questionCard("추적 문진 알림 수신에 동의합니까?", choiceGrid("research", "followUpConsent", research.followUpConsent, OPTIONS.yesNo))}
  `;
}

function renderSummaryStep() {
  const q = state.questionnaire;
  return `
    ${infoPanel("입력한 내용을 한 번 더 확인한 뒤 제출해 주세요. 수정이 필요한 항목은 이전 버튼으로 돌아가 바꿀 수 있습니다.", "neutral")}
    ${summarySection("기본정보", 2, [
      ["환자 이름", q.demographics.fullName || "미입력"],
      ["휴대폰 번호", formatPhoneNumber(q.demographics.phoneNumber)],
      ["이메일", q.demographics.emailAddress || "미입력"],
      ["성별", labelFor(OPTIONS.gender, q.demographics.gender)],
      ["연령", numericText(q.demographics.age, "세")],
      ["키", numericText(q.demographics.heightCm, "cm")],
      ["몸무게", numericText(q.demographics.weightKg, "kg")],
    ])}
    ${summarySection("당뇨 정보", 3, [
      ["진단 기간", labelFor(OPTIONS.diagnosisDuration, q.diabetes.diagnosisDuration)],
      ["치료 정보", labelFor(OPTIONS.treatmentType, q.diabetes.treatmentType)],
      ["최근 수치 인지 여부", labelFor(OPTIONS.yesNo, q.diabetes.knowsRecentGlucoseOrHbA1c)],
      ["최근 당화혈색소", q.diabetes.knowsRecentGlucoseOrHbA1c === "YES" ? q.diabetes.hbA1cMode === "ENTER_VALUE" ? numericText(q.diabetes.hbA1c, "%") : "모름" : "입력 안 함"],
    ])}
    ${summarySection("과거 발 병력", 4, [
      ["과거 궤양", labelFor(OPTIONS.yesNoUnknown, q.history.ulcerHistory)],
      ["과거 절단", labelFor(OPTIONS.yesNo, q.history.amputationHistory)],
      ["입원/시술/수술", labelFor(OPTIONS.yesNoUnknown, q.history.admissionOrProcedureHistory)],
      ["의사 진단 이력", q.history.diagnosedConditions.length ? q.history.diagnosedConditions.map((value) => labelFor(OPTIONS.diagnosedConditions, value)).join(", ") : "미입력"],
    ])}
    ${summarySection("발 저림·통증", 5, [
      ["발 저림", labelFor(OPTIONS.frequency4, q.neuropathy.numbness)],
      ["발바닥 감각 둔화", labelFor(OPTIONS.frequency4, q.neuropathy.reducedSoleSensation)],
      ["화끈거림", labelFor(OPTIONS.frequency4, q.neuropathy.burning)],
      ["야간 통증", labelFor(OPTIONS.nightPain, q.neuropathy.nightPain)],
      ["온도 감각 저하", labelFor(OPTIONS.yesNoUnknown, q.neuropathy.temperatureLoss)],
    ])}
    ${summarySection("혈액순환 증상", 6, [
      ["보행 후 쉬면 호전", labelFor(OPTIONS.yesNoUnknown, q.ischemia.walkingPainRelievedByRest)],
      ["쉬는 중 발 통증", labelFor(OPTIONS.threeLevel, q.ischemia.restPain)],
      ["발 냉감", labelFor(OPTIONS.threeLevel, q.ischemia.coldFeet)],
      ["상처 치유 지연", labelFor(OPTIONS.yesNoUnknown, q.ischemia.slowHealing)],
      ["혈액순환 진단 이력", labelFor(OPTIONS.yesNoUnknown, q.ischemia.circulationDiagnosis)],
    ])}
    ${summarySection("현재 발 상태와 연구 참여", 7, [
      ["현재 상처", labelFor(OPTIONS.yesNoUnknown, q.currentFoot.wound)],
      ["현재 발적", labelFor(OPTIONS.yesNoUnknown, q.currentFoot.redness)],
      ["부종/열감", labelFor(OPTIONS.yesNoUnknown, q.currentFoot.swellingOrHeat)],
      ["사진 선택", q.currentFoot.photoFileNames.length ? `${q.currentFoot.photoFileNames.length}개` : "선택하지 않음"],
      ["발 사진 촬영 동의", labelFor(OPTIONS.yesNo, q.research.photoConsent)],
      ["센서 연구 참여", labelFor(OPTIONS.sensorStudy, q.research.sensorStudyInterest)],
    ])}
    ${summarySection("발 관리·보행·동반질환", 8, [
      ["발 확인 빈도", labelFor(OPTIONS.footCheck, q.selfCare.dailyCheck)],
      ["발가락 사이 건조", labelFor(OPTIONS.care, q.selfCare.dryBetweenToes)],
      ["상처 시 대처", labelFor(OPTIONS.care, q.selfCare.earlyActionForWounds)],
      ["맨발 보행", labelFor(OPTIONS.barefoot, q.selfCare.walksBarefoot)],
      ["꽉 끼는 신발", labelFor(OPTIONS.tightShoes, q.footwear.tightShoes)],
      ["새 신발 상처 경험", labelFor(OPTIONS.yesNo, q.footwear.newShoeInjury)],
      ["하루 평균 걷기", labelFor(OPTIONS.walkingTime, q.footwear.walkingTime)],
      ["보행 불균형", labelFor(OPTIONS.yesNoUnknown, q.footwear.gaitImbalance)],
      ["흡연 상태", labelFor(OPTIONS.smoking, q.comorbidity.smokingStatus)],
      ["신장질환/투석", labelFor(OPTIONS.yesNoUnknown, q.comorbidity.kidneyDiseaseOrDialysis)],
      ["시야 문제", labelFor(OPTIONS.yesNo, q.comorbidity.visionDifficulty)],
      ["혼자 발 관리 어려움", labelFor(OPTIONS.yesNo, q.comorbidity.selfCareDifficulty)],
      ["추적 문진 알림 동의", labelFor(OPTIONS.yesNo, q.research.followUpConsent)],
    ])}
  `;
}

function renderStickyFooter() {
  return `
    <div class="sticky-footer">
      <p>문진 앱은 데이터 수집 축으로만 동작합니다. 현재 진단이나 치료 판단은 의료진 확인이 필요합니다.</p>
      <div class="button-row compact">
        <button class="secondary-button" data-action="prev-step">이전</button>
        ${
          state.stepIndex === STEP_TITLES.length - 1
            ? '<button class="primary-button dark" data-action="submit-questionnaire">제출</button>'
            : '<button class="primary-button" data-action="next-step">다음</button>'
        }
      </div>
    </div>
  `;
}

function questionCard(title, body, hint = "", required = true) {
  return `
    <section class="question-card">
      <div class="question-head">
        <h3>${escapeHtml(title)}</h3>
        <span class="required-pill ${required ? "required" : "optional"}">${required ? "필수" : "선택"}</span>
      </div>
      ${hint ? `<p class="hint-text">${escapeHtml(hint)}</p>` : ""}
      <div class="question-body">${body}</div>
    </section>
  `;
}

function choiceGrid(section, field, currentValue, options, columns = 2) {
  return `
    <div class="choice-grid cols-${columns}">
      ${options
        .map(
          (option) => `
            <button class="choice-button ${option.value === currentValue ? "selected" : ""}" data-action="set-choice" data-section="${section}" data-field="${field}" data-value="${option.value}">
              <strong>${escapeHtml(option.label)}</strong>
            </button>
          `,
        )
        .join("")}
    </div>
  `;
}

function multiSelectGrid(selectedValues) {
  return `
    <div class="choice-grid cols-2">
      ${OPTIONS.diagnosedConditions
        .map(
          (option) => `
            <button class="choice-button ${selectedValues.includes(option.value) ? "selected warm" : ""}" data-action="toggle-condition" data-value="${option.value}">
              <strong>${escapeHtml(option.label)}</strong>
            </button>
          `,
        )
        .join("")}
    </div>
  `;
}

function numberField(section, field, value, unit, placeholder, step = "1") {
  return `
    <label class="number-field">
      <input type="number" inputmode="decimal" step="${step}" data-section="${section}" data-field="${field}" value="${escapeAttribute(value)}" placeholder="${escapeAttribute(placeholder)}" />
      <span>${escapeHtml(unit)}</span>
    </label>
  `;
}

function textField(section, field, value, type, placeholder) {
  return `
    <label class="text-field">
      <input type="${type}" data-section="${section}" data-field="${field}" value="${escapeAttribute(value)}" placeholder="${escapeAttribute(placeholder)}" />
    </label>
  `;
}

function consentToggle(field, label, checked) {
  return `
    <button class="consent-toggle ${checked ? "checked" : ""}" data-action="toggle-consent" data-field="${field}">
      <span class="checkbox-mark">${checked ? "✓" : ""}</span>
      <strong>${escapeHtml(label)}</strong>
    </button>
  `;
}

function infoPanel(text, tone) {
  return `<section class="info-panel ${tone}">${escapeHtml(text)}</section>`;
}

function summarySection(title, step, items) {
  return `
    <section class="summary-card">
      <div class="summary-head">
        <div>
          <p class="step-caption">화면 ${step + 1}</p>
          <h3>${escapeHtml(title)}</h3>
        </div>
        <button class="secondary-button small" data-action="jump-step" data-step="${step}">수정</button>
      </div>
      <div class="summary-grid">
        ${items
          .map(
            ([label, value]) => `
              <article class="summary-item">
                <span>${escapeHtml(label)}</span>
                <strong>${escapeHtml(value)}</strong>
              </article>
            `,
          )
          .join("")}
      </div>
    </section>
  `;
}

function renderValidation() {
  if (!state.validationErrors.length) return "";
  return `
    <section class="validation-box">
      <p>다음 항목을 확인해 주세요.</p>
      <ul>
        ${state.validationErrors.map((error) => `<li>${escapeHtml(error)}</li>`).join("")}
      </ul>
    </section>
  `;
}

function updateQuestionnaireField(section, field, value) {
  state.questionnaire[section][field] = value;
  if (section === "diabetes" && field === "knowsRecentGlucoseOrHbA1c" && value !== "YES") {
    state.questionnaire.diabetes.hbA1cMode = null;
    state.questionnaire.diabetes.hbA1c = "";
  }
  if (section === "diabetes" && field === "hbA1cMode" && value !== "ENTER_VALUE") {
    state.questionnaire.diabetes.hbA1c = "";
  }
  state.validationErrors = [];
}

function toggleCondition(value) {
  const selected = state.questionnaire.history.diagnosedConditions;
  if (value === "NONE" || value === "UNKNOWN") {
    state.questionnaire.history.diagnosedConditions = selected.includes(value) ? [] : [value];
  } else {
    const filtered = selected.filter((item) => item !== "NONE" && item !== "UNKNOWN");
    state.questionnaire.history.diagnosedConditions = filtered.includes(value)
      ? filtered.filter((item) => item !== value)
      : [...filtered, value];
  }
  state.validationErrors = [];
}

function labelFor(options, value) {
  if (!value) return "미입력";
  const option = options.find((item) => item.value === value);
  return option ? option.label : "미입력";
}

function numericText(value, unit) {
  return value ? `${value}${unit}` : "미입력";
}

function validateStep(stepIndex) {
  const q = state.questionnaire;
  const errors = [];

  if (stepIndex === 1) {
    if (!q.consent.readAndUnderstood) errors.push("연구 설명 이해 여부에 동의해 주세요.");
    if (!q.consent.agreedToParticipate) errors.push("연구 참여 동의가 필요합니다.");
  }
  if (stepIndex === 2) {
    requireText(q.demographics.fullName, "환자 이름", errors);
    validatePhoneNumber(q.demographics.phoneNumber, errors);
    validateEmailAddress(q.demographics.emailAddress, errors);
    if (!q.demographics.gender) errors.push("성별을 선택해 주세요.");
    validateNumberRange(q.demographics.age, 19, 110, "연령", errors);
    validateNumberRange(q.demographics.heightCm, 100, 220, "키", errors);
    validateNumberRange(q.demographics.weightKg, 30, 250, "몸무게", errors);
  }
  if (stepIndex === 3) {
    requireValue(q.diabetes.diagnosisDuration, "당뇨 진단 기간", errors);
    requireValue(q.diabetes.treatmentType, "현재 당뇨 치료 정보", errors);
    requireValue(q.diabetes.knowsRecentGlucoseOrHbA1c, "최근 혈당 또는 당화혈색소 수치 인지 여부", errors);
    if (q.diabetes.knowsRecentGlucoseOrHbA1c === "YES") {
      requireValue(q.diabetes.hbA1cMode, "당화혈색소 입력 여부", errors);
      if (q.diabetes.hbA1cMode === "ENTER_VALUE") {
        validateNumberRange(q.diabetes.hbA1c, 4, 20, "당화혈색소", errors);
      }
    }
  }
  if (stepIndex === 4) {
    requireValue(q.history.ulcerHistory, "과거 발 상처 또는 궤양 경험", errors);
    requireValue(q.history.amputationHistory, "과거 절단 경험", errors);
    requireValue(q.history.admissionOrProcedureHistory, "입원 또는 시술·수술 경험", errors);
    if (!q.history.diagnosedConditions.length) errors.push("의사 진단 이력을 하나 이상 선택해 주세요.");
  }
  if (stepIndex === 5) {
    requireValue(q.neuropathy.numbness, "발 저림 또는 감각 둔함", errors);
    requireValue(q.neuropathy.reducedSoleSensation, "발바닥 감각 둔화", errors);
    requireValue(q.neuropathy.burning, "발의 화끈거림", errors);
    requireValue(q.neuropathy.nightPain, "야간 통증 또는 불편감", errors);
    requireValue(q.neuropathy.temperatureLoss, "온도 감각 저하 여부", errors);
  }
  if (stepIndex === 6) {
    requireValue(q.ischemia.walkingPainRelievedByRest, "보행 시 통증 후 휴식 시 호전 여부", errors);
    requireValue(q.ischemia.restPain, "쉬는 중 발 통증", errors);
    requireValue(q.ischemia.coldFeet, "발 냉감", errors);
    requireValue(q.ischemia.slowHealing, "상처 치유 지연 여부", errors);
    requireValue(q.ischemia.circulationDiagnosis, "혈액순환 진단 이력", errors);
  }
  if (stepIndex === 7) {
    requireValue(q.currentFoot.wound, "현재 상처 여부", errors);
    requireValue(q.currentFoot.redness, "현재 발적 여부", errors);
    requireValue(q.currentFoot.swellingOrHeat, "부종 또는 열감 여부", errors);
    requireValue(q.currentFoot.callusCrackBlister, "굳은살·갈라짐·물집 여부", errors);
    requireValue(q.currentFoot.nailOrShapeDeformity, "발톱 또는 발 모양 변형 여부", errors);
  }
  if (stepIndex === 8) {
    requireValue(q.selfCare.dailyCheck, "발 상태 확인 빈도", errors);
    requireValue(q.selfCare.dryBetweenToes, "발가락 사이 건조 습관", errors);
    requireValue(q.selfCare.earlyActionForWounds, "상처 발생 시 대처", errors);
    requireValue(q.selfCare.walksBarefoot, "맨발 보행 여부", errors);
  }
  if (stepIndex === 9) {
    requireValue(q.footwear.tightShoes, "꽉 끼는 신발 착용 빈도", errors);
    requireValue(q.footwear.newShoeInjury, "새 신발 상처 경험", errors);
    requireValue(q.footwear.walkingTime, "하루 평균 걷는 시간", errors);
    requireValue(q.footwear.gaitImbalance, "보행 불균형 여부", errors);
  }
  if (stepIndex === 10) {
    requireValue(q.comorbidity.smokingStatus, "흡연 상태", errors);
    requireValue(q.comorbidity.kidneyDiseaseOrDialysis, "신장질환 또는 투석 여부", errors);
    requireValue(q.comorbidity.visionDifficulty, "시야 문제 여부", errors);
    requireValue(q.comorbidity.selfCareDifficulty, "혼자 발 관리 어려움 여부", errors);
  }
  if (stepIndex === 11) {
    requireValue(q.research.photoConsent, "발 사진 촬영 동의 여부", errors);
    requireValue(q.research.sensorStudyInterest, "센서 연구 참여 의향", errors);
    requireValue(q.research.followUpConsent, "추적 문진 알림 동의 여부", errors);
  }

  return errors;
}

function findFirstInvalidStep() {
  for (let step = 1; step <= 11; step += 1) {
    const errors = validateStep(step);
    if (errors.length) return { stepIndex: step, errors };
  }
  return null;
}

function requireValue(value, label, errors) {
  if (!value) errors.push(`${label}을(를) 선택해 주세요.`);
}

function requireText(value, label, errors) {
  if (!String(value ?? "").trim()) errors.push(`${label}를 입력해 주세요.`);
}

function validatePhoneNumber(value, errors) {
  const digits = String(value ?? "").replace(/\D/g, "");
  if (!digits) {
    errors.push("휴대폰 번호를 입력해 주세요.");
    return;
  }
  if (digits.length < 10 || digits.length > 11) {
    errors.push("휴대폰 번호를 정확히 입력해 주세요.");
  }
}

function validateEmailAddress(value, errors) {
  const trimmed = String(value ?? "").trim();
  if (!trimmed) {
    errors.push("이메일을 입력해 주세요.");
    return;
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
    errors.push("이메일 형식을 확인해 주세요.");
  }
}

function validateNumberRange(value, min, max, label, errors) {
  if (!String(value).trim()) {
    errors.push(`${label}을(를) 입력해 주세요.`);
    return;
  }
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < min || parsed > max) {
    errors.push(`${label}은(는) ${min}~${max} 범위로 입력해 주세요.`);
  }
}

function formatPhoneNumber(value) {
  const digits = String(value ?? "").replace(/\D/g, "");
  if (!digits) {
    return "미입력";
  }
  if (digits.length === 11) {
    return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
  }
  if (digits.length === 10) {
    return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  return String(value);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function escapeAttribute(value) {
  return escapeHtml(value ?? "");
}
