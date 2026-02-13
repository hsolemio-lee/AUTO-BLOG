"use client";

import { useEffect } from "react";

export default function AdSlot({ slot, className = "" }) {
  const client = process.env.NEXT_PUBLIC_ADSENSE_CLIENT;

  useEffect(() => {
    if (!client || !slot) {
      return;
    }

    try {
      window.adsbygoogle = window.adsbygoogle || [];
      window.adsbygoogle.push({});
    } catch {
    }
  }, [client, slot]);

  if (!client || !slot) {
    return null;
  }

  return (
    <ins
      className={`adsbygoogle ${className}`.trim()}
      data-ad-client={client}
      data-ad-slot={slot}
      data-ad-format="auto"
      data-full-width-responsive="true"
      style={{ display: "block" }}
    />
  );
}
