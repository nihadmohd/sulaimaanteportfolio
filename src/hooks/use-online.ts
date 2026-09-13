"use client";

import * as React from "react";

/** Online/offline state backed by navigator.onLine + online/offline listeners. */
export function useOnline(): boolean {
  const [online, setOnline] = React.useState<boolean>(true);

  React.useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);

  return online;
}
