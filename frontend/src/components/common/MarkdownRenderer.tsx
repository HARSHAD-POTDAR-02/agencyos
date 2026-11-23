"use client";

import React from "react";
import ReactMarkdown from "react-markdown";

interface MarkdownRendererProps {
  content: string;
  className?: string;
  isUser?: boolean;
}

export function MarkdownRenderer({ content, className = "", isUser = false }: MarkdownRendererProps) {
  if (!content) return null;

  return (
    <div
      className={`prose prose-xs sm:prose-sm max-w-none break-words ${
        isUser
          ? "text-white dark:text-[#F2F0F7] prose-headings:text-white prose-strong:text-white prose-code:text-white"
          : "text-[#191919] dark:text-[#F2F0F7] prose-headings:text-[#191919] dark:prose-headings:text-white prose-strong:text-[#191919] dark:prose-strong:text-white"
      } ${className}`}
    >
      <ReactMarkdown
        components={{
          h1: ({ children }) => (
            <h1 className="text-sm font-bold font-heading text-[#191919] dark:text-[#F2F0F7] mt-3.5 mb-1.5 pb-1 border-b border-black/[0.06] dark:border-white/[0.08] tracking-tight">
              {children}
            </h1>
          ),
          h2: ({ children }) => (
            <h2 className="text-xs font-bold font-heading text-[#191919] dark:text-[#F2F0F7] mt-3 mb-1 tracking-tight flex items-center gap-1.5">
              {children}
            </h2>
          ),
          h3: ({ children }) => (
            <h3 className="text-xs font-semibold text-[#191919] dark:text-[#F2F0F7] mt-2 mb-1 tracking-tight">
              {children}
            </h3>
          ),
          p: ({ children }) => (
            <p className="text-xs leading-relaxed mb-2 last:mb-0 text-[#2D2D2D] dark:text-[#E2E0EB]">
              {children}
            </p>
          ),
          ul: ({ children }) => (
            <ul className="list-disc list-outside pl-4 space-y-1 mb-2 text-xs text-[#2D2D2D] dark:text-[#E2E0EB]">
              {children}
            </ul>
          ),
          ol: ({ children }) => (
            <ol className="list-decimal list-outside pl-4 space-y-1 mb-2 text-xs text-[#2D2D2D] dark:text-[#E2E0EB]">
              {children}
            </ol>
          ),
          li: ({ children }) => (
            <li className="text-xs leading-relaxed marker:text-[#6B6A65] dark:marker:text-[#A3A0B0]">
              {children}
            </li>
          ),
          strong: ({ children }) => (
            <strong className="font-semibold text-[#111113] dark:text-white">
              {children}
            </strong>
          ),
          em: ({ children }) => (
            <em className="italic text-[#4A4946] dark:text-[#C5C3D0]">
              {children}
            </em>
          ),
          blockquote: ({ children }) => (
            <blockquote className="border-l-2 border-[#2383E2] dark:border-[#A78BFA] pl-3 py-1 my-2 text-[11px] italic bg-black/[0.02] dark:bg-white/[0.03] rounded-r text-[#52514D] dark:text-[#B5B3C2]">
              {children}
            </blockquote>
          ),
          code: ({ children, className }) => {
            const isInline = !className || !className.includes("language-");
            if (isInline) {
              return (
                <code className="px-1.5 py-0.5 rounded text-[10.5px] font-mono font-medium bg-black/[0.05] dark:bg-white/[0.08] text-[#191919] dark:text-[#F2F0F7] border border-black/[0.06] dark:border-white/[0.06]">
                  {children}
                </code>
              );
            }
            return (
              <pre className="p-3 my-2 rounded-xl bg-[#101014] text-white text-[11px] font-mono overflow-x-auto border border-white/[0.08]">
                <code>{children}</code>
              </pre>
            );
          },
          hr: () => <hr className="my-3 border-black/[0.08] dark:border-white/[0.08]" />,
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
