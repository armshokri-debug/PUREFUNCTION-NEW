const CURRENT_APP = 'https://armshokri-debug.github.io/PUREFUNCTION-NEW/';
const RETIRED_APP = 'https://audiovido.github.io/Purefunction-2/';

/** Migrate the retired production link; retain explicit staging deployments. */
export function resolveAppUrl(configured?: string) {
  if (!configured || configured.replace(/\/$/, '') === RETIRED_APP.replace(/\/$/, '')) return CURRENT_APP;
  return configured;
}
