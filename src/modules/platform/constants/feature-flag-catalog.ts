export type FeatureFlagCatalogEntry = {
  key: string;
  label: string;
  description?: string;
};

export const DEFAULT_FEATURE_FLAG_CATALOG: FeatureFlagCatalogEntry[] = [
  {
    key: 'transitImport',
    label: 'Transit Import',
    description: 'Enable transit import module for tenant.',
  },
  {
    key: 'processFlow',
    label: 'Process Flow',
    description: 'Enable process flow (transfer, transformation, recipes).',
  },
  {
    key: 'customDomain',
    label: 'Custom Domain',
    description: 'Allow tenant to use custom subdomain/domain.',
  },
];

export const FEATURE_FLAG_CATALOG_SETTING_KEY = 'feature_flag_catalog';
