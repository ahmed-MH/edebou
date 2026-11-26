"use client";

import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Lenis from "lenis";
import { usePathname } from "next/navigation";
import { useEffect } from "react";

gsap.registerPlugin(ScrollTrigger);

/** Lenis smooth scrolling for the storefront, driven by GSAP's ticker so ScrollTrigger stays in sync. */
export function SmoothScroll() {
  const isAdmin = usePathname().startsWith("/admin");

  useEffect(() => {
    if (isAdmin || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    // Same offset as `scroll-padding-top: 9rem` in globals.css, so anchors clear the sticky header.
    const lenis = new Lenis({ anchors: { offset: -144 } });
    lenis.on("scroll", ScrollTrigger.update);
    const tick = (time: number) => lenis.raf(time * 1000);
    gsap.ticker.add(tick);
    gsap.ticker.lagSmoothing(0);

    return () => {
      gsap.ticker.remove(tick);
      lenis.destroy();
    };
  }, [isAdmin]);

  return null;
}
