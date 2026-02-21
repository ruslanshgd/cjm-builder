/// <reference types="@figma/plugin-typings" />

// Polyfill AbortController — not available in Figma plugin sandbox
// eslint-disable-next-line @typescript-eslint/no-explicit-any
if (typeof (globalThis as any).AbortController === "undefined") {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (globalThis as any).AbortController = class AbortController {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    signal: any = {
      aborted: false,
      addEventListener() {},
      removeEventListener() {},
      dispatchEvent() { return false; },
    };
    abort() { this.signal.aborted = true; }
  };
}

import { parseExcelToCJM } from "./lib/excel-parser";
import { transcriptToCJM, aggregateTranscriptsToCJM, tableToCJM, matchScreensToStages, DEFAULT_TRANSCRIPT_PROMPT, DEFAULT_TABLE_PROMPT, DEFAULT_JOBSTORY_PROMPT, DEFAULT_AGGREGATE_PROMPT, DEFAULT_LIFECYCLE_PROMPT, DEFAULT_ACTIVATION_PROMPT, DEFAULT_PRODUCT_METRICS_PROMPT, DEFAULT_SCREEN_MATCHING_PROMPT, DEFAULT_SCREEN_VISION_PROMPT, type AnalyticsPrompts } from "./lib/openai-client";
import { renderCJM, collectFrames, renderScreenScenario, type FramesSource, type ScreensMode, type FramesConfig } from "./lib/cjm-renderer";

type Row = (string | number | undefined)[];

function extractSpreadsheetId(url: string): string | null {
  const m = url.match(/\/d\/([a-zA-Z0-9_-]+)/);
  return m ? m[1] : null;
}

async function fetchGoogleSheetsRows(spreadsheetId: string): Promise<Row[]> {
  const gvizUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/gviz/tq?tqx=out:json&gid=0`;
  const res = await fetch(gvizUrl);
  if (!res.ok) {
    throw new Error(`Google Sheets: ${res.status}`);
  }
  const text = await res.text();
  const setResponseStart = text.indexOf("setResponse(");
  if (setResponseStart === -1) {
    throw new Error("Неверный формат ответа Google Sheets");
  }
  let i = text.indexOf("{", setResponseStart);
  if (i === -1) throw new Error("Неверный формат ответа Google Sheets");
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
  const data = JSON.parse(jsonStr) as {
    table?: { rows?: Array<{ c?: Array<{ v?: unknown } | null> }> };
  };
  const rows = data.table?.rows ?? [];
  return rows.map((row) =>
    (row.c ?? []).map((cell) =>
      cell && cell.v != null ? String(cell.v) : ""
    )
  );
}

let currentAbortController: AbortController | null = null;

async function renderWithScreens(
  cjm: Parameters<typeof renderCJM>[0],
  framesConfig: FramesConfig | undefined,
  apiKey: string,
  screenMatchEnabled: boolean,
  screenMatchPrompt: string | undefined,
  visionEnabled: boolean,
  visionPromptStr: string | undefined,
  transcriptText: string,
  notifyUI: (t: string) => void,
  signal?: AbortSignal
) {
  // AI scenario (PNG mode only)
  if (screenMatchEnabled && framesConfig && framesConfig.mode === "png") {
    notifyUI("AI-сопоставление экранов с этапами...");
    const matchResult = await matchScreensToStages(
      cjm.stages.map((s) => s.name),
      framesConfig.frames.map((f) => f.name || "Фрейм"),
      apiKey,
      screenMatchPrompt,
      signal
    );
    if (Object.keys(matchResult.mapping).length > 0) {
      if (visionEnabled) notifyUI("Vision-анализ экранов...");
      await renderScreenScenario(cjm, {
        frames: framesConfig.frames,
        mapping: matchResult.mapping,
        screenAnnotations: matchResult.screenAnnotations,
        includeVisionAnnotations: visionEnabled,
        visionPrompt: visionPromptStr,
        apiKey,
        transcriptText,
        signal,
      });
      return;
    }
  }
  // Default: positional CJM (links or PNG preview per-stage)
  await renderCJM(cjm, framesConfig);
}

function getFramesConfig(screensSource?: string, screensMode?: string): FramesConfig | undefined {
  if (!screensSource || screensSource === "none") return undefined;
  const src = screensSource === "selection" || screensSource === "section" || screensSource === "page" ? screensSource : null;
  if (!src) return undefined;
  const frames = collectFrames(src as FramesSource);
  if (frames.length === 0) return undefined;
  const mode: ScreensMode = screensMode === "png" ? "png" : "links";
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
    visionPrompt: visionPrompt || DEFAULT_SCREEN_VISION_PROMPT,
  });
}

  restoreSettings();

  figma.ui.onmessage = async (msg: {
  type: string;
  rows?: Row[];
  text?: string;
  url?: string;
  apiKey?: string;
  useAI?: boolean;
  transcriptPrompt?: string;
  tablePrompt?: string;
  includeDuration?: boolean;
  includeChannels?: boolean;
  includeLifecycle?: boolean;
  includeActivation?: boolean;
  includeProductMetrics?: boolean;
  jobStoryPrompt?: string;
  aggregatePrompt?: string;
  lifecyclePrompt?: string;
  activationPrompt?: string;
  productMetricsPrompt?: string;
  texts?: string[];
  screensSource?: string;
  screensMode?: string;
  includeScreenMatching?: boolean;
  screenMatchingPrompt?: string;
  includeVisionAnnotations?: boolean;
  visionPrompt?: string;
}) => {
  const notifyUI = (text: string, isError?: boolean) => {
    figma.ui.postMessage({ type: "status", text, isError });
  };

  const done = (success: boolean, error?: string) => {
    currentAbortController = null;
    figma.ui.postMessage({ type: "done", success, error });
  };

  if (msg.type === "cancel") {
    currentAbortController?.abort();
    currentAbortController = null;
    figma.ui.postMessage({ type: "done", success: false, error: "Генерация отменена" });
    return;
  }

  try {
    if (msg.type === "savePrompts") {
      if (msg.transcriptPrompt !== undefined) {
        await figma.clientStorage.setAsync("prompt_transcript", msg.transcriptPrompt);
      }
      if (msg.tablePrompt !== undefined) {
        await figma.clientStorage.setAsync("prompt_table", msg.tablePrompt);
      }
      if (msg.includeDuration !== undefined) {
        await figma.clientStorage.setAsync("options_include_duration", msg.includeDuration);
      }
      if (msg.includeChannels !== undefined) {
        await figma.clientStorage.setAsync("options_include_channels", msg.includeChannels);
      }
      if (msg.jobStoryPrompt !== undefined) {
        await figma.clientStorage.setAsync("prompt_jobstory", msg.jobStoryPrompt);
      }
      if (msg.aggregatePrompt !== undefined) {
        await figma.clientStorage.setAsync("prompt_aggregate", msg.aggregatePrompt);
      }
      if (msg.includeLifecycle !== undefined) {
        await figma.clientStorage.setAsync("options_include_lifecycle", msg.includeLifecycle);
      }
      if (msg.includeActivation !== undefined) {
        await figma.clientStorage.setAsync("options_include_activation", msg.includeActivation);
      }
      if (msg.includeProductMetrics !== undefined) {
        await figma.clientStorage.setAsync("options_include_product_metrics", msg.includeProductMetrics);
      }
      if (msg.lifecyclePrompt !== undefined) {
        await figma.clientStorage.setAsync("prompt_lifecycle", msg.lifecyclePrompt);
      }
      if (msg.activationPrompt !== undefined) {
        await figma.clientStorage.setAsync("prompt_activation", msg.activationPrompt);
      }
      if (msg.productMetricsPrompt !== undefined) {
        await figma.clientStorage.setAsync("prompt_product_metrics", msg.productMetricsPrompt);
      }
      if (msg.includeScreenMatching !== undefined) {
        await figma.clientStorage.setAsync("options_include_screen_matching", msg.includeScreenMatching);
      }
      if (msg.screenMatchingPrompt !== undefined) {
        await figma.clientStorage.setAsync("prompt_screen_matching", msg.screenMatchingPrompt);
      }
      if (msg.includeVisionAnnotations !== undefined) {
        await figma.clientStorage.setAsync("options_include_vision_annotations", msg.includeVisionAnnotations);
      }
      if (msg.visionPrompt !== undefined) {
        await figma.clientStorage.setAsync("prompt_vision_annotations", msg.visionPrompt);
      }
      done(true);
      return;
    }

    // Load custom prompts from storage
    const storedTranscriptPrompt = msg.transcriptPrompt || (await figma.clientStorage.getAsync("prompt_transcript")) || undefined;
    const storedTablePrompt = msg.tablePrompt || (await figma.clientStorage.getAsync("prompt_table")) || undefined;

    if (msg.type === "excel") {
      currentAbortController = new AbortController();
      const signal = currentAbortController.signal;
      const rows = msg.rows ?? [];
      const useAI = msg.useAI === true;
      if (useAI) {
        const apiKey = msg.apiKey ?? (await figma.clientStorage.getAsync("openai_key"));
        if (!apiKey) {
          done(false, "Введите OpenAI API ключ для AI-интерпретации");
          return;
        }
        if (msg.apiKey) {
          await figma.clientStorage.setAsync("openai_key", msg.apiKey);
        }
        notifyUI("Анализ таблицы через AI...");
        const cjm = await tableToCJM(rows, apiKey, undefined, storedTablePrompt, signal);
        if (!cjm.stages.length) {
          done(false, "AI не смог извлечь этапы из таблицы");
          return;
        }
        notifyUI("Создание CJM...");
        const framesConfig = getFramesConfig(msg.screensSource, msg.screensMode);
        const screenMatchEnabled = msg.includeScreenMatching ?? (await figma.clientStorage.getAsync("options_include_screen_matching")) === true;
        const screenMatchPrompt = msg.screenMatchingPrompt ?? (await figma.clientStorage.getAsync("prompt_screen_matching")) ?? undefined;
        const visionEnabled = msg.includeVisionAnnotations ?? (await figma.clientStorage.getAsync("options_include_vision_annotations")) === true;
        const visionPromptStr = msg.visionPrompt ?? (await figma.clientStorage.getAsync("prompt_vision_annotations")) ?? undefined;
        await renderWithScreens(cjm, framesConfig, apiKey, screenMatchEnabled, screenMatchPrompt, visionEnabled, visionPromptStr, "", notifyUI, signal);
      } else {
        notifyUI("Парсинг таблицы...");
        const cjm = parseExcelToCJM(rows);
        if (!cjm.stages.length) {
          done(false, "Не удалось определить этапы CJM. Проверьте формат файла.");
          return;
        }
        notifyUI("Создание CJM...");
        const framesConfigNoAI = getFramesConfig(msg.screensSource, msg.screensMode);
        await renderCJM(cjm, framesConfigNoAI);
      }
      figma.notify("CJM создан");
      done(true);
    } else if (msg.type === "googleSheets") {
      currentAbortController = new AbortController();
      const signal = currentAbortController.signal;
      const url = msg.url ?? "";
      const apiKey = msg.apiKey ?? (await figma.clientStorage.getAsync("openai_key"));
      if (!apiKey) {
        done(false, "Введите OpenAI API ключ");
        return;
      }
      if (msg.apiKey) {
        await figma.clientStorage.setAsync("openai_key", msg.apiKey);
      }
      const id = extractSpreadsheetId(url);
      if (!id) {
        done(false, "Неверный URL Google Таблицы");
        return;
      }
      notifyUI("Загрузка из Google Sheets...");
      const rows = await fetchGoogleSheetsRows(id);
      if (!rows.length) {
        done(false, "Таблица пуста или недоступна");
        return;
      }
      notifyUI("Анализ таблицы через AI...");
      const cjm = await tableToCJM(rows, apiKey, `Google Таблицы (ID: ${id})`, storedTablePrompt, signal);
      if (!cjm.stages.length) {
        done(false, "AI не смог извлечь этапы из таблицы");
        return;
      }
      notifyUI("Создание CJM...");
      const framesConfigSheets = getFramesConfig(msg.screensSource, msg.screensMode);
      const sheetsScreenMatchEnabled = msg.includeScreenMatching ?? (await figma.clientStorage.getAsync("options_include_screen_matching")) === true;
      const sheetsScreenMatchPrompt = msg.screenMatchingPrompt ?? (await figma.clientStorage.getAsync("prompt_screen_matching")) ?? undefined;
      const sheetsVisionEnabled = msg.includeVisionAnnotations ?? (await figma.clientStorage.getAsync("options_include_vision_annotations")) === true;
      const sheetsVisionPrompt = msg.visionPrompt ?? (await figma.clientStorage.getAsync("prompt_vision_annotations")) ?? undefined;
      await renderWithScreens(cjm, framesConfigSheets, apiKey, sheetsScreenMatchEnabled, sheetsScreenMatchPrompt, sheetsVisionEnabled, sheetsVisionPrompt, "", notifyUI, signal);
      figma.notify("CJM создан");
      done(true);
    } else if (msg.type === "transcript") {
      currentAbortController = new AbortController();
      const signal = currentAbortController.signal;
      const text = msg.text ?? "";
      const apiKey = msg.apiKey ?? (await figma.clientStorage.getAsync("openai_key"));

      if (!apiKey) {
        done(false, "Введите OpenAI API ключ");
        return;
      }

      if (msg.apiKey) {
        await figma.clientStorage.setAsync("openai_key", msg.apiKey);
      }

      const transcriptOptions = {
        includeDuration: msg.includeDuration ?? (await figma.clientStorage.getAsync("options_include_duration")) === true,
        includeChannels: msg.includeChannels ?? (await figma.clientStorage.getAsync("options_include_channels")) === true,
        includeLifecycle: msg.includeLifecycle ?? (await figma.clientStorage.getAsync("options_include_lifecycle")) === true,
        includeActivation: msg.includeActivation ?? (await figma.clientStorage.getAsync("options_include_activation")) === true,
        includeProductMetrics: msg.includeProductMetrics ?? (await figma.clientStorage.getAsync("options_include_product_metrics")) === true,
      };
      const storedJobStoryPrompt = msg.jobStoryPrompt ?? (await figma.clientStorage.getAsync("prompt_jobstory")) ?? DEFAULT_JOBSTORY_PROMPT;
      const analyticsPrompts: AnalyticsPrompts = {
        lifecyclePrompt: msg.lifecyclePrompt ?? (await figma.clientStorage.getAsync("prompt_lifecycle")) ?? DEFAULT_LIFECYCLE_PROMPT,
        activationPrompt: msg.activationPrompt ?? (await figma.clientStorage.getAsync("prompt_activation")) ?? DEFAULT_ACTIVATION_PROMPT,
        productMetricsPrompt: msg.productMetricsPrompt ?? (await figma.clientStorage.getAsync("prompt_product_metrics")) ?? DEFAULT_PRODUCT_METRICS_PROMPT,
      };
      notifyUI("Анализ транскрипта через AI...");
      const cjm = await transcriptToCJM(text, apiKey, storedTranscriptPrompt, transcriptOptions, storedJobStoryPrompt, analyticsPrompts, signal);

      if (!cjm.stages.length) {
        done(false, "AI не смог извлечь этапы из транскрипта");
        return;
      }

      notifyUI("Создание CJM...");
      const framesConfigTranscript = getFramesConfig(msg.screensSource, msg.screensMode);
      const trScreenMatchEnabled = msg.includeScreenMatching ?? (await figma.clientStorage.getAsync("options_include_screen_matching")) === true;
      const trScreenMatchPrompt = msg.screenMatchingPrompt ?? (await figma.clientStorage.getAsync("prompt_screen_matching")) ?? undefined;
      const trVisionEnabled = msg.includeVisionAnnotations ?? (await figma.clientStorage.getAsync("options_include_vision_annotations")) === true;
      const trVisionPrompt = msg.visionPrompt ?? (await figma.clientStorage.getAsync("prompt_vision_annotations")) ?? undefined;
      await renderWithScreens(cjm, framesConfigTranscript, apiKey, trScreenMatchEnabled, trScreenMatchPrompt, trVisionEnabled, trVisionPrompt, text, notifyUI, signal);
      figma.notify("CJM создан");
      done(true);
    } else if (msg.type === "aggregateTranscripts") {
      currentAbortController = new AbortController();
      const signal = currentAbortController.signal;
      const texts = msg.texts ?? [];
      const apiKey = msg.apiKey ?? (await figma.clientStorage.getAsync("openai_key"));
      if (!apiKey) {
        done(false, "Введите OpenAI API ключ");
        return;
      }
      if (msg.apiKey) {
        await figma.clientStorage.setAsync("openai_key", msg.apiKey);
      }
      const transcriptOptions = {
        includeDuration: msg.includeDuration ?? (await figma.clientStorage.getAsync("options_include_duration")) === true,
        includeChannels: msg.includeChannels ?? (await figma.clientStorage.getAsync("options_include_channels")) === true,
        includeLifecycle: msg.includeLifecycle ?? (await figma.clientStorage.getAsync("options_include_lifecycle")) === true,
        includeActivation: msg.includeActivation ?? (await figma.clientStorage.getAsync("options_include_activation")) === true,
        includeProductMetrics: msg.includeProductMetrics ?? (await figma.clientStorage.getAsync("options_include_product_metrics")) === true,
      };
      const storedJobStoryPrompt = msg.jobStoryPrompt ?? (await figma.clientStorage.getAsync("prompt_jobstory")) ?? DEFAULT_JOBSTORY_PROMPT;
      const storedAggregatePrompt = msg.aggregatePrompt ?? (await figma.clientStorage.getAsync("prompt_aggregate")) ?? DEFAULT_AGGREGATE_PROMPT;
      const analyticsPromptsAgg: AnalyticsPrompts = {
        lifecyclePrompt: msg.lifecyclePrompt ?? (await figma.clientStorage.getAsync("prompt_lifecycle")) ?? DEFAULT_LIFECYCLE_PROMPT,
        activationPrompt: msg.activationPrompt ?? (await figma.clientStorage.getAsync("prompt_activation")) ?? DEFAULT_ACTIVATION_PROMPT,
        productMetricsPrompt: msg.productMetricsPrompt ?? (await figma.clientStorage.getAsync("prompt_product_metrics")) ?? DEFAULT_PRODUCT_METRICS_PROMPT,
      };
      notifyUI("Агрегация транскриптов через AI...");
      const cjm = await aggregateTranscriptsToCJM(texts, apiKey, storedAggregatePrompt, transcriptOptions, storedJobStoryPrompt, analyticsPromptsAgg, signal);
      if (!cjm.stages.length) {
        done(false, "AI не смог агрегировать этапы из транскриптов");
        return;
      }
      notifyUI("Создание CJM...");
      const framesConfigAgg = getFramesConfig(msg.screensSource, msg.screensMode);
      const aggScreenMatchEnabled = msg.includeScreenMatching ?? (await figma.clientStorage.getAsync("options_include_screen_matching")) === true;
      const aggScreenMatchPrompt = msg.screenMatchingPrompt ?? (await figma.clientStorage.getAsync("prompt_screen_matching")) ?? undefined;
      const aggVisionEnabled = msg.includeVisionAnnotations ?? (await figma.clientStorage.getAsync("options_include_vision_annotations")) === true;
      const aggVisionPrompt = msg.visionPrompt ?? (await figma.clientStorage.getAsync("prompt_vision_annotations")) ?? undefined;
      await renderWithScreens(cjm, framesConfigAgg, apiKey, aggScreenMatchEnabled, aggScreenMatchPrompt, aggVisionEnabled, aggVisionPrompt, texts.join("\n--- ИНТЕРВЬЮ ---\n"), notifyUI, signal);
      figma.notify("CJM создан");
      done(true);
    }
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      currentAbortController = null;
      figma.ui.postMessage({ type: "done", success: false, error: "Генерация отменена" });
      return;
    }
    const message = err instanceof Error ? err.message : String(err);
    figma.notify("Ошибка: " + message, { error: true });
    done(false, message);
  }
};
