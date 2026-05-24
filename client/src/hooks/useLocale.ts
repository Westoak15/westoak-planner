/**
 * client/src/hooks/useLocale.ts
 *
 * Locale management hook.
 *
 * Usage:
 *   const { t, locale, setLocale, isFrench, isForced } = useLocale();
 *   <h1>{t("nav.clients")}</h1>
 *
 * French is FORCED (cannot be overridden) when the advisor's province is QC.
 * All other provinces default to English but allow manual toggle.
 */
import { useCallback }        from "react";
import { useTranslation }     from "react-i18next";
import i18n, { localeFromProvince, isFrenchForced, type Locale } from "../i18n";
import { useAuth }            from "../lib/auth";

export function useLocale() {
  const { t, i18n: i18nInst } = useTranslation();
  const { user }               = useAuth();

  const locale    = i18nInst.language as Locale;
  const isFrench  = locale === "fr";
  const isForced  = isFrenchForced(user?.province);

  /**
   * Change locale. If the advisor is in QC the switch to English is blocked.
   */
  const setLocale = useCallback((l: Locale) => {
    if (isForced && l === "en") return; // QC advisors cannot switch to English
    i18nInst.changeLanguage(l);
    localStorage.setItem("be_locale", l);
  }, [isForced, i18nInst]);

  return { t, locale, setLocale, isFrench, isForced };
}

/**
 * Initialise locale from user profile.
 * Called once after login in AuthProvider.
 */
export function applyLocaleFromUser(province?: string | null, savedLocale?: string | null) {
  // QC always forces French regardless of saved preference
  if (isFrenchForced(province)) {
    i18n.changeLanguage("fr");
    return;
  }
  // Otherwise use saved preference, then user's profile locale, then English
  const locale = (savedLocale ?? localStorage.getItem("be_locale") ?? localeFromProvince(province) ?? "en") as Locale;
  i18n.changeLanguage(locale);
}
