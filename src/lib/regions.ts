import countries from "i18n-iso-countries";
import enLocale from "i18n-iso-countries/langs/en.json";

const nonCountryRegionCodes = new Set(["EU", "EZ", "TW", "UN", "ZZ"]);
const defaultPriorityCountryCodes = ["FI", "US", "CN"];

countries.registerLocale(enLocale);

function regionDisplayName(code: string) {
  const localeName = countries.getName(code, "en");
  return localeName ?? code;
}

const supportedRegionCodes = Object.keys(countries.getAlpha2Codes());

export const COUNTRY_TERRITORY_CODES = supportedRegionCodes
  .filter((code) => /^[A-Z]{2}$/.test(code))
  .filter((code) => !nonCountryRegionCodes.has(code))
  .sort((a, b) => a.localeCompare(b));

export const COUNTRY_TERRITORY_CODE_SET = new Set(COUNTRY_TERRITORY_CODES);

export const COUNTRY_TERRITORY_OPTIONS = COUNTRY_TERRITORY_CODES
  .map((code) => {
    const name = regionDisplayName(code);
    return {
      code,
      name,
      label: `${name} (${code})`,
    };
  })
  .sort((a, b) => a.name.localeCompare(b.name));

export const COUNTRY_OPTION_BY_CODE = new Map(
  COUNTRY_TERRITORY_OPTIONS.map((option) => [option.code, option]),
);

export const COUNTRY_CODE_BY_NAME = new Map(
  COUNTRY_TERRITORY_OPTIONS.map((option) => [option.name.toLowerCase(), option.code]),
);

function parsePriorityCountries(): string[] {
  const configured = process.env.NEXT_PUBLIC_PRIORITY_COUNTRIES;
  if (!configured) {
    return defaultPriorityCountryCodes;
  }

  const codes = configured
    .split(",")
    .map((code) => code.trim().toUpperCase())
    .filter((code) => COUNTRY_TERRITORY_CODE_SET.has(code));

  const deduped = [...new Set(codes)];
  return deduped.length > 0 ? deduped : defaultPriorityCountryCodes;
}

export const PRIORITY_COUNTRY_CODES = parsePriorityCountries();
