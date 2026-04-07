export function createInitialQuestionnaireAnswers() {
  return {
    consent: {
      readAndUnderstood: false,
      agreedToParticipate: false,
    },
    demographics: {
      fullName: "",
      phoneNumber: "",
      emailAddress: "",
      gender: null,
      age: "",
      heightCm: "",
      weightKg: "",
    },
    diabetes: {
      diagnosisDuration: null,
      treatmentType: null,
      knowsRecentGlucoseOrHbA1c: null,
      hbA1cMode: null,
      hbA1c: "",
    },
    history: {
      ulcerHistory: null,
      amputationHistory: null,
      admissionOrProcedureHistory: null,
      diagnosedConditions: [],
    },
    neuropathy: {
      achingCold: null,
      numbness: null,
      burning: null,
      stabbing: null,
      sensoryLoss: null,
      sandFeeling: null,
      paperFeeling: null,
      worseAtNight: null,
    },
    ischemia: {
      walkingPainRelievedByRest: null,
      restPain: null,
      coldFeet: null,
      slowHealing: null,
      circulationDiagnosis: null,
    },
    currentFoot: {
      wound: null,
      redness: null,
      swellingOrHeat: null,
      callusCrackBlister: null,
      nailOrShapeDeformity: null,
      photoFileNames: [],
    },
    selfCare: {
      dailyCheck: null,
      dryBetweenToes: null,
      earlyActionForWounds: null,
      walksBarefoot: null,
    },
    footwear: {
      tightShoes: null,
      newShoeInjury: null,
      walkingTime: null,
      gaitImbalance: null,
    },
    comorbidity: {
      smokingStatus: null,
      kidneyDiseaseOrDialysis: null,
      immunosuppressantUse: null,
      kidneyTransplant: null,
      visionDifficulty: null,
      selfCareDifficulty: null,
    },
    research: {
      photoConsent: null,
      sensorStudyInterest: null,
      followUpConsent: null,
    },
  };
}

export function createInitialClinicianMeasurements() {
  return {
    monofilament_abnormal: null,
    pulse_absent_count: null,
    tbi_value: null,
    toe_pressure_value: null,
    tcpo2_value: null,
    deformity_present: null,
    active_wound_present: null,
    clinician_redness: null,
    clinician_callus: null,
    clinician_edema: null,
    clinician_infection_suspect: null,
    iwgdf_confirmed_risk_class: null,
  };
}

export function createInitialLongitudinalFeatures() {
  return {
    day_index: null,
    symptom_change_from_baseline: null,
    temperature_change_from_baseline: null,
    pressure_change_from_baseline: null,
    perfusion_change_from_baseline: null,
    activity_change_from_baseline: null,
    adherence_rate: null,
    image_change_score: null,
  };
}

export function createInitialSensorFeatureBundle() {
  return {
    optical: {
      perfusion_index: null,
      pulsatile_amplitude: null,
      signal_quality_index: null,
      local_heating_response: null,
      time_to_peak: null,
      recovery_slope: null,
      spo2_reflectance_estimate: null,
    },
    thermal: {
      bilateral_temp_diff_max: null,
      regional_temp_diff_mean: null,
      hotspot_count: null,
      hotspot_persistence_days: null,
      thermal_heterogeneity_index: null,
    },
    image: {
      redness_score: null,
      crack_score: null,
      callus_score: null,
      wound_presence_score: null,
      discoloration_score: null,
      toe_dorsal_abnormality_score: null,
    },
    pressure: {
      peak_plantar_pressure: null,
      pressure_time_integral: null,
      pressure_asymmetry_index: null,
      step_count: null,
      gait_asymmetry_index: null,
      offloading_adherence_score: null,
    },
    fiber: {
      toe_temp_profile: null,
      dorsal_temp_profile: null,
      plantar_temp_profile: null,
      local_pressure_cluster: null,
      sustained_pressure_duration: null,
    },
  };
}

export function createInitialRuleFusionSignals() {
  return {
    perfusion_low: false,
    temp_asymmetry: false,
    pressure_high: false,
    callus_score_high: false,
    history_score_high: false,
    hotspot_persistence: false,
  };
}

export function createInitialPredictionEndpoints() {
  return {
    primary_6m_new_ulcer: createEmptyEndpoint("6개월 신규 궤양"),
    primary_6m_recurrent_ulcer: createEmptyEndpoint("6개월 재발 궤양"),
    secondary_persistent_hotspot: createEmptyEndpoint("지속성 hotspot"),
    secondary_wound_worsening: createEmptyEndpoint("상처 악화"),
    secondary_vascular_referral_needed: createEmptyEndpoint("혈관 평가 의뢰"),
    secondary_offloading_failure: createEmptyEndpoint("압력 분산 실패"),
    secondary_clinician_confirmed_high_risk_transition: createEmptyEndpoint("고위험군 전환"),
  };
}

const NEUROPATHY_SUSPECT_THRESHOLD = 9;

export function buildQuestionnairePayload(answers) {
  const historyScore =
    valueIf(answers.history.ulcerHistory === "YES", 4) +
    valueIf(answers.history.amputationHistory === "YES", 4) +
    valueIf(answers.history.admissionOrProcedureHistory === "YES", 2) +
    valueIf(answers.comorbidity.kidneyDiseaseOrDialysis === "YES", 3) +
    valueIf(answers.comorbidity.immunosuppressantUse === "YES", 2) +
    valueIf(answers.comorbidity.kidneyTransplant === "YES", 2);

  const diagnosedNeuropathy = answers.history.diagnosedConditions.includes("NEUROPATHY");
  const diagnosedPad = answers.history.diagnosedConditions.includes("PAD");
  const diagnosedDiabeticFoot = answers.history.diagnosedConditions.includes("DIABETIC_FOOT");

  const neuropathyScore =
    frequency4Score(answers.neuropathy.achingCold) +
    frequency4Score(answers.neuropathy.numbness) +
    frequency4Score(answers.neuropathy.burning) +
    frequency4Score(answers.neuropathy.stabbing) +
    frequency4Score(answers.neuropathy.sensoryLoss) +
    frequency4Score(answers.neuropathy.sandFeeling) +
    frequency4Score(answers.neuropathy.paperFeeling) +
    frequency4Score(answers.neuropathy.worseAtNight);

  const ischemiaScore =
    valueIf(answers.ischemia.walkingPainRelievedByRest === "YES", 2) +
    threeLevelScore(answers.ischemia.restPain) +
    threeLevelScore(answers.ischemia.coldFeet) +
    valueIf(answers.ischemia.slowHealing === "YES", 2) +
    valueIf(answers.ischemia.circulationDiagnosis === "YES", 3);

  const footStatusScore =
    valueIf(answers.currentFoot.wound === "YES", 4) +
    valueIf(answers.currentFoot.redness === "YES", 2) +
    valueIf(answers.currentFoot.swellingOrHeat === "YES", 2) +
    valueIf(answers.currentFoot.callusCrackBlister === "YES", 2) +
    valueIf(answers.currentFoot.nailOrShapeDeformity === "YES", 2) +
    valueIf(answers.footwear.newShoeInjury === "YES", 1);

  const behaviorScore =
    footCheckScore(answers.selfCare.dailyCheck) +
    careScore(answers.selfCare.dryBetweenToes) +
    careScore(answers.selfCare.earlyActionForWounds) +
    barefootScore(answers.selfCare.walksBarefoot);

  const footwearScore =
    tightShoeScore(answers.footwear.tightShoes) +
    valueIf(answers.footwear.newShoeInjury === "YES", 2) +
    walkingTimeScore(answers.footwear.walkingTime) +
    valueIf(answers.footwear.gaitImbalance === "YES", 2);

  const neuropathySuspect = neuropathyScore >= NEUROPATHY_SUSPECT_THRESHOLD || diagnosedNeuropathy;
  const padSuspect =
    ischemiaScore >= 4 || diagnosedPad || answers.ischemia.circulationDiagnosis === "YES";
  const highRiskFootState = footStatusScore >= 3 || diagnosedDiabeticFoot;

  const hxUlcer = answers.history.ulcerHistory === "YES";
  const hxAmputation = answers.history.amputationHistory === "YES";
  const esrd = answers.comorbidity.kidneyDiseaseOrDialysis === "YES";
  const immunosuppressed = answers.comorbidity.immunosuppressantUse === "YES";
  const kidneyTransplant = answers.comorbidity.kidneyTransplant === "YES";

  let appRiskClass = 0;

  if (hxUlcer || hxAmputation || esrd) {
    appRiskClass = 3;
  } else if (
    (padSuspect && neuropathySuspect) ||
    (neuropathySuspect && highRiskFootState) ||
    (padSuspect && highRiskFootState)
  ) {
    appRiskClass = 2;
  } else if (padSuspect || neuropathySuspect) {
    appRiskClass = 1;
  }

  return {
    questionnaireVersion: "iwgdf-2024-patient-v2",
    source: "wiregene-diabetic-foot-screening",
    submittedAt: new Date().toISOString(),
    questionnaireData: structuredClone(answers),
    internalFlags: {
      hx_ulcer: hxUlcer,
      hx_amputation: hxAmputation,
      esrd,
      immunosuppressed,
      kidney_transplant: kidneyTransplant,
      neuropathy_suspect: neuropathySuspect,
      pad_suspect: padSuspect,
      high_risk_foot_state: highRiskFootState,
      active_concerning_foot_symptom:
        answers.currentFoot.wound === "YES" ||
        answers.currentFoot.redness === "YES" ||
        answers.currentFoot.swellingOrHeat === "YES" ||
        answers.ischemia.restPain === "OFTEN",
    },
    internalScores: {
      app_risk_class: appRiskClass,
      history_score: historyScore,
      neuropathy_score: neuropathyScore,
      ischemia_score: ischemiaScore,
      foot_status_score: footStatusScore,
      behavior_score: behaviorScore,
      footwear_score: footwearScore,
    },
  };
}

export function buildQuestionnaireStaticFeatures(questionnairePayload) {
  const { questionnaireData, internalFlags, internalScores } = questionnairePayload;
  const age = parseNullableNumber(questionnaireData.demographics.age);
  const heightCm = parseNullableNumber(questionnaireData.demographics.heightCm);
  const weightKg = parseNullableNumber(questionnaireData.demographics.weightKg);

  return {
    age,
    sex: questionnaireData.demographics.gender,
    bmi: calculateBmi(heightCm, weightKg),
    dm_duration_cat: questionnaireData.diabetes.diagnosisDuration,
    dm_tx_type: questionnaireData.diabetes.treatmentType,
    hba1c_value:
      questionnaireData.diabetes.knowsRecentGlucoseOrHbA1c === "YES" &&
      questionnaireData.diabetes.hbA1cMode === "ENTER_VALUE"
        ? parseNullableNumber(questionnaireData.diabetes.hbA1c)
        : null,
    smoking_status: questionnaireData.comorbidity.smokingStatus,
    esrd: internalFlags.esrd,
    immunosuppressed: internalFlags.immunosuppressed,
    kidney_transplant: internalFlags.kidney_transplant,
    vision_problem: questionnaireData.comorbidity.visionDifficulty === "YES",
    selfcare_difficulty: questionnaireData.comorbidity.selfCareDifficulty === "YES",
    hx_ulcer: internalFlags.hx_ulcer,
    hx_amputation: internalFlags.hx_amputation,
    hx_df_hospital: questionnaireData.history.admissionOrProcedureHistory === "YES",
    hx_diag_neuropathy: questionnaireData.history.diagnosedConditions.includes("NEUROPATHY"),
    hx_diag_pad: questionnaireData.history.diagnosedConditions.includes("PAD"),
    history_score: internalScores.history_score,
    neuropathy_score: internalScores.neuropathy_score,
    ischemia_score: internalScores.ischemia_score,
    foot_status_score: internalScores.foot_status_score,
    behavior_score: internalScores.behavior_score,
    footwear_score: internalScores.footwear_score,
    app_risk_class: internalScores.app_risk_class,
  };
}

export function buildRuleBasedFusionFlags(staticFeatures, signals) {
  return {
    ischemia_risk_strengthened:
      staticFeatures.ischemia_score >= 4 &&
      staticFeatures.app_risk_class >= 1 &&
      signals.perfusion_low &&
      signals.temp_asymmetry,
    pre_ulcer_risk_strengthened:
      staticFeatures.neuropathy_score >= NEUROPATHY_SUSPECT_THRESHOLD &&
      signals.pressure_high &&
      signals.callus_score_high,
    recurrence_risk_strengthened:
      staticFeatures.history_score >= 4 &&
      signals.history_score_high &&
      signals.hotspot_persistence,
  };
}

export function buildResearchInsights({
  questionnairePayload,
  staticFeatures = buildQuestionnaireStaticFeatures(questionnairePayload),
  clinicianMeasurements = createInitialClinicianMeasurements(),
  longitudinalFeatures = createInitialLongitudinalFeatures(),
  sensorFeatureBundle = createInitialSensorFeatureBundle(),
  ruleFusionSignals = createInitialRuleFusionSignals(),
  ruleFusionFlags = buildRuleBasedFusionFlags(staticFeatures, ruleFusionSignals),
}) {
  const answers = questionnairePayload.questionnaireData;
  const flags = questionnairePayload.internalFlags;
  const scores = questionnairePayload.internalScores;
  const thermal = sensorFeatureBundle.thermal;
  const image = sensorFeatureBundle.image;
  const pressure = sensorFeatureBundle.pressure;
  const optical = sensorFeatureBundle.optical;
  const fiber = sensorFeatureBundle.fiber;

  const newUlcer = scorePredictionEndpoint("6개월 신규 궤양", [
    scoredSignal(scores.app_risk_class >= 3, 24, "기본 분류상 고위험군입니다."),
    scoredSignal(scores.app_risk_class === 2, 16, "기본 분류상 중등도 위험군입니다."),
    scoredSignal(flags.hx_ulcer, 12, "과거 궤양 병력이 있습니다."),
    scoredSignal(scores.foot_status_score >= 4, 12, "현재 발 상태 점수가 높습니다."),
    scoredSignal(flags.high_risk_foot_state, 12, "문진상 전궤양 또는 활동성 발 상태가 의심됩니다."),
    scoredSignal(answers.currentFoot.wound === "YES", 14, "문진상 현재 상처가 보고되었습니다."),
    scoredSignal(answers.currentFoot.redness === "YES", 6, "문진상 발적이 보고되었습니다."),
    scoredSignal(answers.currentFoot.swellingOrHeat === "YES", 6, "문진상 부종 또는 열감이 보고되었습니다."),
    scoredSignal(flags.immunosuppressed, 8, "면역억제제 복용력이 있어 상처 악화 및 치유 지연 위험을 높입니다."),
    scoredSignal(flags.kidney_transplant, 6, "신장이식 병력이 있어 고위험 추적관찰이 필요합니다."),
    scoredSignal(clinicianMeasurements.active_wound_present === true, 18, "임상 입력에서 활동성 상처가 확인되었습니다."),
    scoredSignal(clinicianMeasurements.clinician_redness === true, 8, "임상 입력에서 발적이 보고되었습니다."),
    scoredSignal(clinicianMeasurements.clinician_callus === true, 6, "임상 입력에서 굳은살이 보고되었습니다."),
    scoredSignal(ruleFusionFlags.pre_ulcer_risk_strengthened, 10, "압력·굳은살 융합 신호가 전궤양 위험을 강화합니다."),
    scoredSignal(ruleFusionSignals.pressure_high, 8, "압력 이상 신호가 감지되었습니다."),
    scoredSignal(ruleFusionSignals.callus_score_high, 6, "굳은살 점수 상승 신호가 감지되었습니다."),
    scoredSignal(valueAtLeast(image.wound_presence_score, 2.5), 10, "영상 feature에서 상처 의심 점수가 높습니다."),
    scoredSignal(valueAtLeast(image.redness_score, 2.5), 5, "영상 feature에서 발적 점수가 높습니다."),
    scoredSignal(valueAtLeast(pressure.peak_plantar_pressure, 260), 8, "족저 최대 압력이 높습니다."),
    scoredSignal(valueAtLeast(pressure.pressure_time_integral, 120), 6, "압력 노출 시간이 길어지고 있습니다."),
    scoredSignal(valueAtLeast(fiber.sustained_pressure_duration, 20), 5, "국소 압력 지속 시간이 길어지고 있습니다."),
    scoredSignal(valueAtLeast(longitudinalFeatures.temperature_change_from_baseline, 1.5), 6, "기준선 대비 온도 상승이 관찰됩니다."),
    scoredSignal(valueAtLeast(longitudinalFeatures.pressure_change_from_baseline, 12), 6, "기준선 대비 압력 증가가 관찰됩니다."),
    scoredSignal(valueAtLeast(longitudinalFeatures.image_change_score, 2), 5, "영상 변화 점수가 상승했습니다."),
  ]);

  const recurrentUlcer = scorePredictionEndpoint("6개월 재발 궤양", [
    scoredSignal(flags.hx_ulcer, 24, "과거 궤양 병력이 있습니다."),
    scoredSignal(flags.hx_amputation, 20, "과거 절단 병력이 있습니다."),
    scoredSignal(staticFeatures.hx_df_hospital, 10, "당뇨발 관련 입원 또는 시술 병력이 있습니다."),
    scoredSignal(scores.history_score >= 6, 10, "병력 점수가 높습니다."),
    scoredSignal(ruleFusionFlags.recurrence_risk_strengthened, 12, "병력과 hotspot 지속 신호가 재발 위험을 강화합니다."),
    scoredSignal(ruleFusionSignals.history_score_high, 8, "병력 관련 강화 신호가 있습니다."),
    scoredSignal(ruleFusionSignals.hotspot_persistence, 8, "열 hotspot 지속 신호가 있습니다."),
    scoredSignal(flags.immunosuppressed, 8, "면역억제제 복용력이 있어 상처 재발 및 악화 위험을 높입니다."),
    scoredSignal(flags.kidney_transplant, 6, "신장이식 병력이 있어 치유 과정 추적이 더 중요합니다."),
    scoredSignal(valueAtLeast(thermal.hotspot_persistence_days, 5), 8, "hotspot 지속 기간이 길어지고 있습니다."),
    scoredSignal(clinicianMeasurements.active_wound_present === true, 10, "활동성 상처가 남아 있어 재발 위험이 높습니다."),
    scoredSignal(scores.app_risk_class >= 2, 8, "기본 분류상 고위험에 가깝습니다."),
  ]);

  const persistentHotspot = scorePredictionEndpoint("지속성 hotspot", [
    scoredSignal(ruleFusionSignals.temp_asymmetry, 16, "온도 비대칭 신호가 감지되었습니다."),
    scoredSignal(ruleFusionSignals.hotspot_persistence, 14, "hotspot 지속 신호가 감지되었습니다."),
    scoredSignal(valueAtLeast(thermal.bilateral_temp_diff_max, 2.2), 18, "양측 온도차가 큽니다."),
    scoredSignal(valueAtLeast(thermal.regional_temp_diff_mean, 1.3), 10, "국소 평균 온도차가 높습니다."),
    scoredSignal(valueAtLeast(thermal.hotspot_count, 2), 8, "hotspot 개수가 증가했습니다."),
    scoredSignal(valueAtLeast(thermal.hotspot_persistence_days, 3), 10, "hotspot이 여러 날 지속되고 있습니다."),
    scoredSignal(valueAtLeast(longitudinalFeatures.temperature_change_from_baseline, 1.3), 10, "기준선 대비 온도 상승이 유지되고 있습니다."),
    scoredSignal(valueAtLeast(longitudinalFeatures.symptom_change_from_baseline, 1.5), 6, "증상 변화가 함께 커지고 있습니다."),
    scoredSignal(valueBelow(longitudinalFeatures.adherence_rate, 0.75), 5, "측정 순응도가 낮아 hotspot 관리가 불안정합니다."),
  ]);

  const woundWorsening = scorePredictionEndpoint("상처 악화", [
    scoredSignal(answers.currentFoot.wound === "YES", 18, "문진상 현재 상처가 보고되었습니다."),
    scoredSignal(answers.currentFoot.redness === "YES", 8, "문진상 발적이 보고되었습니다."),
    scoredSignal(answers.currentFoot.swellingOrHeat === "YES", 8, "문진상 부종 또는 열감이 보고되었습니다."),
    scoredSignal(flags.immunosuppressed, 10, "면역억제제 복용력이 있어 상처 악화 및 치유 지연 위험이 큽니다."),
    scoredSignal(flags.kidney_transplant, 6, "신장이식 병력이 있어 창상 회복 지연 가능성을 고려해야 합니다."),
    scoredSignal(clinicianMeasurements.active_wound_present === true, 20, "임상 입력에서 활동성 상처가 확인되었습니다."),
    scoredSignal(clinicianMeasurements.clinician_infection_suspect === true, 18, "임상 입력에서 감염 의심이 있습니다."),
    scoredSignal(clinicianMeasurements.clinician_edema === true, 8, "임상 입력에서 부종이 확인되었습니다."),
    scoredSignal(valueAtLeast(image.wound_presence_score, 2.5), 12, "영상 feature에서 상처 점수가 높습니다."),
    scoredSignal(valueAtLeast(image.redness_score, 2.5), 6, "영상 feature에서 발적 점수가 높습니다."),
    scoredSignal(valueAtLeast(longitudinalFeatures.image_change_score, 2.3), 8, "기준선 대비 영상 변화가 큽니다."),
    scoredSignal(valueAtLeast(longitudinalFeatures.symptom_change_from_baseline, 2), 8, "기준선 대비 증상 악화가 큽니다."),
    scoredSignal(ruleFusionSignals.hotspot_persistence, 6, "열 hotspot 지속 신호가 상처 악화 가능성을 높입니다."),
  ]);

  const vascularReferral = scorePredictionEndpoint("혈관 평가 의뢰", [
    scoredSignal(flags.pad_suspect, 16, "문진 기반 PAD 의심이 있습니다."),
    scoredSignal(scores.ischemia_score >= 4, 12, "허혈 점수가 높습니다."),
    scoredSignal(clinicianMeasurements.pulse_absent_count >= 1, 16, "맥박 결손이 확인되었습니다."),
    scoredSignal(valueBelow(clinicianMeasurements.tbi_value, 0.7), 18, "TBI가 낮습니다."),
    scoredSignal(valueBelow(clinicianMeasurements.toe_pressure_value, 60), 14, "toe pressure가 낮습니다."),
    scoredSignal(valueBelow(clinicianMeasurements.tcpo2_value, 40), 14, "TcPO2가 낮습니다."),
    scoredSignal(ruleFusionSignals.perfusion_low, 10, "관류 저하 신호가 감지되었습니다."),
    scoredSignal(ruleFusionSignals.temp_asymmetry, 6, "온도 비대칭 신호가 허혈 가능성을 보강합니다."),
    scoredSignal(ruleFusionFlags.ischemia_risk_strengthened, 10, "문진과 센서 융합 결과 허혈 위험이 강화되었습니다."),
    scoredSignal(valueBelow(optical.perfusion_index, 0.45), 10, "광학 perfusion index가 낮습니다."),
    scoredSignal(valueBelow(optical.local_heating_response, 0.55), 8, "가열 반응이 저하되어 있습니다."),
    scoredSignal(valueAtLeast(optical.time_to_peak, 7), 5, "혈류 반응 최고치 도달 시간이 지연됩니다."),
  ]);

  const offloadingFailure = scorePredictionEndpoint("압력 분산 실패", [
    scoredSignal(ruleFusionSignals.pressure_high, 18, "압력 상승 신호가 감지되었습니다."),
    scoredSignal(ruleFusionSignals.callus_score_high, 8, "굳은살 강화 신호가 있습니다."),
    scoredSignal(answers.footwear.newShoeInjury === "YES", 8, "새 신발 관련 손상 경험이 있습니다."),
    scoredSignal(answers.footwear.gaitImbalance === "YES", 8, "보행 불균형이 보고되었습니다."),
    scoredSignal(scores.footwear_score >= 4, 8, "신발/보행 위험 점수가 높습니다."),
    scoredSignal(valueAtLeast(pressure.peak_plantar_pressure, 260), 14, "족저 최대 압력이 높습니다."),
    scoredSignal(valueAtLeast(pressure.pressure_time_integral, 120), 10, "압력 시간 적분값이 높습니다."),
    scoredSignal(valueAtLeast(pressure.pressure_asymmetry_index, 0.18), 8, "압력 비대칭이 큽니다."),
    scoredSignal(valueAtLeast(pressure.gait_asymmetry_index, 0.18), 8, "보행 비대칭이 큽니다."),
    scoredSignal(valueBelow(pressure.offloading_adherence_score, 0.7), 10, "offloading 순응도가 낮습니다."),
    scoredSignal(valueAtLeast(fiber.sustained_pressure_duration, 20), 6, "국소 압력 지속 시간이 길고 분산이 충분하지 않습니다."),
  ]);

  const highRiskTransition = scorePredictionEndpoint("고위험군 전환", [
    scoredSignal(
      scores.app_risk_class <= 1 && scores.neuropathy_score >= NEUROPATHY_SUSPECT_THRESHOLD,
      10,
      "문진상 신경병증 점수가 증가했습니다.",
    ),
    scoredSignal(scores.app_risk_class <= 1 && scores.ischemia_score >= 4, 10, "문진상 허혈 점수가 증가했습니다."),
    scoredSignal(valueAtLeast(clinicianMeasurements.iwgdf_confirmed_risk_class, 2), 22, "임상 분류에서 Risk 2 이상이 확인되었습니다."),
    scoredSignal(clinicianMeasurements.monofilament_abnormal === true, 10, "모노필라멘트 이상이 확인되었습니다."),
    scoredSignal(clinicianMeasurements.deformity_present === true, 8, "발 변형이 확인되었습니다."),
    scoredSignal(clinicianMeasurements.active_wound_present === true, 12, "활동성 상처가 동반되어 있습니다."),
    scoredSignal(ruleFusionFlags.pre_ulcer_risk_strengthened, 10, "전궤양 위험 신호가 강화되었습니다."),
    scoredSignal(valueAtLeast(longitudinalFeatures.pressure_change_from_baseline, 12), 6, "압력 변화가 누적되고 있습니다."),
    scoredSignal(valueAtLeast(longitudinalFeatures.temperature_change_from_baseline, 1.5), 6, "온도 변화가 누적되고 있습니다."),
    scoredSignal(valueAtLeast(thermal.hotspot_persistence_days, 4), 6, "hotspot이 반복적으로 지속됩니다."),
  ]);

  const predictionEndpoints = {
    primary_6m_new_ulcer: newUlcer,
    primary_6m_recurrent_ulcer: recurrentUlcer,
    secondary_persistent_hotspot: persistentHotspot,
    secondary_wound_worsening: woundWorsening,
    secondary_vascular_referral_needed: vascularReferral,
    secondary_offloading_failure: offloadingFailure,
    secondary_clinician_confirmed_high_risk_transition: highRiskTransition,
  };

  const allEndpoints = Object.values(predictionEndpoints);
  const overallScore = clamp(
    Math.max(...allEndpoints.map((endpoint) => endpoint.score), 0) +
      valueIf(scores.app_risk_class >= 3, 12) +
      valueIf(flags.active_concerning_foot_symptom, 8),
    0,
    100,
  );
  const overallLevel = scoreToLevel(overallScore);
  const urgentAlerts = uniqueItems([
    flags.active_concerning_foot_symptom ? "활동성 발 증상 여부를 우선 확인하세요." : null,
    clinicianMeasurements.clinician_infection_suspect === true
      ? "감염 의심 소견이 있어 같은 날 재평가가 필요합니다."
      : null,
    vascularReferral.level === "높음" || vascularReferral.level === "매우 높음"
      ? "혈관 평가 의뢰 필요성이 높습니다."
      : null,
    woundWorsening.level === "높음" || woundWorsening.level === "매우 높음"
      ? "상처 악화 가능성이 높아 드레싱·오프로딩 전략을 재검토해야 합니다."
      : null,
  ]);

  const recommendedActions = uniqueItems([
    woundWorsening.score >= 55 || newUlcer.score >= 60
      ? "상처 여부, 발적, 열감, 압통을 같은 방문 내 다시 확인합니다."
      : null,
    vascularReferral.score >= 55
      ? "ABI/TBI, toe pressure, TcPO2 등 혈관 평가를 우선 연결합니다."
      : null,
    offloadingFailure.score >= 55
      ? "신발, 깔창, 보행 패턴, offloading 순응도를 함께 점검합니다."
      : null,
    persistentHotspot.score >= 45
      ? "다음 추적 측정에서 온도 hotspot 지속 여부를 비교합니다."
      : null,
    !hasClinicianData(clinicianMeasurements)
      ? "현재는 문진 중심 예측입니다. 임상 측정값을 입력하면 예측 정확도가 높아집니다."
      : null,
    !hasSensorData(longitudinalFeatures, sensorFeatureBundle)
      ? "센서 또는 시계열 feature를 추가하면 변화 추적과 조기 경고가 더 정교해집니다."
      : null,
  ]);

  const completeness = buildDataCompleteness(
    answers,
    clinicianMeasurements,
    longitudinalFeatures,
    sensorFeatureBundle,
  );

  return {
    predictionEndpoints,
    predictionSummary: {
      overallScore,
      overallLevel,
      careStage: determineCareStage(completeness),
      dataCompleteness: completeness,
      topDrivers: uniqueItems(
        allEndpoints
          .sort((left, right) => right.score - left.score)
          .slice(0, 2)
          .flatMap((endpoint) => endpoint.rationale.slice(0, 2)),
      ).slice(0, 4),
      recommendedActions,
      urgentAlerts,
      narrative: buildNarrative(overallLevel, completeness, recommendedActions),
    },
  };
}

export function buildCombinedResearchRecord({
  questionnaireAnswers,
  clinicianMeasurements = createInitialClinicianMeasurements(),
  longitudinalFeatures = createInitialLongitudinalFeatures(),
  sensorFeatureBundle = createInitialSensorFeatureBundle(),
  ruleFusionSignals = createInitialRuleFusionSignals(),
}) {
  const questionnairePayload = buildQuestionnairePayload(questionnaireAnswers);
  const staticFeatures = buildQuestionnaireStaticFeatures(questionnairePayload);
  const ruleFusionFlags = buildRuleBasedFusionFlags(staticFeatures, ruleFusionSignals);
  const insights = buildResearchInsights({
    questionnairePayload,
    staticFeatures,
    clinicianMeasurements,
    longitudinalFeatures,
    sensorFeatureBundle,
    ruleFusionSignals,
    ruleFusionFlags,
  });

  return {
    questionnairePayload,
    clinicianMeasurements,
    aiFeatureGroups: {
      static: staticFeatures,
      clinical: structuredClone(clinicianMeasurements),
      timeSeries: structuredClone(longitudinalFeatures),
      sensor: structuredClone(sensorFeatureBundle),
    },
    ruleFusionSignals: structuredClone(ruleFusionSignals),
    ruleFusionFlags,
    predictionEndpoints: insights.predictionEndpoints,
    predictionSummary: insights.predictionSummary,
  };
}

function valueIf(condition, score) {
  return condition ? score : 0;
}

function frequency4Score(value) {
  switch (value) {
    case "SOMETIMES":
      return 1;
    case "OFTEN":
      return 2;
    case "ALMOST_ALWAYS":
      return 3;
    default:
      return 0;
  }
}

function threeLevelScore(value) {
  switch (value) {
    case "SOMETIMES":
      return 1;
    case "OFTEN":
      return 2;
    default:
      return 0;
  }
}

function footCheckScore(value) {
  switch (value) {
    case "WEEKLY_2_3":
      return 1;
    case "RARELY":
      return 2;
    case "NEVER":
      return 3;
    default:
      return 0;
  }
}

function careScore(value) {
  switch (value) {
    case "SOMETIMES":
      return 1;
    case "RARELY":
      return 2;
    default:
      return 0;
  }
}

function barefootScore(value) {
  switch (value) {
    case "SOMETIMES":
      return 1;
    case "OFTEN":
      return 2;
    default:
      return 0;
  }
}

function tightShoeScore(value) {
  switch (value) {
    case "SOMETIMES":
      return 1;
    case "OFTEN":
      return 2;
    default:
      return 0;
  }
}

function walkingTimeScore(value) {
  switch (value) {
    case "MIN_30_TO_60":
      return 1;
    case "HOUR_1_TO_2":
      return 2;
    case "OVER_2_HOURS":
      return 3;
    default:
      return 0;
  }
}

function createEmptyEndpoint(label) {
  return {
    label,
    score: 0,
    level: "계산 전",
    rationale: [],
  };
}

function scorePredictionEndpoint(label, signals) {
  const activeSignals = signals.filter((signal) => signal.active);
  const score = clamp(
    activeSignals.reduce((total, signal) => total + signal.weight, 0),
    0,
    100,
  );

  return {
    label,
    score,
    level: scoreToLevel(score),
    rationale: activeSignals
      .sort((left, right) => right.weight - left.weight)
      .map((signal) => signal.message)
      .slice(0, 4),
  };
}

function scoredSignal(active, weight, message) {
  return {
    active: Boolean(active),
    weight,
    message,
  };
}

function buildDataCompleteness(
  questionnaireAnswers,
  clinicianMeasurements,
  longitudinalFeatures,
  sensorFeatureBundle,
) {
  const questionnaireFields = [
    questionnaireAnswers.demographics.fullName,
    questionnaireAnswers.demographics.gender,
    questionnaireAnswers.demographics.age,
    questionnaireAnswers.diabetes.diagnosisDuration,
    questionnaireAnswers.diabetes.treatmentType,
    questionnaireAnswers.history.ulcerHistory,
    questionnaireAnswers.neuropathy.numbness,
    questionnaireAnswers.ischemia.restPain,
    questionnaireAnswers.currentFoot.wound,
    questionnaireAnswers.selfCare.dailyCheck,
    questionnaireAnswers.footwear.tightShoes,
    questionnaireAnswers.comorbidity.smokingStatus,
  ];

  const clinicianFields = Object.values(clinicianMeasurements);
  const timeSeriesFields = Object.values(longitudinalFeatures);
  const sensorFields = flattenSensorValues(sensorFeatureBundle);

  return {
    questionnairePercent: calculatePercentFilled(questionnaireFields),
    clinicianPercent: calculatePercentFilled(clinicianFields),
    sensorPercent: calculatePercentFilled([...timeSeriesFields, ...sensorFields]),
  };
}

function determineCareStage(completeness) {
  if (completeness.sensorPercent >= 30) {
    return "센서 융합 예측 단계";
  }
  if (completeness.clinicianPercent >= 30) {
    return "임상 측정 반영 단계";
  }
  return "문진 기반 초기 분류 단계";
}

function buildNarrative(overallLevel, completeness, recommendedActions) {
  const readiness =
    completeness.sensorPercent >= 30
      ? "센서와 시계열 feature가 포함된 상태"
      : completeness.clinicianPercent >= 30
        ? "문진과 임상 측정이 결합된 상태"
        : "문진 위주의 초기 상태";

  if (recommendedActions.length === 0) {
    return `${readiness}에서 위험도는 ${overallLevel}입니다. 추가 측정이 들어오면 예측이 더 정교해집니다.`;
  }

  return `${readiness}에서 위험도는 ${overallLevel}이며, 우선 ${recommendedActions[0]}`;
}

function hasClinicianData(clinicianMeasurements) {
  return Object.values(clinicianMeasurements).some(hasMeaningfulValue);
}

function hasSensorData(longitudinalFeatures, sensorFeatureBundle) {
  return (
    Object.values(longitudinalFeatures).some(hasMeaningfulValue) ||
    flattenSensorValues(sensorFeatureBundle).some(hasMeaningfulValue)
  );
}

function flattenSensorValues(sensorFeatureBundle) {
  return Object.values(sensorFeatureBundle).flatMap((group) => Object.values(group));
}

function calculatePercentFilled(values) {
  if (!values.length) {
    return 0;
  }

  const filledCount = values.filter(hasMeaningfulValue).length;
  return Math.round((filledCount / values.length) * 100);
}

function hasMeaningfulValue(value) {
  if (Array.isArray(value)) {
    return value.length > 0;
  }
  return value !== null && value !== undefined && value !== "";
}

function valueAtLeast(value, threshold) {
  return typeof value === "number" && Number.isFinite(value) && value >= threshold;
}

function valueBelow(value, threshold) {
  return typeof value === "number" && Number.isFinite(value) && value < threshold;
}

function scoreToLevel(score) {
  if (score >= 75) {
    return "매우 높음";
  }
  if (score >= 55) {
    return "높음";
  }
  if (score >= 30) {
    return "주의";
  }
  return "낮음";
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function uniqueItems(values) {
  return [...new Set(values.filter(Boolean))];
}

function parseNullableNumber(value) {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value !== "string" || !value.trim()) {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function calculateBmi(heightCm, weightKg) {
  if (!heightCm || !weightKg) {
    return null;
  }

  const heightM = heightCm / 100;
  if (heightM <= 0) {
    return null;
  }

  return Number((weightKg / (heightM * heightM)).toFixed(1));
}
