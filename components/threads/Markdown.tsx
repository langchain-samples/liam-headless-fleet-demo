"use client";

import * as React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "@/lib/cn";

// Renders assistant message text as markdown, styled to match the chat surface.
// Used for AI bubbles (the model emits **bold**, lists, code, links, etc.).
export function Markdown({ children, className }: { children: string; className?: string }) {
  return (
    <div className={cn("dm-md text-[14px] leading-[1.65] text-ink", className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          // Open links safely in a new tab.
          a: ({ ...props }) => (
            <a {...props} target="_blank" rel="noopener noreferrer" className="text-navy underline decoration-line-strong underline-offset-2 hover:text-navy-600" />
          ),
          // Distinguish inline code from fenced blocks.
          code: ({ className: c, children: ch, ...props }) => {
            const isBlock = /language-/.test(c ?? "");
            if (isBlock) {
              return (
                <code className="block overflow-x-auto rounded-[10px] border border-line bg-paper-2/70 px-3 py-2 font-mono text-[12.5px] text-ink-soft" {...props}>
                  {ch}
                </code>
              );
            }
            return (
              <code className="rounded bg-paper-2 px-1 py-0.5 font-mono text-[12.5px] text-ink-soft" {...props}>
                {ch}
              </code>
            );
          },
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
