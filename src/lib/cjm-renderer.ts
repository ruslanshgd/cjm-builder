/// <reference types="@figma/plugin-typings" />
import type { CJMData, CJMStage } from "./cjm-types";
import { analyzeScreenWithVision, type ScreenVisionAnnotation, type VisionStageContext } from "./openai-client";

export type FramesSource = "selection" | "section" | "page";
export type ScreensMode = "links" | "png";

export function collectFrames(source: FramesSource): FrameNode[] {
  const selection = figma.currentPage.selection;
  let frames: FrameNode[] = [];
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
      frames = section.children.filter((c): c is FrameNode => c.type === "FRAME");
    }
  } else if (source === "page") {
    frames = figma.currentPage.findAll((n) => n.type === "FRAME") as FrameNode[];
  }
  // Always sort by X position (left to right) for predictable order
  frames.sort((a, b) => a.x - b.x);
  return frames;
}

/* ═══ Design tokens (same palette as plugin UI) ═══ */
const INK_BLACK: RGB = { r: 0.075, g: 0.106, b: 0.137 };
const DUSTY_GRAPE: RGB = { r: 0.337, g: 0.337, b: 0.463 };
const PERIWINKLE: RGB = { r: 0.847, g: 0.863, b: 1.0 };
const BARBIE_PINK: RGB = { r: 0.976, g: 0.0, b: 0.576 };
const WHITE: RGB = { r: 1, g: 1, b: 1 };
const STAGE_BG: RGB = { r: 0.976, g: 0.978, b: 1.0 };

/* ═══ Fonts ═══ */
const FONT_REGULAR = { family: "Inter", style: "Regular" } as const;
const FONT_MEDIUM = { family: "Inter", style: "Medium" } as const;
const FONT_SEMIBOLD = { family: "Inter", style: "Semi Bold" } as const;
const FONT_BOLD = { family: "Inter", style: "Bold" } as const;

/* ═══ Layout constants ═══ */
const TEXT_WIDTH = 220;
const CARD_PADDING = 12;
const CARD_GAP = 8;
const STAGE_PADDING = 12;
const STAGE_GAP = 16;
const CANVAS_PADDING = 32;

async function loadFonts() {
  await Promise.all([
    figma.loadFontAsync(FONT_REGULAR),
    figma.loadFontAsync(FONT_MEDIUM),
    figma.loadFontAsync(FONT_SEMIBOLD),
    figma.loadFontAsync(FONT_BOLD),
  ]);
}

/* ═══ Card colors ═══ */
const CARD_COLORS: Record<string, RGB> = {
  actions:     { r: 0.922, g: 0.933, b: 1.0 },
  touchpoints: { r: 0.910, g: 0.910, b: 0.988 },
  experience:  { r: 1.0, g: 0.941, b: 0.969 },
  thoughts:    { r: 0.941, g: 0.933, b: 1.0 },
  emotions:    { r: 1.0, g: 0.910, b: 0.953 },
  quotes:      { r: 0.961, g: 0.957, b: 0.984 },
  metrics:     { r: 0.894, g: 0.902, b: 0.988 },
  hypotheses:  { r: 0.949, g: 0.933, b: 1.0 },
};

/* ═══ Helper: create a text node with fixed width, height hugs ═══ */
function makeText(
  chars: string,
  font: FontName,
  size: number,
  color: RGB,
  width: number,
  lineH?: number
): TextNode {
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

/* ═══ Card ═══ */
async function createCard(
  title: string,
  items: string[],
  bgColor: RGB,
  formatItem?: (item: string) => string
): Promise<FrameNode> {
  const contentWidth = TEXT_WIDTH;
  const frame = figma.createFrame();
  frame.name = title;
  frame.fills = [{ type: "SOLID", color: bgColor }];
  frame.cornerRadius = 8;
  frame.layoutMode = "VERTICAL";
  frame.primaryAxisSizingMode = "AUTO";   // height = hug
  frame.counterAxisSizingMode = "AUTO";   // width = hug (from children)
  frame.itemSpacing = 4;
  frame.paddingLeft = CARD_PADDING;
  frame.paddingRight = CARD_PADDING;
  frame.paddingTop = 10;
  frame.paddingBottom = 10;

  // Card title
  const titleNode = makeText(title.toUpperCase(), FONT_MEDIUM, 9, DUSTY_GRAPE, contentWidth);
  titleNode.letterSpacing = { value: 4, unit: "PERCENT" };
  frame.appendChild(titleNode);

  // Items
  for (const item of items) {
    if (!item.trim()) continue;
    const raw = item.length > 200 ? item.slice(0, 197) + "..." : item;
    const chars = formatItem ? formatItem(raw) : raw;
    const t = makeText(chars, FONT_REGULAR, 11, INK_BLACK, contentWidth, 16);
    frame.appendChild(t);
  }

  return frame;
}

/* ═══ Stage column ═══ */
async function renderStage(stage: CJMStage, index: number): Promise<FrameNode> {
  const innerWidth = TEXT_WIDTH + CARD_PADDING * 2;  // card width = text + card padding

  const stageFrame = figma.createFrame();
  stageFrame.name = stage.name;
  stageFrame.layoutMode = "VERTICAL";
  stageFrame.primaryAxisSizingMode = "AUTO";   // height = hug
  stageFrame.counterAxisSizingMode = "AUTO";   // width = hug (from children)
  stageFrame.itemSpacing = CARD_GAP;
  stageFrame.fills = [{ type: "SOLID", color: STAGE_BG }];
  stageFrame.cornerRadius = 12;
  stageFrame.paddingLeft = STAGE_PADDING;
  stageFrame.paddingRight = STAGE_PADDING;
  stageFrame.paddingTop = 16;
  stageFrame.paddingBottom = 16;

  // Stage number pill
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

  // Stage name row (name + optional duration/channel badges)
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

  // Divider
  const divider = figma.createRectangle();
  divider.name = "divider";
  divider.resize(innerWidth, 1);
  divider.fills = [{ type: "SOLID", color: PERIWINKLE }];
  stageFrame.appendChild(divider);

  // Section cards
  const sections = [
    { key: "actions", label: "Действия", items: stage.actions ?? [] },
    { key: "touchpoints", label: "Touchpoints", items: stage.touchpoints ?? [] },
    { key: "experience", label: "Опыт", items: stage.experience ?? [] },
    { key: "thoughts", label: "Мысли", items: stage.thoughts ?? [] },
    { key: "emotions", label: "Эмоции", items: stage.emotions ?? [] },
    { key: "quotes", label: "Цитаты", items: stage.quotes ?? [] },
    { key: "metrics", label: "Метрики", items: stage.metrics ?? [] },
    { key: "hypotheses", label: "Гипотезы", items: stage.hypotheses ?? [] },
  ];

  for (const { key, label, items } of sections) {
    if (items.length === 0) continue;
    const formatItem = key === "quotes" ? (s: string) => `«${s}»` : undefined;
    const card = await createCard(label, items, CARD_COLORS[key] ?? CARD_COLORS.actions, formatItem);
    stageFrame.appendChild(card);
  }

  return stageFrame;
}

const SCREEN_PREVIEW_SIZE = 120;

async function addScreenToStage(
  stageFrame: FrameNode,
  frameNode: FrameNode,
  mode: ScreensMode
): Promise<void> {
  if (mode === "links") {
    const linkText = makeText("Экран: " + (frameNode.name || "Фрейм"), FONT_REGULAR, 11, BARBIE_PINK, TEXT_WIDTH + CARD_PADDING * 2, 16);
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
      rect.resize(SCREEN_PREVIEW_SIZE, Math.round((frameNode.height / frameNode.width) * SCREEN_PREVIEW_SIZE) || SCREEN_PREVIEW_SIZE);
      rect.fills = [{ type: "IMAGE", imageHash: image.hash, scaleMode: "FILL" }];
      rect.cornerRadius = 6;
      const wrapper = figma.createFrame();
      wrapper.name = "screen-preview-wrapper";
      wrapper.layoutMode = "VERTICAL";
      wrapper.primaryAxisSizingMode = "AUTO";
      wrapper.counterAxisSizingMode = "AUTO";
      wrapper.appendChild(rect);
      stageFrame.appendChild(wrapper);
    } catch {
      // Fallback to link if export fails
      const linkText = makeText("Экран: " + (frameNode.name || "Фрейм"), FONT_REGULAR, 11, BARBIE_PINK, TEXT_WIDTH + CARD_PADDING * 2, 16);
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

export interface FramesConfig {
  frames: FrameNode[];
  mode: ScreensMode;
  mapping?: Record<string, string[]>; // stageName -> [frameName, ...]
}

/** Add screens to an existing CJM canvas. Canvas must contain a child frame named "stages" with stage columns as children. */
export async function addScreensToExistingCJM(
  canvas: FrameNode,
  frames: FrameNode[],
  mode: ScreensMode,
  mapping?: Record<string, string[]>
): Promise<void> {
  await loadFonts();
  const stagesRow = canvas.findOne((n) => n.name === "stages") as FrameNode | null;
  if (!stagesRow || stagesRow.type !== "FRAME") {
    throw new Error("CJM не найден или неверный формат. Выделите canvas с CJM.");
  }
  const stageColumns = stagesRow.children.filter((c) => c.type === "FRAME") as FrameNode[];

  if (mapping) {
    const framesByName: Record<string, FrameNode[]> = {};
    for (const f of frames) {
      const n = f.name || "";
      if (!framesByName[n]) framesByName[n] = [];
      framesByName[n].push(f);
    }
    for (const col of stageColumns) {
      const mappedNames = mapping[col.name] || [];
      for (const frameName of mappedNames) {
        const candidates = framesByName[frameName];
        if (candidates && candidates.length > 0) {
          await addScreenToStage(col, candidates[0], mode);
        }
      }
    }
  } else {
    for (let i = 0; i < Math.min(stageColumns.length, frames.length); i++) {
      await addScreenToStage(stageColumns[i], frames[i], mode);
    }
  }
}

/* ═══ Main render ═══ */
export async function renderCJM(data: CJMData, framesConfig?: FramesConfig): Promise<FrameNode> {
  if (!data.stages || data.stages.length === 0) {
    throw new Error("Нет этапов для отображения");
  }

  await loadFonts();

  // Canvas
  const canvas = figma.createFrame();
  canvas.name = "CJM — Сборка CJM";
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

  // Title
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

  // Job Story / Job Stories (if present)
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

  // Product analytics panel (if present)
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
    analyticsFrame.fills = [{ type: "SOLID", color: { r: 0.957, g: 0.941, b: 1.0 } }];

    const aLabel = makeText("PRODUCT ANALYTICS", FONT_MEDIUM, 9, DUSTY_GRAPE, 700, 14);
    aLabel.letterSpacing = { value: 4, unit: "PERCENT" };
    analyticsFrame.appendChild(aLabel);

    // Badges row: lifecycle, segment, engagement, adoption, activation
    const badgesRowPA = figma.createFrame();
    badgesRowPA.name = "analytics-badges";
    badgesRowPA.layoutMode = "HORIZONTAL";
    badgesRowPA.primaryAxisSizingMode = "AUTO";
    badgesRowPA.counterAxisSizingMode = "AUTO";
    badgesRowPA.itemSpacing = 8;
    badgesRowPA.fills = [];

    const badgeItems: { label: string; value: string; color: RGB }[] = [];
    if (pa.lifecycle) badgeItems.push({ label: "Lifecycle", value: pa.lifecycle, color: DUSTY_GRAPE });
    if (pa.segment) badgeItems.push({ label: "Сегмент", value: pa.segment, color: BARBIE_PINK });
    if (pa.activated !== undefined) badgeItems.push({ label: "Активация", value: pa.activated ? "да" : "нет", color: pa.activated ? { r: 0.08, g: 0.68, b: 0.36 } : { r: 0.88, g: 0.24, b: 0.18 } });
    if (pa.engagementLevel) badgeItems.push({ label: "Вовлечённость", value: pa.engagementLevel, color: DUSTY_GRAPE });
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

    // Segment reasoning
    if (pa.segmentReasoning) {
      const segText = makeText("Сегмент: " + pa.segmentReasoning, FONT_REGULAR, 11, INK_BLACK, 700, 16);
      analyticsFrame.appendChild(segText);
    }

    // Activation point
    if (pa.activationPoint) {
      const apText = makeText(
        "Точка активации: " + (pa.activationPoint.reached ? "достигнута" : "не достигнута") +
          " — " + (pa.activationPoint.stageName ? "этап «" + pa.activationPoint.stageName + "»" : "") +
          (pa.activationPoint.description ? ". " + pa.activationPoint.description : ""),
        FONT_REGULAR, 11, INK_BLACK, 700, 16
      );
      analyticsFrame.appendChild(apText);
    }

    // Adoption details
    if (pa.adoptionDetails) {
      const adText = makeText("Adoption: " + pa.adoptionDetails, FONT_REGULAR, 11, INK_BLACK, 700, 16);
      analyticsFrame.appendChild(adText);
    }

    // Product insights
    if (pa.productInsights && pa.productInsights.length > 0) {
      const insightsLabel = makeText("PRODUCT INSIGHTS", FONT_MEDIUM, 9, DUSTY_GRAPE, 700, 14);
      insightsLabel.letterSpacing = { value: 4, unit: "PERCENT" };
      analyticsFrame.appendChild(insightsLabel);
      for (const insight of pa.productInsights.slice(0, 5)) {
        const iText = makeText("• " + insight, FONT_REGULAR, 11, INK_BLACK, 700, 16);
        analyticsFrame.appendChild(iText);
      }
    }

    canvas.appendChild(analyticsFrame);
  }

  // Subtitle
  const subtitle = figma.createText();
  subtitle.fontName = FONT_REGULAR;
  subtitle.fontSize = 12;
  const n = data.stages.length;
  subtitle.characters = n + " " + (n === 1 ? "этап" : n < 5 ? "этапа" : "этапов");
  subtitle.fills = [{ type: "SOLID", color: DUSTY_GRAPE }];
  canvas.appendChild(subtitle);

  // Stages row
  const stagesRow = figma.createFrame();
  stagesRow.name = "stages";
  stagesRow.layoutMode = "HORIZONTAL";
  stagesRow.primaryAxisSizingMode = "AUTO";
  stagesRow.counterAxisSizingMode = "AUTO";
  stagesRow.counterAxisAlignItems = "MIN";
  stagesRow.itemSpacing = STAGE_GAP;
  stagesRow.fills = [];

  // Build a name->FrameNode lookup for mapping mode
  const framesByName: Record<string, FrameNode[]> = {};
  if (framesConfig) {
    for (const f of framesConfig.frames) {
      const n = f.name || "";
      if (!framesByName[n]) framesByName[n] = [];
      framesByName[n].push(f);
    }
  }

  for (let i = 0; i < data.stages.length; i++) {
    const stageFrame = await renderStage(data.stages[i], i);
    if (framesConfig && framesConfig.frames.length > 0) {
      if (framesConfig.mapping) {
        // AI mapping mode: find frames by stage name
        const mappedNames = framesConfig.mapping[data.stages[i].name] || [];
        for (const frameName of mappedNames) {
          const candidates = framesByName[frameName];
          if (candidates && candidates.length > 0) {
            await addScreenToStage(stageFrame, candidates[0], framesConfig.mode);
          }
        }
      } else {
        // Positional fallback: 1st frame -> 1st stage
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

/* ═══ Screen Scenario renderer ═══ */

const SCENARIO_SCREEN_HEIGHT = 400;

/* Vision annotation sticker colors */
const VISION_STICKER_COLORS: RGB[] = [
  { r: 1.0,  g: 0.87, b: 0.19 }, // yellow
  { r: 0.28, g: 0.86, b: 0.76 }, // teal
  { r: 0.55, g: 0.82, b: 0.42 }, // green
  { r: 1.0,  g: 0.67, b: 0.16 }, // orange
  { r: 0.62, g: 0.43, b: 0.90 }, // purple
];
const VISION_CARD_W = 200;
const VISION_CARD_GAP = 24;
const VISION_CARD_SPACING = 8;
const VISION_DOT_R = 5;

function drawConnector(
  parent: FrameNode,
  x1: number, y1: number,
  x2: number, y2: number,
  color: RGB,
  opacity = 0.5
): void {
  const minX = Math.min(x1, x2);
  const minY = Math.min(y1, y2);
  const vec = figma.createVector();
  vec.name = "connector";
  vec.x = minX;
  vec.y = minY;
  vec.vectorPaths = [{
    windingRule: "NONE",
    data: `M ${x1 - minX} ${y1 - minY} L ${x2 - minX} ${y2 - minY}`,
  }];
  vec.strokes = [{ type: "SOLID", color, opacity }];
  vec.strokeWeight = 1.5;
  parent.appendChild(vec);
}

function uint8ArrayToBase64(bytes: Uint8Array): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  let output = "";
  let i = 0;

  for (; i + 2 < bytes.length; i += 3) {
    const n = (bytes[i] << 16) | (bytes[i + 1] << 8) | bytes[i + 2];
    output += chars[(n >> 18) & 63];
    output += chars[(n >> 12) & 63];
    output += chars[(n >> 6) & 63];
    output += chars[n & 63];
  }

  const remaining = bytes.length - i;
  if (remaining === 1) {
    const n = bytes[i] << 16;
    output += chars[(n >> 18) & 63];
    output += chars[(n >> 12) & 63];
    output += "==";
  } else if (remaining === 2) {
    const n = (bytes[i] << 16) | (bytes[i + 1] << 8);
    output += chars[(n >> 18) & 63];
    output += chars[(n >> 12) & 63];
    output += chars[(n >> 6) & 63];
    output += "=";
  }

  return output;
}


export interface ScreenScenarioConfig {
  frames: FrameNode[];
  mapping: Record<string, string[]>;
  screenAnnotations?: Record<string, string>;
  includeVisionAnnotations?: boolean;
  visionPrompt?: string;
  apiKey?: string;
  transcriptText?: string;
  signal?: AbortSignal;
}

export async function renderScreenScenario(
  data: CJMData,
  config: ScreenScenarioConfig
): Promise<FrameNode> {
  if (!data.stages || data.stages.length === 0) {
    throw new Error("Нет этапов для отображения");
  }

  await loadFonts();

  let visionErrorMessage = "";
  let visionTotalAnnotations = 0;

  // Build name -> FrameNode lookup
  const framesByName: Record<string, FrameNode[]> = {};
  for (const f of config.frames) {
    const n = f.name || "";
    if (!framesByName[n]) framesByName[n] = [];
    framesByName[n].push(f);
  }

  const canvas = figma.createFrame();
  canvas.name = "CJM — Сценарий с экранами";
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

  // Title
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
  title.characters = "Сценарий с экранами";
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

  // Job Stories
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

  // Product analytics panel (same as in regular CJM mode)
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
    analyticsFrame.fills = [{ type: "SOLID", color: { r: 0.957, g: 0.941, b: 1.0 } }];

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

    const badgeItems: { label: string; value: string; color: RGB }[] = [];
    if (pa.lifecycle) badgeItems.push({ label: "Lifecycle", value: pa.lifecycle, color: DUSTY_GRAPE });
    if (pa.segment) badgeItems.push({ label: "Сегмент", value: pa.segment, color: BARBIE_PINK });
    if (pa.activated !== undefined) badgeItems.push({ label: "Активация", value: pa.activated ? "да" : "нет", color: pa.activated ? { r: 0.08, g: 0.68, b: 0.36 } : { r: 0.88, g: 0.24, b: 0.18 } });
    if (pa.engagementLevel) badgeItems.push({ label: "Вовлечённость", value: pa.engagementLevel, color: DUSTY_GRAPE });
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
      const segText = makeText("Сегмент: " + pa.segmentReasoning, FONT_REGULAR, 11, INK_BLACK, 700, 16);
      analyticsFrame.appendChild(segText);
    }
    if (pa.activationPoint) {
      const apText = makeText(
        "Точка активации: " + (pa.activationPoint.reached ? "достигнута" : "не достигнута") +
          " — " + (pa.activationPoint.stageName ? "этап «" + pa.activationPoint.stageName + "»" : "") +
          (pa.activationPoint.description ? ". " + pa.activationPoint.description : ""),
        FONT_REGULAR, 11, INK_BLACK, 700, 16
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
        const iText = makeText("• " + insight, FONT_REGULAR, 11, INK_BLACK, 700, 16);
        analyticsFrame.appendChild(iText);
      }
    }

    canvas.appendChild(analyticsFrame);
  }

  // Stages row (horizontal)
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

    // Stage number pill
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

    // Stage name
    const stageNameText = makeText(stage.name, FONT_SEMIBOLD, 14, INK_BLACK, 600, 20);
    stageGroup.appendChild(stageNameText);

    // Duration / channel badges
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
        db.paddingLeft = 6; db.paddingRight = 6; db.paddingTop = 2; db.paddingBottom = 2;
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
        cb.paddingLeft = 6; cb.paddingRight = 6; cb.paddingTop = 2; cb.paddingBottom = 2;
        cb.cornerRadius = 6;
        cb.fills = [{ type: "SOLID", color: BARBIE_PINK, opacity: 0.15 }];
        cb.appendChild(makeText(stage.channel, FONT_REGULAR, 10, BARBIE_PINK, 120, 14));
        badgesRow.appendChild(cb);
      }
      stageGroup.appendChild(badgesRow);
    }

    // Cloned screens row
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
        let savedPngBytes: Uint8Array | null = null;
        let screenNode: SceneNode | null = null;
        try {
          let pngBytes: Uint8Array | null = null;
          try {
            pngBytes = await original.exportAsync({ format: "PNG", constraint: { type: "HEIGHT", value: SCENARIO_SCREEN_HEIGHT } });
          } catch {
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
        } catch {
          const clone = original.clone();
          clone.rescale(scale);
          clone.cornerRadius = 8;
          screenNode = clone;
        }

        // ── Vision analysis ──
        let visionAnnotations: ScreenVisionAnnotation[] = [];
        if (
          config.includeVisionAnnotations &&
          config.apiKey &&
          config.transcriptText &&
          config.transcriptText.length > 0 &&
          savedPngBytes &&
          !(config.signal && config.signal.aborted)
        ) {
          try {
            const base64 = uint8ArrayToBase64(savedPngBytes);
            const stageCtx: VisionStageContext = {
              actions: stage.actions,
              touchpoints: stage.touchpoints,
              thoughts: stage.thoughts,
              experience: stage.experience,
              emotions: stage.emotions,
              quotes: stage.quotes,
            };
            figma.notify("[Vision] " + frameName + "...", { timeout: 5000 });
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
            figma.notify("[Vision] " + frameName + " => " + visionAnnotations.length + " аннотаций", { timeout: 5000 });
          } catch (err) {
            if (err instanceof Error && err.name === "AbortError") throw err;
            const errMsg = err instanceof Error ? err.message : String(err);
            figma.notify("[Vision ERR] " + frameName + ": " + errMsg.slice(0, 120), { timeout: 10000, error: true });
            if (!visionErrorMessage) visionErrorMessage = errMsg;
          }
        }

        // ── Render: annotated view (cards left + screen right) or plain screen ──
        if (visionAnnotations.length > 0 && screenNode) {
          const sorted = [...visionAnnotations].sort((a, b) => a.y - b.y);

          // Build cards first so we know their heights
          const cards: { node: FrameNode; ann: ScreenVisionAnnotation; color: RGB }[] = [];
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

          // Position cards on the left, avoiding overlaps
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

          // Annotated view (no auto-layout — absolute positioning)
          const annotView = figma.createFrame();
          annotView.name = "annotated-" + frameName;
          annotView.resize(viewW, viewH);
          annotView.fills = [];
          annotView.clipsContent = false;

          // Screen PNG on the right
          screenNode.x = pngLeft;
          screenNode.y = 0;
          annotView.appendChild(screenNode);

          // Append cards, draw connectors & dots
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

        // Screen name label
        const screenLabel = makeText(frameName, FONT_MEDIUM, 10, DUSTY_GRAPE, newWidth, 14);
        screenCol.appendChild(screenLabel);

        // Per-screen AI annotation
        if (config.screenAnnotations && config.screenAnnotations[frameName]) {
          const annText = makeText(config.screenAnnotations[frameName], FONT_REGULAR, 10, INK_BLACK, newWidth, 14);
          screenCol.appendChild(annText);
        }

        screensRow.appendChild(screenCol);
      }

      stageGroup.appendChild(screensRow);
    }

    // Divider
    const divider = figma.createRectangle();
    divider.name = "divider";
    divider.resize(200, 1);
    divider.fills = [{ type: "SOLID", color: PERIWINKLE }];
    stageGroup.appendChild(divider);

    // Annotation cards (same sections as regular CJM)
    const sections = [
      { key: "actions", label: "Действия", items: stage.actions ?? [] },
      { key: "touchpoints", label: "Touchpoints", items: stage.touchpoints ?? [] },
      { key: "experience", label: "Опыт", items: stage.experience ?? [] },
      { key: "thoughts", label: "Мысли", items: stage.thoughts ?? [] },
      { key: "emotions", label: "Эмоции", items: stage.emotions ?? [] },
      { key: "quotes", label: "Цитаты", items: stage.quotes ?? [] },
      { key: "metrics", label: "Метрики", items: stage.metrics ?? [] },
      { key: "hypotheses", label: "Гипотезы", items: stage.hypotheses ?? [] },
    ];

    for (const { key, label, items } of sections) {
      if (items.length === 0) continue;
      const formatItem = key === "quotes" ? (s: string) => "\u00AB" + s + "\u00BB" : undefined;
      const card = await createCard(label, items, CARD_COLORS[key] ?? CARD_COLORS.actions, formatItem);
      stageGroup.appendChild(card);
    }

    stagesRow.appendChild(stageGroup);
  }

  canvas.appendChild(stagesRow);

  if (config.includeVisionAnnotations) {
    if (visionErrorMessage) {
      figma.notify("Vision: " + visionErrorMessage, { error: true });
    } else if (visionTotalAnnotations > 0) {
      figma.notify("Vision: " + visionTotalAnnotations + " аннотаций создано");
    } else {
      figma.notify("Vision-аннотации не найдены по транскрипту для выбранных экранов.");
    }
  }

  figma.currentPage.appendChild(canvas);
  figma.viewport.scrollAndZoomIntoView([canvas]);
  figma.currentPage.selection = [canvas];

  return canvas;
}
