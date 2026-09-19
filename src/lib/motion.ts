"use client";

/**
 * Animaciones de la app con anime.js v4.
 * API v4: importar funciones individuales (animate, stagger, createTimeline…).
 * Docs: https://animejs.com/documentation
 */
import { animate, stagger } from "animejs";

export { animate, stagger };

const EASE_OUT = "out(3)";

/** Entrada suave de una página/sección: fade + slide-up. */
export function pageEnter(el: Element | null) {
  if (!el) return;
  animate(el, {
    opacity: [0, 1],
    translateY: [16, 0],
    duration: 420,
    ease: EASE_OUT,
  });
}

type AnimTargets = Element | Element[] | NodeList | null | undefined;

/** Stagger de elementos (tarjetas, filas, chips). */
export function staggerIn(targets: AnimTargets, delay = 40) {
  if (!targets) return;
  animate(targets, {
    opacity: [0, 1],
    translateY: [10, 0],
    delay: stagger(delay),
    duration: 380,
    ease: EASE_OUT,
  });
}

/** Apertura del modal: overlay fade + panel scale-up. */
export function modalIn(overlay: Element | null, panel: Element | null) {
  if (overlay) {
    animate(overlay, { opacity: [0, 1], duration: 200, ease: "out(2)" });
  }
  if (panel) {
    animate(panel, {
      opacity: [0, 1],
      scale: [0.94, 1],
      translateY: [14, 0],
      duration: 300,
      ease: EASE_OUT,
    });
  }
}

/** Cierre del modal. Llama onDone al terminar. */
export function modalOut(overlay: Element | null, panel: Element | null, onDone?: () => void) {
  if (!overlay || !panel) {
    onDone?.();
    return;
  }
  animate(panel, {
    opacity: [1, 0],
    scale: [1, 0.96],
    translateY: [0, 10],
    duration: 180,
    ease: "in(2)",
  });
  animate(overlay, {
    opacity: [1, 0],
    duration: 180,
    ease: "in(2)",
    onComplete: () => onDone?.(),
  });
}

/** Stagger de campos del formulario al abrir el modal. */
export function fieldsIn(targets: AnimTargets) {
  if (!targets) return;
  animate(targets, {
    opacity: [0, 1],
    translateY: [8, 0],
    delay: stagger(35),
    duration: 320,
    ease: EASE_OUT,
  });
}

/** Shake horizontal para errores de validación. */
export function shake(el: Element | null) {
  if (!el) return;
  animate(el, {
    translateX: [0, -8, 8, -5, 5, -2, 0],
    duration: 450,
    ease: "out(2)",
  });
}

/** Pop de confirmación (botón guardado, éxito). */
export function successPop(el: Element | null) {
  if (!el) return;
  animate(el, {
    scale: [1, 1.12, 0.96, 1],
    duration: 450,
    ease: "out(3)",
  });
}

/** Pulso de alerta (cupo lleno, aviso). */
export function alertPulse(el: Element | null) {
  if (!el) return;
  animate(el, {
    scale: [1, 1.08, 1],
    opacity: [1, 0.7, 1],
    duration: 600,
    ease: "inOut(2)",
  });
}
