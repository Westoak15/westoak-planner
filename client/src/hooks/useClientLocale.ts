/**
 * client/src/hooks/useClientLocale.ts
 *
 * Client-specific locale — drives labels INSIDE the client workspace.
 * Separate from the advisor's own locale (useLocale) which drives the sidebar/nav.
 *
 * Ottawa Valley use case: English-speaking advisor, French-speaking client.
 * Advisor UI stays English, client file labels switch to French.
 *
 * Usage in any component inside the client workspace:
 *   const { ct, clientLocale } = useClientLocale();
 *   <label>{ct("netWorth.assets")}</label>
 */
import { createContext, useContext } from "react";
import { useTranslation }            from "react-i18next";

export type ClientLocale = "en" | "fr";

interface ClientLocaleCtx {
  clientLocale: ClientLocale;
  setClientLocale: (l: ClientLocale) => void;
}

export const ClientLocaleContext = createContext<ClientLocaleCtx>({
  clientLocale:    "en",
  setClientLocale: () => {},
});

/**
 * Returns a translate function (`ct`) scoped to the client's locale.
 * Falls back to English for any missing key.
 */
export function useClientLocale() {
  const { clientLocale, setClientLocale } = useContext(ClientLocaleContext);
  const { t } = useTranslation();

  // Translate using the CLIENT locale, not the advisor's locale
  const ct = (key: string): string => {
    const result = t(key, { lng: clientLocale });
    return result === key ? t(key, { lng: "en" }) : result;  // fallback to EN
  };

  return { ct, clientLocale, setClientLocale, isFrenchClient: clientLocale === "fr" };
}
