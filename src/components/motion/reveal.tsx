"use client";

import { useGSAP } from "@gsap/react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useRef, type ReactNode } from "react";

gsap.registerPlugin(ScrollTrigger, useGSAP);

type RevealProps = {
  readonly children: ReactNode;
  readonly className?: string;
  /** CSS selector, inside this wrapper, of the elements that fade in one after another. */
  readonly targets?: string;
};

/** Fades and lifts its items in when they scroll into view. Skipped for reduced motion. */
export function Reveal({ children, className, targets = ":scope > *" }: RevealProps) {
  const ref = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const element = ref.current;
      if (!element) return;
      const media = gsap.matchMedia();
      media.add("(prefers-reduced-motion: no-preference)", () => {
        gsap.from(element.querySelectorAll(targets), {
          opacity: 0,
          y: 28,
          duration: 0.7,
          ease: "power2.out",
          stagger: 0.08,
          clearProps: "transform,opacity",
          scrollTrigger: { trigger: element, start: "top 88%", once: true },
        });
      });
      return () => media.revert();
    },
    { scope: ref },
  );

  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}
