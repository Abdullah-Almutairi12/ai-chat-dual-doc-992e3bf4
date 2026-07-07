import { useNavigate } from "@tanstack/react-router";
import type { CSSProperties, KeyboardEvent, MouseEvent, ReactNode } from "react";

type Props = {
  toolId: string;
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
  "aria-label"?: string;
};

/** Reliable link to /tools/:toolId — real href + SPA navigate on click. */
export function PdfToolLink({ toolId, className, style, children, "aria-label": ariaLabel }: Props) {
  const navigate = useNavigate();
  const href = `/tools/${toolId}`;

  const go = () => {
    void navigate({ to: "/tools/$toolId", params: { toolId } });
  };

  const onClick = (e: MouseEvent<HTMLAnchorElement>) => {
    if (
      e.defaultPrevented ||
      e.metaKey ||
      e.ctrlKey ||
      e.shiftKey ||
      e.altKey ||
      e.button !== 0
    ) {
      return;
    }
    e.preventDefault();
    go();
  };

  const onKeyDown = (e: KeyboardEvent<HTMLAnchorElement>) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      go();
    }
  };

  return (
    <a
      href={href}
      className={className}
      style={style}
      aria-label={ariaLabel}
      onClick={onClick}
      onKeyDown={onKeyDown}
    >
      {children}
    </a>
  );
}
