import { assetBlob } from "@/lib/assets";
import { useEffect, useState } from "react";

export function useImageAssetUrl(
  assetId?: string,
  legacyDataUrl?: string,
  kind: "preview" | "original" = "preview",
) {
  const [url, setUrl] = useState<string | undefined>(legacyDataUrl);
  useEffect(() => {
    let live = true;
    let objectUrl: string | undefined;
    if (!assetId) {
      setUrl(legacyDataUrl);
      return;
    }
    void assetBlob(assetId, kind)
      .then((blob) => {
        if (!live) return;
        if (!blob) {
          setUrl(legacyDataUrl);
          return;
        }
        objectUrl = URL.createObjectURL(blob);
        setUrl(objectUrl);
      })
      .catch(() => live && setUrl(legacyDataUrl));
    return () => {
      live = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [assetId, legacyDataUrl, kind]);
  return url;
}
