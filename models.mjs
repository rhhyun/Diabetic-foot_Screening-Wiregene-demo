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
      numbness: null,
      reducedSoleSensation: null,
      burning: null,
      nightPain: null,
      temperatureLoss: null,
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
    primary_6m_new_ulcer: null,
    primary_6m_recurrent_ulcer: null,
    secondary_persistent_hotspot: null,
    secondary_wound_worsening: null,
    secondary_vascular_referral_needed: null,
    secondary_offloading_failure: null,
    secondary_clinician_confirmed_high_risk_transition: null,
  };
}

export function buildQuestionnairePayload(answers) {
  const historyScore =
    valueIf(answers.history.ulcerHistory === "YES", 4) +
    valueIf(answers.history.amputationHistory === "YES", 4) +
    valueIf(answers.history.admissionOrProcedureHistory === "YES", 2) +
    valueIf(answers.comorbidity.kidneyDiseaseOrDialysis === "YES", 3);

  const diagnosedNeuropathy = answers.history.diagnosedConditions.includes("NEUROPATHY");
  const diagnosedPad = answers.history.diagnosedConditions.includes("PAD");
  const diagnosedDiabeticFoot = answers.history.diagnosedConditions.includes("DIABETIC_FOOT");

  const neuropathyScore =
    frequency4Score(answers.neuropathy.numbness) +
    frequency4Score(answers.neuropathy.reducedSoleSensation) +
    frequency4Score(answers.neuropathy.burning) +
    frequency4Score(answers.neuropathy.nightPain) +
    valueIf(answers.neuropathy.temperatureLoss === "YES", 2);

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

  const neuropathySuspect = neuropathyScore >= 5 || diagnosedNeuropathy;
  const padSuspect =
    ischemiaScore >= 4 || diagnosedPad || answers.ischemia.circulationDiagnosis === "YES";
  const highRiskFootState = footStatusScore >= 3 || diagnosedDiabeticFoot;

  const hxUlcer = answers.history.ulcerHistory === "YES";
  const hxAmputation = answers.history.amputationHistory === "YES";
  const esrd = answers.comorbidity.kidneyDiseaseOrDialysis === "YES";

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
    questionnaireVersion: "iwgdf-2024-patient-v1",
    source: "wiregene-diabetic-foot-screening",
    submittedAt: new Date().toISOString(),
    questionnaireData: structuredClone(answers),
    internalFlags: {
      hx_ulcer: hxUlcer,
      hx_amputation: hxAmputation,
      esrd,
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
      staticFeatures.neuropathy_score >= 5 &&
      signals.pressure_high &&
      signals.callus_score_high,
    recurrence_risk_strengthened:
      staticFeatures.history_score >= 4 &&
      signals.history_score_high &&
      signals.hotspot_persistence,
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

  return {
    questionnairePayload,
    clinicianMeasurements,
    aiFeatureGroups: {
      static: staticFeatures,
      clinical: structuredClone(clinicianMeasurements),
      timeSeries: structuredClone(longitudinalFeatures),
      sensor: structuredClone(sensorFeatureBundle),
    },
    ruleFusionFlags,
    predictionEndpoints: createInitialPredictionEndpoints(),
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
