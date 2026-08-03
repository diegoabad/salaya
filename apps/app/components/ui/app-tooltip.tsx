"use client";

import {
  cloneElement,
  isValidElement,
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type FocusEvent,
  type MouseEvent,
  type ReactElement,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";

export type AppTooltipPlacement = "right" | "left" | "top" | "bottom";

type TooltipLayout = {
  top: number;
  left: number;
  placement: AppTooltipPlacement;
  arrowAnchor: number;
  arrowY?: number;
};

type AppTooltipProps = {
  label: string;
  hint?: string;
  enabled?: boolean;
  placement?: AppTooltipPlacement;
  children: ReactNode;
};

type ElementWithHandlers = ReactElement<{
  onMouseEnter?: (e: MouseEvent<HTMLElement>) => void;
  onMouseLeave?: (e: MouseEvent<HTMLElement>) => void;
  onFocus?: (e: FocusEvent<HTMLElement>) => void;
  onBlur?: (e: FocusEvent<HTMLElement>) => void;
  "aria-describedby"?: string;
}>;

const VIEWPORT_PAD = 8;
const GAP = 8;

let hideActiveTooltip: (() => void) | null = null;

function ocultarTooltipActivo() {
  hideActiveTooltip?.();
  hideActiveTooltip = null;
}

function posicionInicial(
  el: HTMLElement,
  preferred: AppTooltipPlacement,
): TooltipLayout {
  const rect = el.getBoundingClientRect();

  switch (preferred) {
    case "top":
      return {
        top: rect.top - GAP,
        left: rect.left + rect.width / 2,
        placement: "top",
        arrowAnchor: rect.left + rect.width / 2,
      };
    case "bottom":
      return {
        top: rect.bottom + GAP,
        left: rect.left + rect.width / 2,
        placement: "bottom",
        arrowAnchor: rect.left + rect.width / 2,
      };
    case "left":
      return {
        top: rect.top + rect.height / 2,
        left: rect.left - GAP,
        placement: "left",
        arrowAnchor: rect.top + rect.height / 2,
      };
    default:
      return {
        top: rect.top + rect.height / 2,
        left: rect.right + GAP,
        placement: "right",
        arrowAnchor: rect.top + rect.height / 2,
      };
  }
}

function ajustarAlViewport(
  trigger: HTMLElement,
  tooltip: HTMLElement,
  preferred: AppTooltipPlacement,
): TooltipLayout {
  const rect = trigger.getBoundingClientRect();
  const tipW = tooltip.offsetWidth;
  const tipH = tooltip.offsetHeight;
  const triggerCenterX = rect.left + rect.width / 2;
  const triggerCenterY = rect.top + rect.height / 2;

  if (preferred === "top" || preferred === "bottom") {
    let placement: AppTooltipPlacement = preferred;
    let left = triggerCenterX - tipW / 2;
    left = Math.max(
      VIEWPORT_PAD,
      Math.min(left, window.innerWidth - tipW - VIEWPORT_PAD),
    );

    let top = placement === "top" ? rect.top - GAP : rect.bottom + GAP;

    if (placement === "top" && top - tipH < VIEWPORT_PAD) {
      placement = "bottom";
      top = rect.bottom + GAP;
    } else if (
      placement === "bottom" &&
      top + tipH > window.innerHeight - VIEWPORT_PAD
    ) {
      placement = "top";
      top = rect.top - GAP;
    }

    return {
      top,
      left,
      placement,
      arrowAnchor: Math.max(
        left + 12,
        Math.min(triggerCenterX, left + tipW - 12),
      ),
    };
  }

  const cabeDerecha =
    rect.right + GAP + tipW <= window.innerWidth - VIEWPORT_PAD;
  const cabeIzquierda = rect.left - GAP - tipW >= VIEWPORT_PAD;

  if (!cabeIzquierda && !cabeDerecha) {
    let placement: AppTooltipPlacement = "top";
    let left = triggerCenterX - tipW / 2;
    left = Math.max(
      VIEWPORT_PAD,
      Math.min(left, window.innerWidth - tipW - VIEWPORT_PAD),
    );

    let top = rect.top - GAP;
    if (top - tipH < VIEWPORT_PAD) {
      placement = "bottom";
      top = rect.bottom + GAP;
    }

    return {
      top,
      left,
      placement,
      arrowAnchor: Math.max(
        left + 12,
        Math.min(triggerCenterX, left + tipW - 12),
      ),
    };
  }

  let placement: AppTooltipPlacement = preferred;
  if (preferred === "right" && !cabeDerecha && cabeIzquierda) {
    placement = "left";
  } else if (preferred === "left" && !cabeIzquierda && cabeDerecha) {
    placement = "right";
  }

  let centerY = triggerCenterY;
  centerY = Math.max(
    VIEWPORT_PAD + tipH / 2,
    Math.min(centerY, window.innerHeight - tipH / 2 - VIEWPORT_PAD),
  );

  const left = placement === "left" ? rect.left - GAP : rect.right + GAP;
  const arrowY = triggerCenterY - centerY + tipH / 2;

  return {
    top: centerY,
    left,
    placement,
    arrowAnchor: triggerCenterY,
    arrowY: Math.max(12, Math.min(arrowY, tipH - 12)),
  };
}

export function AppTooltip({
  label,
  hint,
  enabled = true,
  placement = "top",
  children,
}: AppTooltipProps) {
  const tooltipId = useId();
  const triggerRef = useRef<HTMLElement | null>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const [layout, setLayout] = useState<TooltipLayout>({
    top: 0,
    left: 0,
    placement,
    arrowAnchor: 0,
  });
  const hideRef = useRef<() => void>(() => {});

  const ocultar = useCallback(() => {
    setVisible(false);
    triggerRef.current = null;
    if (hideActiveTooltip === hideRef.current) {
      hideActiveTooltip = null;
    }
  }, []);

  hideRef.current = ocultar;

  const mostrar = useCallback(
    (e: MouseEvent<HTMLElement> | FocusEvent<HTMLElement>) => {
      ocultarTooltipActivo();
      hideActiveTooltip = hideRef.current;
      triggerRef.current = e.currentTarget;
      setLayout(posicionInicial(e.currentTarget, placement));
      setVisible(true);
    },
    [placement],
  );

  useLayoutEffect(() => {
    if (!visible || !triggerRef.current || !tooltipRef.current) return;
    setLayout(
      ajustarAlViewport(triggerRef.current, tooltipRef.current, placement),
    );
  }, [visible, placement, label, hint]);

  useEffect(() => {
    if (!enabled) ocultar();
  }, [enabled, ocultar]);

  useEffect(() => {
    if (!visible) return;

    function onPointerDown(ev: PointerEvent) {
      const target = ev.target as Node;
      if (triggerRef.current?.contains(target)) return;
      ocultar();
    }

    window.addEventListener("pointerdown", onPointerDown, true);
    return () => window.removeEventListener("pointerdown", onPointerDown, true);
  }, [visible, ocultar]);

  useEffect(() => {
    return () => {
      if (hideActiveTooltip === hideRef.current) {
        hideActiveTooltip = null;
      }
    };
  }, []);

  if (!enabled || !isValidElement(children)) {
    return <>{children}</>;
  }

  const child = children as ElementWithHandlers;

  const conTooltip = cloneElement(child, {
    onMouseEnter: (e: MouseEvent<HTMLElement>) => {
      child.props.onMouseEnter?.(e);
      mostrar(e);
    },
    onMouseLeave: (e: MouseEvent<HTMLElement>) => {
      child.props.onMouseLeave?.(e);
      ocultar();
    },
    onFocus: (e: FocusEvent<HTMLElement>) => {
      child.props.onFocus?.(e);
      mostrar(e);
    },
    onBlur: (e: FocusEvent<HTMLElement>) => {
      child.props.onBlur?.(e);
      ocultar();
    },
    "aria-describedby": visible ? tooltipId : undefined,
  });

  const arrowStyle =
    layout.placement === "top" || layout.placement === "bottom"
      ? ({
          "--tooltip-arrow-x": `${layout.arrowAnchor - layout.left}px`,
        } as CSSProperties)
      : layout.arrowY != null
        ? ({
            "--tooltip-arrow-y": `${layout.arrowY}px`,
          } as CSSProperties)
        : undefined;

  return (
    <>
      {conTooltip}
      {visible
        ? createPortal(
            <div
              ref={tooltipRef}
              id={tooltipId}
              className={`app-tooltip app-tooltip--${layout.placement}`}
              role="tooltip"
              style={{
                top: layout.top,
                left: layout.left,
                ...arrowStyle,
              }}
            >
              <span className="app-tooltip__text">
                <span className="app-tooltip__label">{label}</span>
                {hint ? (
                  <>
                    <span className="app-tooltip__sep" aria-hidden="true">
                      ·
                    </span>
                    <span className="app-tooltip__hint">{hint}</span>
                  </>
                ) : null}
              </span>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}

/** Wrapper para botones de acción (también cuando están disabled). */
export function ActionTooltip({
  label,
  hint,
  placement = "top",
  enabled = true,
  children,
}: {
  label: string;
  hint?: string;
  placement?: AppTooltipPlacement;
  enabled?: boolean;
  children: ReactNode;
}) {
  return (
    <AppTooltip
      label={label}
      hint={hint}
      placement={placement}
      enabled={enabled}
    >
      <span className="inline-flex">{children}</span>
    </AppTooltip>
  );
}
