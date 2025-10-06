import { memo } from "react";
import { cn } from "@/lib/utils";

interface CodeSnippetProps {
  code: string;
  language?: string;
  className?: string;
}

const CodeSnippet = memo(({ code, language = "text", className }: CodeSnippetProps) => {
  const formatted = code?.trim().length ? code : "No content available.";

  return (
    <pre
      className={cn(
        "h-full w-full overflow-auto whitespace-pre-wrap break-words p-4 font-mono text-sm leading-relaxed text-slate-100",
        className,
      )}
      role="region"
      aria-label={`${language} code block`}
    >
      <code>{formatted}</code>
    </pre>
  );
});

CodeSnippet.displayName = "CodeSnippet";

export default CodeSnippet;
