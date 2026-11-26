"use client";

// Adapted from React Bits "SplitText" (reactbits.dev, TS + Tailwind variant).
// Changes: trimmed to the load/view reveal (no hover/click/loop extras), and no
// inline `style` attribute because the production CSP sets style-src-attr 'none'.
// Splits by words by default: splitting Arabic into characters breaks letter joining.
import { useGSAP } from "@gsap/react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { SplitText as GSAPSplitText } from "gsap/SplitText";
import { useRef } from "react";

gsap.registerPlugin(ScrollTrigger, GSAPSplitText, useGSAP);

type SplitTextProps = {
  readonly text: string;
  readonly className?: string;
  readonly tag?: "h1" | "h2" | "h3" | "p" | "span";
  readonly splitType?: "words" | "lines";
  readonly delay?: number;
  readonly duration?: number;
  readonly trigger?: "load" | "view";
};

export function SplitText({
  text,
  className = "",
  tag: Tag = "p",
  splitType = "words",
  delay = 60,
  duration = 0.9,
  trigger = "load",
}: SplitTextProps) {
  const ref = useRef<HTMLHeadingElement>(null);

  useGSAP(
    () => {
      const element = ref.current;
      if (!element) return;
      const media = gsap.matchMedia();
      media.add("(prefers-reduced-motion: no-preference)", () => {
        const split = new GSAPSplitText(element, {
          type: splitType,
          smartWrap: true,
          wordsClass: "split-word",
          linesClass: "split-line",
        });
        const pieces = splitType === "lines" ? split.lines : split.words;
        gsap.fromTo(
          pieces,
          { opacity: 0, y: 32 },
          {
            opacity: 1,
            y: 0,
            duration,
            ease: "power3.out",
            stagger: delay / 1000,
            clearProps: "transform,opacity,willChange",
            scrollTrigger:
              trigger === "view"
                ? { trigger: element, start: "top 90%", once: true }
                : undefined,
          },
        );
        return () => split.revert();
      });
      return () => media.revert();
    },
    { dependencies: [text, splitType, delay, duration, trigger], scope: ref, revertOnUpdate: true },
  );

  return (
    <Tag ref={ref} className={`break-words ${className}`}>
      {text}
    </Tag>
  );
}
