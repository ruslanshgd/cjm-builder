/**
 * Unified CJM (Customer Journey Map) data structures
 */

export interface CJMStage {
  name: string;
  actions: string[];
  touchpoints: string[];
  experience: string[];
  thoughts: string[];
  emotions: string[];
  quotes: string[];
  illustrations: string[];
  metrics: string[];
  hypotheses: string[];
  duration?: string;
  channel?: string;
  screenAnnotations?: Record<string, string>;
}

export interface JobStory {
  situation: string;
  motivation: string;
  outcome: string;
}

export interface ActivationPoint {
  stageName: string;
  description: string;
  reached: boolean;
}

export interface ProductAnalytics {
  lifecycle?: "new" | "active" | "inactive" | "churned" | "reactivated";
  activated?: boolean;
  segment?: "A" | "B" | "C" | "D" | "X";
  segmentReasoning?: string;
  activationPoint?: ActivationPoint;
  engagementLevel?: "low" | "medium" | "high";
  adoptionStatus?: "none" | "partial" | "full";
  adoptionDetails?: string;
  productInsights?: string[];
}

export interface CJMData {
  stageFramework?: "base" | "aarrr" | "aida";
  jobStories?: JobStory[];
  productAnalytics?: ProductAnalytics;
  stages: CJMStage[];
}

export type SourceType = "excel" | "transcript" | "googleSheets";
