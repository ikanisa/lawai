export interface AcceptanceThresholds {
  citationsAllowlistedP95: number;
  temporalValidityP95: number;
  maghrebBindingBannerCoverage: number;
  rwandaLanguageNoticeCoverage: number;
  linkHealthFailureRatioMax: number;
}

export const ACCEPTANCE_THRESHOLDS: AcceptanceThresholds = {
  citationsAllowlistedP95: 0.95,
  temporalValidityP95: 0.95,
  maghrebBindingBannerCoverage: 1,
  rwandaLanguageNoticeCoverage: 1,
  linkHealthFailureRatioMax: 0.05,
};
