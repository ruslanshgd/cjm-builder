import type { CJMData, CJMStage } from "./cjm-types";

type Row = (string | number | undefined)[];

/**
 * Parse raw sheet rows into CJM structure.
 * Supports:
 * - Variant A: first row = stage names, cells below = actions per stage
 * - Variant B: first column = stages, other columns = actions/thoughts/etc
 */
export function parseExcelToCJM(rows: Row[]): CJMData {
  if (!rows || rows.length === 0) {
    return { stages: [] };
  }

  const trimmed = rows.map((r) =>
    (Array.isArray(r) ? r : []).map((c) =>
      String(c ?? "").trim()
    )
  ).filter((r) => r.some((c) => c.length > 0));

  if (trimmed.length === 0) return { stages: [] };

  const tryVariantA = (): CJMData | null => {
    const header = trimmed[0].filter((c) => c.length > 0);
    if (header.length < 2) return null;

    const avgLen = header.reduce((s, c) => s + c.length, 0) / header.length;
    if (avgLen > 40) return null;

    const stages: CJMStage[] = header.map((name) => ({
      name: name || "Этап",
      actions: [],
      touchpoints: [],
      experience: [],
      thoughts: [],
      emotions: [],
      quotes: [],
      illustrations: [],
      metrics: [],
      hypotheses: [],
    }));

    for (let i = 1; i < trimmed.length; i++) {
      const row = trimmed[i];
      for (let col = 0; col < Math.min(stages.length, row.length); col++) {
        const val = String(row[col] ?? "").trim();
        if (val) stages[col].actions.push(val);
      }
    }

    return { stages };
  };

  const tryVariantB = (): CJMData | null => {
    const stages: CJMStage[] = [];
    let currentStage: CJMStage | null = null;
    const headerWords = /^(этап|stage|стадия|фаза|колонка|column)$/i;

    for (const row of trimmed) {
      const first = String(row[0] ?? "").trim();
      if (!first) continue;
      if (headerWords.test(first) && stages.length === 0) continue;

      const looksLikeStage =
        first.length <= 50 &&
        !/^(действие|action|мысль|thought|эмоция|emotion|touchpoint|опыт|experience|метрика|hypothesis|гипотеза)/i.test(first);

      if (looksLikeStage && (stages.length === 0 || row[0] !== stages[stages.length - 1]?.name)) {
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
          hypotheses: [],
        };
        stages.push(currentStage);
      } else if (currentStage) {
        const val = first;
        const rest = row.slice(1).map((c) => String(c ?? "").trim()).filter(Boolean);

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
        rest.forEach((r) => currentStage!.actions.push(r));
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
  return result ?? { stages: [] };
}
