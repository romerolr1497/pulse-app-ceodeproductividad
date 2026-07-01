// Confetti ligero sin dependencias — partículas DOM con animación CSS.

const COLORS = ["#e5a01e", "#34d399", "#3b82f6", "#a78bfa", "#ec4899", "#f4f4f5"];

/**
 * Lanza una pequeña ráfaga de confeti desde un punto de la pantalla.
 * @param x coordenada X de origen (px). Por defecto centro horizontal.
 * @param y coordenada Y de origen (px). Por defecto un poco arriba del centro.
 * @param count cantidad de partículas.
 */
export function fireConfetti(x?: number, y?: number, count = 18) {
  if (typeof window === "undefined") return;
  // Respeta usuarios con movimiento reducido
  if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;

  const originX = x ?? window.innerWidth / 2;
  const originY = y ?? window.innerHeight / 2.5;

  const container = document.createElement("div");
  container.style.cssText =
    "position:fixed;left:0;top:0;width:0;height:0;pointer-events:none;z-index:9999;";
  document.body.appendChild(container);

  for (let i = 0; i < count; i++) {
    const p = document.createElement("span");
    const color = COLORS[Math.floor(Math.random() * COLORS.length)];
    const angle = Math.random() * Math.PI * 2;
    const velocity = 60 + Math.random() * 120;
    const dx = Math.cos(angle) * velocity;
    const dy = Math.sin(angle) * velocity - (40 + Math.random() * 60);
    const size = 5 + Math.random() * 5;
    const rot = Math.random() * 360;

    p.style.cssText = `
      position:fixed;
      left:${originX}px;
      top:${originY}px;
      width:${size}px;
      height:${size * (0.4 + Math.random() * 0.8)}px;
      background:${color};
      border-radius:1px;
      opacity:1;
      will-change:transform,opacity;
      transform:rotate(${rot}deg);
    `;
    container.appendChild(p);

    const duration = 600 + Math.random() * 500;
    p.animate(
      [
        { transform: `translate(0,0) rotate(${rot}deg)`, opacity: 1 },
        {
          transform: `translate(${dx}px, ${dy + 140}px) rotate(${rot + 360}deg)`,
          opacity: 0,
        },
      ],
      { duration, easing: "cubic-bezier(.2,.6,.3,1)", fill: "forwards" }
    );
  }

  setTimeout(() => container.remove(), 1200);
}
