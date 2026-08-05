"use client";

import ReactMarkdown from "react-markdown";

interface ManualContentProps {
  content: string;
}

export function ManualContent({ content }: ManualContentProps) {
  return (
    <div className="space-y-4 text-sm leading-relaxed [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:pt-2 [&_ul]:list-disc [&_ul]:pl-5 [&_li]:space-y-1">
      <ReactMarkdown>{content}</ReactMarkdown>
    </div>
  );
}
