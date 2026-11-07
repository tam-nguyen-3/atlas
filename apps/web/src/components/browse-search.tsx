import { useEffect, useRef, useState } from "react";
import { Search, X } from "lucide-react";
import { Input } from "./ui/input";
import { Button } from "./ui/button";

export function BrowseSearch({
  committed,
  commit,
  children,
  navigationKey,
}: {
  committed: string;
  commit: (value: string) => void;
  children: React.ReactNode;
  navigationKey: string;
}) {
  const [draft, setDraft] = useState(committed);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const composing = useRef(false);
  const input = useRef<HTMLInputElement>(null);
  const commitRef = useRef(commit);
  commitRef.current = commit;
  function cancel() {
    clearTimeout(timer.current);
  }
  function submit(value: string) {
    cancel();
    if (value.trim() !== committed) commitRef.current(value.trim());
  }
  function schedule(value: string) {
    cancel();
    if (!composing.current)
      timer.current = setTimeout(() => submit(value), 300);
  }
  useEffect(() => {
    cancel();
    setDraft(committed);
    return cancel;
  }, [committed, navigationKey]);
  return (
    <form
      className="search-box"
      role="search"
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        if (!composing.current) submit(draft);
      }}
    >
      <Search size={21} aria-hidden="true" />
      <Input
        ref={input}
        aria-label="Search insights"
        placeholder="Search insights"
        value={draft}
        onChange={(event) => {
          setDraft(event.target.value);
          schedule(event.target.value);
        }}
        onCompositionStart={() => {
          composing.current = true;
          cancel();
        }}
        onCompositionEnd={(event) => {
          composing.current = false;
          schedule(event.currentTarget.value);
        }}
        onKeyDown={(event) => {
          if (
            event.key === "Enter" &&
            (composing.current ||
              event.nativeEvent.isComposing ||
              event.keyCode === 229)
          )
            event.preventDefault();
        }}
      />
      {draft && (
        <Button
          type="button"
          variant="ghost"
          aria-label="Clear search"
          onClick={() => {
            composing.current = false;
            setDraft("");
            submit("");
            input.current?.focus();
          }}
        >
          <X size={19} aria-hidden="true" />
        </Button>
      )}
      {children}
    </form>
  );
}
