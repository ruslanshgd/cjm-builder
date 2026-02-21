/// <reference types="@figma/plugin-typings" />
import type { CJMData, CJMStage, JobStory, ProductAnalytics, ActivationPoint } from "./cjm-types";

function throwIfAborted(signal?: AbortSignal): void {
  if (signal && signal.aborted) {
    const err = new Error("Cancelled");
    err.name = "AbortError";
    throw err;
  }
}

function parseCoord01(value: unknown, fallback = 0.5): number {
  let n: number;
  if (typeof value === "number") {
    n = value;
  } else if (typeof value === "string") {
    // Handle both "0.42" and locale "0,42"
    n = Number(value.replace(",", ".").trim());
  } else {
    n = fallback;
  }
  if (!Number.isFinite(n)) n = fallback;
  return Math.max(0.05, Math.min(0.95, n));
}

const MAX_TRANSCRIPT_LENGTH = 45000;

export const DEFAULT_LIFECYCLE_PROMPT = `Определи этап жизненного цикла респондента на основе его слов:
- lifecycle: "new" (первый опыт, онбординг, только начал), "active" (регулярно использует), "inactive" (был активен, сейчас редко), "churned" (ушёл, объясняет почему), "reactivated" (вернулся после паузы).
- activated: true/false — нашёл ли пользователь ценность в продукте (aha-момент).
- segment (ABCDX): "A" (очень нужен продукт, платит быстро/много), "B" (нужен, но есть возражения), "C" (ценность невысокая, платит мало, много требований), "D" (задаёт вопросы, не покупает), "X" (готов много платить, но нужен особый продукт/фича).
- segmentReasoning: краткое пояснение выбора сегмента (1–2 предложения).

Добавь в JSON объект "productAnalytics" с полями: lifecycle, activated, segment, segmentReasoning.`;

export const DEFAULT_ACTIVATION_PROMPT = `Проанализируй путь респондента с точки зрения активации, вовлечённости и принятия (adoption):
- activationPoint: объект {stageName, description, reached} — на каком этапе CJM произошла активация (пользователь впервые получил ценность). Если не произошла — reached: false и описание почему.
- engagementLevel: "low" | "medium" | "high" — оценка глубины, частоты и продолжительности использования.
- adoptionStatus: "none" | "partial" | "full" — стал ли продукт частью рутины пользователя.
- adoptionDetails: краткое пояснение (какие функции приняты, какие нет).

Добавь эти поля в объект "productAnalytics" в JSON.`;

export const DEFAULT_PRODUCT_METRICS_PROMPT = `Для каждого этапа CJM предложи 1–2 продуктовые метрики в контексте юнит-экономики и продуктового роста. Рассуждай в терминах:
- Этапы привлечения: UA (user acquisition), CPU (cost per user), каналы
- Этапы активации: C1 (конверсия в ключевое действие), time-to-value, completion rate онбординга
- Этапы использования: avg. payment count, frequency, retention rate, DAU/MAU
- Этапы проблем/ухода: churn rate, NPS, причины оттока

Не считай цифры — рассуждай, какие метрики применимы и почему. Формулируй метрики содержательно, с пояснением.

Также добавь в "productAnalytics" массив "productInsights" — 3–5 ключевых продуктовых инсайтов и рекомендаций на основе анализа всей CJM (сегмент пользователя, воронка, точки потерь, возможности роста).`;

/* ═══ Vision Annotations ═══ */

export interface ScreenVisionAnnotation {
  tag: string;     // short label: "Ценность", "Боль", "Барьер", etc.
  comment: string; // 1-2 sentences from the transcript
  x: number;       // 0–1 horizontal position on screen
  y: number;       // 0–1 vertical position on screen
}

export const DEFAULT_SCREEN_VISION_PROMPT = `Ты — UX-исследователь. Тебе показан скриншот экрана приложения, контекст этапа CJM (действия, мысли, touchpoints, опыт пользователя) и фрагмент транскрипта интервью.

Твоя задача — расставить от 3 до 5 аннотаций на экране, связывая элементы интерфейса с тем, что пользователь делает, думает и чувствует на этом этапе.

Используй ВСЮ предоставленную информацию:
- Контекст этапа CJM (действия, мысли, эмоции, touchpoints) — это уже проанализированные данные о том, что пользователь делает на этом экране
- Транскрипт интервью — прямые слова пользователя
- Скриншот — визуальные элементы интерфейса

Для каждой аннотации:
- tag: короткий заголовок (1–3 слова), например: "Ценность", "Боль", "Барьер", "Aha-момент", "Путаница", "Желание", "Трение", "Активация", "Разочарование", "Удобство", "Навигация", "Первый контакт" — или придумай подходящий
- comment: 1–2 коротких предложения — что пользователь делает, думает или чувствует в этом месте экрана (на основе контекста этапа и/или транскрипта)
- x: от 0.0 (лево) до 1.0 (право) — координата центра элемента интерфейса на скриншоте
- y: от 0.0 (верх) до 1.0 (низ) — координата центра элемента интерфейса на скриншоте

ВАЖНО: Ты ДОЛЖЕН вернуть хотя бы 3 аннотации. Даже если прямой цитаты нет, используй контекст этапа CJM (действия, мысли, touchpoints) чтобы привязать аннотации к конкретным элементам интерфейса на экране.

Верни строго JSON:
{"annotations": [{"tag": "...", "comment": "...", "x": 0.5, "y": 0.3}, ...]}`;

export interface VisionStageContext {
  actions?: string[];
  touchpoints?: string[];
  thoughts?: string[];
  experience?: string[];
  emotions?: string[];
  quotes?: string[];
}

export async function analyzeScreenWithVision(
  pngBase64: string,
  transcriptText: string,
  apiKey: string,
  stageName: string,
  frameName?: string,
  customPrompt?: string,
  signal?: AbortSignal,
  stageContext?: VisionStageContext
): Promise<ScreenVisionAnnotation[]> {
  if (!pngBase64 || !apiKey) return [];

  const systemPrompt = customPrompt || DEFAULT_SCREEN_VISION_PROMPT;

  let contextBlock = `Этап CJM: "${stageName}"`;
  if (frameName) contextBlock += `\nЭкран: "${frameName}"`;

  if (stageContext) {
    contextBlock += "\n\n--- КОНТЕКСТ ЭТАПА ---";
    if (stageContext.actions && stageContext.actions.length > 0)
      contextBlock += "\nДействия: " + stageContext.actions.join("; ");
    if (stageContext.touchpoints && stageContext.touchpoints.length > 0)
      contextBlock += "\nTouchpoints: " + stageContext.touchpoints.join("; ");
    if (stageContext.thoughts && stageContext.thoughts.length > 0)
      contextBlock += "\nМысли: " + stageContext.thoughts.join("; ");
    if (stageContext.experience && stageContext.experience.length > 0)
      contextBlock += "\nОпыт: " + stageContext.experience.join("; ");
    if (stageContext.emotions && stageContext.emotions.length > 0)
      contextBlock += "\nЭмоции: " + stageContext.emotions.join("; ");
    if (stageContext.quotes && stageContext.quotes.length > 0)
      contextBlock += "\nЦитаты: «" + stageContext.quotes.join("»; «") + "»";
    contextBlock += "\n--- КОНЕЦ КОНТЕКСТА ---";
  }

  contextBlock += `\n\nТранскрипт интервью (фрагмент):\n${transcriptText.slice(0, 8000)}`;

  const userMessage = {
    role: "user" as const,
    content: [
      {
        type: "text" as const,
        text: contextBlock,
      },
      {
        type: "image_url" as const,
        image_url: {
          url: `data:image/png;base64,${pngBase64}`,
          detail: "high" as const,
        },
      },
    ],
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
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: systemPrompt },
            userMessage,
          ],
          temperature: 0.4,
          max_tokens: 1200,
        }),
      });

      if (!response.ok) {
        const errBody = await response.text();
        lastError = model + ": HTTP " + response.status + (errBody ? " " + errBody.slice(0, 200) : "");
        continue;
      }

      const data = (await response.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
      };
      const content = data.choices?.[0]?.message?.content;
      if (!content) {
        lastError = model + ": empty response content";
        continue;
      }

      const parsed = tryParseJSON(content);
      if (!parsed || typeof parsed !== "object") {
        lastError = model + ": invalid JSON in response";
        continue;
      }
      const rawList = (parsed as Record<string, unknown>).annotations;
      if (!Array.isArray(rawList)) {
        lastError = model + ": no 'annotations' array in response";
        continue;
      }

      return rawList
        .slice(0, 5)
        .map((item: unknown) => {
          const a = item as Record<string, unknown>;
          return {
            tag: String(a.tag ?? "").trim(),
            comment: String(a.comment ?? "").trim(),
            x: parseCoord01(a.x, 0.5),
            y: parseCoord01(a.y, 0.5),
          };
        })
        .filter((a) => a.tag && a.comment);
    }
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") throw err;
    if (err instanceof Error && err.message) {
      lastError = err.message;
    }
  }

  throw new Error("Vision annotation failed: " + lastError);
}

/* ═══ Screen matching ═══ */

export const DEFAULT_SCREEN_MATCHING_PROMPT = `Тебе дан список этапов CJM (Customer Journey Map) и список имён фреймов (экранов интерфейса из Figma).

Сопоставь каждый фрейм с наиболее подходящим этапом CJM по смыслу названия.
- Один этап может иметь несколько экранов.
- Фрейм может не подходить ни к одному этапу — не включай его.
- Учитывай, что названия фреймов — это названия экранов интерфейса (например: "App Store", "Каталог", "Корзина", "Оплата", "Трекинг заказа").
- Учитывай, что названия этапов CJM — это шаги пользовательского пути (например: "Планирование закупки", "Сбор корзины", "Оформление заказа").

Дополнительно, для каждого сопоставленного фрейма напиши краткую аннотацию (1–2 предложения): что пользователь видит или делает на этом экране в контексте данного этапа CJM.

Верни строго JSON:
{
  "mapping": {"Название этапа": ["имя фрейма 1", "имя фрейма 2"], ...},
  "screenAnnotations": {"имя фрейма 1": "Краткое описание", "имя фрейма 2": "Краткое описание", ...}
}
Имена этапов и фреймов должны быть точно такими же, как в предоставленных списках.`;

export interface ScreenMatchResult {
  mapping: Record<string, string[]>;
  screenAnnotations?: Record<string, string>;
}

export const DEFAULT_AGGREGATE_PROMPT = `Ты — UX-исследователь. Тебе даны несколько транскриптов пользовательских интервью (разделённых метками --- ИНТЕРВЬЮ N ---).

Твоя задача: агрегировать инсайты из всех интервью и построить ОДНУ обобщённую Customer Journey Map, которая отражает типичный путь пользователя на основе данных из всех интервью.

Правила агрегации:
- Объединяй схожие этапы из разных интервью в один этап
- Объединяй похожие действия, touchpoints, эмоции
- Если респонденты по-разному описывают этап — формулируй обобщённо
- Для actions, thoughts, emotions — собирай типичные формулировки из всех интервью
- Минимум 3 этапа, максимум 10
- Извлекай 1–2 характерные цитаты на этап (поле quotes)
- Язык = язык транскриптов
- Формат ответа — строго JSON: {"jobStories":[...],"stages":[...]}

Формат этапа: {"name":"...","actions":["..."],"touchpoints":["..."],"experience":["..."],"thoughts":["..."],"emotions":["..."],"quotes":["..."],"illustrations":[],"metrics":["..."],"hypotheses":["..."]}`;

export const DEFAULT_JOBSTORY_PROMPT = `Ты — эксперт по Jobs-to-be-Done (JTBD). Из транскрипта пользовательского интервью извлекаешь Job Story.

Job Story описывает цель пользователя в формате: When [situation] I want to [motivation] so I can [outcome].
- situation: контекст, в котором находится пользователь (где, когда, какая задача/проблема)
- motivation: что пользователь хочет сделать (действие, потребность)
- outcome: зачем, какой результат или выгода

Анализируй слова респондента. Не придумывай — извлекай из разговора. Язык = язык транскрипта.`;

export const DEFAULT_TRANSCRIPT_PROMPT = `Ты — UX-исследователь и эксперт по Customer Journey Map.

Тебе дан транскрипт пользовательского интервью. Твоя задача — проанализировать разговор и САМОСТОЯТЕЛЬНО построить CJM на основе того, что обсуждалось.

Как анализировать:
1. Прочитай весь разговор между интервьюером и респондентом.
2. Определи, через какие этапы взаимодействия с продуктом/сервисом прошёл респондент (например: узнал о продукте → попробовал → столкнулся с проблемой → нашёл решение → стал постоянным пользователем).
3. Для каждого этапа извлеки из слов респондента:
   - actions: что конкретно делал пользователь (его действия, шаги)
   - touchpoints: через какие каналы/интерфейсы он взаимодействовал (приложение, сайт, поддержка, соцсети и т.д.)
   - experience: как он воспринимал происходящее, что ему нравилось/не нравилось
   - thoughts: о чём думал, что его беспокоило, какие были сомнения или ожидания
   - emotions: какие эмоции испытывал (радость, раздражение, разочарование, удивление и т.д.)
   - quotes: 1–2 дословные цитаты респондента, иллюстрирующие опыт на этом этапе
   - metrics: какие метрики/KPI могли бы это измерить (предположи на основе контекста)
   - hypotheses: идеи для улучшения продукта на этом этапе (предложи на основе проблем респондента)

Этапов в транскрипте явно НЕТ — ты определяешь их сам, интерпретируя разговор.

Дополнительно: определи Job Story пользователя (цель, с которой он пришёл в продукт) в формате JTBD: When [situation] I want to [motivation] so I can [outcome]. Добавь в ответ поле jobStories — массив с одним объектом {situation, motivation, outcome}.

Формат ответа — строго JSON:
{"jobStories":[{"situation":"...","motivation":"...","outcome":"..."}],"stages":[{"name":"Название этапа","actions":["..."],"touchpoints":["..."],"experience":["..."],"thoughts":["..."],"emotions":["..."],"quotes":["..."],"illustrations":[],"metrics":["..."],"hypotheses":["..."]}]}

Правила:
- Минимум 3 этапа, максимум 10.
- Массивы могут быть пустыми [] если из разговора нельзя извлечь информацию для этого поля.
- Язык = язык транскрипта.
- Только JSON, никакого дополнительного текста.`;

export const DEFAULT_TABLE_PROMPT = `Ты — эксперт по CJM. Из таблицы структурируешь Customer Journey Map.

Важно: ты НЕ додумываешь данные. Ты работаешь ТОЛЬКО с тем, что есть в таблице.

Как работать:
1. Определи структуру таблицы: что является этапами (строки или колонки), а что атрибутами (действия, точки контакта, эмоции и т.д.).
2. Маппинг колонок по смыслу: "Действия" → actions, "Точки контакта" → touchpoints, "Эмоции" → emotions, "Болевые точки" → experience, "Возможности" → hypotheses, "Метрики" → metrics и т.д.
3. Если колонка не маппится ни на одно стандартное поле CJM — пропусти её.
4. Если в ячейке несколько пунктов через ";" или перенос строки — разбей на массив.

Если в таблице нет ни одного этапа и ни одного действия/описания — верни:
{"error":"Таблица не содержит данных для построения CJM"}

Формат ответа — строго JSON:
{"stages":[{"name":"...","actions":["..."],"touchpoints":["..."],"experience":["..."],"thoughts":["..."],"emotions":["..."],"illustrations":[],"metrics":["..."],"hypotheses":["..."]}]}

Правила:
- Бери только то, что есть в таблице. Пустые поля = пустые массивы [].
- НЕ придумывай этапы, действия, эмоции — только реальные данные из таблицы.
- Язык = язык данных таблицы.
- Только JSON.`;

function normalizeStage(s: Partial<CJMStage>): CJMStage {
  return {
    name: s.name ?? "Этап",
    actions: Array.isArray(s.actions) ? s.actions : [],
    touchpoints: Array.isArray(s.touchpoints) ? s.touchpoints : [],
    experience: Array.isArray(s.experience) ? s.experience : [],
    thoughts: Array.isArray(s.thoughts) ? s.thoughts : [],
    emotions: Array.isArray(s.emotions) ? s.emotions : [],
    quotes: Array.isArray(s.quotes) ? s.quotes : [],
    illustrations: Array.isArray(s.illustrations) ? s.illustrations : [],
    metrics: Array.isArray(s.metrics) ? s.metrics : [],
    hypotheses: Array.isArray(s.hypotheses) ? s.hypotheses : [],
    duration: typeof s.duration === "string" ? s.duration : undefined,
    channel: typeof s.channel === "string" ? s.channel : undefined,
  };
}

function stripMarkdownFences(text: string): string {
  // Remove ```json ... ``` or ``` ... ```
  let s = text.trim();
  s = s.replace(/^```(?:json|JSON)?\s*\n?/m, "");
  s = s.replace(/\n?\s*```\s*$/m, "");
  return s.trim();
}

function tryParseJSON(text: string): unknown {
  const cleaned = stripMarkdownFences(text);
  // Try direct parse first
  try { return JSON.parse(cleaned); } catch {}
  // Try object
  const objStart = cleaned.indexOf("{");
  const objEnd = cleaned.lastIndexOf("}") + 1;
  if (objStart !== -1 && objEnd > objStart) {
    try { return JSON.parse(cleaned.slice(objStart, objEnd)); } catch {}
  }
  // Try array
  const arrStart = cleaned.indexOf("[");
  const arrEnd = cleaned.lastIndexOf("]") + 1;
  if (arrStart !== -1 && arrEnd > arrStart) {
    try { return JSON.parse(cleaned.slice(arrStart, arrEnd)); } catch {}
  }
  return null;
}

function looksLikeStage(obj: unknown): boolean {
  if (typeof obj !== "object" || obj === null) return false;
  const r = obj as Record<string, unknown>;
  // Any object with a name-like field + at least one array field
  const hasName = !!(r.name || r.stage || r.этап || r.название || r.Name || r.Stage || r.title);
  const hasArrayField = Object.values(r).some(v => Array.isArray(v));
  return hasName || hasArrayField;
}

function findStagesArray(obj: unknown, depth = 0): Partial<CJMStage>[] | null {
  if (depth > 5) return null;

  if (Array.isArray(obj)) {
    if (obj.length > 0 && looksLikeStage(obj[0])) {
      return obj as Partial<CJMStage>[];
    }
    return null;
  }
  if (typeof obj === "object" && obj !== null) {
    const record = obj as Record<string, unknown>;
    // Check common keys for stages array
    for (const key of ["stages", "Stages", "этапы", "Этапы", "data", "cjm", "CJM", "journey", "steps", "customerJourney", "customer_journey"]) {
      const val = record[key];
      if (Array.isArray(val) && val.length > 0 && looksLikeStage(val[0])) {
        return val as Partial<CJMStage>[];
      }
    }
    // Search any array field
    for (const key of Object.keys(record)) {
      const val = record[key];
      if (Array.isArray(val) && val.length > 0 && looksLikeStage(val[0])) {
        return val as Partial<CJMStage>[];
      }
    }
    // Deep search into nested objects
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

function normalizeStageFromAny(s: Record<string, unknown>): CJMStage {
  const getString = (keys: string[]): string => {
    for (const k of keys) {
      if (typeof s[k] === "string" && s[k]) return s[k] as string;
    }
    return "";
  };
  const getArray = (keys: string[]): string[] => {
    for (const k of keys) {
      if (Array.isArray(s[k])) return (s[k] as unknown[]).map(v => String(v ?? "")).filter(Boolean);
    }
    return [];
  };

  const duration = getString(["duration", "Duration", "длительность", "время", "time"]);
  const channel = getString(["channel", "Channel", "канал", "channel", "channelType"]);
  return {
    name: getString(["name", "stage", "этап", "название", "Name", "Stage", "title", "Этап", "Название"]) || "Этап",
    actions: getArray(["actions", "Actions", "действия", "Действия", "steps", "шаги", "действия_пользователя"]),
    touchpoints: getArray(["touchpoints", "Touchpoints", "точки_контакта", "Точки контакта", "touchpoint", "каналы", "channels"]),
    experience: getArray(["experience", "Experience", "опыт", "Опыт", "болевые_точки", "pain_points", "painPoints", "боли"]),
    thoughts: getArray(["thoughts", "Thoughts", "мысли", "Мысли", "thinking", "сомнения", "ожидания"]),
    emotions: getArray(["emotions", "Emotions", "эмоции", "Эмоции", "emotion", "feelings", "чувства"]),
    quotes: getArray(["quotes", "Quotes", "цитаты", "Цитаты", "quotes_from_user"]),
    illustrations: getArray(["illustrations", "Illustrations", "иллюстрации", "images", "screenshots"]),
    metrics: getArray(["metrics", "Metrics", "метрики", "Метрики", "kpi", "KPI", "ux_метрики", "UX-метрики"]),
    hypotheses: getArray(["hypotheses", "Hypotheses", "гипотезы", "Гипотезы", "ideas", "идеи", "возможности", "improvements", "улучшения", "Возможности для улучшения"]),
    duration: duration || undefined,
    channel: channel || undefined,
  };
}

function extractFramework(obj: unknown): CJMData["stageFramework"] {
  if (typeof obj === "object" && obj !== null) {
    const val = (obj as Record<string, unknown>).stageFramework ?? (obj as Record<string, unknown>).framework;
    if (val === "base" || val === "aarrr" || val === "aida") return val;
  }
  return undefined;
}

function extractJobStories(obj: unknown): JobStory[] {
  if (typeof obj !== "object" || obj === null) return [];
  const arr = (obj as Record<string, unknown>).jobStories ?? (obj as Record<string, unknown>).job_stories;
  if (!Array.isArray(arr) || arr.length === 0) return [];
  return arr
    .filter((s): s is Record<string, unknown> => typeof s === "object" && s !== null)
    .map((s) => ({
      situation: String(s.situation ?? s.Situation ?? "").trim(),
      motivation: String(s.motivation ?? s.Motivation ?? "").trim(),
      outcome: String(s.outcome ?? s.Outcome ?? "").trim(),
    }))
    .filter((s) => s.situation || s.motivation || s.outcome);
}

function extractProductAnalytics(obj: unknown): ProductAnalytics | undefined {
  if (typeof obj !== "object" || obj === null) return undefined;
  const record = obj as Record<string, unknown>;
  const pa = record.productAnalytics ?? record.product_analytics ?? record.analytics;
  if (typeof pa !== "object" || pa === null) return undefined;
  const r = pa as Record<string, unknown>;
  const result: ProductAnalytics = {};
  const lc = r.lifecycle ?? r.Lifecycle;
  if (lc === "new" || lc === "active" || lc === "inactive" || lc === "churned" || lc === "reactivated") result.lifecycle = lc;
  if (typeof r.activated === "boolean") result.activated = r.activated;
  const seg = r.segment ?? r.Segment;
  if (seg === "A" || seg === "B" || seg === "C" || seg === "D" || seg === "X") result.segment = seg;
  if (typeof r.segmentReasoning === "string") result.segmentReasoning = r.segmentReasoning;
  const ap = r.activationPoint ?? r.activation_point;
  if (typeof ap === "object" && ap !== null) {
    const a = ap as Record<string, unknown>;
    result.activationPoint = {
      stageName: String(a.stageName ?? a.stage_name ?? a.stage ?? ""),
      description: String(a.description ?? a.desc ?? ""),
      reached: a.reached === true,
    };
  }
  const eng = r.engagementLevel ?? r.engagement_level ?? r.engagement;
  if (eng === "low" || eng === "medium" || eng === "high") result.engagementLevel = eng;
  const adp = r.adoptionStatus ?? r.adoption_status ?? r.adoption;
  if (adp === "none" || adp === "partial" || adp === "full") result.adoptionStatus = adp;
  if (typeof r.adoptionDetails === "string") result.adoptionDetails = r.adoptionDetails;
  const insights = r.productInsights ?? r.product_insights ?? r.insights;
  if (Array.isArray(insights)) {
    result.productInsights = insights.map(v => String(v ?? "")).filter(Boolean);
  }
  if (Object.keys(result).length === 0) return undefined;
  return result;
}

async function extractJSON(text: string): Promise<CJMData> {
  const parsed = tryParseJSON(text);
  if (!parsed) {
    const preview = text.length > 200 ? text.slice(0, 200) + "..." : text;
    throw new Error("Не удалось распарсить JSON из ответа AI: " + preview);
  }

  // Check if AI returned an error message (e.g. invalid table)
  if (typeof parsed === "object" && parsed !== null) {
    const record = parsed as Record<string, unknown>;
    if (record.error && typeof record.error === "string") {
      throw new Error(record.error as string);
    }
  }

  const stagesRaw = findStagesArray(parsed);
  if (!stagesRaw || stagesRaw.length === 0) {
    const keys = typeof parsed === "object" && parsed !== null ? Object.keys(parsed as Record<string, unknown>).join(", ") : "N/A";
    throw new Error("Не найдены этапы в ответе AI (ключи: " + keys + "). Попробуйте уточнить промпт.");
  }

  return {
    stageFramework: extractFramework(parsed),
    jobStories: extractJobStories(parsed),
    productAnalytics: extractProductAnalytics(parsed),
    stages: stagesRaw.map((s) => normalizeStageFromAny(s as Record<string, unknown>)),
  };
}

export interface TranscriptOptions {
  includeDuration?: boolean;
  includeChannels?: boolean;
  includeLifecycle?: boolean;
  includeActivation?: boolean;
  includeProductMetrics?: boolean;
}

export interface AnalyticsPrompts {
  lifecyclePrompt?: string;
  activationPrompt?: string;
  productMetricsPrompt?: string;
}

function buildTranscriptPrompt(basePrompt: string, options?: TranscriptOptions, analyticsPrompts?: AnalyticsPrompts): string {
  let result = basePrompt;
  const extra: string[] = [];
  if (options?.includeDuration) {
    extra.push('Для каждого этапа укажи примерную длительность в поле duration (например "~5 мин", "~1 месяц", "~1 день").');
  }
  if (options?.includeChannels) {
    extra.push('Укажи канал взаимодействия в поле channel (mobile, desktop, website, app, поддержка и т.д.), особенно при смене канала.');
  }
  if (extra.length > 0) {
    result += '\n\nДополнительно извлекай:\n- ' + extra.join('\n- ');
    result += ' В JSON для каждого этапа добавь поля "duration" и/или "channel" где применимо.';
  }
  if (options?.includeLifecycle && analyticsPrompts?.lifecyclePrompt) {
    result += '\n\n' + analyticsPrompts.lifecyclePrompt;
  }
  if (options?.includeActivation && analyticsPrompts?.activationPrompt) {
    result += '\n\n' + analyticsPrompts.activationPrompt;
  }
  if (options?.includeProductMetrics && analyticsPrompts?.productMetricsPrompt) {
    result += '\n\n' + analyticsPrompts.productMetricsPrompt;
  }
  return result;
}

export async function transcriptToCJM(
  transcript: string,
  apiKey: string,
  customPrompt?: string,
  options?: TranscriptOptions,
  jobStoryPrompt?: string,
  analyticsPrompts?: AnalyticsPrompts,
  signal?: AbortSignal
): Promise<CJMData> {
  const trimmed = transcript.trim();
  if (!trimmed) {
    throw new Error("Транскрипт пуст");
  }

  const text = trimmed.length > MAX_TRANSCRIPT_LENGTH
    ? trimmed.slice(0, MAX_TRANSCRIPT_LENGTH) + "\n\n[... текст обрезан ...]"
    : trimmed;

  let basePrompt = buildTranscriptPrompt(customPrompt || DEFAULT_TRANSCRIPT_PROMPT, options, analyticsPrompts);
  if (jobStoryPrompt?.trim()) {
    basePrompt = basePrompt + "\n\n" + jobStoryPrompt.trim();
  }
  const systemPrompt = basePrompt;

  throwIfAborted(signal);
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: `Входные данные:\n\n---\n${text}\n---\n\nВерни CJM как JSON.` },
      ],
      temperature: 0.3,
    }),
  });

  if (!response.ok) {
    const errBody = await response.text();
    let msg = `OpenAI API: ${response.status}`;
    try {
      const j = JSON.parse(errBody);
      if (j.error?.message) msg = j.error.message;
    } catch {
      if (errBody) msg += " " + errBody.slice(0, 200);
    }
    throw new Error(msg);
  }

  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };

  const content = data.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error("Пустой ответ от OpenAI");
  }

  return extractJSON(content);
}

export async function aggregateTranscriptsToCJM(
  transcripts: string[],
  apiKey: string,
  customPrompt?: string,
  options?: TranscriptOptions,
  jobStoryPrompt?: string,
  analyticsPrompts?: AnalyticsPrompts,
  signal?: AbortSignal
): Promise<CJMData> {
  if (!transcripts || transcripts.length === 0) {
    throw new Error("Нет транскриптов");
  }
  const combined = transcripts
    .map((t, i) => `--- ИНТЕРВЬЮ ${i + 1} ---\n${t.trim()}`)
    .join("\n\n");
  const text = combined.length > MAX_TRANSCRIPT_LENGTH
    ? combined.slice(0, MAX_TRANSCRIPT_LENGTH) + "\n\n[... текст обрезан ...]"
    : combined;
  const basePrompt = (customPrompt || DEFAULT_AGGREGATE_PROMPT) + (jobStoryPrompt?.trim() ? "\n\n" + jobStoryPrompt.trim() : "");
  const systemPrompt = buildTranscriptPrompt(basePrompt, options, analyticsPrompts);
  throwIfAborted(signal);
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: `Агрегированные транскрипты:\n\n---\n${text}\n---\n\nВерни CJM как JSON.` },
      ],
      temperature: 0.3,
    }),
  });
  if (!response.ok) {
    const errBody = await response.text();
    let msg = `OpenAI API: ${response.status}`;
    try {
      const j = JSON.parse(errBody);
      if (j.error?.message) msg = j.error.message;
    } catch {
      if (errBody) msg += " " + errBody.slice(0, 200);
    }
    throw new Error(msg);
  }
  const data = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error("Пустой ответ от OpenAI");
  return extractJSON(content);
}

function rowsToText(rows: (string | number | undefined)[][]): string {
  return rows
    .map((row) =>
      (Array.isArray(row) ? row : [])
        .map((c) => String(c ?? ""))
        .join("\t")
    )
    .join("\n");
}

export async function tableToCJM(
  rows: (string | number | undefined)[][],
  apiKey: string,
  sourceLabel?: string,
  customPrompt?: string,
  signal?: AbortSignal
): Promise<CJMData> {
  if (!rows || rows.length === 0) {
    throw new Error("Таблица пуста");
  }

  const tableText = rowsToText(rows);
  const userContent = sourceLabel
    ? `Данные из ${sourceLabel}:\n\n${tableText}`
    : `Таблица (первая строка — заголовок):\n\n${tableText}`;

  throwIfAborted(signal);
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: customPrompt || DEFAULT_TABLE_PROMPT },
        { role: "user", content: userContent + "\n\nВерни CJM как JSON." },
      ],
      temperature: 0.3,
    }),
  });

  if (!response.ok) {
    const errBody = await response.text();
    let msg = `OpenAI API: ${response.status}`;
    try {
      const j = JSON.parse(errBody);
      if (j.error?.message) msg = j.error.message;
    } catch {
      if (errBody) msg += " " + errBody.slice(0, 200);
    }
    throw new Error(msg);
  }

  const tableData = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };

  const tableContent = tableData.choices?.[0]?.message?.content;
  if (!tableContent) {
    throw new Error("Пустой ответ от OpenAI");
  }

  return extractJSON(tableContent);
}

export async function matchScreensToStages(
  stageNames: string[],
  frameNames: string[],
  apiKey: string,
  customPrompt?: string,
  signal?: AbortSignal
): Promise<ScreenMatchResult> {
  if (!stageNames.length || !frameNames.length) return { mapping: {} };

  const systemPrompt = customPrompt || DEFAULT_SCREEN_MATCHING_PROMPT;
  const userContent2 = "Этапы CJM:\n" + stageNames.map(function(s, i) { return (i + 1) + ". " + s; }).join("\n") +
    "\n\nФреймы (экраны):\n" + frameNames.map(function(f, i) { return (i + 1) + ". " + f; }).join("\n") +
    "\n\nВерни JSON с маппингом и аннотациями экранов.";

  throwIfAborted(signal);
  const matchResponse = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userContent2 },
      ],
      temperature: 0.2,
    }),
  });

  if (!matchResponse.ok) {
    return { mapping: {} };
  }

  const matchData = (await matchResponse.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };

  const matchContent = matchData.choices?.[0]?.message?.content;
  if (!matchContent) return { mapping: {} };

  try {
    const parsed = tryParseJSON(matchContent);
    if (!parsed || typeof parsed !== "object") return { mapping: {} };
    const record = parsed as Record<string, unknown>;
    const rawMapping = record.mapping ?? record.Mapping ?? record;
    if (typeof rawMapping !== "object" || rawMapping === null) return { mapping: {} };
    const mapping: Record<string, string[]> = {};
    for (const [key, val] of Object.entries(rawMapping as Record<string, unknown>)) {
      if (key === "mapping" || key === "Mapping" || key === "screenAnnotations") continue;
      if (Array.isArray(val)) {
        mapping[key] = val.map((v) => String(v ?? "")).filter(Boolean);
      }
    }
    // Parse screenAnnotations if present
    let screenAnnotations: Record<string, string> | undefined;
    const rawAnnotations = record.screenAnnotations ?? record.ScreenAnnotations;
    if (rawAnnotations && typeof rawAnnotations === "object" && rawAnnotations !== null) {
      screenAnnotations = {};
      for (const [k, v] of Object.entries(rawAnnotations as Record<string, unknown>)) {
        if (typeof v === "string" && v.trim()) {
          screenAnnotations[k] = v.trim();
        }
      }
      if (Object.keys(screenAnnotations).length === 0) screenAnnotations = undefined;
    }
    return { mapping, screenAnnotations };
  } catch {
    return { mapping: {} };
  }
}
