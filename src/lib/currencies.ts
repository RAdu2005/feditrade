import currencyCodes from "currency-codes";

const nonCirculatingCurrencyCodes = new Set([
  "BOV",
  "CHE",
  "CHW",
  "CLF",
  "COU",
  "MXV",
  "USN",
  "UYI",
  "UYW",
  "XAG",
  "XAU",
  "XBA",
  "XBB",
  "XBC",
  "XBD",
  "XDR",
  "XPD",
  "XPT",
  "XSU",
  "XTS",
  "XUA",
  "XXX",
]);

const defaultPriorityCurrencyCodes = ["EUR", "USD", "CNY"];

function currencyDisplayName(code: string) {
  return currencyCodes.code(code)?.currency ?? code;
}

const supportedCurrencyCodes = currencyCodes.codes();

export const MASS_CIRCULATION_CURRENCY_CODES = supportedCurrencyCodes
  .filter((code) => /^[A-Z]{3}$/.test(code))
  .filter((code) => !nonCirculatingCurrencyCodes.has(code))
  .sort((a, b) => a.localeCompare(b));

export const MASS_CIRCULATION_CURRENCY_CODE_SET = new Set(MASS_CIRCULATION_CURRENCY_CODES);

export const MASS_CIRCULATION_CURRENCY_OPTIONS = MASS_CIRCULATION_CURRENCY_CODES
  .map((code) => ({
    code,
    label: `${code} - ${currencyDisplayName(code)}`,
  }))
  .sort((a, b) => a.label.localeCompare(b.label));

const currencyOptionByCode = new Map(
  MASS_CIRCULATION_CURRENCY_OPTIONS.map((option) => [option.code, option]),
);

function parsePriorityCurrencies(): string[] {
  const configured = process.env.NEXT_PUBLIC_PRIORITY_CURRENCIES;
  if (!configured) {
    return defaultPriorityCurrencyCodes;
  }

  const codes = configured
    .split(",")
    .map((code) => code.trim().toUpperCase())
    .filter((code) => MASS_CIRCULATION_CURRENCY_CODE_SET.has(code));

  const deduped = [...new Set(codes)];
  return deduped.length > 0 ? deduped : defaultPriorityCurrencyCodes;
}

export const PRIORITY_CURRENCY_CODES = parsePriorityCurrencies();
export const CURRENCY_OPTION_BY_CODE = currencyOptionByCode;
