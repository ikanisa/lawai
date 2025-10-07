import type { Variants, Transition } from "framer-motion";

export const motionTiming: Transition = {
  duration: 0.18,
  ease: [0.2, 0.8, 0.2, 1]
};

export const pageTransition: Variants = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0, transition: { ...motionTiming, type: "spring", damping: 22, stiffness: 200, mass: 0.8 } },
  exit: { opacity: 0, y: -8, transition: motionTiming }
};

export const messageTransition: Variants = {
  initial: { opacity: 0, scale: 0.98 },
  animate: { opacity: 1, scale: 1, transition: motionTiming }
};

export const chipTransition: Variants = {
  initial: { opacity: 0, y: 6 },
  animate: { opacity: 1, y: 0, transition: motionTiming }
};

export const fadeInUp: Variants = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0, transition: motionTiming }
};
