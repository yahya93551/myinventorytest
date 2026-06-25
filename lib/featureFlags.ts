// Central place for feature flags. Use NEXT_PUBLIC_ prefix for client visibility.
export const FEATURE_CUSTOM_FIELDS =
  (typeof process !== 'undefined' &&
    (process.env.NEXT_PUBLIC_FEATURE_CUSTOM_FIELDS === 'true' || process.env.FEATURE_CUSTOM_FIELDS === 'true')) ||
  false;

export default {
  FEATURE_CUSTOM_FIELDS,
};
