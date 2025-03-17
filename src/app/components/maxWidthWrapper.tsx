import React from "react";
import { cn } from "~/lib/utils";

type MaxWidthWapperProps = {
  className?: string;
  children: React.ReactNode;
};

const MaxWidthWapper = ({ className, children }: MaxWidthWapperProps) => {
  return (
    <div
      className={cn("mx-auto h-full w-full max-w-screen-xl px-3", className)}
    >
      {children}
    </div>
  );
};

export default MaxWidthWapper;
