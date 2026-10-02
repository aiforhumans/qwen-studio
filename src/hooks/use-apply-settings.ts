import { getSettings } from "@/lib/storage";
import { useEffect } from "react";
export function useApplySettings() {
  useEffect(() => {
    const apply = () => {
      const s = getSettings();
      document.documentElement.classList.toggle("light", s.theme === "light");
      document.documentElement.classList.toggle("density-comfortable", s.density === "comfortable");
    };
    apply();
    window.addEventListener("qps-settings", apply);
    return () => window.removeEventListener("qps-settings", apply);
  }, []);
}
