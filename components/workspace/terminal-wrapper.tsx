"use client";

import React from "react";
import dynamic from "next/dynamic";

const TerminalComponent = dynamic(
  () => import("./terminal").then((mod) => mod.Terminal),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-full bg-black flex items-center justify-center text-muted-foreground text-xs">
        Loading Terminal...
      </div>
    ),
  }
);

export const TerminalWrapper = React.forwardRef((props: any, ref) => {
  return <TerminalComponent {...props} ref={ref} />;
});
TerminalWrapper.displayName = "TerminalWrapper";
