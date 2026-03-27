type PipelineKind = "buyer" | "seller";

export const BUYER_STAGES = [
  "Lead",
  "Contacted",
  "Showing Homes",
  "Offer",
  "Under Contract",
  "Inspection",
  "Appraisal",
  "Closed",
  "Past Client",
] as const;

export const SELLER_STAGES = [
  "Lead",
  "Met",
  "Listed",
  "Under Contract",
  "Inspection",
  "Closed",
  "Past Client",
] as const;

export function getStagesForPipeline(pipeline: PipelineKind): readonly string[] {
  return pipeline === "buyer" ? BUYER_STAGES : SELLER_STAGES;
}
