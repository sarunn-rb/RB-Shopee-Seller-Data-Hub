import type { ReactNode } from "react";

export function PlaceholderPage({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children?: ReactNode;
}) {
  return (
    <div className="mx-auto w-full max-w-[1360px] px-4 py-8 sm:px-7 lg:px-10 lg:py-9">
      <h1 className="text-[30px] font-semibold tracking-[-0.035em]">{title}</h1>
      <p className="mt-1 max-w-2xl text-[15px] leading-6 text-muted-foreground">
        {description}
      </p>
      {children}
    </div>
  );
}
