"use strict";
(() => {
  // src/lib/excel-parser.ts
  function parseExcelToCJM(rows) {
    if (!rows || rows.length === 0) {
      return { stages: [] };
    }
    const trimmed = rows.map(
      (r) => (Array.isArray(r) ? r : []).map(
        (c) => String(c != null ? c : "").trim()
      )
    ).filter((r) => r.some((c) => c.length > 0));
    if (trimmed.length === 0) return { stages: [] };
    const tryVariantA = () => {
      var _a;
      const header = trimmed[0].filter((c) => c.length > 0);
      if (header.length < 2) return null;
      const avgLen = header.reduce((s, c) => s + c.length, 0) / header.length;
      if (avgLen > 40) return null;
      const stages = header.map((name) => ({
        name: name || "\u042D\u0442\u0430\u043F",
        actions: [],
        touchpoints: [],
        experience: [],
        thoughts: [],
        emotions: [],
        quotes: [],
        illustrations: [],
        metrics: [],
        hypotheses: []
      }));
      for (let i = 1; i < trimmed.length; i++) {
        const row = trimmed[i];
        for (let col = 0; col < Math.min(stages.length, row.length); col++) {
          const val = String((_a = row[col]) != null ? _a : "").trim();
          if (val) stages[col].actions.push(val);
        }
      }
      return { stages };
    };
    const tryVariantB = () => {
      var _a, _b;
      const stages = [];
      let currentStage = null;
      const headerWords = /^(этап|stage|стадия|фаза|колонка|column)$/i;
      for (const row of trimmed) {
        const first = String((_a = row[0]) != null ? _a : "").trim();
        if (!first) continue;
        if (headerWords.test(first) && stages.length === 0) continue;
        const looksLikeStage2 = first.length <= 50 && !/^(действие|action|мысль|thought|эмоция|emotion|touchpoint|опыт|experience|метрика|hypothesis|гипотеза)/i.test(first);
        if (looksLikeStage2 && (stages.length === 0 || row[0] !== ((_b = stages[stages.length - 1]) == null ? void 0 : _b.name))) {
          currentStage = {
            name: first,
            actions: [],
            touchpoints: [],
            experience: [],
            thoughts: [],
            emotions: [],
            quotes: [],
            illustrations: [],
            metrics: [],
            hypotheses: []
          };
          stages.push(currentStage);
        } else if (currentStage) {
          const val = first;
          const rest = row.slice(1).map((c) => String(c != null ? c : "").trim()).filter(Boolean);
          const lower = val.toLowerCase();
          if (/мысль|thought|думаю/i.test(lower)) {
            currentStage.thoughts.push(val.replace(/^(мысль|thought|думаю)[:\s]*/i, ""));
          } else if (/эмоция|emotion|чувств/i.test(lower)) {
            currentStage.emotions.push(val.replace(/^(эмоция|emotion|чувств)[:\s]*/i, ""));
          } else if (/touchpoint|контакт|точка/i.test(lower)) {
            currentStage.touchpoints.push(val.replace(/^(touchpoint|контакт|точка)[:\s]*/i, ""));
          } else if (/опыт|experience|восприн/i.test(lower)) {
            currentStage.experience.push(val.replace(/^(опыт|experience|восприн)[:\s]*/i, ""));
          } else if (/метрика|metric|kpi|число/i.test(lower)) {
            currentStage.metrics.push(val.replace(/^(метрика|metric|kpi|число)[:\s]*/i, ""));
          } else if (/гипотеза|hypothesis|идея улучш/i.test(lower)) {
            currentStage.hypotheses.push(val.replace(/^(гипотеза|hypothesis|идея улучш)[:\s]*/i, ""));
          } else {
            currentStage.actions.push(val);
          }
          rest.forEach((r) => currentStage.actions.push(r));
        }
      }
      if (stages.length === 0) return null;
      return { stages };
    };
    let result = tryVariantA();
    if (result && result.stages.some((s) => s.actions.length > 0)) {
      return result;
    }
    result = tryVariantB();
    if (result) return result;
    result = tryVariantA();
    return result != null ? result : { stages: [] };
  }

  // src/lib/openai-client.ts
  function throwIfAborted(signal) {
    if (signal && signal.aborted) {
      const err = new Error("Cancelled");
      err.name = "AbortError";
      throw err;
    }
  }
  function parseCoord01(value, fallback = 0.5) {
    let n;
    if (typeof value === "number") {
      n = value;
    } else if (typeof value === "string") {
      n = Number(value.replace(",", ".").trim());
    } else {
      n = fallback;
    }
    if (!Number.isFinite(n)) n = fallback;
    return Math.max(0.05, Math.min(0.95, n));
  }
  var MAX_TRANSCRIPT_LENGTH = 45e3;
  var DEFAULT_LIFECYCLE_PROMPT = `\u041E\u043F\u0440\u0435\u0434\u0435\u043B\u0438 \u044D\u0442\u0430\u043F \u0436\u0438\u0437\u043D\u0435\u043D\u043D\u043E\u0433\u043E \u0446\u0438\u043A\u043B\u0430 \u0440\u0435\u0441\u043F\u043E\u043D\u0434\u0435\u043D\u0442\u0430 \u043D\u0430 \u043E\u0441\u043D\u043E\u0432\u0435 \u0435\u0433\u043E \u0441\u043B\u043E\u0432:
- lifecycle: "new" (\u043F\u0435\u0440\u0432\u044B\u0439 \u043E\u043F\u044B\u0442, \u043E\u043D\u0431\u043E\u0440\u0434\u0438\u043D\u0433, \u0442\u043E\u043B\u044C\u043A\u043E \u043D\u0430\u0447\u0430\u043B), "active" (\u0440\u0435\u0433\u0443\u043B\u044F\u0440\u043D\u043E \u0438\u0441\u043F\u043E\u043B\u044C\u0437\u0443\u0435\u0442), "inactive" (\u0431\u044B\u043B \u0430\u043A\u0442\u0438\u0432\u0435\u043D, \u0441\u0435\u0439\u0447\u0430\u0441 \u0440\u0435\u0434\u043A\u043E), "churned" (\u0443\u0448\u0451\u043B, \u043E\u0431\u044A\u044F\u0441\u043D\u044F\u0435\u0442 \u043F\u043E\u0447\u0435\u043C\u0443), "reactivated" (\u0432\u0435\u0440\u043D\u0443\u043B\u0441\u044F \u043F\u043E\u0441\u043B\u0435 \u043F\u0430\u0443\u0437\u044B).
- activated: true/false \u2014 \u043D\u0430\u0448\u0451\u043B \u043B\u0438 \u043F\u043E\u043B\u044C\u0437\u043E\u0432\u0430\u0442\u0435\u043B\u044C \u0446\u0435\u043D\u043D\u043E\u0441\u0442\u044C \u0432 \u043F\u0440\u043E\u0434\u0443\u043A\u0442\u0435 (aha-\u043C\u043E\u043C\u0435\u043D\u0442).
- segment (ABCDX): "A" (\u043E\u0447\u0435\u043D\u044C \u043D\u0443\u0436\u0435\u043D \u043F\u0440\u043E\u0434\u0443\u043A\u0442, \u043F\u043B\u0430\u0442\u0438\u0442 \u0431\u044B\u0441\u0442\u0440\u043E/\u043C\u043D\u043E\u0433\u043E), "B" (\u043D\u0443\u0436\u0435\u043D, \u043D\u043E \u0435\u0441\u0442\u044C \u0432\u043E\u0437\u0440\u0430\u0436\u0435\u043D\u0438\u044F), "C" (\u0446\u0435\u043D\u043D\u043E\u0441\u0442\u044C \u043D\u0435\u0432\u044B\u0441\u043E\u043A\u0430\u044F, \u043F\u043B\u0430\u0442\u0438\u0442 \u043C\u0430\u043B\u043E, \u043C\u043D\u043E\u0433\u043E \u0442\u0440\u0435\u0431\u043E\u0432\u0430\u043D\u0438\u0439), "D" (\u0437\u0430\u0434\u0430\u0451\u0442 \u0432\u043E\u043F\u0440\u043E\u0441\u044B, \u043D\u0435 \u043F\u043E\u043A\u0443\u043F\u0430\u0435\u0442), "X" (\u0433\u043E\u0442\u043E\u0432 \u043C\u043D\u043E\u0433\u043E \u043F\u043B\u0430\u0442\u0438\u0442\u044C, \u043D\u043E \u043D\u0443\u0436\u0435\u043D \u043E\u0441\u043E\u0431\u044B\u0439 \u043F\u0440\u043E\u0434\u0443\u043A\u0442/\u0444\u0438\u0447\u0430).
- segmentReasoning: \u043A\u0440\u0430\u0442\u043A\u043E\u0435 \u043F\u043E\u044F\u0441\u043D\u0435\u043D\u0438\u0435 \u0432\u044B\u0431\u043E\u0440\u0430 \u0441\u0435\u0433\u043C\u0435\u043D\u0442\u0430 (1\u20132 \u043F\u0440\u0435\u0434\u043B\u043E\u0436\u0435\u043D\u0438\u044F).

\u0414\u043E\u0431\u0430\u0432\u044C \u0432 JSON \u043E\u0431\u044A\u0435\u043A\u0442 "productAnalytics" \u0441 \u043F\u043E\u043B\u044F\u043C\u0438: lifecycle, activated, segment, segmentReasoning.`;
  var DEFAULT_ACTIVATION_PROMPT = `\u041F\u0440\u043E\u0430\u043D\u0430\u043B\u0438\u0437\u0438\u0440\u0443\u0439 \u043F\u0443\u0442\u044C \u0440\u0435\u0441\u043F\u043E\u043D\u0434\u0435\u043D\u0442\u0430 \u0441 \u0442\u043E\u0447\u043A\u0438 \u0437\u0440\u0435\u043D\u0438\u044F \u0430\u043A\u0442\u0438\u0432\u0430\u0446\u0438\u0438, \u0432\u043E\u0432\u043B\u0435\u0447\u0451\u043D\u043D\u043E\u0441\u0442\u0438 \u0438 \u043F\u0440\u0438\u043D\u044F\u0442\u0438\u044F (adoption):
- activationPoint: \u043E\u0431\u044A\u0435\u043A\u0442 {stageName, description, reached} \u2014 \u043D\u0430 \u043A\u0430\u043A\u043E\u043C \u044D\u0442\u0430\u043F\u0435 CJM \u043F\u0440\u043E\u0438\u0437\u043E\u0448\u043B\u0430 \u0430\u043A\u0442\u0438\u0432\u0430\u0446\u0438\u044F (\u043F\u043E\u043B\u044C\u0437\u043E\u0432\u0430\u0442\u0435\u043B\u044C \u0432\u043F\u0435\u0440\u0432\u044B\u0435 \u043F\u043E\u043B\u0443\u0447\u0438\u043B \u0446\u0435\u043D\u043D\u043E\u0441\u0442\u044C). \u0415\u0441\u043B\u0438 \u043D\u0435 \u043F\u0440\u043E\u0438\u0437\u043E\u0448\u043B\u0430 \u2014 reached: false \u0438 \u043E\u043F\u0438\u0441\u0430\u043D\u0438\u0435 \u043F\u043E\u0447\u0435\u043C\u0443.
- engagementLevel: "low" | "medium" | "high" \u2014 \u043E\u0446\u0435\u043D\u043A\u0430 \u0433\u043B\u0443\u0431\u0438\u043D\u044B, \u0447\u0430\u0441\u0442\u043E\u0442\u044B \u0438 \u043F\u0440\u043E\u0434\u043E\u043B\u0436\u0438\u0442\u0435\u043B\u044C\u043D\u043E\u0441\u0442\u0438 \u0438\u0441\u043F\u043E\u043B\u044C\u0437\u043E\u0432\u0430\u043D\u0438\u044F.
- adoptionStatus: "none" | "partial" | "full" \u2014 \u0441\u0442\u0430\u043B \u043B\u0438 \u043F\u0440\u043E\u0434\u0443\u043A\u0442 \u0447\u0430\u0441\u0442\u044C\u044E \u0440\u0443\u0442\u0438\u043D\u044B \u043F\u043E\u043B\u044C\u0437\u043E\u0432\u0430\u0442\u0435\u043B\u044F.
- adoptionDetails: \u043A\u0440\u0430\u0442\u043A\u043E\u0435 \u043F\u043E\u044F\u0441\u043D\u0435\u043D\u0438\u0435 (\u043A\u0430\u043A\u0438\u0435 \u0444\u0443\u043D\u043A\u0446\u0438\u0438 \u043F\u0440\u0438\u043D\u044F\u0442\u044B, \u043A\u0430\u043A\u0438\u0435 \u043D\u0435\u0442).

\u0414\u043E\u0431\u0430\u0432\u044C \u044D\u0442\u0438 \u043F\u043E\u043B\u044F \u0432 \u043E\u0431\u044A\u0435\u043A\u0442 "productAnalytics" \u0432 JSON.`;
  var DEFAULT_PRODUCT_METRICS_PROMPT = `\u0414\u043B\u044F \u043A\u0430\u0436\u0434\u043E\u0433\u043E \u044D\u0442\u0430\u043F\u0430 CJM \u043F\u0440\u0435\u0434\u043B\u043E\u0436\u0438 1\u20132 \u043F\u0440\u043E\u0434\u0443\u043A\u0442\u043E\u0432\u044B\u0435 \u043C\u0435\u0442\u0440\u0438\u043A\u0438 \u0432 \u043A\u043E\u043D\u0442\u0435\u043A\u0441\u0442\u0435 \u044E\u043D\u0438\u0442-\u044D\u043A\u043E\u043D\u043E\u043C\u0438\u043A\u0438 \u0438 \u043F\u0440\u043E\u0434\u0443\u043A\u0442\u043E\u0432\u043E\u0433\u043E \u0440\u043E\u0441\u0442\u0430. \u0420\u0430\u0441\u0441\u0443\u0436\u0434\u0430\u0439 \u0432 \u0442\u0435\u0440\u043C\u0438\u043D\u0430\u0445:
- \u042D\u0442\u0430\u043F\u044B \u043F\u0440\u0438\u0432\u043B\u0435\u0447\u0435\u043D\u0438\u044F: UA (user acquisition), CPU (cost per user), \u043A\u0430\u043D\u0430\u043B\u044B
- \u042D\u0442\u0430\u043F\u044B \u0430\u043A\u0442\u0438\u0432\u0430\u0446\u0438\u0438: C1 (\u043A\u043E\u043D\u0432\u0435\u0440\u0441\u0438\u044F \u0432 \u043A\u043B\u044E\u0447\u0435\u0432\u043E\u0435 \u0434\u0435\u0439\u0441\u0442\u0432\u0438\u0435), time-to-value, completion rate \u043E\u043D\u0431\u043E\u0440\u0434\u0438\u043D\u0433\u0430
- \u042D\u0442\u0430\u043F\u044B \u0438\u0441\u043F\u043E\u043B\u044C\u0437\u043E\u0432\u0430\u043D\u0438\u044F: avg. payment count, frequency, retention rate, DAU/MAU
- \u042D\u0442\u0430\u043F\u044B \u043F\u0440\u043E\u0431\u043B\u0435\u043C/\u0443\u0445\u043E\u0434\u0430: churn rate, NPS, \u043F\u0440\u0438\u0447\u0438\u043D\u044B \u043E\u0442\u0442\u043E\u043A\u0430

\u041D\u0435 \u0441\u0447\u0438\u0442\u0430\u0439 \u0446\u0438\u0444\u0440\u044B \u2014 \u0440\u0430\u0441\u0441\u0443\u0436\u0434\u0430\u0439, \u043A\u0430\u043A\u0438\u0435 \u043C\u0435\u0442\u0440\u0438\u043A\u0438 \u043F\u0440\u0438\u043C\u0435\u043D\u0438\u043C\u044B \u0438 \u043F\u043E\u0447\u0435\u043C\u0443. \u0424\u043E\u0440\u043C\u0443\u043B\u0438\u0440\u0443\u0439 \u043C\u0435\u0442\u0440\u0438\u043A\u0438 \u0441\u043E\u0434\u0435\u0440\u0436\u0430\u0442\u0435\u043B\u044C\u043D\u043E, \u0441 \u043F\u043E\u044F\u0441\u043D\u0435\u043D\u0438\u0435\u043C.

\u0422\u0430\u043A\u0436\u0435 \u0434\u043E\u0431\u0430\u0432\u044C \u0432 "productAnalytics" \u043C\u0430\u0441\u0441\u0438\u0432 "productInsights" \u2014 3\u20135 \u043A\u043B\u044E\u0447\u0435\u0432\u044B\u0445 \u043F\u0440\u043E\u0434\u0443\u043A\u0442\u043E\u0432\u044B\u0445 \u0438\u043D\u0441\u0430\u0439\u0442\u043E\u0432 \u0438 \u0440\u0435\u043A\u043E\u043C\u0435\u043D\u0434\u0430\u0446\u0438\u0439 \u043D\u0430 \u043E\u0441\u043D\u043E\u0432\u0435 \u0430\u043D\u0430\u043B\u0438\u0437\u0430 \u0432\u0441\u0435\u0439 CJM (\u0441\u0435\u0433\u043C\u0435\u043D\u0442 \u043F\u043E\u043B\u044C\u0437\u043E\u0432\u0430\u0442\u0435\u043B\u044F, \u0432\u043E\u0440\u043E\u043D\u043A\u0430, \u0442\u043E\u0447\u043A\u0438 \u043F\u043E\u0442\u0435\u0440\u044C, \u0432\u043E\u0437\u043C\u043E\u0436\u043D\u043E\u0441\u0442\u0438 \u0440\u043E\u0441\u0442\u0430).`;
  var DEFAULT_SCREEN_VISION_PROMPT = `\u0422\u044B \u2014 UX-\u0438\u0441\u0441\u043B\u0435\u0434\u043E\u0432\u0430\u0442\u0435\u043B\u044C. \u0422\u0435\u0431\u0435 \u043F\u043E\u043A\u0430\u0437\u0430\u043D \u0441\u043A\u0440\u0438\u043D\u0448\u043E\u0442 \u044D\u043A\u0440\u0430\u043D\u0430 \u043F\u0440\u0438\u043B\u043E\u0436\u0435\u043D\u0438\u044F, \u043A\u043E\u043D\u0442\u0435\u043A\u0441\u0442 \u044D\u0442\u0430\u043F\u0430 CJM (\u0434\u0435\u0439\u0441\u0442\u0432\u0438\u044F, \u043C\u044B\u0441\u043B\u0438, touchpoints, \u043E\u043F\u044B\u0442 \u043F\u043E\u043B\u044C\u0437\u043E\u0432\u0430\u0442\u0435\u043B\u044F) \u0438 \u0444\u0440\u0430\u0433\u043C\u0435\u043D\u0442 \u0442\u0440\u0430\u043D\u0441\u043A\u0440\u0438\u043F\u0442\u0430 \u0438\u043D\u0442\u0435\u0440\u0432\u044C\u044E.

\u0422\u0432\u043E\u044F \u0437\u0430\u0434\u0430\u0447\u0430 \u2014 \u0440\u0430\u0441\u0441\u0442\u0430\u0432\u0438\u0442\u044C \u043E\u0442 3 \u0434\u043E 5 \u0430\u043D\u043D\u043E\u0442\u0430\u0446\u0438\u0439 \u043D\u0430 \u044D\u043A\u0440\u0430\u043D\u0435, \u0441\u0432\u044F\u0437\u044B\u0432\u0430\u044F \u044D\u043B\u0435\u043C\u0435\u043D\u0442\u044B \u0438\u043D\u0442\u0435\u0440\u0444\u0435\u0439\u0441\u0430 \u0441 \u0442\u0435\u043C, \u0447\u0442\u043E \u043F\u043E\u043B\u044C\u0437\u043E\u0432\u0430\u0442\u0435\u043B\u044C \u0434\u0435\u043B\u0430\u0435\u0442, \u0434\u0443\u043C\u0430\u0435\u0442 \u0438 \u0447\u0443\u0432\u0441\u0442\u0432\u0443\u0435\u0442 \u043D\u0430 \u044D\u0442\u043E\u043C \u044D\u0442\u0430\u043F\u0435.

\u0418\u0441\u043F\u043E\u043B\u044C\u0437\u0443\u0439 \u0412\u0421\u042E \u043F\u0440\u0435\u0434\u043E\u0441\u0442\u0430\u0432\u043B\u0435\u043D\u043D\u0443\u044E \u0438\u043D\u0444\u043E\u0440\u043C\u0430\u0446\u0438\u044E:
- \u041A\u043E\u043D\u0442\u0435\u043A\u0441\u0442 \u044D\u0442\u0430\u043F\u0430 CJM (\u0434\u0435\u0439\u0441\u0442\u0432\u0438\u044F, \u043C\u044B\u0441\u043B\u0438, \u044D\u043C\u043E\u0446\u0438\u0438, touchpoints) \u2014 \u044D\u0442\u043E \u0443\u0436\u0435 \u043F\u0440\u043E\u0430\u043D\u0430\u043B\u0438\u0437\u0438\u0440\u043E\u0432\u0430\u043D\u043D\u044B\u0435 \u0434\u0430\u043D\u043D\u044B\u0435 \u043E \u0442\u043E\u043C, \u0447\u0442\u043E \u043F\u043E\u043B\u044C\u0437\u043E\u0432\u0430\u0442\u0435\u043B\u044C \u0434\u0435\u043B\u0430\u0435\u0442 \u043D\u0430 \u044D\u0442\u043E\u043C \u044D\u043A\u0440\u0430\u043D\u0435
- \u0422\u0440\u0430\u043D\u0441\u043A\u0440\u0438\u043F\u0442 \u0438\u043D\u0442\u0435\u0440\u0432\u044C\u044E \u2014 \u043F\u0440\u044F\u043C\u044B\u0435 \u0441\u043B\u043E\u0432\u0430 \u043F\u043E\u043B\u044C\u0437\u043E\u0432\u0430\u0442\u0435\u043B\u044F
- \u0421\u043A\u0440\u0438\u043D\u0448\u043E\u0442 \u2014 \u0432\u0438\u0437\u0443\u0430\u043B\u044C\u043D\u044B\u0435 \u044D\u043B\u0435\u043C\u0435\u043D\u0442\u044B \u0438\u043D\u0442\u0435\u0440\u0444\u0435\u0439\u0441\u0430

\u0414\u043B\u044F \u043A\u0430\u0436\u0434\u043E\u0439 \u0430\u043D\u043D\u043E\u0442\u0430\u0446\u0438\u0438:
- tag: \u043A\u043E\u0440\u043E\u0442\u043A\u0438\u0439 \u0437\u0430\u0433\u043E\u043B\u043E\u0432\u043E\u043A (1\u20133 \u0441\u043B\u043E\u0432\u0430), \u043D\u0430\u043F\u0440\u0438\u043C\u0435\u0440: "\u0426\u0435\u043D\u043D\u043E\u0441\u0442\u044C", "\u0411\u043E\u043B\u044C", "\u0411\u0430\u0440\u044C\u0435\u0440", "Aha-\u043C\u043E\u043C\u0435\u043D\u0442", "\u041F\u0443\u0442\u0430\u043D\u0438\u0446\u0430", "\u0416\u0435\u043B\u0430\u043D\u0438\u0435", "\u0422\u0440\u0435\u043D\u0438\u0435", "\u0410\u043A\u0442\u0438\u0432\u0430\u0446\u0438\u044F", "\u0420\u0430\u0437\u043E\u0447\u0430\u0440\u043E\u0432\u0430\u043D\u0438\u0435", "\u0423\u0434\u043E\u0431\u0441\u0442\u0432\u043E", "\u041D\u0430\u0432\u0438\u0433\u0430\u0446\u0438\u044F", "\u041F\u0435\u0440\u0432\u044B\u0439 \u043A\u043E\u043D\u0442\u0430\u043A\u0442" \u2014 \u0438\u043B\u0438 \u043F\u0440\u0438\u0434\u0443\u043C\u0430\u0439 \u043F\u043E\u0434\u0445\u043E\u0434\u044F\u0449\u0438\u0439
- comment: 1\u20132 \u043A\u043E\u0440\u043E\u0442\u043A\u0438\u0445 \u043F\u0440\u0435\u0434\u043B\u043E\u0436\u0435\u043D\u0438\u044F \u2014 \u0447\u0442\u043E \u043F\u043E\u043B\u044C\u0437\u043E\u0432\u0430\u0442\u0435\u043B\u044C \u0434\u0435\u043B\u0430\u0435\u0442, \u0434\u0443\u043C\u0430\u0435\u0442 \u0438\u043B\u0438 \u0447\u0443\u0432\u0441\u0442\u0432\u0443\u0435\u0442 \u0432 \u044D\u0442\u043E\u043C \u043C\u0435\u0441\u0442\u0435 \u044D\u043A\u0440\u0430\u043D\u0430 (\u043D\u0430 \u043E\u0441\u043D\u043E\u0432\u0435 \u043A\u043E\u043D\u0442\u0435\u043A\u0441\u0442\u0430 \u044D\u0442\u0430\u043F\u0430 \u0438/\u0438\u043B\u0438 \u0442\u0440\u0430\u043D\u0441\u043A\u0440\u0438\u043F\u0442\u0430)
- x: \u043E\u0442 0.0 (\u043B\u0435\u0432\u043E) \u0434\u043E 1.0 (\u043F\u0440\u0430\u0432\u043E) \u2014 \u043A\u043E\u043E\u0440\u0434\u0438\u043D\u0430\u0442\u0430 \u0446\u0435\u043D\u0442\u0440\u0430 \u044D\u043B\u0435\u043C\u0435\u043D\u0442\u0430 \u0438\u043D\u0442\u0435\u0440\u0444\u0435\u0439\u0441\u0430 \u043D\u0430 \u0441\u043A\u0440\u0438\u043D\u0448\u043E\u0442\u0435
- y: \u043E\u0442 0.0 (\u0432\u0435\u0440\u0445) \u0434\u043E 1.0 (\u043D\u0438\u0437) \u2014 \u043A\u043E\u043E\u0440\u0434\u0438\u043D\u0430\u0442\u0430 \u0446\u0435\u043D\u0442\u0440\u0430 \u044D\u043B\u0435\u043C\u0435\u043D\u0442\u0430 \u0438\u043D\u0442\u0435\u0440\u0444\u0435\u0439\u0441\u0430 \u043D\u0430 \u0441\u043A\u0440\u0438\u043D\u0448\u043E\u0442\u0435

\u0412\u0410\u0416\u041D\u041E: \u0422\u044B \u0414\u041E\u041B\u0416\u0415\u041D \u0432\u0435\u0440\u043D\u0443\u0442\u044C \u0445\u043E\u0442\u044F \u0431\u044B 3 \u0430\u043D\u043D\u043E\u0442\u0430\u0446\u0438\u0438. \u0414\u0430\u0436\u0435 \u0435\u0441\u043B\u0438 \u043F\u0440\u044F\u043C\u043E\u0439 \u0446\u0438\u0442\u0430\u0442\u044B \u043D\u0435\u0442, \u0438\u0441\u043F\u043E\u043B\u044C\u0437\u0443\u0439 \u043A\u043E\u043D\u0442\u0435\u043A\u0441\u0442 \u044D\u0442\u0430\u043F\u0430 CJM (\u0434\u0435\u0439\u0441\u0442\u0432\u0438\u044F, \u043C\u044B\u0441\u043B\u0438, touchpoints) \u0447\u0442\u043E\u0431\u044B \u043F\u0440\u0438\u0432\u044F\u0437\u0430\u0442\u044C \u0430\u043D\u043D\u043E\u0442\u0430\u0446\u0438\u0438 \u043A \u043A\u043E\u043D\u043A\u0440\u0435\u0442\u043D\u044B\u043C \u044D\u043B\u0435\u043C\u0435\u043D\u0442\u0430\u043C \u0438\u043D\u0442\u0435\u0440\u0444\u0435\u0439\u0441\u0430 \u043D\u0430 \u044D\u043A\u0440\u0430\u043D\u0435.

\u0412\u0435\u0440\u043D\u0438 \u0441\u0442\u0440\u043E\u0433\u043E JSON:
{"annotations": [{"tag": "...", "comment": "...", "x": 0.5, "y": 0.3}, ...]}`;
  async function analyzeScreenWithVision(pngBase64, transcriptText, apiKey, stageName, frameName, customPrompt, signal, stageContext) {
    var _a, _b, _c;
    if (!pngBase64 || !apiKey) return [];
    const systemPrompt = customPrompt || DEFAULT_SCREEN_VISION_PROMPT;
    let contextBlock = `\u042D\u0442\u0430\u043F CJM: "${stageName}"`;
    if (frameName) contextBlock += `
\u042D\u043A\u0440\u0430\u043D: "${frameName}"`;
    if (stageContext) {
      contextBlock += "\n\n--- \u041A\u041E\u041D\u0422\u0415\u041A\u0421\u0422 \u042D\u0422\u0410\u041F\u0410 ---";
      if (stageContext.actions && stageContext.actions.length > 0)
        contextBlock += "\n\u0414\u0435\u0439\u0441\u0442\u0432\u0438\u044F: " + stageContext.actions.join("; ");
      if (stageContext.touchpoints && stageContext.touchpoints.length > 0)
        contextBlock += "\nTouchpoints: " + stageContext.touchpoints.join("; ");
      if (stageContext.thoughts && stageContext.thoughts.length > 0)
        contextBlock += "\n\u041C\u044B\u0441\u043B\u0438: " + stageContext.thoughts.join("; ");
      if (stageContext.experience && stageContext.experience.length > 0)
        contextBlock += "\n\u041E\u043F\u044B\u0442: " + stageContext.experience.join("; ");
      if (stageContext.emotions && stageContext.emotions.length > 0)
        contextBlock += "\n\u042D\u043C\u043E\u0446\u0438\u0438: " + stageContext.emotions.join("; ");
      if (stageContext.quotes && stageContext.quotes.length > 0)
        contextBlock += "\n\u0426\u0438\u0442\u0430\u0442\u044B: \xAB" + stageContext.quotes.join("\xBB; \xAB") + "\xBB";
      contextBlock += "\n--- \u041A\u041E\u041D\u0415\u0426 \u041A\u041E\u041D\u0422\u0415\u041A\u0421\u0422\u0410 ---";
    }
    contextBlock += `

\u0422\u0440\u0430\u043D\u0441\u043A\u0440\u0438\u043F\u0442 \u0438\u043D\u0442\u0435\u0440\u0432\u044C\u044E (\u0444\u0440\u0430\u0433\u043C\u0435\u043D\u0442):
${transcriptText.slice(0, 8e3)}`;
    const userMessage = {
      role: "user",
      content: [
        {
          type: "text",
          text: contextBlock
        },
        {
          type: "image_url",
          image_url: {
            url: `data:image/png;base64,${pngBase64}`,
            detail: "high"
          }
        }
      ]
    };
    const visionModels = ["gpt-4o", "gpt-4o-mini"];
    let lastError = "Vision API returned no valid response";
    try {
      for (const model of visionModels) {
        throwIfAborted(signal);
        const response = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`
          },
          body: JSON.stringify({
            model,
            response_format: { type: "json_object" },
            messages: [
              { role: "system", content: systemPrompt },
              userMessage
            ],
            temperature: 0.4,
            max_tokens: 1200
          })
        });
        if (!response.ok) {
          const errBody = await response.text();
          lastError = model + ": HTTP " + response.status + (errBody ? " " + errBody.slice(0, 200) : "");
          continue;
        }
        const data = await response.json();
        const content = (_c = (_b = (_a = data.choices) == null ? void 0 : _a[0]) == null ? void 0 : _b.message) == null ? void 0 : _c.content;
        if (!content) {
          lastError = model + ": empty response content";
          continue;
        }
        const parsed = tryParseJSON(content);
        if (!parsed || typeof parsed !== "object") {
          lastError = model + ": invalid JSON in response";
          continue;
        }
        const rawList = parsed.annotations;
        if (!Array.isArray(rawList)) {
          lastError = model + ": no 'annotations' array in response";
          continue;
        }
        return rawList.slice(0, 5).map((item) => {
          var _a2, _b2;
          const a = item;
          return {
            tag: String((_a2 = a.tag) != null ? _a2 : "").trim(),
            comment: String((_b2 = a.comment) != null ? _b2 : "").trim(),
            x: parseCoord01(a.x, 0.5),
            y: parseCoord01(a.y, 0.5)
          };
        }).filter((a) => a.tag && a.comment);
      }
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") throw err;
      if (err instanceof Error && err.message) {
        lastError = err.message;
      }
    }
    throw new Error("Vision annotation failed: " + lastError);
  }
  var DEFAULT_SCREEN_MATCHING_PROMPT = `\u0422\u0435\u0431\u0435 \u0434\u0430\u043D \u0441\u043F\u0438\u0441\u043E\u043A \u044D\u0442\u0430\u043F\u043E\u0432 CJM (Customer Journey Map) \u0438 \u0441\u043F\u0438\u0441\u043E\u043A \u0438\u043C\u0451\u043D \u0444\u0440\u0435\u0439\u043C\u043E\u0432 (\u044D\u043A\u0440\u0430\u043D\u043E\u0432 \u0438\u043D\u0442\u0435\u0440\u0444\u0435\u0439\u0441\u0430 \u0438\u0437 Figma).

\u0421\u043E\u043F\u043E\u0441\u0442\u0430\u0432\u044C \u043A\u0430\u0436\u0434\u044B\u0439 \u0444\u0440\u0435\u0439\u043C \u0441 \u043D\u0430\u0438\u0431\u043E\u043B\u0435\u0435 \u043F\u043E\u0434\u0445\u043E\u0434\u044F\u0449\u0438\u043C \u044D\u0442\u0430\u043F\u043E\u043C CJM \u043F\u043E \u0441\u043C\u044B\u0441\u043B\u0443 \u043D\u0430\u0437\u0432\u0430\u043D\u0438\u044F.
- \u041E\u0434\u0438\u043D \u044D\u0442\u0430\u043F \u043C\u043E\u0436\u0435\u0442 \u0438\u043C\u0435\u0442\u044C \u043D\u0435\u0441\u043A\u043E\u043B\u044C\u043A\u043E \u044D\u043A\u0440\u0430\u043D\u043E\u0432.
- \u0424\u0440\u0435\u0439\u043C \u043C\u043E\u0436\u0435\u0442 \u043D\u0435 \u043F\u043E\u0434\u0445\u043E\u0434\u0438\u0442\u044C \u043D\u0438 \u043A \u043E\u0434\u043D\u043E\u043C\u0443 \u044D\u0442\u0430\u043F\u0443 \u2014 \u043D\u0435 \u0432\u043A\u043B\u044E\u0447\u0430\u0439 \u0435\u0433\u043E.
- \u0423\u0447\u0438\u0442\u044B\u0432\u0430\u0439, \u0447\u0442\u043E \u043D\u0430\u0437\u0432\u0430\u043D\u0438\u044F \u0444\u0440\u0435\u0439\u043C\u043E\u0432 \u2014 \u044D\u0442\u043E \u043D\u0430\u0437\u0432\u0430\u043D\u0438\u044F \u044D\u043A\u0440\u0430\u043D\u043E\u0432 \u0438\u043D\u0442\u0435\u0440\u0444\u0435\u0439\u0441\u0430 (\u043D\u0430\u043F\u0440\u0438\u043C\u0435\u0440: "App Store", "\u041A\u0430\u0442\u0430\u043B\u043E\u0433", "\u041A\u043E\u0440\u0437\u0438\u043D\u0430", "\u041E\u043F\u043B\u0430\u0442\u0430", "\u0422\u0440\u0435\u043A\u0438\u043D\u0433 \u0437\u0430\u043A\u0430\u0437\u0430").
- \u0423\u0447\u0438\u0442\u044B\u0432\u0430\u0439, \u0447\u0442\u043E \u043D\u0430\u0437\u0432\u0430\u043D\u0438\u044F \u044D\u0442\u0430\u043F\u043E\u0432 CJM \u2014 \u044D\u0442\u043E \u0448\u0430\u0433\u0438 \u043F\u043E\u043B\u044C\u0437\u043E\u0432\u0430\u0442\u0435\u043B\u044C\u0441\u043A\u043E\u0433\u043E \u043F\u0443\u0442\u0438 (\u043D\u0430\u043F\u0440\u0438\u043C\u0435\u0440: "\u041F\u043B\u0430\u043D\u0438\u0440\u043E\u0432\u0430\u043D\u0438\u0435 \u0437\u0430\u043A\u0443\u043F\u043A\u0438", "\u0421\u0431\u043E\u0440 \u043A\u043E\u0440\u0437\u0438\u043D\u044B", "\u041E\u0444\u043E\u0440\u043C\u043B\u0435\u043D\u0438\u0435 \u0437\u0430\u043A\u0430\u0437\u0430").

\u0414\u043E\u043F\u043E\u043B\u043D\u0438\u0442\u0435\u043B\u044C\u043D\u043E, \u0434\u043B\u044F \u043A\u0430\u0436\u0434\u043E\u0433\u043E \u0441\u043E\u043F\u043E\u0441\u0442\u0430\u0432\u043B\u0435\u043D\u043D\u043E\u0433\u043E \u0444\u0440\u0435\u0439\u043C\u0430 \u043D\u0430\u043F\u0438\u0448\u0438 \u043A\u0440\u0430\u0442\u043A\u0443\u044E \u0430\u043D\u043D\u043E\u0442\u0430\u0446\u0438\u044E (1\u20132 \u043F\u0440\u0435\u0434\u043B\u043E\u0436\u0435\u043D\u0438\u044F): \u0447\u0442\u043E \u043F\u043E\u043B\u044C\u0437\u043E\u0432\u0430\u0442\u0435\u043B\u044C \u0432\u0438\u0434\u0438\u0442 \u0438\u043B\u0438 \u0434\u0435\u043B\u0430\u0435\u0442 \u043D\u0430 \u044D\u0442\u043E\u043C \u044D\u043A\u0440\u0430\u043D\u0435 \u0432 \u043A\u043E\u043D\u0442\u0435\u043A\u0441\u0442\u0435 \u0434\u0430\u043D\u043D\u043E\u0433\u043E \u044D\u0442\u0430\u043F\u0430 CJM.

\u0412\u0435\u0440\u043D\u0438 \u0441\u0442\u0440\u043E\u0433\u043E JSON:
{
  "mapping": {"\u041D\u0430\u0437\u0432\u0430\u043D\u0438\u0435 \u044D\u0442\u0430\u043F\u0430": ["\u0438\u043C\u044F \u0444\u0440\u0435\u0439\u043C\u0430 1", "\u0438\u043C\u044F \u0444\u0440\u0435\u0439\u043C\u0430 2"], ...},
  "screenAnnotations": {"\u0438\u043C\u044F \u0444\u0440\u0435\u0439\u043C\u0430 1": "\u041A\u0440\u0430\u0442\u043A\u043E\u0435 \u043E\u043F\u0438\u0441\u0430\u043D\u0438\u0435", "\u0438\u043C\u044F \u0444\u0440\u0435\u0439\u043C\u0430 2": "\u041A\u0440\u0430\u0442\u043A\u043E\u0435 \u043E\u043F\u0438\u0441\u0430\u043D\u0438\u0435", ...}
}
\u0418\u043C\u0435\u043D\u0430 \u044D\u0442\u0430\u043F\u043E\u0432 \u0438 \u0444\u0440\u0435\u0439\u043C\u043E\u0432 \u0434\u043E\u043B\u0436\u043D\u044B \u0431\u044B\u0442\u044C \u0442\u043E\u0447\u043D\u043E \u0442\u0430\u043A\u0438\u043C\u0438 \u0436\u0435, \u043A\u0430\u043A \u0432 \u043F\u0440\u0435\u0434\u043E\u0441\u0442\u0430\u0432\u043B\u0435\u043D\u043D\u044B\u0445 \u0441\u043F\u0438\u0441\u043A\u0430\u0445.`;
  var DEFAULT_AGGREGATE_PROMPT = `\u0422\u044B \u2014 UX-\u0438\u0441\u0441\u043B\u0435\u0434\u043E\u0432\u0430\u0442\u0435\u043B\u044C. \u0422\u0435\u0431\u0435 \u0434\u0430\u043D\u044B \u043D\u0435\u0441\u043A\u043E\u043B\u044C\u043A\u043E \u0442\u0440\u0430\u043D\u0441\u043A\u0440\u0438\u043F\u0442\u043E\u0432 \u043F\u043E\u043B\u044C\u0437\u043E\u0432\u0430\u0442\u0435\u043B\u044C\u0441\u043A\u0438\u0445 \u0438\u043D\u0442\u0435\u0440\u0432\u044C\u044E (\u0440\u0430\u0437\u0434\u0435\u043B\u0451\u043D\u043D\u044B\u0445 \u043C\u0435\u0442\u043A\u0430\u043C\u0438 --- \u0418\u041D\u0422\u0415\u0420\u0412\u042C\u042E N ---).

\u0422\u0432\u043E\u044F \u0437\u0430\u0434\u0430\u0447\u0430: \u0430\u0433\u0440\u0435\u0433\u0438\u0440\u043E\u0432\u0430\u0442\u044C \u0438\u043D\u0441\u0430\u0439\u0442\u044B \u0438\u0437 \u0432\u0441\u0435\u0445 \u0438\u043D\u0442\u0435\u0440\u0432\u044C\u044E \u0438 \u043F\u043E\u0441\u0442\u0440\u043E\u0438\u0442\u044C \u041E\u0414\u041D\u0423 \u043E\u0431\u043E\u0431\u0449\u0451\u043D\u043D\u0443\u044E Customer Journey Map, \u043A\u043E\u0442\u043E\u0440\u0430\u044F \u043E\u0442\u0440\u0430\u0436\u0430\u0435\u0442 \u0442\u0438\u043F\u0438\u0447\u043D\u044B\u0439 \u043F\u0443\u0442\u044C \u043F\u043E\u043B\u044C\u0437\u043E\u0432\u0430\u0442\u0435\u043B\u044F \u043D\u0430 \u043E\u0441\u043D\u043E\u0432\u0435 \u0434\u0430\u043D\u043D\u044B\u0445 \u0438\u0437 \u0432\u0441\u0435\u0445 \u0438\u043D\u0442\u0435\u0440\u0432\u044C\u044E.

\u041F\u0440\u0430\u0432\u0438\u043B\u0430 \u0430\u0433\u0440\u0435\u0433\u0430\u0446\u0438\u0438:
- \u041E\u0431\u044A\u0435\u0434\u0438\u043D\u044F\u0439 \u0441\u0445\u043E\u0436\u0438\u0435 \u044D\u0442\u0430\u043F\u044B \u0438\u0437 \u0440\u0430\u0437\u043D\u044B\u0445 \u0438\u043D\u0442\u0435\u0440\u0432\u044C\u044E \u0432 \u043E\u0434\u0438\u043D \u044D\u0442\u0430\u043F
- \u041E\u0431\u044A\u0435\u0434\u0438\u043D\u044F\u0439 \u043F\u043E\u0445\u043E\u0436\u0438\u0435 \u0434\u0435\u0439\u0441\u0442\u0432\u0438\u044F, touchpoints, \u044D\u043C\u043E\u0446\u0438\u0438
- \u0415\u0441\u043B\u0438 \u0440\u0435\u0441\u043F\u043E\u043D\u0434\u0435\u043D\u0442\u044B \u043F\u043E-\u0440\u0430\u0437\u043D\u043E\u043C\u0443 \u043E\u043F\u0438\u0441\u044B\u0432\u0430\u044E\u0442 \u044D\u0442\u0430\u043F \u2014 \u0444\u043E\u0440\u043C\u0443\u043B\u0438\u0440\u0443\u0439 \u043E\u0431\u043E\u0431\u0449\u0451\u043D\u043D\u043E
- \u0414\u043B\u044F actions, thoughts, emotions \u2014 \u0441\u043E\u0431\u0438\u0440\u0430\u0439 \u0442\u0438\u043F\u0438\u0447\u043D\u044B\u0435 \u0444\u043E\u0440\u043C\u0443\u043B\u0438\u0440\u043E\u0432\u043A\u0438 \u0438\u0437 \u0432\u0441\u0435\u0445 \u0438\u043D\u0442\u0435\u0440\u0432\u044C\u044E
- \u041C\u0438\u043D\u0438\u043C\u0443\u043C 3 \u044D\u0442\u0430\u043F\u0430, \u043C\u0430\u043A\u0441\u0438\u043C\u0443\u043C 10
- \u0418\u0437\u0432\u043B\u0435\u043A\u0430\u0439 1\u20132 \u0445\u0430\u0440\u0430\u043A\u0442\u0435\u0440\u043D\u044B\u0435 \u0446\u0438\u0442\u0430\u0442\u044B \u043D\u0430 \u044D\u0442\u0430\u043F (\u043F\u043E\u043B\u0435 quotes)
- \u042F\u0437\u044B\u043A = \u044F\u0437\u044B\u043A \u0442\u0440\u0430\u043D\u0441\u043A\u0440\u0438\u043F\u0442\u043E\u0432
- \u0424\u043E\u0440\u043C\u0430\u0442 \u043E\u0442\u0432\u0435\u0442\u0430 \u2014 \u0441\u0442\u0440\u043E\u0433\u043E JSON: {"jobStories":[...],"stages":[...]}

\u0424\u043E\u0440\u043C\u0430\u0442 \u044D\u0442\u0430\u043F\u0430: {"name":"...","actions":["..."],"touchpoints":["..."],"experience":["..."],"thoughts":["..."],"emotions":["..."],"quotes":["..."],"illustrations":[],"metrics":["..."],"hypotheses":["..."]}`;
  var DEFAULT_JOBSTORY_PROMPT = `\u0422\u044B \u2014 \u044D\u043A\u0441\u043F\u0435\u0440\u0442 \u043F\u043E Jobs-to-be-Done (JTBD). \u0418\u0437 \u0442\u0440\u0430\u043D\u0441\u043A\u0440\u0438\u043F\u0442\u0430 \u043F\u043E\u043B\u044C\u0437\u043E\u0432\u0430\u0442\u0435\u043B\u044C\u0441\u043A\u043E\u0433\u043E \u0438\u043D\u0442\u0435\u0440\u0432\u044C\u044E \u0438\u0437\u0432\u043B\u0435\u043A\u0430\u0435\u0448\u044C Job Story.

Job Story \u043E\u043F\u0438\u0441\u044B\u0432\u0430\u0435\u0442 \u0446\u0435\u043B\u044C \u043F\u043E\u043B\u044C\u0437\u043E\u0432\u0430\u0442\u0435\u043B\u044F \u0432 \u0444\u043E\u0440\u043C\u0430\u0442\u0435: When [situation] I want to [motivation] so I can [outcome].
- situation: \u043A\u043E\u043D\u0442\u0435\u043A\u0441\u0442, \u0432 \u043A\u043E\u0442\u043E\u0440\u043E\u043C \u043D\u0430\u0445\u043E\u0434\u0438\u0442\u0441\u044F \u043F\u043E\u043B\u044C\u0437\u043E\u0432\u0430\u0442\u0435\u043B\u044C (\u0433\u0434\u0435, \u043A\u043E\u0433\u0434\u0430, \u043A\u0430\u043A\u0430\u044F \u0437\u0430\u0434\u0430\u0447\u0430/\u043F\u0440\u043E\u0431\u043B\u0435\u043C\u0430)
- motivation: \u0447\u0442\u043E \u043F\u043E\u043B\u044C\u0437\u043E\u0432\u0430\u0442\u0435\u043B\u044C \u0445\u043E\u0447\u0435\u0442 \u0441\u0434\u0435\u043B\u0430\u0442\u044C (\u0434\u0435\u0439\u0441\u0442\u0432\u0438\u0435, \u043F\u043E\u0442\u0440\u0435\u0431\u043D\u043E\u0441\u0442\u044C)
- outcome: \u0437\u0430\u0447\u0435\u043C, \u043A\u0430\u043A\u043E\u0439 \u0440\u0435\u0437\u0443\u043B\u044C\u0442\u0430\u0442 \u0438\u043B\u0438 \u0432\u044B\u0433\u043E\u0434\u0430

\u0410\u043D\u0430\u043B\u0438\u0437\u0438\u0440\u0443\u0439 \u0441\u043B\u043E\u0432\u0430 \u0440\u0435\u0441\u043F\u043E\u043D\u0434\u0435\u043D\u0442\u0430. \u041D\u0435 \u043F\u0440\u0438\u0434\u0443\u043C\u044B\u0432\u0430\u0439 \u2014 \u0438\u0437\u0432\u043B\u0435\u043A\u0430\u0439 \u0438\u0437 \u0440\u0430\u0437\u0433\u043E\u0432\u043E\u0440\u0430. \u042F\u0437\u044B\u043A = \u044F\u0437\u044B\u043A \u0442\u0440\u0430\u043D\u0441\u043A\u0440\u0438\u043F\u0442\u0430.`;
  var DEFAULT_TRANSCRIPT_PROMPT = `\u0422\u044B \u2014 UX-\u0438\u0441\u0441\u043B\u0435\u0434\u043E\u0432\u0430\u0442\u0435\u043B\u044C \u0438 \u044D\u043A\u0441\u043F\u0435\u0440\u0442 \u043F\u043E Customer Journey Map.

\u0422\u0435\u0431\u0435 \u0434\u0430\u043D \u0442\u0440\u0430\u043D\u0441\u043A\u0440\u0438\u043F\u0442 \u043F\u043E\u043B\u044C\u0437\u043E\u0432\u0430\u0442\u0435\u043B\u044C\u0441\u043A\u043E\u0433\u043E \u0438\u043D\u0442\u0435\u0440\u0432\u044C\u044E. \u0422\u0432\u043E\u044F \u0437\u0430\u0434\u0430\u0447\u0430 \u2014 \u043F\u0440\u043E\u0430\u043D\u0430\u043B\u0438\u0437\u0438\u0440\u043E\u0432\u0430\u0442\u044C \u0440\u0430\u0437\u0433\u043E\u0432\u043E\u0440 \u0438 \u0421\u0410\u041C\u041E\u0421\u0422\u041E\u042F\u0422\u0415\u041B\u042C\u041D\u041E \u043F\u043E\u0441\u0442\u0440\u043E\u0438\u0442\u044C CJM \u043D\u0430 \u043E\u0441\u043D\u043E\u0432\u0435 \u0442\u043E\u0433\u043E, \u0447\u0442\u043E \u043E\u0431\u0441\u0443\u0436\u0434\u0430\u043B\u043E\u0441\u044C.

\u041A\u0430\u043A \u0430\u043D\u0430\u043B\u0438\u0437\u0438\u0440\u043E\u0432\u0430\u0442\u044C:
1. \u041F\u0440\u043E\u0447\u0438\u0442\u0430\u0439 \u0432\u0435\u0441\u044C \u0440\u0430\u0437\u0433\u043E\u0432\u043E\u0440 \u043C\u0435\u0436\u0434\u0443 \u0438\u043D\u0442\u0435\u0440\u0432\u044C\u044E\u0435\u0440\u043E\u043C \u0438 \u0440\u0435\u0441\u043F\u043E\u043D\u0434\u0435\u043D\u0442\u043E\u043C.
2. \u041E\u043F\u0440\u0435\u0434\u0435\u043B\u0438, \u0447\u0435\u0440\u0435\u0437 \u043A\u0430\u043A\u0438\u0435 \u044D\u0442\u0430\u043F\u044B \u0432\u0437\u0430\u0438\u043C\u043E\u0434\u0435\u0439\u0441\u0442\u0432\u0438\u044F \u0441 \u043F\u0440\u043E\u0434\u0443\u043A\u0442\u043E\u043C/\u0441\u0435\u0440\u0432\u0438\u0441\u043E\u043C \u043F\u0440\u043E\u0448\u0451\u043B \u0440\u0435\u0441\u043F\u043E\u043D\u0434\u0435\u043D\u0442 (\u043D\u0430\u043F\u0440\u0438\u043C\u0435\u0440: \u0443\u0437\u043D\u0430\u043B \u043E \u043F\u0440\u043E\u0434\u0443\u043A\u0442\u0435 \u2192 \u043F\u043E\u043F\u0440\u043E\u0431\u043E\u0432\u0430\u043B \u2192 \u0441\u0442\u043E\u043B\u043A\u043D\u0443\u043B\u0441\u044F \u0441 \u043F\u0440\u043E\u0431\u043B\u0435\u043C\u043E\u0439 \u2192 \u043D\u0430\u0448\u0451\u043B \u0440\u0435\u0448\u0435\u043D\u0438\u0435 \u2192 \u0441\u0442\u0430\u043B \u043F\u043E\u0441\u0442\u043E\u044F\u043D\u043D\u044B\u043C \u043F\u043E\u043B\u044C\u0437\u043E\u0432\u0430\u0442\u0435\u043B\u0435\u043C).
3. \u0414\u043B\u044F \u043A\u0430\u0436\u0434\u043E\u0433\u043E \u044D\u0442\u0430\u043F\u0430 \u0438\u0437\u0432\u043B\u0435\u043A\u0438 \u0438\u0437 \u0441\u043B\u043E\u0432 \u0440\u0435\u0441\u043F\u043E\u043D\u0434\u0435\u043D\u0442\u0430:
   - actions: \u0447\u0442\u043E \u043A\u043E\u043D\u043A\u0440\u0435\u0442\u043D\u043E \u0434\u0435\u043B\u0430\u043B \u043F\u043E\u043B\u044C\u0437\u043E\u0432\u0430\u0442\u0435\u043B\u044C (\u0435\u0433\u043E \u0434\u0435\u0439\u0441\u0442\u0432\u0438\u044F, \u0448\u0430\u0433\u0438)
   - touchpoints: \u0447\u0435\u0440\u0435\u0437 \u043A\u0430\u043A\u0438\u0435 \u043A\u0430\u043D\u0430\u043B\u044B/\u0438\u043D\u0442\u0435\u0440\u0444\u0435\u0439\u0441\u044B \u043E\u043D \u0432\u0437\u0430\u0438\u043C\u043E\u0434\u0435\u0439\u0441\u0442\u0432\u043E\u0432\u0430\u043B (\u043F\u0440\u0438\u043B\u043E\u0436\u0435\u043D\u0438\u0435, \u0441\u0430\u0439\u0442, \u043F\u043E\u0434\u0434\u0435\u0440\u0436\u043A\u0430, \u0441\u043E\u0446\u0441\u0435\u0442\u0438 \u0438 \u0442.\u0434.)
   - experience: \u043A\u0430\u043A \u043E\u043D \u0432\u043E\u0441\u043F\u0440\u0438\u043D\u0438\u043C\u0430\u043B \u043F\u0440\u043E\u0438\u0441\u0445\u043E\u0434\u044F\u0449\u0435\u0435, \u0447\u0442\u043E \u0435\u043C\u0443 \u043D\u0440\u0430\u0432\u0438\u043B\u043E\u0441\u044C/\u043D\u0435 \u043D\u0440\u0430\u0432\u0438\u043B\u043E\u0441\u044C
   - thoughts: \u043E \u0447\u0451\u043C \u0434\u0443\u043C\u0430\u043B, \u0447\u0442\u043E \u0435\u0433\u043E \u0431\u0435\u0441\u043F\u043E\u043A\u043E\u0438\u043B\u043E, \u043A\u0430\u043A\u0438\u0435 \u0431\u044B\u043B\u0438 \u0441\u043E\u043C\u043D\u0435\u043D\u0438\u044F \u0438\u043B\u0438 \u043E\u0436\u0438\u0434\u0430\u043D\u0438\u044F
   - emotions: \u043A\u0430\u043A\u0438\u0435 \u044D\u043C\u043E\u0446\u0438\u0438 \u0438\u0441\u043F\u044B\u0442\u044B\u0432\u0430\u043B (\u0440\u0430\u0434\u043E\u0441\u0442\u044C, \u0440\u0430\u0437\u0434\u0440\u0430\u0436\u0435\u043D\u0438\u0435, \u0440\u0430\u0437\u043E\u0447\u0430\u0440\u043E\u0432\u0430\u043D\u0438\u0435, \u0443\u0434\u0438\u0432\u043B\u0435\u043D\u0438\u0435 \u0438 \u0442.\u0434.)
   - quotes: 1\u20132 \u0434\u043E\u0441\u043B\u043E\u0432\u043D\u044B\u0435 \u0446\u0438\u0442\u0430\u0442\u044B \u0440\u0435\u0441\u043F\u043E\u043D\u0434\u0435\u043D\u0442\u0430, \u0438\u043B\u043B\u044E\u0441\u0442\u0440\u0438\u0440\u0443\u044E\u0449\u0438\u0435 \u043E\u043F\u044B\u0442 \u043D\u0430 \u044D\u0442\u043E\u043C \u044D\u0442\u0430\u043F\u0435
   - metrics: \u043A\u0430\u043A\u0438\u0435 \u043C\u0435\u0442\u0440\u0438\u043A\u0438/KPI \u043C\u043E\u0433\u043B\u0438 \u0431\u044B \u044D\u0442\u043E \u0438\u0437\u043C\u0435\u0440\u0438\u0442\u044C (\u043F\u0440\u0435\u0434\u043F\u043E\u043B\u043E\u0436\u0438 \u043D\u0430 \u043E\u0441\u043D\u043E\u0432\u0435 \u043A\u043E\u043D\u0442\u0435\u043A\u0441\u0442\u0430)
   - hypotheses: \u0438\u0434\u0435\u0438 \u0434\u043B\u044F \u0443\u043B\u0443\u0447\u0448\u0435\u043D\u0438\u044F \u043F\u0440\u043E\u0434\u0443\u043A\u0442\u0430 \u043D\u0430 \u044D\u0442\u043E\u043C \u044D\u0442\u0430\u043F\u0435 (\u043F\u0440\u0435\u0434\u043B\u043E\u0436\u0438 \u043D\u0430 \u043E\u0441\u043D\u043E\u0432\u0435 \u043F\u0440\u043E\u0431\u043B\u0435\u043C \u0440\u0435\u0441\u043F\u043E\u043D\u0434\u0435\u043D\u0442\u0430)

\u042D\u0442\u0430\u043F\u043E\u0432 \u0432 \u0442\u0440\u0430\u043D\u0441\u043A\u0440\u0438\u043F\u0442\u0435 \u044F\u0432\u043D\u043E \u041D\u0415\u0422 \u2014 \u0442\u044B \u043E\u043F\u0440\u0435\u0434\u0435\u043B\u044F\u0435\u0448\u044C \u0438\u0445 \u0441\u0430\u043C, \u0438\u043D\u0442\u0435\u0440\u043F\u0440\u0435\u0442\u0438\u0440\u0443\u044F \u0440\u0430\u0437\u0433\u043E\u0432\u043E\u0440.

\u0414\u043E\u043F\u043E\u043B\u043D\u0438\u0442\u0435\u043B\u044C\u043D\u043E: \u043E\u043F\u0440\u0435\u0434\u0435\u043B\u0438 Job Story \u043F\u043E\u043B\u044C\u0437\u043E\u0432\u0430\u0442\u0435\u043B\u044F (\u0446\u0435\u043B\u044C, \u0441 \u043A\u043E\u0442\u043E\u0440\u043E\u0439 \u043E\u043D \u043F\u0440\u0438\u0448\u0451\u043B \u0432 \u043F\u0440\u043E\u0434\u0443\u043A\u0442) \u0432 \u0444\u043E\u0440\u043C\u0430\u0442\u0435 JTBD: When [situation] I want to [motivation] so I can [outcome]. \u0414\u043E\u0431\u0430\u0432\u044C \u0432 \u043E\u0442\u0432\u0435\u0442 \u043F\u043E\u043B\u0435 jobStories \u2014 \u043C\u0430\u0441\u0441\u0438\u0432 \u0441 \u043E\u0434\u043D\u0438\u043C \u043E\u0431\u044A\u0435\u043A\u0442\u043E\u043C {situation, motivation, outcome}.

\u0424\u043E\u0440\u043C\u0430\u0442 \u043E\u0442\u0432\u0435\u0442\u0430 \u2014 \u0441\u0442\u0440\u043E\u0433\u043E JSON:
{"jobStories":[{"situation":"...","motivation":"...","outcome":"..."}],"stages":[{"name":"\u041D\u0430\u0437\u0432\u0430\u043D\u0438\u0435 \u044D\u0442\u0430\u043F\u0430","actions":["..."],"touchpoints":["..."],"experience":["..."],"thoughts":["..."],"emotions":["..."],"quotes":["..."],"illustrations":[],"metrics":["..."],"hypotheses":["..."]}]}

\u041F\u0440\u0430\u0432\u0438\u043B\u0430:
- \u041C\u0438\u043D\u0438\u043C\u0443\u043C 3 \u044D\u0442\u0430\u043F\u0430, \u043C\u0430\u043A\u0441\u0438\u043C\u0443\u043C 10.
- \u041C\u0430\u0441\u0441\u0438\u0432\u044B \u043C\u043E\u0433\u0443\u0442 \u0431\u044B\u0442\u044C \u043F\u0443\u0441\u0442\u044B\u043C\u0438 [] \u0435\u0441\u043B\u0438 \u0438\u0437 \u0440\u0430\u0437\u0433\u043E\u0432\u043E\u0440\u0430 \u043D\u0435\u043B\u044C\u0437\u044F \u0438\u0437\u0432\u043B\u0435\u0447\u044C \u0438\u043D\u0444\u043E\u0440\u043C\u0430\u0446\u0438\u044E \u0434\u043B\u044F \u044D\u0442\u043E\u0433\u043E \u043F\u043E\u043B\u044F.
- \u042F\u0437\u044B\u043A = \u044F\u0437\u044B\u043A \u0442\u0440\u0430\u043D\u0441\u043A\u0440\u0438\u043F\u0442\u0430.
- \u0422\u043E\u043B\u044C\u043A\u043E JSON, \u043D\u0438\u043A\u0430\u043A\u043E\u0433\u043E \u0434\u043E\u043F\u043E\u043B\u043D\u0438\u0442\u0435\u043B\u044C\u043D\u043E\u0433\u043E \u0442\u0435\u043A\u0441\u0442\u0430.`;
  var DEFAULT_TABLE_PROMPT = `\u0422\u044B \u2014 \u044D\u043A\u0441\u043F\u0435\u0440\u0442 \u043F\u043E CJM. \u0418\u0437 \u0442\u0430\u0431\u043B\u0438\u0446\u044B \u0441\u0442\u0440\u0443\u043A\u0442\u0443\u0440\u0438\u0440\u0443\u0435\u0448\u044C Customer Journey Map.

\u0412\u0430\u0436\u043D\u043E: \u0442\u044B \u041D\u0415 \u0434\u043E\u0434\u0443\u043C\u044B\u0432\u0430\u0435\u0448\u044C \u0434\u0430\u043D\u043D\u044B\u0435. \u0422\u044B \u0440\u0430\u0431\u043E\u0442\u0430\u0435\u0448\u044C \u0422\u041E\u041B\u042C\u041A\u041E \u0441 \u0442\u0435\u043C, \u0447\u0442\u043E \u0435\u0441\u0442\u044C \u0432 \u0442\u0430\u0431\u043B\u0438\u0446\u0435.

\u041A\u0430\u043A \u0440\u0430\u0431\u043E\u0442\u0430\u0442\u044C:
1. \u041E\u043F\u0440\u0435\u0434\u0435\u043B\u0438 \u0441\u0442\u0440\u0443\u043A\u0442\u0443\u0440\u0443 \u0442\u0430\u0431\u043B\u0438\u0446\u044B: \u0447\u0442\u043E \u044F\u0432\u043B\u044F\u0435\u0442\u0441\u044F \u044D\u0442\u0430\u043F\u0430\u043C\u0438 (\u0441\u0442\u0440\u043E\u043A\u0438 \u0438\u043B\u0438 \u043A\u043E\u043B\u043E\u043D\u043A\u0438), \u0430 \u0447\u0442\u043E \u0430\u0442\u0440\u0438\u0431\u0443\u0442\u0430\u043C\u0438 (\u0434\u0435\u0439\u0441\u0442\u0432\u0438\u044F, \u0442\u043E\u0447\u043A\u0438 \u043A\u043E\u043D\u0442\u0430\u043A\u0442\u0430, \u044D\u043C\u043E\u0446\u0438\u0438 \u0438 \u0442.\u0434.).
2. \u041C\u0430\u043F\u043F\u0438\u043D\u0433 \u043A\u043E\u043B\u043E\u043D\u043E\u043A \u043F\u043E \u0441\u043C\u044B\u0441\u043B\u0443: "\u0414\u0435\u0439\u0441\u0442\u0432\u0438\u044F" \u2192 actions, "\u0422\u043E\u0447\u043A\u0438 \u043A\u043E\u043D\u0442\u0430\u043A\u0442\u0430" \u2192 touchpoints, "\u042D\u043C\u043E\u0446\u0438\u0438" \u2192 emotions, "\u0411\u043E\u043B\u0435\u0432\u044B\u0435 \u0442\u043E\u0447\u043A\u0438" \u2192 experience, "\u0412\u043E\u0437\u043C\u043E\u0436\u043D\u043E\u0441\u0442\u0438" \u2192 hypotheses, "\u041C\u0435\u0442\u0440\u0438\u043A\u0438" \u2192 metrics \u0438 \u0442.\u0434.
3. \u0415\u0441\u043B\u0438 \u043A\u043E\u043B\u043E\u043D\u043A\u0430 \u043D\u0435 \u043C\u0430\u043F\u043F\u0438\u0442\u0441\u044F \u043D\u0438 \u043D\u0430 \u043E\u0434\u043D\u043E \u0441\u0442\u0430\u043D\u0434\u0430\u0440\u0442\u043D\u043E\u0435 \u043F\u043E\u043B\u0435 CJM \u2014 \u043F\u0440\u043E\u043F\u0443\u0441\u0442\u0438 \u0435\u0451.
4. \u0415\u0441\u043B\u0438 \u0432 \u044F\u0447\u0435\u0439\u043A\u0435 \u043D\u0435\u0441\u043A\u043E\u043B\u044C\u043A\u043E \u043F\u0443\u043D\u043A\u0442\u043E\u0432 \u0447\u0435\u0440\u0435\u0437 ";" \u0438\u043B\u0438 \u043F\u0435\u0440\u0435\u043D\u043E\u0441 \u0441\u0442\u0440\u043E\u043A\u0438 \u2014 \u0440\u0430\u0437\u0431\u0435\u0439 \u043D\u0430 \u043C\u0430\u0441\u0441\u0438\u0432.

\u0415\u0441\u043B\u0438 \u0432 \u0442\u0430\u0431\u043B\u0438\u0446\u0435 \u043D\u0435\u0442 \u043D\u0438 \u043E\u0434\u043D\u043E\u0433\u043E \u044D\u0442\u0430\u043F\u0430 \u0438 \u043D\u0438 \u043E\u0434\u043D\u043E\u0433\u043E \u0434\u0435\u0439\u0441\u0442\u0432\u0438\u044F/\u043E\u043F\u0438\u0441\u0430\u043D\u0438\u044F \u2014 \u0432\u0435\u0440\u043D\u0438:
{"error":"\u0422\u0430\u0431\u043B\u0438\u0446\u0430 \u043D\u0435 \u0441\u043E\u0434\u0435\u0440\u0436\u0438\u0442 \u0434\u0430\u043D\u043D\u044B\u0445 \u0434\u043B\u044F \u043F\u043E\u0441\u0442\u0440\u043E\u0435\u043D\u0438\u044F CJM"}

\u0424\u043E\u0440\u043C\u0430\u0442 \u043E\u0442\u0432\u0435\u0442\u0430 \u2014 \u0441\u0442\u0440\u043E\u0433\u043E JSON:
{"stages":[{"name":"...","actions":["..."],"touchpoints":["..."],"experience":["..."],"thoughts":["..."],"emotions":["..."],"illustrations":[],"metrics":["..."],"hypotheses":["..."]}]}

\u041F\u0440\u0430\u0432\u0438\u043B\u0430:
- \u0411\u0435\u0440\u0438 \u0442\u043E\u043B\u044C\u043A\u043E \u0442\u043E, \u0447\u0442\u043E \u0435\u0441\u0442\u044C \u0432 \u0442\u0430\u0431\u043B\u0438\u0446\u0435. \u041F\u0443\u0441\u0442\u044B\u0435 \u043F\u043E\u043B\u044F = \u043F\u0443\u0441\u0442\u044B\u0435 \u043C\u0430\u0441\u0441\u0438\u0432\u044B [].
- \u041D\u0415 \u043F\u0440\u0438\u0434\u0443\u043C\u044B\u0432\u0430\u0439 \u044D\u0442\u0430\u043F\u044B, \u0434\u0435\u0439\u0441\u0442\u0432\u0438\u044F, \u044D\u043C\u043E\u0446\u0438\u0438 \u2014 \u0442\u043E\u043B\u044C\u043A\u043E \u0440\u0435\u0430\u043B\u044C\u043D\u044B\u0435 \u0434\u0430\u043D\u043D\u044B\u0435 \u0438\u0437 \u0442\u0430\u0431\u043B\u0438\u0446\u044B.
- \u042F\u0437\u044B\u043A = \u044F\u0437\u044B\u043A \u0434\u0430\u043D\u043D\u044B\u0445 \u0442\u0430\u0431\u043B\u0438\u0446\u044B.
- \u0422\u043E\u043B\u044C\u043A\u043E JSON.`;
  function stripMarkdownFences(text) {
    let s = text.trim();
    s = s.replace(/^```(?:json|JSON)?\s*\n?/m, "");
    s = s.replace(/\n?\s*```\s*$/m, "");
    return s.trim();
  }
  function tryParseJSON(text) {
    const cleaned = stripMarkdownFences(text);
    try {
      return JSON.parse(cleaned);
    } catch (e) {
    }
    const objStart = cleaned.indexOf("{");
    const objEnd = cleaned.lastIndexOf("}") + 1;
    if (objStart !== -1 && objEnd > objStart) {
      try {
        return JSON.parse(cleaned.slice(objStart, objEnd));
      } catch (e) {
      }
    }
    const arrStart = cleaned.indexOf("[");
    const arrEnd = cleaned.lastIndexOf("]") + 1;
    if (arrStart !== -1 && arrEnd > arrStart) {
      try {
        return JSON.parse(cleaned.slice(arrStart, arrEnd));
      } catch (e) {
      }
    }
    return null;
  }
  function looksLikeStage(obj) {
    if (typeof obj !== "object" || obj === null) return false;
    const r = obj;
    const hasName = !!(r.name || r.stage || r.\u044D\u0442\u0430\u043F || r.\u043D\u0430\u0437\u0432\u0430\u043D\u0438\u0435 || r.Name || r.Stage || r.title);
    const hasArrayField = Object.values(r).some((v) => Array.isArray(v));
    return hasName || hasArrayField;
  }
  function findStagesArray(obj, depth = 0) {
    if (depth > 5) return null;
    if (Array.isArray(obj)) {
      if (obj.length > 0 && looksLikeStage(obj[0])) {
        return obj;
      }
      return null;
    }
    if (typeof obj === "object" && obj !== null) {
      const record = obj;
      for (const key of ["stages", "Stages", "\u044D\u0442\u0430\u043F\u044B", "\u042D\u0442\u0430\u043F\u044B", "data", "cjm", "CJM", "journey", "steps", "customerJourney", "customer_journey"]) {
        const val = record[key];
        if (Array.isArray(val) && val.length > 0 && looksLikeStage(val[0])) {
          return val;
        }
      }
      for (const key of Object.keys(record)) {
        const val = record[key];
        if (Array.isArray(val) && val.length > 0 && looksLikeStage(val[0])) {
          return val;
        }
      }
      for (const key of Object.keys(record)) {
        const val = record[key];
        if (typeof val === "object" && val !== null && !Array.isArray(val)) {
          const found = findStagesArray(val, depth + 1);
          if (found) return found;
        }
      }
    }
    return null;
  }
  function normalizeStageFromAny(s) {
    const getString = (keys) => {
      for (const k of keys) {
        if (typeof s[k] === "string" && s[k]) return s[k];
      }
      return "";
    };
    const getArray = (keys) => {
      for (const k of keys) {
        if (Array.isArray(s[k])) return s[k].map((v) => String(v != null ? v : "")).filter(Boolean);
      }
      return [];
    };
    const duration = getString(["duration", "Duration", "\u0434\u043B\u0438\u0442\u0435\u043B\u044C\u043D\u043E\u0441\u0442\u044C", "\u0432\u0440\u0435\u043C\u044F", "time"]);
    const channel = getString(["channel", "Channel", "\u043A\u0430\u043D\u0430\u043B", "channel", "channelType"]);
    return {
      name: getString(["name", "stage", "\u044D\u0442\u0430\u043F", "\u043D\u0430\u0437\u0432\u0430\u043D\u0438\u0435", "Name", "Stage", "title", "\u042D\u0442\u0430\u043F", "\u041D\u0430\u0437\u0432\u0430\u043D\u0438\u0435"]) || "\u042D\u0442\u0430\u043F",
      actions: getArray(["actions", "Actions", "\u0434\u0435\u0439\u0441\u0442\u0432\u0438\u044F", "\u0414\u0435\u0439\u0441\u0442\u0432\u0438\u044F", "steps", "\u0448\u0430\u0433\u0438", "\u0434\u0435\u0439\u0441\u0442\u0432\u0438\u044F_\u043F\u043E\u043B\u044C\u0437\u043E\u0432\u0430\u0442\u0435\u043B\u044F"]),
      touchpoints: getArray(["touchpoints", "Touchpoints", "\u0442\u043E\u0447\u043A\u0438_\u043A\u043E\u043D\u0442\u0430\u043A\u0442\u0430", "\u0422\u043E\u0447\u043A\u0438 \u043A\u043E\u043D\u0442\u0430\u043A\u0442\u0430", "touchpoint", "\u043A\u0430\u043D\u0430\u043B\u044B", "channels"]),
      experience: getArray(["experience", "Experience", "\u043E\u043F\u044B\u0442", "\u041E\u043F\u044B\u0442", "\u0431\u043E\u043B\u0435\u0432\u044B\u0435_\u0442\u043E\u0447\u043A\u0438", "pain_points", "painPoints", "\u0431\u043E\u043B\u0438"]),
      thoughts: getArray(["thoughts", "Thoughts", "\u043C\u044B\u0441\u043B\u0438", "\u041C\u044B\u0441\u043B\u0438", "thinking", "\u0441\u043E\u043C\u043D\u0435\u043D\u0438\u044F", "\u043E\u0436\u0438\u0434\u0430\u043D\u0438\u044F"]),
      emotions: getArray(["emotions", "Emotions", "\u044D\u043C\u043E\u0446\u0438\u0438", "\u042D\u043C\u043E\u0446\u0438\u0438", "emotion", "feelings", "\u0447\u0443\u0432\u0441\u0442\u0432\u0430"]),
      quotes: getArray(["quotes", "Quotes", "\u0446\u0438\u0442\u0430\u0442\u044B", "\u0426\u0438\u0442\u0430\u0442\u044B", "quotes_from_user"]),
      illustrations: getArray(["illustrations", "Illustrations", "\u0438\u043B\u043B\u044E\u0441\u0442\u0440\u0430\u0446\u0438\u0438", "images", "screenshots"]),
      metrics: getArray(["metrics", "Metrics", "\u043C\u0435\u0442\u0440\u0438\u043A\u0438", "\u041C\u0435\u0442\u0440\u0438\u043A\u0438", "kpi", "KPI", "ux_\u043C\u0435\u0442\u0440\u0438\u043A\u0438", "UX-\u043C\u0435\u0442\u0440\u0438\u043A\u0438"]),
      hypotheses: getArray(["hypotheses", "Hypotheses", "\u0433\u0438\u043F\u043E\u0442\u0435\u0437\u044B", "\u0413\u0438\u043F\u043E\u0442\u0435\u0437\u044B", "ideas", "\u0438\u0434\u0435\u0438", "\u0432\u043E\u0437\u043C\u043E\u0436\u043D\u043E\u0441\u0442\u0438", "improvements", "\u0443\u043B\u0443\u0447\u0448\u0435\u043D\u0438\u044F", "\u0412\u043E\u0437\u043C\u043E\u0436\u043D\u043E\u0441\u0442\u0438 \u0434\u043B\u044F \u0443\u043B\u0443\u0447\u0448\u0435\u043D\u0438\u044F"]),
      duration: duration || void 0,
      channel: channel || void 0
    };
  }
  function extractFramework(obj) {
    var _a;
    if (typeof obj === "object" && obj !== null) {
      const val = (_a = obj.stageFramework) != null ? _a : obj.framework;
      if (val === "base" || val === "aarrr" || val === "aida") return val;
    }
    return void 0;
  }
  function extractJobStories(obj) {
    var _a;
    if (typeof obj !== "object" || obj === null) return [];
    const arr = (_a = obj.jobStories) != null ? _a : obj.job_stories;
    if (!Array.isArray(arr) || arr.length === 0) return [];
    return arr.filter((s) => typeof s === "object" && s !== null).map((s) => {
      var _a2, _b, _c, _d, _e, _f;
      return {
        situation: String((_b = (_a2 = s.situation) != null ? _a2 : s.Situation) != null ? _b : "").trim(),
        motivation: String((_d = (_c = s.motivation) != null ? _c : s.Motivation) != null ? _d : "").trim(),
        outcome: String((_f = (_e = s.outcome) != null ? _e : s.Outcome) != null ? _f : "").trim()
      };
    }).filter((s) => s.situation || s.motivation || s.outcome);
  }
  function extractProductAnalytics(obj) {
    var _a, _b, _c, _d, _e, _f, _g, _h, _i, _j, _k, _l, _m, _n, _o, _p;
    if (typeof obj !== "object" || obj === null) return void 0;
    const record = obj;
    const pa = (_b = (_a = record.productAnalytics) != null ? _a : record.product_analytics) != null ? _b : record.analytics;
    if (typeof pa !== "object" || pa === null) return void 0;
    const r = pa;
    const result = {};
    const lc = (_c = r.lifecycle) != null ? _c : r.Lifecycle;
    if (lc === "new" || lc === "active" || lc === "inactive" || lc === "churned" || lc === "reactivated") result.lifecycle = lc;
    if (typeof r.activated === "boolean") result.activated = r.activated;
    const seg = (_d = r.segment) != null ? _d : r.Segment;
    if (seg === "A" || seg === "B" || seg === "C" || seg === "D" || seg === "X") result.segment = seg;
    if (typeof r.segmentReasoning === "string") result.segmentReasoning = r.segmentReasoning;
    const ap = (_e = r.activationPoint) != null ? _e : r.activation_point;
    if (typeof ap === "object" && ap !== null) {
      const a = ap;
      result.activationPoint = {
        stageName: String((_h = (_g = (_f = a.stageName) != null ? _f : a.stage_name) != null ? _g : a.stage) != null ? _h : ""),
        description: String((_j = (_i = a.description) != null ? _i : a.desc) != null ? _j : ""),
        reached: a.reached === true
      };
    }
    const eng = (_l = (_k = r.engagementLevel) != null ? _k : r.engagement_level) != null ? _l : r.engagement;
    if (eng === "low" || eng === "medium" || eng === "high") result.engagementLevel = eng;
    const adp = (_n = (_m = r.adoptionStatus) != null ? _m : r.adoption_status) != null ? _n : r.adoption;
    if (adp === "none" || adp === "partial" || adp === "full") result.adoptionStatus = adp;
    if (typeof r.adoptionDetails === "string") result.adoptionDetails = r.adoptionDetails;
    const insights = (_p = (_o = r.productInsights) != null ? _o : r.product_insights) != null ? _p : r.insights;
    if (Array.isArray(insights)) {
      result.productInsights = insights.map((v) => String(v != null ? v : "")).filter(Boolean);
    }
    if (Object.keys(result).length === 0) return void 0;
    return result;
  }
  async function extractJSON(text) {
    const parsed = tryParseJSON(text);
    if (!parsed) {
      const preview = text.length > 200 ? text.slice(0, 200) + "..." : text;
      throw new Error("\u041D\u0435 \u0443\u0434\u0430\u043B\u043E\u0441\u044C \u0440\u0430\u0441\u043F\u0430\u0440\u0441\u0438\u0442\u044C JSON \u0438\u0437 \u043E\u0442\u0432\u0435\u0442\u0430 AI: " + preview);
    }
    if (typeof parsed === "object" && parsed !== null) {
      const record = parsed;
      if (record.error && typeof record.error === "string") {
        throw new Error(record.error);
      }
    }
    const stagesRaw = findStagesArray(parsed);
    if (!stagesRaw || stagesRaw.length === 0) {
      const keys = typeof parsed === "object" && parsed !== null ? Object.keys(parsed).join(", ") : "N/A";
      throw new Error("\u041D\u0435 \u043D\u0430\u0439\u0434\u0435\u043D\u044B \u044D\u0442\u0430\u043F\u044B \u0432 \u043E\u0442\u0432\u0435\u0442\u0435 AI (\u043A\u043B\u044E\u0447\u0438: " + keys + "). \u041F\u043E\u043F\u0440\u043E\u0431\u0443\u0439\u0442\u0435 \u0443\u0442\u043E\u0447\u043D\u0438\u0442\u044C \u043F\u0440\u043E\u043C\u043F\u0442.");
    }
    return {
      stageFramework: extractFramework(parsed),
      jobStories: extractJobStories(parsed),
      productAnalytics: extractProductAnalytics(parsed),
      stages: stagesRaw.map((s) => normalizeStageFromAny(s))
    };
  }
  function buildTranscriptPrompt(basePrompt, options, analyticsPrompts) {
    let result = basePrompt;
    const extra = [];
    if (options == null ? void 0 : options.includeDuration) {
      extra.push('\u0414\u043B\u044F \u043A\u0430\u0436\u0434\u043E\u0433\u043E \u044D\u0442\u0430\u043F\u0430 \u0443\u043A\u0430\u0436\u0438 \u043F\u0440\u0438\u043C\u0435\u0440\u043D\u0443\u044E \u0434\u043B\u0438\u0442\u0435\u043B\u044C\u043D\u043E\u0441\u0442\u044C \u0432 \u043F\u043E\u043B\u0435 duration (\u043D\u0430\u043F\u0440\u0438\u043C\u0435\u0440 "~5 \u043C\u0438\u043D", "~1 \u043C\u0435\u0441\u044F\u0446", "~1 \u0434\u0435\u043D\u044C").');
    }
    if (options == null ? void 0 : options.includeChannels) {
      extra.push("\u0423\u043A\u0430\u0436\u0438 \u043A\u0430\u043D\u0430\u043B \u0432\u0437\u0430\u0438\u043C\u043E\u0434\u0435\u0439\u0441\u0442\u0432\u0438\u044F \u0432 \u043F\u043E\u043B\u0435 channel (mobile, desktop, website, app, \u043F\u043E\u0434\u0434\u0435\u0440\u0436\u043A\u0430 \u0438 \u0442.\u0434.), \u043E\u0441\u043E\u0431\u0435\u043D\u043D\u043E \u043F\u0440\u0438 \u0441\u043C\u0435\u043D\u0435 \u043A\u0430\u043D\u0430\u043B\u0430.");
    }
    if (extra.length > 0) {
      result += "\n\n\u0414\u043E\u043F\u043E\u043B\u043D\u0438\u0442\u0435\u043B\u044C\u043D\u043E \u0438\u0437\u0432\u043B\u0435\u043A\u0430\u0439:\n- " + extra.join("\n- ");
      result += ' \u0412 JSON \u0434\u043B\u044F \u043A\u0430\u0436\u0434\u043E\u0433\u043E \u044D\u0442\u0430\u043F\u0430 \u0434\u043E\u0431\u0430\u0432\u044C \u043F\u043E\u043B\u044F "duration" \u0438/\u0438\u043B\u0438 "channel" \u0433\u0434\u0435 \u043F\u0440\u0438\u043C\u0435\u043D\u0438\u043C\u043E.';
    }
    if ((options == null ? void 0 : options.includeLifecycle) && (analyticsPrompts == null ? void 0 : analyticsPrompts.lifecyclePrompt)) {
      result += "\n\n" + analyticsPrompts.lifecyclePrompt;
    }
    if ((options == null ? void 0 : options.includeActivation) && (analyticsPrompts == null ? void 0 : analyticsPrompts.activationPrompt)) {
      result += "\n\n" + analyticsPrompts.activationPrompt;
    }
    if ((options == null ? void 0 : options.includeProductMetrics) && (analyticsPrompts == null ? void 0 : analyticsPrompts.productMetricsPrompt)) {
      result += "\n\n" + analyticsPrompts.productMetricsPrompt;
    }
    return result;
  }
  async function transcriptToCJM(transcript, apiKey, customPrompt, options, jobStoryPrompt, analyticsPrompts, signal) {
    var _a, _b, _c, _d;
    const trimmed = transcript.trim();
    if (!trimmed) {
      throw new Error("\u0422\u0440\u0430\u043D\u0441\u043A\u0440\u0438\u043F\u0442 \u043F\u0443\u0441\u0442");
    }
    const text = trimmed.length > MAX_TRANSCRIPT_LENGTH ? trimmed.slice(0, MAX_TRANSCRIPT_LENGTH) + "\n\n[... \u0442\u0435\u043A\u0441\u0442 \u043E\u0431\u0440\u0435\u0437\u0430\u043D ...]" : trimmed;
    let basePrompt = buildTranscriptPrompt(customPrompt || DEFAULT_TRANSCRIPT_PROMPT, options, analyticsPrompts);
    if (jobStoryPrompt == null ? void 0 : jobStoryPrompt.trim()) {
      basePrompt = basePrompt + "\n\n" + jobStoryPrompt.trim();
    }
    const systemPrompt = basePrompt;
    throwIfAborted(signal);
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `\u0412\u0445\u043E\u0434\u043D\u044B\u0435 \u0434\u0430\u043D\u043D\u044B\u0435:

---
${text}
---

\u0412\u0435\u0440\u043D\u0438 CJM \u043A\u0430\u043A JSON.` }
        ],
        temperature: 0.3
      })
    });
    if (!response.ok) {
      const errBody = await response.text();
      let msg = `OpenAI API: ${response.status}`;
      try {
        const j = JSON.parse(errBody);
        if ((_a = j.error) == null ? void 0 : _a.message) msg = j.error.message;
      } catch (e) {
        if (errBody) msg += " " + errBody.slice(0, 200);
      }
      throw new Error(msg);
    }
    const data = await response.json();
    const content = (_d = (_c = (_b = data.choices) == null ? void 0 : _b[0]) == null ? void 0 : _c.message) == null ? void 0 : _d.content;
    if (!content) {
      throw new Error("\u041F\u0443\u0441\u0442\u043E\u0439 \u043E\u0442\u0432\u0435\u0442 \u043E\u0442 OpenAI");
    }
    return extractJSON(content);
  }
  async function aggregateTranscriptsToCJM(transcripts, apiKey, customPrompt, options, jobStoryPrompt, analyticsPrompts, signal) {
    var _a, _b, _c, _d;
    if (!transcripts || transcripts.length === 0) {
      throw new Error("\u041D\u0435\u0442 \u0442\u0440\u0430\u043D\u0441\u043A\u0440\u0438\u043F\u0442\u043E\u0432");
    }
    const combined = transcripts.map((t, i) => `--- \u0418\u041D\u0422\u0415\u0420\u0412\u042C\u042E ${i + 1} ---
${t.trim()}`).join("\n\n");
    const text = combined.length > MAX_TRANSCRIPT_LENGTH ? combined.slice(0, MAX_TRANSCRIPT_LENGTH) + "\n\n[... \u0442\u0435\u043A\u0441\u0442 \u043E\u0431\u0440\u0435\u0437\u0430\u043D ...]" : combined;
    const basePrompt = (customPrompt || DEFAULT_AGGREGATE_PROMPT) + ((jobStoryPrompt == null ? void 0 : jobStoryPrompt.trim()) ? "\n\n" + jobStoryPrompt.trim() : "");
    const systemPrompt = buildTranscriptPrompt(basePrompt, options, analyticsPrompts);
    throwIfAborted(signal);
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `\u0410\u0433\u0440\u0435\u0433\u0438\u0440\u043E\u0432\u0430\u043D\u043D\u044B\u0435 \u0442\u0440\u0430\u043D\u0441\u043A\u0440\u0438\u043F\u0442\u044B:

---
${text}
---

\u0412\u0435\u0440\u043D\u0438 CJM \u043A\u0430\u043A JSON.` }
        ],
        temperature: 0.3
      })
    });
    if (!response.ok) {
      const errBody = await response.text();
      let msg = `OpenAI API: ${response.status}`;
      try {
        const j = JSON.parse(errBody);
        if ((_a = j.error) == null ? void 0 : _a.message) msg = j.error.message;
      } catch (e) {
        if (errBody) msg += " " + errBody.slice(0, 200);
      }
      throw new Error(msg);
    }
    const data = await response.json();
    const content = (_d = (_c = (_b = data.choices) == null ? void 0 : _b[0]) == null ? void 0 : _c.message) == null ? void 0 : _d.content;
    if (!content) throw new Error("\u041F\u0443\u0441\u0442\u043E\u0439 \u043E\u0442\u0432\u0435\u0442 \u043E\u0442 OpenAI");
    return extractJSON(content);
  }
  function rowsToText(rows) {
    return rows.map(
      (row) => (Array.isArray(row) ? row : []).map((c) => String(c != null ? c : "")).join("	")
    ).join("\n");
  }
  async function tableToCJM(rows, apiKey, sourceLabel, customPrompt, signal) {
    var _a, _b, _c, _d;
    if (!rows || rows.length === 0) {
      throw new Error("\u0422\u0430\u0431\u043B\u0438\u0446\u0430 \u043F\u0443\u0441\u0442\u0430");
    }
    const tableText = rowsToText(rows);
    const userContent = sourceLabel ? `\u0414\u0430\u043D\u043D\u044B\u0435 \u0438\u0437 ${sourceLabel}:

${tableText}` : `\u0422\u0430\u0431\u043B\u0438\u0446\u0430 (\u043F\u0435\u0440\u0432\u0430\u044F \u0441\u0442\u0440\u043E\u043A\u0430 \u2014 \u0437\u0430\u0433\u043E\u043B\u043E\u0432\u043E\u043A):

${tableText}`;
    throwIfAborted(signal);
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: customPrompt || DEFAULT_TABLE_PROMPT },
          { role: "user", content: userContent + "\n\n\u0412\u0435\u0440\u043D\u0438 CJM \u043A\u0430\u043A JSON." }
        ],
        temperature: 0.3
      })
    });
    if (!response.ok) {
      const errBody = await response.text();
      let msg = `OpenAI API: ${response.status}`;
      try {
        const j = JSON.parse(errBody);
        if ((_a = j.error) == null ? void 0 : _a.message) msg = j.error.message;
      } catch (e) {
        if (errBody) msg += " " + errBody.slice(0, 200);
      }
      throw new Error(msg);
    }
    const tableData = await response.json();
    const tableContent = (_d = (_c = (_b = tableData.choices) == null ? void 0 : _b[0]) == null ? void 0 : _c.message) == null ? void 0 : _d.content;
    if (!tableContent) {
      throw new Error("\u041F\u0443\u0441\u0442\u043E\u0439 \u043E\u0442\u0432\u0435\u0442 \u043E\u0442 OpenAI");
    }
    return extractJSON(tableContent);
  }
  async function matchScreensToStages(stageNames, frameNames, apiKey, customPrompt, signal) {
    var _a, _b, _c, _d, _e, _f;
    if (!stageNames.length || !frameNames.length) return { mapping: {} };
    const systemPrompt = customPrompt || DEFAULT_SCREEN_MATCHING_PROMPT;
    const userContent2 = "\u042D\u0442\u0430\u043F\u044B CJM:\n" + stageNames.map(function(s, i) {
      return i + 1 + ". " + s;
    }).join("\n") + "\n\n\u0424\u0440\u0435\u0439\u043C\u044B (\u044D\u043A\u0440\u0430\u043D\u044B):\n" + frameNames.map(function(f, i) {
      return i + 1 + ". " + f;
    }).join("\n") + "\n\n\u0412\u0435\u0440\u043D\u0438 JSON \u0441 \u043C\u0430\u043F\u043F\u0438\u043D\u0433\u043E\u043C \u0438 \u0430\u043D\u043D\u043E\u0442\u0430\u0446\u0438\u044F\u043C\u0438 \u044D\u043A\u0440\u0430\u043D\u043E\u0432.";
    throwIfAborted(signal);
    const matchResponse = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userContent2 }
        ],
        temperature: 0.2
      })
    });
    if (!matchResponse.ok) {
      return { mapping: {} };
    }
    const matchData = await matchResponse.json();
    const matchContent = (_c = (_b = (_a = matchData.choices) == null ? void 0 : _a[0]) == null ? void 0 : _b.message) == null ? void 0 : _c.content;
    if (!matchContent) return { mapping: {} };
    try {
      const parsed = tryParseJSON(matchContent);
      if (!parsed || typeof parsed !== "object") return { mapping: {} };
      const record = parsed;
      const rawMapping = (_e = (_d = record.mapping) != null ? _d : record.Mapping) != null ? _e : record;
      if (typeof rawMapping !== "object" || rawMapping === null) return { mapping: {} };
      const mapping = {};
      for (const [key, val] of Object.entries(rawMapping)) {
        if (key === "mapping" || key === "Mapping" || key === "screenAnnotations") continue;
        if (Array.isArray(val)) {
          mapping[key] = val.map((v) => String(v != null ? v : "")).filter(Boolean);
        }
      }
      let screenAnnotations;
      const rawAnnotations = (_f = record.screenAnnotations) != null ? _f : record.ScreenAnnotations;
      if (rawAnnotations && typeof rawAnnotations === "object" && rawAnnotations !== null) {
        screenAnnotations = {};
        for (const [k, v] of Object.entries(rawAnnotations)) {
          if (typeof v === "string" && v.trim()) {
            screenAnnotations[k] = v.trim();
          }
        }
        if (Object.keys(screenAnnotations).length === 0) screenAnnotations = void 0;
      }
      return { mapping, screenAnnotations };
    } catch (e) {
      return { mapping: {} };
    }
  }

  // src/lib/cjm-renderer.ts
  function collectFrames(source) {
    const selection = figma.currentPage.selection;
    let frames = [];
    if (source === "selection") {
      for (const node of selection) {
        if (node.type === "FRAME") {
          frames.push(node);
        } else if (node.type === "SECTION") {
          for (const child of node.children) {
            if (child.type === "FRAME") frames.push(child);
          }
        }
      }
    } else if (source === "section") {
      if (selection.length === 1 && selection[0].type === "SECTION") {
        const section = selection[0];
        frames = section.children.filter((c) => c.type === "FRAME");
      }
    } else if (source === "page") {
      frames = figma.currentPage.findAll((n) => n.type === "FRAME");
    }
    frames.sort((a, b) => a.x - b.x);
    return frames;
  }
  var INK_BLACK = { r: 0.075, g: 0.106, b: 0.137 };
  var DUSTY_GRAPE = { r: 0.337, g: 0.337, b: 0.463 };
  var PERIWINKLE = { r: 0.847, g: 0.863, b: 1 };
  var BARBIE_PINK = { r: 0.976, g: 0, b: 0.576 };
  var WHITE = { r: 1, g: 1, b: 1 };
  var STAGE_BG = { r: 0.976, g: 0.978, b: 1 };
  var FONT_REGULAR = { family: "Inter", style: "Regular" };
  var FONT_MEDIUM = { family: "Inter", style: "Medium" };
  var FONT_SEMIBOLD = { family: "Inter", style: "Semi Bold" };
  var FONT_BOLD = { family: "Inter", style: "Bold" };
  var TEXT_WIDTH = 220;
  var CARD_PADDING = 12;
  var CARD_GAP = 8;
  var STAGE_PADDING = 12;
  var STAGE_GAP = 16;
  var CANVAS_PADDING = 32;
  async function loadFonts() {
    await Promise.all([
      figma.loadFontAsync(FONT_REGULAR),
      figma.loadFontAsync(FONT_MEDIUM),
      figma.loadFontAsync(FONT_SEMIBOLD),
      figma.loadFontAsync(FONT_BOLD)
    ]);
  }
  var CARD_COLORS = {
    actions: { r: 0.922, g: 0.933, b: 1 },
    touchpoints: { r: 0.91, g: 0.91, b: 0.988 },
    experience: { r: 1, g: 0.941, b: 0.969 },
    thoughts: { r: 0.941, g: 0.933, b: 1 },
    emotions: { r: 1, g: 0.91, b: 0.953 },
    quotes: { r: 0.961, g: 0.957, b: 0.984 },
    metrics: { r: 0.894, g: 0.902, b: 0.988 },
    hypotheses: { r: 0.949, g: 0.933, b: 1 }
  };
  function makeText(chars, font, size, color, width, lineH) {
    const t = figma.createText();
    t.fontName = font;
    t.fontSize = size;
    if (lineH) t.lineHeight = { value: lineH, unit: "PIXELS" };
    t.fills = [{ type: "SOLID", color }];
    t.textAutoResize = "HEIGHT";
    t.characters = chars;
    t.resize(width, t.height);
    return t;
  }
  async function createCard(title, items, bgColor, formatItem) {
    const contentWidth = TEXT_WIDTH;
    const frame = figma.createFrame();
    frame.name = title;
    frame.fills = [{ type: "SOLID", color: bgColor }];
    frame.cornerRadius = 8;
    frame.layoutMode = "VERTICAL";
    frame.primaryAxisSizingMode = "AUTO";
    frame.counterAxisSizingMode = "AUTO";
    frame.itemSpacing = 4;
    frame.paddingLeft = CARD_PADDING;
    frame.paddingRight = CARD_PADDING;
    frame.paddingTop = 10;
    frame.paddingBottom = 10;
    const titleNode = makeText(title.toUpperCase(), FONT_MEDIUM, 9, DUSTY_GRAPE, contentWidth);
    titleNode.letterSpacing = { value: 4, unit: "PERCENT" };
    frame.appendChild(titleNode);
    for (const item of items) {
      if (!item.trim()) continue;
      const raw = item.length > 200 ? item.slice(0, 197) + "..." : item;
      const chars = formatItem ? formatItem(raw) : raw;
      const t = makeText(chars, FONT_REGULAR, 11, INK_BLACK, contentWidth, 16);
      frame.appendChild(t);
    }
    return frame;
  }
  async function renderStage(stage, index) {
    var _a, _b, _c, _d, _e, _f, _g, _h, _i;
    const innerWidth = TEXT_WIDTH + CARD_PADDING * 2;
    const stageFrame = figma.createFrame();
    stageFrame.name = stage.name;
    stageFrame.layoutMode = "VERTICAL";
    stageFrame.primaryAxisSizingMode = "AUTO";
    stageFrame.counterAxisSizingMode = "AUTO";
    stageFrame.itemSpacing = CARD_GAP;
    stageFrame.fills = [{ type: "SOLID", color: STAGE_BG }];
    stageFrame.cornerRadius = 12;
    stageFrame.paddingLeft = STAGE_PADDING;
    stageFrame.paddingRight = STAGE_PADDING;
    stageFrame.paddingTop = 16;
    stageFrame.paddingBottom = 16;
    const pillFrame = figma.createFrame();
    pillFrame.name = "stage-number";
    pillFrame.layoutMode = "HORIZONTAL";
    pillFrame.primaryAxisSizingMode = "AUTO";
    pillFrame.counterAxisSizingMode = "AUTO";
    pillFrame.paddingLeft = 8;
    pillFrame.paddingRight = 8;
    pillFrame.paddingTop = 3;
    pillFrame.paddingBottom = 3;
    pillFrame.cornerRadius = 10;
    pillFrame.fills = [{ type: "SOLID", color: BARBIE_PINK }];
    const pillText = figma.createText();
    pillText.fontName = FONT_SEMIBOLD;
    pillText.fontSize = 9;
    pillText.fills = [{ type: "SOLID", color: WHITE }];
    pillText.characters = String(index + 1);
    pillFrame.appendChild(pillText);
    stageFrame.appendChild(pillFrame);
    const headerRow = figma.createFrame();
    headerRow.name = "stage-header";
    headerRow.layoutMode = "VERTICAL";
    headerRow.primaryAxisSizingMode = "AUTO";
    headerRow.counterAxisSizingMode = "AUTO";
    headerRow.itemSpacing = 6;
    headerRow.fills = [];
    const header = makeText(stage.name, FONT_SEMIBOLD, 14, INK_BLACK, innerWidth, 20);
    headerRow.appendChild(header);
    const badgesRow = figma.createFrame();
    badgesRow.name = "stage-badges";
    badgesRow.layoutMode = "HORIZONTAL";
    badgesRow.primaryAxisSizingMode = "AUTO";
    badgesRow.counterAxisSizingMode = "AUTO";
    badgesRow.itemSpacing = 6;
    badgesRow.fills = [];
    if (stage.duration) {
      const durationBadge = figma.createFrame();
      durationBadge.name = "duration";
      durationBadge.layoutMode = "HORIZONTAL";
      durationBadge.primaryAxisSizingMode = "AUTO";
      durationBadge.counterAxisSizingMode = "AUTO";
      durationBadge.paddingLeft = 6;
      durationBadge.paddingRight = 6;
      durationBadge.paddingTop = 2;
      durationBadge.paddingBottom = 2;
      durationBadge.cornerRadius = 6;
      durationBadge.fills = [{ type: "SOLID", color: DUSTY_GRAPE, opacity: 0.15 }];
      const durationText = makeText(stage.duration, FONT_REGULAR, 10, DUSTY_GRAPE, 100, 14);
      durationBadge.appendChild(durationText);
      badgesRow.appendChild(durationBadge);
    }
    if (stage.channel) {
      const channelBadge = figma.createFrame();
      channelBadge.name = "channel";
      channelBadge.layoutMode = "HORIZONTAL";
      channelBadge.primaryAxisSizingMode = "AUTO";
      channelBadge.counterAxisSizingMode = "AUTO";
      channelBadge.paddingLeft = 6;
      channelBadge.paddingRight = 6;
      channelBadge.paddingTop = 2;
      channelBadge.paddingBottom = 2;
      channelBadge.cornerRadius = 6;
      channelBadge.fills = [{ type: "SOLID", color: BARBIE_PINK, opacity: 0.15 }];
      const channelText = makeText(stage.channel, FONT_REGULAR, 10, BARBIE_PINK, 120, 14);
      channelBadge.appendChild(channelText);
      badgesRow.appendChild(channelBadge);
    }
    if (stage.duration || stage.channel) {
      headerRow.appendChild(badgesRow);
    }
    stageFrame.appendChild(headerRow);
    const divider = figma.createRectangle();
    divider.name = "divider";
    divider.resize(innerWidth, 1);
    divider.fills = [{ type: "SOLID", color: PERIWINKLE }];
    stageFrame.appendChild(divider);
    const sections = [
      { key: "actions", label: "\u0414\u0435\u0439\u0441\u0442\u0432\u0438\u044F", items: (_a = stage.actions) != null ? _a : [] },
      { key: "touchpoints", label: "Touchpoints", items: (_b = stage.touchpoints) != null ? _b : [] },
      { key: "experience", label: "\u041E\u043F\u044B\u0442", items: (_c = stage.experience) != null ? _c : [] },
      { key: "thoughts", label: "\u041C\u044B\u0441\u043B\u0438", items: (_d = stage.thoughts) != null ? _d : [] },
      { key: "emotions", label: "\u042D\u043C\u043E\u0446\u0438\u0438", items: (_e = stage.emotions) != null ? _e : [] },
      { key: "quotes", label: "\u0426\u0438\u0442\u0430\u0442\u044B", items: (_f = stage.quotes) != null ? _f : [] },
      { key: "metrics", label: "\u041C\u0435\u0442\u0440\u0438\u043A\u0438", items: (_g = stage.metrics) != null ? _g : [] },
      { key: "hypotheses", label: "\u0413\u0438\u043F\u043E\u0442\u0435\u0437\u044B", items: (_h = stage.hypotheses) != null ? _h : [] }
    ];
    for (const { key, label, items } of sections) {
      if (items.length === 0) continue;
      const formatItem = key === "quotes" ? (s) => `\xAB${s}\xBB` : void 0;
      const card = await createCard(label, items, (_i = CARD_COLORS[key]) != null ? _i : CARD_COLORS.actions, formatItem);
      stageFrame.appendChild(card);
    }
    return stageFrame;
  }
  var SCREEN_PREVIEW_SIZE = 120;
  async function addScreenToStage(stageFrame, frameNode, mode) {
    if (mode === "links") {
      const linkText = makeText("\u042D\u043A\u0440\u0430\u043D: " + (frameNode.name || "\u0424\u0440\u0435\u0439\u043C"), FONT_REGULAR, 11, BARBIE_PINK, TEXT_WIDTH + CARD_PADDING * 2, 16);
      linkText.setRangeHyperlink(0, linkText.characters.length, { type: "NODE", value: frameNode.id });
      const linkFrame = figma.createFrame();
      linkFrame.name = "screen-link";
      linkFrame.layoutMode = "VERTICAL";
      linkFrame.primaryAxisSizingMode = "AUTO";
      linkFrame.counterAxisSizingMode = "AUTO";
      linkFrame.paddingLeft = 8;
      linkFrame.paddingRight = 8;
      linkFrame.paddingTop = 6;
      linkFrame.paddingBottom = 6;
      linkFrame.cornerRadius = 6;
      linkFrame.fills = [{ type: "SOLID", color: PERIWINKLE, opacity: 0.2 }];
      linkFrame.appendChild(linkText);
      stageFrame.appendChild(linkFrame);
    } else {
      try {
        const bytes = await frameNode.exportAsync({ format: "PNG", constraint: { type: "SCALE", value: 0.5 } });
        const image = figma.createImage(bytes);
        const rect = figma.createRectangle();
        rect.name = "screen-preview";
        rect.resize(SCREEN_PREVIEW_SIZE, Math.round(frameNode.height / frameNode.width * SCREEN_PREVIEW_SIZE) || SCREEN_PREVIEW_SIZE);
        rect.fills = [{ type: "IMAGE", imageHash: image.hash, scaleMode: "FILL" }];
        rect.cornerRadius = 6;
        const wrapper = figma.createFrame();
        wrapper.name = "screen-preview-wrapper";
        wrapper.layoutMode = "VERTICAL";
        wrapper.primaryAxisSizingMode = "AUTO";
        wrapper.counterAxisSizingMode = "AUTO";
        wrapper.appendChild(rect);
        stageFrame.appendChild(wrapper);
      } catch (e) {
        const linkText = makeText("\u042D\u043A\u0440\u0430\u043D: " + (frameNode.name || "\u0424\u0440\u0435\u0439\u043C"), FONT_REGULAR, 11, BARBIE_PINK, TEXT_WIDTH + CARD_PADDING * 2, 16);
        linkText.setRangeHyperlink(0, linkText.characters.length, { type: "NODE", value: frameNode.id });
        const linkFrame = figma.createFrame();
        linkFrame.name = "screen-link";
        linkFrame.layoutMode = "VERTICAL";
        linkFrame.primaryAxisSizingMode = "AUTO";
        linkFrame.counterAxisSizingMode = "AUTO";
        linkFrame.paddingLeft = 8;
        linkFrame.paddingRight = 8;
        linkFrame.paddingTop = 6;
        linkFrame.paddingBottom = 6;
        linkFrame.cornerRadius = 6;
        linkFrame.fills = [{ type: "SOLID", color: PERIWINKLE, opacity: 0.2 }];
        linkFrame.appendChild(linkText);
        stageFrame.appendChild(linkFrame);
      }
    }
  }
  async function renderCJM(data, framesConfig) {
    if (!data.stages || data.stages.length === 0) {
      throw new Error("\u041D\u0435\u0442 \u044D\u0442\u0430\u043F\u043E\u0432 \u0434\u043B\u044F \u043E\u0442\u043E\u0431\u0440\u0430\u0436\u0435\u043D\u0438\u044F");
    }
    await loadFonts();
    const canvas = figma.createFrame();
    canvas.name = "CJM \u2014 \u0421\u0431\u043E\u0440\u043A\u0430 CJM";
    canvas.layoutMode = "VERTICAL";
    canvas.primaryAxisSizingMode = "AUTO";
    canvas.counterAxisSizingMode = "AUTO";
    canvas.itemSpacing = 20;
    canvas.paddingLeft = CANVAS_PADDING;
    canvas.paddingRight = CANVAS_PADDING;
    canvas.paddingTop = CANVAS_PADDING;
    canvas.paddingBottom = CANVAS_PADDING;
    canvas.fills = [{ type: "SOLID", color: WHITE }];
    canvas.cornerRadius = 16;
    const titleRow = figma.createFrame();
    titleRow.name = "header";
    titleRow.layoutMode = "HORIZONTAL";
    titleRow.primaryAxisSizingMode = "AUTO";
    titleRow.counterAxisSizingMode = "AUTO";
    titleRow.itemSpacing = 12;
    titleRow.fills = [];
    const title = figma.createText();
    title.fontName = FONT_BOLD;
    title.fontSize = 20;
    title.characters = "Customer Journey Map";
    title.fills = [{ type: "SOLID", color: INK_BLACK }];
    titleRow.appendChild(title);
    if (data.stageFramework) {
      const badge = figma.createFrame();
      badge.name = "framework-badge";
      badge.layoutMode = "HORIZONTAL";
      badge.primaryAxisSizingMode = "AUTO";
      badge.counterAxisSizingMode = "AUTO";
      badge.paddingLeft = 10;
      badge.paddingRight = 10;
      badge.paddingTop = 4;
      badge.paddingBottom = 4;
      badge.cornerRadius = 12;
      badge.fills = [{ type: "SOLID", color: BARBIE_PINK, opacity: 0.1 }];
      const badgeText = figma.createText();
      badgeText.fontName = FONT_SEMIBOLD;
      badgeText.fontSize = 11;
      badgeText.characters = data.stageFramework.toUpperCase();
      badgeText.fills = [{ type: "SOLID", color: BARBIE_PINK }];
      badge.appendChild(badgeText);
      titleRow.appendChild(badge);
    }
    canvas.appendChild(titleRow);
    if (data.jobStories && data.jobStories.length > 0) {
      const jobStoriesToShow = data.jobStories.slice(0, 3);
      for (let ji = 0; ji < jobStoriesToShow.length; ji++) {
        const jobStory = jobStoriesToShow[ji];
        const jobText = `When ${jobStory.situation}, I want to ${jobStory.motivation}, so I can ${jobStory.outcome}`;
        const jobFrame = figma.createFrame();
        jobFrame.name = jobStoriesToShow.length > 1 ? `job-story-${ji + 1}` : "job-story";
        jobFrame.layoutMode = "VERTICAL";
        jobFrame.primaryAxisSizingMode = "AUTO";
        jobFrame.counterAxisSizingMode = "AUTO";
        jobFrame.paddingLeft = 12;
        jobFrame.paddingRight = 12;
        jobFrame.paddingTop = 8;
        jobFrame.paddingBottom = 8;
        jobFrame.cornerRadius = 8;
        jobFrame.fills = [{ type: "SOLID", color: PERIWINKLE, opacity: 0.3 }];
        const jobLabel = makeText(jobStoriesToShow.length > 1 ? `JOB STORY ${ji + 1}` : "JOB STORY", FONT_MEDIUM, 9, DUSTY_GRAPE, 600, 14);
        jobLabel.letterSpacing = { value: 4, unit: "PERCENT" };
        jobFrame.appendChild(jobLabel);
        const jobContent = makeText(jobText, FONT_REGULAR, 12, INK_BLACK, 600, 18);
        jobFrame.appendChild(jobContent);
        canvas.appendChild(jobFrame);
      }
    }
    if (data.productAnalytics) {
      const pa = data.productAnalytics;
      const analyticsFrame = figma.createFrame();
      analyticsFrame.name = "product-analytics";
      analyticsFrame.layoutMode = "VERTICAL";
      analyticsFrame.primaryAxisSizingMode = "AUTO";
      analyticsFrame.counterAxisSizingMode = "AUTO";
      analyticsFrame.paddingLeft = 12;
      analyticsFrame.paddingRight = 12;
      analyticsFrame.paddingTop = 10;
      analyticsFrame.paddingBottom = 10;
      analyticsFrame.cornerRadius = 8;
      analyticsFrame.itemSpacing = 8;
      analyticsFrame.fills = [{ type: "SOLID", color: { r: 0.957, g: 0.941, b: 1 } }];
      const aLabel = makeText("PRODUCT ANALYTICS", FONT_MEDIUM, 9, DUSTY_GRAPE, 700, 14);
      aLabel.letterSpacing = { value: 4, unit: "PERCENT" };
      analyticsFrame.appendChild(aLabel);
      const badgesRowPA = figma.createFrame();
      badgesRowPA.name = "analytics-badges";
      badgesRowPA.layoutMode = "HORIZONTAL";
      badgesRowPA.primaryAxisSizingMode = "AUTO";
      badgesRowPA.counterAxisSizingMode = "AUTO";
      badgesRowPA.itemSpacing = 8;
      badgesRowPA.fills = [];
      const badgeItems = [];
      if (pa.lifecycle) badgeItems.push({ label: "Lifecycle", value: pa.lifecycle, color: DUSTY_GRAPE });
      if (pa.segment) badgeItems.push({ label: "\u0421\u0435\u0433\u043C\u0435\u043D\u0442", value: pa.segment, color: BARBIE_PINK });
      if (pa.activated !== void 0) badgeItems.push({ label: "\u0410\u043A\u0442\u0438\u0432\u0430\u0446\u0438\u044F", value: pa.activated ? "\u0434\u0430" : "\u043D\u0435\u0442", color: pa.activated ? { r: 0.08, g: 0.68, b: 0.36 } : { r: 0.88, g: 0.24, b: 0.18 } });
      if (pa.engagementLevel) badgeItems.push({ label: "\u0412\u043E\u0432\u043B\u0435\u0447\u0451\u043D\u043D\u043E\u0441\u0442\u044C", value: pa.engagementLevel, color: DUSTY_GRAPE });
      if (pa.adoptionStatus) badgeItems.push({ label: "Adoption", value: pa.adoptionStatus, color: DUSTY_GRAPE });
      for (const bi of badgeItems) {
        const bFrame = figma.createFrame();
        bFrame.name = bi.label;
        bFrame.layoutMode = "HORIZONTAL";
        bFrame.primaryAxisSizingMode = "AUTO";
        bFrame.counterAxisSizingMode = "AUTO";
        bFrame.paddingLeft = 8;
        bFrame.paddingRight = 8;
        bFrame.paddingTop = 3;
        bFrame.paddingBottom = 3;
        bFrame.cornerRadius = 6;
        bFrame.fills = [{ type: "SOLID", color: bi.color, opacity: 0.12 }];
        bFrame.itemSpacing = 4;
        const bLabel = makeText(bi.label + ":", FONT_MEDIUM, 10, bi.color, 200, 14);
        const bValue = makeText(bi.value, FONT_SEMIBOLD, 10, bi.color, 200, 14);
        bFrame.appendChild(bLabel);
        bFrame.appendChild(bValue);
        badgesRowPA.appendChild(bFrame);
      }
      if (badgeItems.length > 0) analyticsFrame.appendChild(badgesRowPA);
      if (pa.segmentReasoning) {
        const segText = makeText("\u0421\u0435\u0433\u043C\u0435\u043D\u0442: " + pa.segmentReasoning, FONT_REGULAR, 11, INK_BLACK, 700, 16);
        analyticsFrame.appendChild(segText);
      }
      if (pa.activationPoint) {
        const apText = makeText(
          "\u0422\u043E\u0447\u043A\u0430 \u0430\u043A\u0442\u0438\u0432\u0430\u0446\u0438\u0438: " + (pa.activationPoint.reached ? "\u0434\u043E\u0441\u0442\u0438\u0433\u043D\u0443\u0442\u0430" : "\u043D\u0435 \u0434\u043E\u0441\u0442\u0438\u0433\u043D\u0443\u0442\u0430") + " \u2014 " + (pa.activationPoint.stageName ? "\u044D\u0442\u0430\u043F \xAB" + pa.activationPoint.stageName + "\xBB" : "") + (pa.activationPoint.description ? ". " + pa.activationPoint.description : ""),
          FONT_REGULAR,
          11,
          INK_BLACK,
          700,
          16
        );
        analyticsFrame.appendChild(apText);
      }
      if (pa.adoptionDetails) {
        const adText = makeText("Adoption: " + pa.adoptionDetails, FONT_REGULAR, 11, INK_BLACK, 700, 16);
        analyticsFrame.appendChild(adText);
      }
      if (pa.productInsights && pa.productInsights.length > 0) {
        const insightsLabel = makeText("PRODUCT INSIGHTS", FONT_MEDIUM, 9, DUSTY_GRAPE, 700, 14);
        insightsLabel.letterSpacing = { value: 4, unit: "PERCENT" };
        analyticsFrame.appendChild(insightsLabel);
        for (const insight of pa.productInsights.slice(0, 5)) {
          const iText = makeText("\u2022 " + insight, FONT_REGULAR, 11, INK_BLACK, 700, 16);
          analyticsFrame.appendChild(iText);
        }
      }
      canvas.appendChild(analyticsFrame);
    }
    const subtitle = figma.createText();
    subtitle.fontName = FONT_REGULAR;
    subtitle.fontSize = 12;
    const n = data.stages.length;
    subtitle.characters = n + " " + (n === 1 ? "\u044D\u0442\u0430\u043F" : n < 5 ? "\u044D\u0442\u0430\u043F\u0430" : "\u044D\u0442\u0430\u043F\u043E\u0432");
    subtitle.fills = [{ type: "SOLID", color: DUSTY_GRAPE }];
    canvas.appendChild(subtitle);
    const stagesRow = figma.createFrame();
    stagesRow.name = "stages";
    stagesRow.layoutMode = "HORIZONTAL";
    stagesRow.primaryAxisSizingMode = "AUTO";
    stagesRow.counterAxisSizingMode = "AUTO";
    stagesRow.counterAxisAlignItems = "MIN";
    stagesRow.itemSpacing = STAGE_GAP;
    stagesRow.fills = [];
    const framesByName = {};
    if (framesConfig) {
      for (const f of framesConfig.frames) {
        const n2 = f.name || "";
        if (!framesByName[n2]) framesByName[n2] = [];
        framesByName[n2].push(f);
      }
    }
    for (let i = 0; i < data.stages.length; i++) {
      const stageFrame = await renderStage(data.stages[i], i);
      if (framesConfig && framesConfig.frames.length > 0) {
        if (framesConfig.mapping) {
          const mappedNames = framesConfig.mapping[data.stages[i].name] || [];
          for (const frameName of mappedNames) {
            const candidates = framesByName[frameName];
            if (candidates && candidates.length > 0) {
              await addScreenToStage(stageFrame, candidates[0], framesConfig.mode);
            }
          }
        } else {
          if (framesConfig.frames[i]) {
            await addScreenToStage(stageFrame, framesConfig.frames[i], framesConfig.mode);
          }
        }
      }
      stagesRow.appendChild(stageFrame);
    }
    canvas.appendChild(stagesRow);
    figma.currentPage.appendChild(canvas);
    figma.viewport.scrollAndZoomIntoView([canvas]);
    figma.currentPage.selection = [canvas];
    return canvas;
  }
  var SCENARIO_SCREEN_HEIGHT = 400;
  var VISION_STICKER_COLORS = [
    { r: 1, g: 0.87, b: 0.19 },
    // yellow
    { r: 0.28, g: 0.86, b: 0.76 },
    // teal
    { r: 0.55, g: 0.82, b: 0.42 },
    // green
    { r: 1, g: 0.67, b: 0.16 },
    // orange
    { r: 0.62, g: 0.43, b: 0.9 }
    // purple
  ];
  var VISION_CARD_W = 200;
  var VISION_CARD_GAP = 24;
  var VISION_CARD_SPACING = 8;
  var VISION_DOT_R = 5;
  function drawConnector(parent, x1, y1, x2, y2, color, opacity = 0.5) {
    const minX = Math.min(x1, x2);
    const minY = Math.min(y1, y2);
    const vec = figma.createVector();
    vec.name = "connector";
    vec.x = minX;
    vec.y = minY;
    vec.vectorPaths = [{
      windingRule: "NONE",
      data: `M ${x1 - minX} ${y1 - minY} L ${x2 - minX} ${y2 - minY}`
    }];
    vec.strokes = [{ type: "SOLID", color, opacity }];
    vec.strokeWeight = 1.5;
    parent.appendChild(vec);
  }
  function uint8ArrayToBase64(bytes) {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    let output = "";
    let i = 0;
    for (; i + 2 < bytes.length; i += 3) {
      const n = bytes[i] << 16 | bytes[i + 1] << 8 | bytes[i + 2];
      output += chars[n >> 18 & 63];
      output += chars[n >> 12 & 63];
      output += chars[n >> 6 & 63];
      output += chars[n & 63];
    }
    const remaining = bytes.length - i;
    if (remaining === 1) {
      const n = bytes[i] << 16;
      output += chars[n >> 18 & 63];
      output += chars[n >> 12 & 63];
      output += "==";
    } else if (remaining === 2) {
      const n = bytes[i] << 16 | bytes[i + 1] << 8;
      output += chars[n >> 18 & 63];
      output += chars[n >> 12 & 63];
      output += chars[n >> 6 & 63];
      output += "=";
    }
    return output;
  }
  async function renderScreenScenario(data, config) {
    var _a, _b, _c, _d, _e, _f, _g, _h, _i;
    if (!data.stages || data.stages.length === 0) {
      throw new Error("\u041D\u0435\u0442 \u044D\u0442\u0430\u043F\u043E\u0432 \u0434\u043B\u044F \u043E\u0442\u043E\u0431\u0440\u0430\u0436\u0435\u043D\u0438\u044F");
    }
    await loadFonts();
    let visionErrorMessage = "";
    let visionTotalAnnotations = 0;
    const framesByName = {};
    for (const f of config.frames) {
      const n = f.name || "";
      if (!framesByName[n]) framesByName[n] = [];
      framesByName[n].push(f);
    }
    const canvas = figma.createFrame();
    canvas.name = "CJM \u2014 \u0421\u0446\u0435\u043D\u0430\u0440\u0438\u0439 \u0441 \u044D\u043A\u0440\u0430\u043D\u0430\u043C\u0438";
    canvas.layoutMode = "VERTICAL";
    canvas.primaryAxisSizingMode = "AUTO";
    canvas.counterAxisSizingMode = "AUTO";
    canvas.itemSpacing = 24;
    canvas.paddingLeft = CANVAS_PADDING;
    canvas.paddingRight = CANVAS_PADDING;
    canvas.paddingTop = CANVAS_PADDING;
    canvas.paddingBottom = CANVAS_PADDING;
    canvas.fills = [{ type: "SOLID", color: WHITE }];
    canvas.cornerRadius = 16;
    const titleRow = figma.createFrame();
    titleRow.name = "header";
    titleRow.layoutMode = "HORIZONTAL";
    titleRow.primaryAxisSizingMode = "AUTO";
    titleRow.counterAxisSizingMode = "AUTO";
    titleRow.itemSpacing = 12;
    titleRow.fills = [];
    const title = figma.createText();
    title.fontName = FONT_BOLD;
    title.fontSize = 20;
    title.characters = "\u0421\u0446\u0435\u043D\u0430\u0440\u0438\u0439 \u0441 \u044D\u043A\u0440\u0430\u043D\u0430\u043C\u0438";
    title.fills = [{ type: "SOLID", color: INK_BLACK }];
    titleRow.appendChild(title);
    if (data.stageFramework) {
      const badge = figma.createFrame();
      badge.name = "framework-badge";
      badge.layoutMode = "HORIZONTAL";
      badge.primaryAxisSizingMode = "AUTO";
      badge.counterAxisSizingMode = "AUTO";
      badge.paddingLeft = 10;
      badge.paddingRight = 10;
      badge.paddingTop = 4;
      badge.paddingBottom = 4;
      badge.cornerRadius = 12;
      badge.fills = [{ type: "SOLID", color: BARBIE_PINK, opacity: 0.1 }];
      const badgeText = figma.createText();
      badgeText.fontName = FONT_SEMIBOLD;
      badgeText.fontSize = 11;
      badgeText.characters = data.stageFramework.toUpperCase();
      badgeText.fills = [{ type: "SOLID", color: BARBIE_PINK }];
      badge.appendChild(badgeText);
      titleRow.appendChild(badge);
    }
    canvas.appendChild(titleRow);
    if (data.jobStories && data.jobStories.length > 0) {
      for (let ji = 0; ji < Math.min(data.jobStories.length, 3); ji++) {
        const js = data.jobStories[ji];
        const jobText = "When " + js.situation + ", I want to " + js.motivation + ", so I can " + js.outcome;
        const jobFrame = figma.createFrame();
        jobFrame.name = data.jobStories.length > 1 ? "job-story-" + (ji + 1) : "job-story";
        jobFrame.layoutMode = "VERTICAL";
        jobFrame.primaryAxisSizingMode = "AUTO";
        jobFrame.counterAxisSizingMode = "AUTO";
        jobFrame.paddingLeft = 12;
        jobFrame.paddingRight = 12;
        jobFrame.paddingTop = 8;
        jobFrame.paddingBottom = 8;
        jobFrame.cornerRadius = 8;
        jobFrame.fills = [{ type: "SOLID", color: PERIWINKLE, opacity: 0.3 }];
        const jobLabel = makeText(data.jobStories.length > 1 ? "JOB STORY " + (ji + 1) : "JOB STORY", FONT_MEDIUM, 9, DUSTY_GRAPE, 600, 14);
        jobLabel.letterSpacing = { value: 4, unit: "PERCENT" };
        jobFrame.appendChild(jobLabel);
        const jobContent = makeText(jobText, FONT_REGULAR, 12, INK_BLACK, 600, 18);
        jobFrame.appendChild(jobContent);
        canvas.appendChild(jobFrame);
      }
    }
    if (data.productAnalytics) {
      const pa = data.productAnalytics;
      const analyticsFrame = figma.createFrame();
      analyticsFrame.name = "product-analytics";
      analyticsFrame.layoutMode = "VERTICAL";
      analyticsFrame.primaryAxisSizingMode = "AUTO";
      analyticsFrame.counterAxisSizingMode = "AUTO";
      analyticsFrame.paddingLeft = 12;
      analyticsFrame.paddingRight = 12;
      analyticsFrame.paddingTop = 10;
      analyticsFrame.paddingBottom = 10;
      analyticsFrame.cornerRadius = 8;
      analyticsFrame.itemSpacing = 8;
      analyticsFrame.fills = [{ type: "SOLID", color: { r: 0.957, g: 0.941, b: 1 } }];
      const aLabel = makeText("PRODUCT ANALYTICS", FONT_MEDIUM, 9, DUSTY_GRAPE, 700, 14);
      aLabel.letterSpacing = { value: 4, unit: "PERCENT" };
      analyticsFrame.appendChild(aLabel);
      const badgesRowPA = figma.createFrame();
      badgesRowPA.name = "analytics-badges";
      badgesRowPA.layoutMode = "HORIZONTAL";
      badgesRowPA.primaryAxisSizingMode = "AUTO";
      badgesRowPA.counterAxisSizingMode = "AUTO";
      badgesRowPA.itemSpacing = 8;
      badgesRowPA.fills = [];
      const badgeItems = [];
      if (pa.lifecycle) badgeItems.push({ label: "Lifecycle", value: pa.lifecycle, color: DUSTY_GRAPE });
      if (pa.segment) badgeItems.push({ label: "\u0421\u0435\u0433\u043C\u0435\u043D\u0442", value: pa.segment, color: BARBIE_PINK });
      if (pa.activated !== void 0) badgeItems.push({ label: "\u0410\u043A\u0442\u0438\u0432\u0430\u0446\u0438\u044F", value: pa.activated ? "\u0434\u0430" : "\u043D\u0435\u0442", color: pa.activated ? { r: 0.08, g: 0.68, b: 0.36 } : { r: 0.88, g: 0.24, b: 0.18 } });
      if (pa.engagementLevel) badgeItems.push({ label: "\u0412\u043E\u0432\u043B\u0435\u0447\u0451\u043D\u043D\u043E\u0441\u0442\u044C", value: pa.engagementLevel, color: DUSTY_GRAPE });
      if (pa.adoptionStatus) badgeItems.push({ label: "Adoption", value: pa.adoptionStatus, color: DUSTY_GRAPE });
      for (const bi of badgeItems) {
        const bFrame = figma.createFrame();
        bFrame.name = bi.label;
        bFrame.layoutMode = "HORIZONTAL";
        bFrame.primaryAxisSizingMode = "AUTO";
        bFrame.counterAxisSizingMode = "AUTO";
        bFrame.paddingLeft = 8;
        bFrame.paddingRight = 8;
        bFrame.paddingTop = 3;
        bFrame.paddingBottom = 3;
        bFrame.cornerRadius = 6;
        bFrame.fills = [{ type: "SOLID", color: bi.color, opacity: 0.12 }];
        bFrame.itemSpacing = 4;
        const bLabel = makeText(bi.label + ":", FONT_MEDIUM, 10, bi.color, 200, 14);
        const bValue = makeText(bi.value, FONT_SEMIBOLD, 10, bi.color, 200, 14);
        bFrame.appendChild(bLabel);
        bFrame.appendChild(bValue);
        badgesRowPA.appendChild(bFrame);
      }
      if (badgeItems.length > 0) analyticsFrame.appendChild(badgesRowPA);
      if (pa.segmentReasoning) {
        const segText = makeText("\u0421\u0435\u0433\u043C\u0435\u043D\u0442: " + pa.segmentReasoning, FONT_REGULAR, 11, INK_BLACK, 700, 16);
        analyticsFrame.appendChild(segText);
      }
      if (pa.activationPoint) {
        const apText = makeText(
          "\u0422\u043E\u0447\u043A\u0430 \u0430\u043A\u0442\u0438\u0432\u0430\u0446\u0438\u0438: " + (pa.activationPoint.reached ? "\u0434\u043E\u0441\u0442\u0438\u0433\u043D\u0443\u0442\u0430" : "\u043D\u0435 \u0434\u043E\u0441\u0442\u0438\u0433\u043D\u0443\u0442\u0430") + " \u2014 " + (pa.activationPoint.stageName ? "\u044D\u0442\u0430\u043F \xAB" + pa.activationPoint.stageName + "\xBB" : "") + (pa.activationPoint.description ? ". " + pa.activationPoint.description : ""),
          FONT_REGULAR,
          11,
          INK_BLACK,
          700,
          16
        );
        analyticsFrame.appendChild(apText);
      }
      if (pa.adoptionDetails) {
        const adText = makeText("Adoption: " + pa.adoptionDetails, FONT_REGULAR, 11, INK_BLACK, 700, 16);
        analyticsFrame.appendChild(adText);
      }
      if (pa.productInsights && pa.productInsights.length > 0) {
        const insightsLabel = makeText("PRODUCT INSIGHTS", FONT_MEDIUM, 9, DUSTY_GRAPE, 700, 14);
        insightsLabel.letterSpacing = { value: 4, unit: "PERCENT" };
        analyticsFrame.appendChild(insightsLabel);
        for (const insight of pa.productInsights.slice(0, 5)) {
          const iText = makeText("\u2022 " + insight, FONT_REGULAR, 11, INK_BLACK, 700, 16);
          analyticsFrame.appendChild(iText);
        }
      }
      canvas.appendChild(analyticsFrame);
    }
    const stagesRow = figma.createFrame();
    stagesRow.name = "stages";
    stagesRow.layoutMode = "HORIZONTAL";
    stagesRow.primaryAxisSizingMode = "AUTO";
    stagesRow.counterAxisSizingMode = "AUTO";
    stagesRow.counterAxisAlignItems = "MIN";
    stagesRow.itemSpacing = 24;
    stagesRow.fills = [];
    for (let i = 0; i < data.stages.length; i++) {
      const stage = data.stages[i];
      const mappedNames = config.mapping[stage.name] || [];
      const stageGroup = figma.createFrame();
      stageGroup.name = stage.name;
      stageGroup.layoutMode = "VERTICAL";
      stageGroup.primaryAxisSizingMode = "AUTO";
      stageGroup.counterAxisSizingMode = "AUTO";
      stageGroup.itemSpacing = 12;
      stageGroup.fills = [{ type: "SOLID", color: STAGE_BG }];
      stageGroup.cornerRadius = 12;
      stageGroup.paddingLeft = STAGE_PADDING;
      stageGroup.paddingRight = STAGE_PADDING;
      stageGroup.paddingTop = 16;
      stageGroup.paddingBottom = 16;
      const pillFrame = figma.createFrame();
      pillFrame.name = "stage-number";
      pillFrame.layoutMode = "HORIZONTAL";
      pillFrame.primaryAxisSizingMode = "AUTO";
      pillFrame.counterAxisSizingMode = "AUTO";
      pillFrame.paddingLeft = 8;
      pillFrame.paddingRight = 8;
      pillFrame.paddingTop = 3;
      pillFrame.paddingBottom = 3;
      pillFrame.cornerRadius = 10;
      pillFrame.fills = [{ type: "SOLID", color: BARBIE_PINK }];
      const pillText = figma.createText();
      pillText.fontName = FONT_SEMIBOLD;
      pillText.fontSize = 9;
      pillText.fills = [{ type: "SOLID", color: WHITE }];
      pillText.characters = String(i + 1);
      pillFrame.appendChild(pillText);
      stageGroup.appendChild(pillFrame);
      const stageNameText = makeText(stage.name, FONT_SEMIBOLD, 14, INK_BLACK, 600, 20);
      stageGroup.appendChild(stageNameText);
      if (stage.duration || stage.channel) {
        const badgesRow = figma.createFrame();
        badgesRow.name = "stage-badges";
        badgesRow.layoutMode = "HORIZONTAL";
        badgesRow.primaryAxisSizingMode = "AUTO";
        badgesRow.counterAxisSizingMode = "AUTO";
        badgesRow.itemSpacing = 6;
        badgesRow.fills = [];
        if (stage.duration) {
          const db = figma.createFrame();
          db.name = "duration";
          db.layoutMode = "HORIZONTAL";
          db.primaryAxisSizingMode = "AUTO";
          db.counterAxisSizingMode = "AUTO";
          db.paddingLeft = 6;
          db.paddingRight = 6;
          db.paddingTop = 2;
          db.paddingBottom = 2;
          db.cornerRadius = 6;
          db.fills = [{ type: "SOLID", color: DUSTY_GRAPE, opacity: 0.15 }];
          db.appendChild(makeText(stage.duration, FONT_REGULAR, 10, DUSTY_GRAPE, 100, 14));
          badgesRow.appendChild(db);
        }
        if (stage.channel) {
          const cb = figma.createFrame();
          cb.name = "channel";
          cb.layoutMode = "HORIZONTAL";
          cb.primaryAxisSizingMode = "AUTO";
          cb.counterAxisSizingMode = "AUTO";
          cb.paddingLeft = 6;
          cb.paddingRight = 6;
          cb.paddingTop = 2;
          cb.paddingBottom = 2;
          cb.cornerRadius = 6;
          cb.fills = [{ type: "SOLID", color: BARBIE_PINK, opacity: 0.15 }];
          cb.appendChild(makeText(stage.channel, FONT_REGULAR, 10, BARBIE_PINK, 120, 14));
          badgesRow.appendChild(cb);
        }
        stageGroup.appendChild(badgesRow);
      }
      if (mappedNames.length > 0) {
        const screensRow = figma.createFrame();
        screensRow.name = "screens";
        screensRow.layoutMode = "HORIZONTAL";
        screensRow.primaryAxisSizingMode = "AUTO";
        screensRow.counterAxisSizingMode = "AUTO";
        screensRow.itemSpacing = 12;
        screensRow.fills = [];
        for (const frameName of mappedNames) {
          const candidates = framesByName[frameName];
          if (!candidates || candidates.length === 0) continue;
          const original = candidates[0];
          const screenCol = figma.createFrame();
          screenCol.name = "screen-" + frameName;
          screenCol.layoutMode = "VERTICAL";
          screenCol.primaryAxisSizingMode = "AUTO";
          screenCol.counterAxisSizingMode = "AUTO";
          screenCol.itemSpacing = 6;
          screenCol.fills = [];
          const scale = SCENARIO_SCREEN_HEIGHT / (original.height || 1);
          const newWidth = Math.round(original.width * scale);
          let savedPngBytes = null;
          let screenNode = null;
          try {
            let pngBytes = null;
            try {
              pngBytes = await original.exportAsync({ format: "PNG", constraint: { type: "HEIGHT", value: SCENARIO_SCREEN_HEIGHT } });
            } catch (e) {
              const tmp = original.clone();
              tmp.visible = false;
              figma.currentPage.appendChild(tmp);
              try {
                pngBytes = await tmp.exportAsync({ format: "PNG", constraint: { type: "HEIGHT", value: SCENARIO_SCREEN_HEIGHT } });
              } finally {
                tmp.remove();
              }
            }
            if (!pngBytes) throw new Error("Export returned no PNG bytes");
            savedPngBytes = pngBytes;
            const img = figma.createImage(pngBytes);
            const rect = figma.createRectangle();
            rect.name = frameName;
            rect.resize(newWidth, SCENARIO_SCREEN_HEIGHT);
            rect.fills = [{ type: "IMAGE", imageHash: img.hash, scaleMode: "FILL" }];
            rect.cornerRadius = 8;
            screenNode = rect;
          } catch (e) {
            const clone = original.clone();
            clone.rescale(scale);
            clone.cornerRadius = 8;
            screenNode = clone;
          }
          let visionAnnotations = [];
          if (config.includeVisionAnnotations && config.apiKey && config.transcriptText && config.transcriptText.length > 0 && savedPngBytes && !(config.signal && config.signal.aborted)) {
            try {
              const base64 = uint8ArrayToBase64(savedPngBytes);
              const stageCtx = {
                actions: stage.actions,
                touchpoints: stage.touchpoints,
                thoughts: stage.thoughts,
                experience: stage.experience,
                emotions: stage.emotions,
                quotes: stage.quotes
              };
              figma.notify("[Vision] " + frameName + "...", { timeout: 5e3 });
              visionAnnotations = await analyzeScreenWithVision(
                base64,
                config.transcriptText,
                config.apiKey,
                stage.name,
                frameName,
                config.visionPrompt,
                config.signal,
                stageCtx
              );
              figma.notify("[Vision] " + frameName + " => " + visionAnnotations.length + " \u0430\u043D\u043D\u043E\u0442\u0430\u0446\u0438\u0439", { timeout: 5e3 });
            } catch (err) {
              if (err instanceof Error && err.name === "AbortError") throw err;
              const errMsg = err instanceof Error ? err.message : String(err);
              figma.notify("[Vision ERR] " + frameName + ": " + errMsg.slice(0, 120), { timeout: 1e4, error: true });
              if (!visionErrorMessage) visionErrorMessage = errMsg;
            }
          }
          if (visionAnnotations.length > 0 && screenNode) {
            const sorted = [...visionAnnotations].sort((a, b) => a.y - b.y);
            const cards = [];
            for (const ann of sorted) {
              const cIdx = visionTotalAnnotations % VISION_STICKER_COLORS.length;
              const color = VISION_STICKER_COLORS[cIdx];
              const card = figma.createFrame();
              card.name = "vision: " + ann.tag;
              card.layoutMode = "VERTICAL";
              card.counterAxisSizingMode = "FIXED";
              card.resize(VISION_CARD_W, 10);
              card.primaryAxisSizingMode = "AUTO";
              card.paddingLeft = 8;
              card.paddingRight = 8;
              card.paddingTop = 6;
              card.paddingBottom = 6;
              card.itemSpacing = 2;
              card.cornerRadius = 6;
              card.fills = [{ type: "SOLID", color, opacity: 0.18 }];
              card.appendChild(makeText(ann.tag, FONT_BOLD, 11, color, VISION_CARD_W - 16, 14));
              card.appendChild(makeText(ann.comment, FONT_REGULAR, 10, INK_BLACK, VISION_CARD_W - 16, 14));
              cards.push({ node: card, ann, color });
              visionTotalAnnotations++;
            }
            const pngLeft = VISION_CARD_W + VISION_CARD_GAP;
            const viewW = pngLeft + newWidth;
            let viewH = SCENARIO_SCREEN_HEIGHT;
            let nextMinY = 0;
            for (const c of cards) {
              const idealY = c.ann.y * SCENARIO_SCREEN_HEIGHT - c.node.height / 2;
              const y = Math.max(nextMinY, Math.max(0, idealY));
              c.node.x = 0;
              c.node.y = y;
              nextMinY = y + c.node.height + VISION_CARD_SPACING;
            }
            const lastCard = cards[cards.length - 1];
            const cardsBottom = lastCard.node.y + lastCard.node.height;
            if (cardsBottom > viewH) viewH = Math.ceil(cardsBottom);
            const annotView = figma.createFrame();
            annotView.name = "annotated-" + frameName;
            annotView.resize(viewW, viewH);
            annotView.fills = [];
            annotView.clipsContent = false;
            screenNode.x = pngLeft;
            screenNode.y = 0;
            annotView.appendChild(screenNode);
            for (const c of cards) {
              annotView.appendChild(c.node);
              const cardCenterY = c.node.y + c.node.height / 2;
              const targetX = pngLeft + c.ann.x * newWidth;
              const targetY = c.ann.y * SCENARIO_SCREEN_HEIGHT;
              drawConnector(annotView, VISION_CARD_W + 2, cardCenterY, targetX, targetY, c.color, 0.5);
              const dot = figma.createEllipse();
              dot.name = "dot";
              dot.resize(VISION_DOT_R * 2, VISION_DOT_R * 2);
              dot.x = targetX - VISION_DOT_R;
              dot.y = targetY - VISION_DOT_R;
              dot.fills = [{ type: "SOLID", color: c.color }];
              annotView.appendChild(dot);
            }
            screenCol.appendChild(annotView);
          } else if (screenNode) {
            screenCol.appendChild(screenNode);
          }
          const screenLabel = makeText(frameName, FONT_MEDIUM, 10, DUSTY_GRAPE, newWidth, 14);
          screenCol.appendChild(screenLabel);
          if (config.screenAnnotations && config.screenAnnotations[frameName]) {
            const annText = makeText(config.screenAnnotations[frameName], FONT_REGULAR, 10, INK_BLACK, newWidth, 14);
            screenCol.appendChild(annText);
          }
          screensRow.appendChild(screenCol);
        }
        stageGroup.appendChild(screensRow);
      }
      const divider = figma.createRectangle();
      divider.name = "divider";
      divider.resize(200, 1);
      divider.fills = [{ type: "SOLID", color: PERIWINKLE }];
      stageGroup.appendChild(divider);
      const sections = [
        { key: "actions", label: "\u0414\u0435\u0439\u0441\u0442\u0432\u0438\u044F", items: (_a = stage.actions) != null ? _a : [] },
        { key: "touchpoints", label: "Touchpoints", items: (_b = stage.touchpoints) != null ? _b : [] },
        { key: "experience", label: "\u041E\u043F\u044B\u0442", items: (_c = stage.experience) != null ? _c : [] },
        { key: "thoughts", label: "\u041C\u044B\u0441\u043B\u0438", items: (_d = stage.thoughts) != null ? _d : [] },
        { key: "emotions", label: "\u042D\u043C\u043E\u0446\u0438\u0438", items: (_e = stage.emotions) != null ? _e : [] },
        { key: "quotes", label: "\u0426\u0438\u0442\u0430\u0442\u044B", items: (_f = stage.quotes) != null ? _f : [] },
        { key: "metrics", label: "\u041C\u0435\u0442\u0440\u0438\u043A\u0438", items: (_g = stage.metrics) != null ? _g : [] },
        { key: "hypotheses", label: "\u0413\u0438\u043F\u043E\u0442\u0435\u0437\u044B", items: (_h = stage.hypotheses) != null ? _h : [] }
      ];
      for (const { key, label, items } of sections) {
        if (items.length === 0) continue;
        const formatItem = key === "quotes" ? (s) => "\xAB" + s + "\xBB" : void 0;
        const card = await createCard(label, items, (_i = CARD_COLORS[key]) != null ? _i : CARD_COLORS.actions, formatItem);
        stageGroup.appendChild(card);
      }
      stagesRow.appendChild(stageGroup);
    }
    canvas.appendChild(stagesRow);
    if (config.includeVisionAnnotations) {
      if (visionErrorMessage) {
        figma.notify("Vision: " + visionErrorMessage, { error: true });
      } else if (visionTotalAnnotations > 0) {
        figma.notify("Vision: " + visionTotalAnnotations + " \u0430\u043D\u043D\u043E\u0442\u0430\u0446\u0438\u0439 \u0441\u043E\u0437\u0434\u0430\u043D\u043E");
      } else {
        figma.notify("Vision-\u0430\u043D\u043D\u043E\u0442\u0430\u0446\u0438\u0438 \u043D\u0435 \u043D\u0430\u0439\u0434\u0435\u043D\u044B \u043F\u043E \u0442\u0440\u0430\u043D\u0441\u043A\u0440\u0438\u043F\u0442\u0443 \u0434\u043B\u044F \u0432\u044B\u0431\u0440\u0430\u043D\u043D\u044B\u0445 \u044D\u043A\u0440\u0430\u043D\u043E\u0432.");
      }
    }
    figma.currentPage.appendChild(canvas);
    figma.viewport.scrollAndZoomIntoView([canvas]);
    figma.currentPage.selection = [canvas];
    return canvas;
  }

  // src/code.ts
  if (typeof globalThis.AbortController === "undefined") {
    globalThis.AbortController = class AbortController {
      constructor() {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        this.signal = {
          aborted: false,
          addEventListener() {
          },
          removeEventListener() {
          },
          dispatchEvent() {
            return false;
          }
        };
      }
      abort() {
        this.signal.aborted = true;
      }
    };
  }
  function extractSpreadsheetId(url) {
    const m = url.match(/\/d\/([a-zA-Z0-9_-]+)/);
    return m ? m[1] : null;
  }
  async function fetchGoogleSheetsRows(spreadsheetId) {
    var _a, _b;
    const gvizUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/gviz/tq?tqx=out:json&gid=0`;
    const res = await fetch(gvizUrl);
    if (!res.ok) {
      throw new Error(`Google Sheets: ${res.status}`);
    }
    const text = await res.text();
    const setResponseStart = text.indexOf("setResponse(");
    if (setResponseStart === -1) {
      throw new Error("\u041D\u0435\u0432\u0435\u0440\u043D\u044B\u0439 \u0444\u043E\u0440\u043C\u0430\u0442 \u043E\u0442\u0432\u0435\u0442\u0430 Google Sheets");
    }
    let i = text.indexOf("{", setResponseStart);
    if (i === -1) throw new Error("\u041D\u0435\u0432\u0435\u0440\u043D\u044B\u0439 \u0444\u043E\u0440\u043C\u0430\u0442 \u043E\u0442\u0432\u0435\u0442\u0430 Google Sheets");
    let depth = 0;
    const jsonStart = i;
    while (i < text.length) {
      const ch = text[i];
      if (ch === "{") depth++;
      else if (ch === "}") depth--;
      i++;
      if (depth === 0) break;
    }
    const jsonStr = text.slice(jsonStart, i);
    const data = JSON.parse(jsonStr);
    const rows = (_b = (_a = data.table) == null ? void 0 : _a.rows) != null ? _b : [];
    return rows.map(
      (row) => {
        var _a2;
        return ((_a2 = row.c) != null ? _a2 : []).map(
          (cell) => cell && cell.v != null ? String(cell.v) : ""
        );
      }
    );
  }
  var currentAbortController = null;
  async function renderWithScreens(cjm, framesConfig, apiKey, screenMatchEnabled, screenMatchPrompt, visionEnabled, visionPromptStr, transcriptText, notifyUI, signal) {
    if (screenMatchEnabled && framesConfig && framesConfig.mode === "png") {
      notifyUI("AI-\u0441\u043E\u043F\u043E\u0441\u0442\u0430\u0432\u043B\u0435\u043D\u0438\u0435 \u044D\u043A\u0440\u0430\u043D\u043E\u0432 \u0441 \u044D\u0442\u0430\u043F\u0430\u043C\u0438...");
      const matchResult = await matchScreensToStages(
        cjm.stages.map((s) => s.name),
        framesConfig.frames.map((f) => f.name || "\u0424\u0440\u0435\u0439\u043C"),
        apiKey,
        screenMatchPrompt,
        signal
      );
      if (Object.keys(matchResult.mapping).length > 0) {
        if (visionEnabled) notifyUI("Vision-\u0430\u043D\u0430\u043B\u0438\u0437 \u044D\u043A\u0440\u0430\u043D\u043E\u0432...");
        await renderScreenScenario(cjm, {
          frames: framesConfig.frames,
          mapping: matchResult.mapping,
          screenAnnotations: matchResult.screenAnnotations,
          includeVisionAnnotations: visionEnabled,
          visionPrompt: visionPromptStr,
          apiKey,
          transcriptText,
          signal
        });
        return;
      }
    }
    await renderCJM(cjm, framesConfig);
  }
  function getFramesConfig(screensSource, screensMode) {
    if (!screensSource || screensSource === "none") return void 0;
    const src = screensSource === "selection" || screensSource === "section" || screensSource === "page" ? screensSource : null;
    if (!src) return void 0;
    const frames = collectFrames(src);
    if (frames.length === 0) return void 0;
    const mode = screensMode === "png" ? "png" : "links";
    return { frames, mode };
  }
  figma.showUI(__html__, { width: 420, height: 580, themeColors: true });
  async function restoreSettings() {
    const key = await figma.clientStorage.getAsync("openai_key");
    const transcriptPrompt = await figma.clientStorage.getAsync("prompt_transcript");
    const tablePrompt = await figma.clientStorage.getAsync("prompt_table");
    const includeDuration = await figma.clientStorage.getAsync("options_include_duration");
    const includeChannels = await figma.clientStorage.getAsync("options_include_channels");
    const jobStoryPrompt = await figma.clientStorage.getAsync("prompt_jobstory");
    const aggregatePrompt = await figma.clientStorage.getAsync("prompt_aggregate");
    const includeLifecycle = await figma.clientStorage.getAsync("options_include_lifecycle");
    const includeActivation = await figma.clientStorage.getAsync("options_include_activation");
    const includeProductMetrics = await figma.clientStorage.getAsync("options_include_product_metrics");
    const lifecyclePrompt = await figma.clientStorage.getAsync("prompt_lifecycle");
    const activationPrompt = await figma.clientStorage.getAsync("prompt_activation");
    const productMetricsPrompt = await figma.clientStorage.getAsync("prompt_product_metrics");
    const includeScreenMatching = await figma.clientStorage.getAsync("options_include_screen_matching");
    const screenMatchingPrompt = await figma.clientStorage.getAsync("prompt_screen_matching");
    const includeVisionAnnotations = await figma.clientStorage.getAsync("options_include_vision_annotations");
    const visionPrompt = await figma.clientStorage.getAsync("prompt_vision_annotations");
    figma.ui.postMessage({
      type: "settingsRestored",
      apiKey: key || "",
      transcriptPrompt: transcriptPrompt || DEFAULT_TRANSCRIPT_PROMPT,
      tablePrompt: tablePrompt || DEFAULT_TABLE_PROMPT,
      jobStoryPrompt: jobStoryPrompt || DEFAULT_JOBSTORY_PROMPT,
      aggregatePrompt: aggregatePrompt || DEFAULT_AGGREGATE_PROMPT,
      includeDuration: includeDuration === true,
      includeChannels: includeChannels === true,
      includeLifecycle: includeLifecycle === true,
      includeActivation: includeActivation === true,
      includeProductMetrics: includeProductMetrics === true,
      lifecyclePrompt: lifecyclePrompt || DEFAULT_LIFECYCLE_PROMPT,
      activationPrompt: activationPrompt || DEFAULT_ACTIVATION_PROMPT,
      productMetricsPrompt: productMetricsPrompt || DEFAULT_PRODUCT_METRICS_PROMPT,
      includeScreenMatching: includeScreenMatching === true,
      screenMatchingPrompt: screenMatchingPrompt || DEFAULT_SCREEN_MATCHING_PROMPT,
      includeVisionAnnotations: includeVisionAnnotations === true,
      visionPrompt: visionPrompt || DEFAULT_SCREEN_VISION_PROMPT
    });
  }
  restoreSettings();
  figma.ui.onmessage = async (msg) => {
    var _a, _b, _c, _d, _e, _f, _g, _h, _i, _j, _k, _l, _m, _n, _o, _p, _q, _r, _s, _t, _u, _v, _w, _x, _y, _z, _A, _B, _C, _D, _E, _F, _G, _H, _I, _J, _K, _L, _M, _N, _O, _P, _Q, _R, _S, _T, _U, _V, _W, _X, _Y, _Z, __, _$, _aa, _ba, _ca, _da, _ea, _fa;
    const notifyUI = (text, isError) => {
      figma.ui.postMessage({ type: "status", text, isError });
    };
    const done = (success, error) => {
      currentAbortController = null;
      figma.ui.postMessage({ type: "done", success, error });
    };
    if (msg.type === "cancel") {
      currentAbortController == null ? void 0 : currentAbortController.abort();
      currentAbortController = null;
      figma.ui.postMessage({ type: "done", success: false, error: "\u0413\u0435\u043D\u0435\u0440\u0430\u0446\u0438\u044F \u043E\u0442\u043C\u0435\u043D\u0435\u043D\u0430" });
      return;
    }
    try {
      if (msg.type === "savePrompts") {
        if (msg.transcriptPrompt !== void 0) {
          await figma.clientStorage.setAsync("prompt_transcript", msg.transcriptPrompt);
        }
        if (msg.tablePrompt !== void 0) {
          await figma.clientStorage.setAsync("prompt_table", msg.tablePrompt);
        }
        if (msg.includeDuration !== void 0) {
          await figma.clientStorage.setAsync("options_include_duration", msg.includeDuration);
        }
        if (msg.includeChannels !== void 0) {
          await figma.clientStorage.setAsync("options_include_channels", msg.includeChannels);
        }
        if (msg.jobStoryPrompt !== void 0) {
          await figma.clientStorage.setAsync("prompt_jobstory", msg.jobStoryPrompt);
        }
        if (msg.aggregatePrompt !== void 0) {
          await figma.clientStorage.setAsync("prompt_aggregate", msg.aggregatePrompt);
        }
        if (msg.includeLifecycle !== void 0) {
          await figma.clientStorage.setAsync("options_include_lifecycle", msg.includeLifecycle);
        }
        if (msg.includeActivation !== void 0) {
          await figma.clientStorage.setAsync("options_include_activation", msg.includeActivation);
        }
        if (msg.includeProductMetrics !== void 0) {
          await figma.clientStorage.setAsync("options_include_product_metrics", msg.includeProductMetrics);
        }
        if (msg.lifecyclePrompt !== void 0) {
          await figma.clientStorage.setAsync("prompt_lifecycle", msg.lifecyclePrompt);
        }
        if (msg.activationPrompt !== void 0) {
          await figma.clientStorage.setAsync("prompt_activation", msg.activationPrompt);
        }
        if (msg.productMetricsPrompt !== void 0) {
          await figma.clientStorage.setAsync("prompt_product_metrics", msg.productMetricsPrompt);
        }
        if (msg.includeScreenMatching !== void 0) {
          await figma.clientStorage.setAsync("options_include_screen_matching", msg.includeScreenMatching);
        }
        if (msg.screenMatchingPrompt !== void 0) {
          await figma.clientStorage.setAsync("prompt_screen_matching", msg.screenMatchingPrompt);
        }
        if (msg.includeVisionAnnotations !== void 0) {
          await figma.clientStorage.setAsync("options_include_vision_annotations", msg.includeVisionAnnotations);
        }
        if (msg.visionPrompt !== void 0) {
          await figma.clientStorage.setAsync("prompt_vision_annotations", msg.visionPrompt);
        }
        done(true);
        return;
      }
      const storedTranscriptPrompt = msg.transcriptPrompt || await figma.clientStorage.getAsync("prompt_transcript") || void 0;
      const storedTablePrompt = msg.tablePrompt || await figma.clientStorage.getAsync("prompt_table") || void 0;
      if (msg.type === "excel") {
        currentAbortController = new AbortController();
        const signal = currentAbortController.signal;
        const rows = (_a = msg.rows) != null ? _a : [];
        const useAI = msg.useAI === true;
        if (useAI) {
          const apiKey = (_b = msg.apiKey) != null ? _b : await figma.clientStorage.getAsync("openai_key");
          if (!apiKey) {
            done(false, "\u0412\u0432\u0435\u0434\u0438\u0442\u0435 OpenAI API \u043A\u043B\u044E\u0447 \u0434\u043B\u044F AI-\u0438\u043D\u0442\u0435\u0440\u043F\u0440\u0435\u0442\u0430\u0446\u0438\u0438");
            return;
          }
          if (msg.apiKey) {
            await figma.clientStorage.setAsync("openai_key", msg.apiKey);
          }
          notifyUI("\u0410\u043D\u0430\u043B\u0438\u0437 \u0442\u0430\u0431\u043B\u0438\u0446\u044B \u0447\u0435\u0440\u0435\u0437 AI...");
          const cjm = await tableToCJM(rows, apiKey, void 0, storedTablePrompt, signal);
          if (!cjm.stages.length) {
            done(false, "AI \u043D\u0435 \u0441\u043C\u043E\u0433 \u0438\u0437\u0432\u043B\u0435\u0447\u044C \u044D\u0442\u0430\u043F\u044B \u0438\u0437 \u0442\u0430\u0431\u043B\u0438\u0446\u044B");
            return;
          }
          notifyUI("\u0421\u043E\u0437\u0434\u0430\u043D\u0438\u0435 CJM...");
          const framesConfig = getFramesConfig(msg.screensSource, msg.screensMode);
          const screenMatchEnabled = (_c = msg.includeScreenMatching) != null ? _c : await figma.clientStorage.getAsync("options_include_screen_matching") === true;
          const screenMatchPrompt = (_e = (_d = msg.screenMatchingPrompt) != null ? _d : await figma.clientStorage.getAsync("prompt_screen_matching")) != null ? _e : void 0;
          const visionEnabled = (_f = msg.includeVisionAnnotations) != null ? _f : await figma.clientStorage.getAsync("options_include_vision_annotations") === true;
          const visionPromptStr = (_h = (_g = msg.visionPrompt) != null ? _g : await figma.clientStorage.getAsync("prompt_vision_annotations")) != null ? _h : void 0;
          await renderWithScreens(cjm, framesConfig, apiKey, screenMatchEnabled, screenMatchPrompt, visionEnabled, visionPromptStr, "", notifyUI, signal);
        } else {
          notifyUI("\u041F\u0430\u0440\u0441\u0438\u043D\u0433 \u0442\u0430\u0431\u043B\u0438\u0446\u044B...");
          const cjm = parseExcelToCJM(rows);
          if (!cjm.stages.length) {
            done(false, "\u041D\u0435 \u0443\u0434\u0430\u043B\u043E\u0441\u044C \u043E\u043F\u0440\u0435\u0434\u0435\u043B\u0438\u0442\u044C \u044D\u0442\u0430\u043F\u044B CJM. \u041F\u0440\u043E\u0432\u0435\u0440\u044C\u0442\u0435 \u0444\u043E\u0440\u043C\u0430\u0442 \u0444\u0430\u0439\u043B\u0430.");
            return;
          }
          notifyUI("\u0421\u043E\u0437\u0434\u0430\u043D\u0438\u0435 CJM...");
          const framesConfigNoAI = getFramesConfig(msg.screensSource, msg.screensMode);
          await renderCJM(cjm, framesConfigNoAI);
        }
        figma.notify("CJM \u0441\u043E\u0437\u0434\u0430\u043D");
        done(true);
      } else if (msg.type === "googleSheets") {
        currentAbortController = new AbortController();
        const signal = currentAbortController.signal;
        const url = (_i = msg.url) != null ? _i : "";
        const apiKey = (_j = msg.apiKey) != null ? _j : await figma.clientStorage.getAsync("openai_key");
        if (!apiKey) {
          done(false, "\u0412\u0432\u0435\u0434\u0438\u0442\u0435 OpenAI API \u043A\u043B\u044E\u0447");
          return;
        }
        if (msg.apiKey) {
          await figma.clientStorage.setAsync("openai_key", msg.apiKey);
        }
        const id = extractSpreadsheetId(url);
        if (!id) {
          done(false, "\u041D\u0435\u0432\u0435\u0440\u043D\u044B\u0439 URL Google \u0422\u0430\u0431\u043B\u0438\u0446\u044B");
          return;
        }
        notifyUI("\u0417\u0430\u0433\u0440\u0443\u0437\u043A\u0430 \u0438\u0437 Google Sheets...");
        const rows = await fetchGoogleSheetsRows(id);
        if (!rows.length) {
          done(false, "\u0422\u0430\u0431\u043B\u0438\u0446\u0430 \u043F\u0443\u0441\u0442\u0430 \u0438\u043B\u0438 \u043D\u0435\u0434\u043E\u0441\u0442\u0443\u043F\u043D\u0430");
          return;
        }
        notifyUI("\u0410\u043D\u0430\u043B\u0438\u0437 \u0442\u0430\u0431\u043B\u0438\u0446\u044B \u0447\u0435\u0440\u0435\u0437 AI...");
        const cjm = await tableToCJM(rows, apiKey, `Google \u0422\u0430\u0431\u043B\u0438\u0446\u044B (ID: ${id})`, storedTablePrompt, signal);
        if (!cjm.stages.length) {
          done(false, "AI \u043D\u0435 \u0441\u043C\u043E\u0433 \u0438\u0437\u0432\u043B\u0435\u0447\u044C \u044D\u0442\u0430\u043F\u044B \u0438\u0437 \u0442\u0430\u0431\u043B\u0438\u0446\u044B");
          return;
        }
        notifyUI("\u0421\u043E\u0437\u0434\u0430\u043D\u0438\u0435 CJM...");
        const framesConfigSheets = getFramesConfig(msg.screensSource, msg.screensMode);
        const sheetsScreenMatchEnabled = (_k = msg.includeScreenMatching) != null ? _k : await figma.clientStorage.getAsync("options_include_screen_matching") === true;
        const sheetsScreenMatchPrompt = (_m = (_l = msg.screenMatchingPrompt) != null ? _l : await figma.clientStorage.getAsync("prompt_screen_matching")) != null ? _m : void 0;
        const sheetsVisionEnabled = (_n = msg.includeVisionAnnotations) != null ? _n : await figma.clientStorage.getAsync("options_include_vision_annotations") === true;
        const sheetsVisionPrompt = (_p = (_o = msg.visionPrompt) != null ? _o : await figma.clientStorage.getAsync("prompt_vision_annotations")) != null ? _p : void 0;
        await renderWithScreens(cjm, framesConfigSheets, apiKey, sheetsScreenMatchEnabled, sheetsScreenMatchPrompt, sheetsVisionEnabled, sheetsVisionPrompt, "", notifyUI, signal);
        figma.notify("CJM \u0441\u043E\u0437\u0434\u0430\u043D");
        done(true);
      } else if (msg.type === "transcript") {
        currentAbortController = new AbortController();
        const signal = currentAbortController.signal;
        const text = (_q = msg.text) != null ? _q : "";
        const apiKey = (_r = msg.apiKey) != null ? _r : await figma.clientStorage.getAsync("openai_key");
        if (!apiKey) {
          done(false, "\u0412\u0432\u0435\u0434\u0438\u0442\u0435 OpenAI API \u043A\u043B\u044E\u0447");
          return;
        }
        if (msg.apiKey) {
          await figma.clientStorage.setAsync("openai_key", msg.apiKey);
        }
        const transcriptOptions = {
          includeDuration: (_s = msg.includeDuration) != null ? _s : await figma.clientStorage.getAsync("options_include_duration") === true,
          includeChannels: (_t = msg.includeChannels) != null ? _t : await figma.clientStorage.getAsync("options_include_channels") === true,
          includeLifecycle: (_u = msg.includeLifecycle) != null ? _u : await figma.clientStorage.getAsync("options_include_lifecycle") === true,
          includeActivation: (_v = msg.includeActivation) != null ? _v : await figma.clientStorage.getAsync("options_include_activation") === true,
          includeProductMetrics: (_w = msg.includeProductMetrics) != null ? _w : await figma.clientStorage.getAsync("options_include_product_metrics") === true
        };
        const storedJobStoryPrompt = (_y = (_x = msg.jobStoryPrompt) != null ? _x : await figma.clientStorage.getAsync("prompt_jobstory")) != null ? _y : DEFAULT_JOBSTORY_PROMPT;
        const analyticsPrompts = {
          lifecyclePrompt: (_A = (_z = msg.lifecyclePrompt) != null ? _z : await figma.clientStorage.getAsync("prompt_lifecycle")) != null ? _A : DEFAULT_LIFECYCLE_PROMPT,
          activationPrompt: (_C = (_B = msg.activationPrompt) != null ? _B : await figma.clientStorage.getAsync("prompt_activation")) != null ? _C : DEFAULT_ACTIVATION_PROMPT,
          productMetricsPrompt: (_E = (_D = msg.productMetricsPrompt) != null ? _D : await figma.clientStorage.getAsync("prompt_product_metrics")) != null ? _E : DEFAULT_PRODUCT_METRICS_PROMPT
        };
        notifyUI("\u0410\u043D\u0430\u043B\u0438\u0437 \u0442\u0440\u0430\u043D\u0441\u043A\u0440\u0438\u043F\u0442\u0430 \u0447\u0435\u0440\u0435\u0437 AI...");
        const cjm = await transcriptToCJM(text, apiKey, storedTranscriptPrompt, transcriptOptions, storedJobStoryPrompt, analyticsPrompts, signal);
        if (!cjm.stages.length) {
          done(false, "AI \u043D\u0435 \u0441\u043C\u043E\u0433 \u0438\u0437\u0432\u043B\u0435\u0447\u044C \u044D\u0442\u0430\u043F\u044B \u0438\u0437 \u0442\u0440\u0430\u043D\u0441\u043A\u0440\u0438\u043F\u0442\u0430");
          return;
        }
        notifyUI("\u0421\u043E\u0437\u0434\u0430\u043D\u0438\u0435 CJM...");
        const framesConfigTranscript = getFramesConfig(msg.screensSource, msg.screensMode);
        const trScreenMatchEnabled = (_F = msg.includeScreenMatching) != null ? _F : await figma.clientStorage.getAsync("options_include_screen_matching") === true;
        const trScreenMatchPrompt = (_H = (_G = msg.screenMatchingPrompt) != null ? _G : await figma.clientStorage.getAsync("prompt_screen_matching")) != null ? _H : void 0;
        const trVisionEnabled = (_I = msg.includeVisionAnnotations) != null ? _I : await figma.clientStorage.getAsync("options_include_vision_annotations") === true;
        const trVisionPrompt = (_K = (_J = msg.visionPrompt) != null ? _J : await figma.clientStorage.getAsync("prompt_vision_annotations")) != null ? _K : void 0;
        await renderWithScreens(cjm, framesConfigTranscript, apiKey, trScreenMatchEnabled, trScreenMatchPrompt, trVisionEnabled, trVisionPrompt, text, notifyUI, signal);
        figma.notify("CJM \u0441\u043E\u0437\u0434\u0430\u043D");
        done(true);
      } else if (msg.type === "aggregateTranscripts") {
        currentAbortController = new AbortController();
        const signal = currentAbortController.signal;
        const texts = (_L = msg.texts) != null ? _L : [];
        const apiKey = (_M = msg.apiKey) != null ? _M : await figma.clientStorage.getAsync("openai_key");
        if (!apiKey) {
          done(false, "\u0412\u0432\u0435\u0434\u0438\u0442\u0435 OpenAI API \u043A\u043B\u044E\u0447");
          return;
        }
        if (msg.apiKey) {
          await figma.clientStorage.setAsync("openai_key", msg.apiKey);
        }
        const transcriptOptions = {
          includeDuration: (_N = msg.includeDuration) != null ? _N : await figma.clientStorage.getAsync("options_include_duration") === true,
          includeChannels: (_O = msg.includeChannels) != null ? _O : await figma.clientStorage.getAsync("options_include_channels") === true,
          includeLifecycle: (_P = msg.includeLifecycle) != null ? _P : await figma.clientStorage.getAsync("options_include_lifecycle") === true,
          includeActivation: (_Q = msg.includeActivation) != null ? _Q : await figma.clientStorage.getAsync("options_include_activation") === true,
          includeProductMetrics: (_R = msg.includeProductMetrics) != null ? _R : await figma.clientStorage.getAsync("options_include_product_metrics") === true
        };
        const storedJobStoryPrompt = (_T = (_S = msg.jobStoryPrompt) != null ? _S : await figma.clientStorage.getAsync("prompt_jobstory")) != null ? _T : DEFAULT_JOBSTORY_PROMPT;
        const storedAggregatePrompt = (_V = (_U = msg.aggregatePrompt) != null ? _U : await figma.clientStorage.getAsync("prompt_aggregate")) != null ? _V : DEFAULT_AGGREGATE_PROMPT;
        const analyticsPromptsAgg = {
          lifecyclePrompt: (_X = (_W = msg.lifecyclePrompt) != null ? _W : await figma.clientStorage.getAsync("prompt_lifecycle")) != null ? _X : DEFAULT_LIFECYCLE_PROMPT,
          activationPrompt: (_Z = (_Y = msg.activationPrompt) != null ? _Y : await figma.clientStorage.getAsync("prompt_activation")) != null ? _Z : DEFAULT_ACTIVATION_PROMPT,
          productMetricsPrompt: (_$ = (__ = msg.productMetricsPrompt) != null ? __ : await figma.clientStorage.getAsync("prompt_product_metrics")) != null ? _$ : DEFAULT_PRODUCT_METRICS_PROMPT
        };
        notifyUI("\u0410\u0433\u0440\u0435\u0433\u0430\u0446\u0438\u044F \u0442\u0440\u0430\u043D\u0441\u043A\u0440\u0438\u043F\u0442\u043E\u0432 \u0447\u0435\u0440\u0435\u0437 AI...");
        const cjm = await aggregateTranscriptsToCJM(texts, apiKey, storedAggregatePrompt, transcriptOptions, storedJobStoryPrompt, analyticsPromptsAgg, signal);
        if (!cjm.stages.length) {
          done(false, "AI \u043D\u0435 \u0441\u043C\u043E\u0433 \u0430\u0433\u0440\u0435\u0433\u0438\u0440\u043E\u0432\u0430\u0442\u044C \u044D\u0442\u0430\u043F\u044B \u0438\u0437 \u0442\u0440\u0430\u043D\u0441\u043A\u0440\u0438\u043F\u0442\u043E\u0432");
          return;
        }
        notifyUI("\u0421\u043E\u0437\u0434\u0430\u043D\u0438\u0435 CJM...");
        const framesConfigAgg = getFramesConfig(msg.screensSource, msg.screensMode);
        const aggScreenMatchEnabled = (_aa = msg.includeScreenMatching) != null ? _aa : await figma.clientStorage.getAsync("options_include_screen_matching") === true;
        const aggScreenMatchPrompt = (_ca = (_ba = msg.screenMatchingPrompt) != null ? _ba : await figma.clientStorage.getAsync("prompt_screen_matching")) != null ? _ca : void 0;
        const aggVisionEnabled = (_da = msg.includeVisionAnnotations) != null ? _da : await figma.clientStorage.getAsync("options_include_vision_annotations") === true;
        const aggVisionPrompt = (_fa = (_ea = msg.visionPrompt) != null ? _ea : await figma.clientStorage.getAsync("prompt_vision_annotations")) != null ? _fa : void 0;
        await renderWithScreens(cjm, framesConfigAgg, apiKey, aggScreenMatchEnabled, aggScreenMatchPrompt, aggVisionEnabled, aggVisionPrompt, texts.join("\n--- \u0418\u041D\u0422\u0415\u0420\u0412\u042C\u042E ---\n"), notifyUI, signal);
        figma.notify("CJM \u0441\u043E\u0437\u0434\u0430\u043D");
        done(true);
      }
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        currentAbortController = null;
        figma.ui.postMessage({ type: "done", success: false, error: "\u0413\u0435\u043D\u0435\u0440\u0430\u0446\u0438\u044F \u043E\u0442\u043C\u0435\u043D\u0435\u043D\u0430" });
        return;
      }
      const message = err instanceof Error ? err.message : String(err);
      figma.notify("\u041E\u0448\u0438\u0431\u043A\u0430: " + message, { error: true });
      done(false, message);
    }
  };
})();
