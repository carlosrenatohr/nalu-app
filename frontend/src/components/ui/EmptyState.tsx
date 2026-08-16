import type { ReactNode } from "react";

export function EmptyState({
  emoji,
  title,
  description,
  action,
}: {
  emoji: string;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-[1.25rem] bg-white/70 px-6 py-10 text-center ring-1 ring-cocoa/5">
      <span className="text-5xl" aria-hidden="true">
        {emoji}
      </span>
      <h3 className="text-lg font-extrabold text-cocoa">{title}</h3>
      <p className="max-w-xs text-sm text-cocoa-soft">{description}</p>
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}
