"use client";

import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
  type ReactNode,
} from "react";
import {
  AnimatePresence,
  motion,
  useMotionValueEvent,
  useReducedMotion,
  useSpring,
  useTransform,
  useVelocity,
} from "motion/react";
import { Check, RotateCcw } from "lucide-react";

import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { BorderBeam } from "@/components/magicui/border-beam";
import { ShimmerButton } from "@/components/magicui/shimmer-button";

/* ------------------------------------------------------------------ */
/*  Zipper                                                             */
/* ------------------------------------------------------------------ */

const RAIL_W = 28;
const CX = RAIL_W / 2;
const PITCH = 9; // vertical distance between teeth rows
const TOP = 14; // where the teeth start
const BOTTOM = 44; // room left at the bottom for slider + pull tab
const BODY_H = 22; // slider body height

/** Brass (idle) <-> mint (sent) metal that cross-fades smoothly */
function Metal({ sent, className }: { sent: boolean; className?: string }) {
  return (
    <div className={cn("relative overflow-hidden", className)}>
      <span className="absolute inset-0 bg-gradient-to-b from-amber-200 via-amber-400 to-orange-500" />
      <span
        className={cn(
          "absolute inset-0 bg-gradient-to-b from-emerald-100 via-emerald-300 to-emerald-500 transition-opacity duration-700",
          sent ? "opacity-100" : "opacity-0"
        )}
      />
    </div>
  );
}

function Zipper({
  progress,
  sent,
  pullable,
  onPull,
}: {
  progress: number; // 0..1 resting position of the slider
  sent: boolean;
  pullable: boolean; // true when the form is complete and can be sent
  onPull: () => void;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const [h, setH] = useState(520);
  const [grabbing, setGrabbing] = useState(false);
  const startRef = useRef(TOP);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setH(entry.contentRect.height));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const travel = Math.max(h - TOP - BOTTOM, 1);
  const restPos = TOP + progress * travel;
  const endPos = TOP + travel;

  const mouth = useSpring(TOP, { stiffness: 130, damping: 15, mass: 0.8 });
  const [m, setM] = useState(TOP);
  useMotionValueEvent(mouth, "change", (v) => setM(v));

  // fields / status drive the resting position
  useEffect(() => {
    if (reduce) mouth.jump(restPos);
    else mouth.set(restPos);
  }, [restPos, reduce, mouth]);

  const sliderY = useTransform(mouth, (v) => v - BODY_H / 2);
  const swing = useSpring(
    useTransform(useVelocity(mouth), [-900, 0, 900], [16, 0, -16]),
    { stiffness: 220, damping: 10 }
  );

  const clamp = (v: number, a: number, b: number) => Math.min(Math.max(v, a), b);

  const count = Math.max(Math.floor((h - TOP - BOTTOM) / PITCH) + 1, 0);
  const rows = Array.from({ length: count }, (_, i) => {
    const y = TOP + i * PITCH;
    const open = 1 - Math.exp(-Math.max(y - m, 0) / 12);
    const spread = open * 5;
    return {
      y,
      open,
      lx: CX - 1.8 - spread,
      rx: CX + 1.8 + spread,
      ry: y + (PITCH / 2) * (1 - open),
    };
  });

  const leftTape = rows.map((r) => `${r.lx - 6.5},${r.y + 1.8}`).join(" ");
  const rightTape = rows.map((r) => `${r.rx + 6.5},${r.ry + 1.8}`).join(" ");

  return (
    <div ref={wrapRef} className="relative -ml-1 w-7 shrink-0 self-stretch">
      <svg
        aria-hidden
        width={RAIL_W}
        height={h}
        className={cn(
          "absolute inset-0 overflow-visible transition-colors duration-700",
          sent ? "text-emerald-600" : "text-[#786142]"
        )}
        style={{
          filter: sent
            ? "drop-shadow(0 0 5px rgba(16,185,129,.4))"
            : "drop-shadow(0 0 3px rgba(120,97,66,.25))",
          transition: "filter 700ms",
        }}
      >
        {[leftTape, rightTape].map((pts, i) => (
          <g key={i}>
            <polyline points={pts} fill="none" stroke="currentColor" strokeOpacity={0.25} strokeWidth={4} strokeLinejoin="round" />
            <polyline points={pts} fill="none" stroke="currentColor" strokeOpacity={0.65} strokeWidth={0.8} strokeDasharray="1.5 3" />
          </g>
        ))}
        <rect x={CX - 6} y={TOP - 10} width={12} height={4} rx={2} fill="currentColor" opacity={0.85} />
        {rows.map((r, i) => (
          <g key={i} fill="currentColor" fillOpacity={1 - r.open * 0.62}>
            <rect x={r.lx - 3.25} y={r.y} width={6.5} height={3.6} rx={1.4} />
            <rect x={r.rx - 3.25} y={r.ry} width={6.5} height={3.6} rx={1.4} />
          </g>
        ))}
      </svg>

      {/* slider: drag it down to send */}
      <motion.div
        role="button"
        tabIndex={pullable ? 0 : -1}
        aria-label="Pull the zip down to send"
        aria-disabled={!pullable}
        onKeyDown={(e) => {
          if (pullable && (e.key === "Enter" || e.key === " ")) {
            e.preventDefault();
            onPull();
          }
        }}
        onPanStart={() => {
          startRef.current = mouth.get();
          setGrabbing(true);
        }}
        onPan={(_, info) => {
          if (!pullable) return;
          mouth.set(clamp(startRef.current + info.offset.y, restPos, endPos));
        }}
        onPanEnd={() => {
          setGrabbing(false);
          if (!pullable) return;
          // pulled most of the way? send. otherwise spring back.
          if (mouth.get() > restPos + (endPos - restPos) * 0.78) onPull();
          else mouth.set(restPos);
        }}
        className={cn(
          "absolute rounded-md outline-none focus-visible:ring-[3px] focus-visible:ring-amber-500/50",
          pullable && (grabbing ? "cursor-grabbing" : "cursor-grab")
        )}
        style={{ left: CX - 9, top: 0, width: 18, y: sliderY, touchAction: "none" }}
      >
        {/* bigger invisible grab area */}
        <span className="absolute -inset-x-3 -inset-y-2" />

        <motion.div
          animate={pullable && !grabbing ? { y: [0, 5, 0] } : { y: 0 }}
          transition={
            pullable && !grabbing
              ? { duration: 1.4, repeat: Infinity, ease: "easeInOut" }
              : { duration: 0.2 }
          }
        >
          <Metal
            sent={sent}
            className="h-[22px] w-[18px] rounded-[7px] shadow-[0_8px_16px_-4px_rgba(0,0,0,.4),inset_0_1px_0_rgba(255,255,255,.6)]"
          />
          <span className="absolute left-1/2 top-[11px] h-[10px] w-[4px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#1f1811]/80" />

          <motion.div
            className="absolute left-1/2 top-full -ml-[5px] -mt-px"
            style={{ rotate: swing, transformOrigin: "50% 0%" }}
          >
            <Metal
              sent={sent}
              className="h-4 w-[10px] rounded-b-[5px] rounded-t-[2px] shadow-[0_6px_10px_-3px_rgba(0,0,0,.35)]"
            />
            <span className="absolute bottom-[3px] left-1/2 size-[3px] -translate-x-1/2 rounded-full bg-[#1f1811]/80" />
          </motion.div>
        </motion.div>
      </motion.div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Small pieces                                                       */
/* ------------------------------------------------------------------ */

function Field({
  id,
  label,
  done,
  children,
}: {
  id: string;
  label: string;
  done: boolean;
  children: ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex h-4 items-center justify-between">
        <Label htmlFor={id} className="text-[13px] font-medium text-[#2e261d]">
          {label}
          <span className="ml-0.5 text-amber-600">*</span>
        </Label>
        <AnimatePresence>
          {done && (
            <motion.span
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0, opacity: 0 }}
              transition={{ type: "spring", stiffness: 500, damping: 22 }}
              className="grid size-4 place-items-center rounded-full bg-amber-600/15 text-amber-800"
            >
              <Check className="size-2.5" strokeWidth={3.5} />
            </motion.span>
          )}
        </AnimatePresence>
      </div>
      {children}
    </div>
  );
}

const inputCls =
  "rounded-xl border-[#dfcfb9] bg-white/80 text-[#1c1813] shadow-xs placeholder:text-[#a0907c] " +
  "focus-visible:border-amber-600/70 focus-visible:ring-[3px] focus-visible:ring-amber-500/25";

/* ------------------------------------------------------------------ */
/*  Form                                                               */
/* ------------------------------------------------------------------ */

const BUDGETS = ["$3–5k", "$5–10k", "$10–20k", "$20k+"];

type FormState = {
  name: string;
  email: string;
  company: string;
  budget: string;
  message: string;
};
const EMPTY: FormState = { name: "", email: "", company: "", budget: "", message: "" };

export default function ZipForm() {
  const [form, setForm] = useState<FormState>(EMPTY);
  const [status, setStatus] = useState<"idle" | "sending" | "sent">("idle");
  const cardRef = useRef<HTMLDivElement>(null);

  const bind = (key: "name" | "email" | "company" | "message") => ({
    value: form[key],
    onChange: (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm((f) => ({ ...f, [key]: e.target.value })),
  });

  const checks = [
    form.name.trim().length > 1,
    /^\S+@\S+\.\S+$/.test(form.email.trim()),
    form.company.trim().length > 0,
    form.budget !== "",
    form.message.trim().length >= 8,
  ];
  const done = checks.filter(Boolean).length;
  const ready = done === checks.length;
  const sent = status === "sent";
  // fields fill the zip to 80%. the last 20% is the pull. sending/sent = fully zipped
  const progress = status !== "idle" ? 1 : (done / checks.length) * 0.8;

  async function celebrate() {
    const rect = cardRef.current?.getBoundingClientRect();
    if (!rect) return;
    const { default: confetti } = await import("canvas-confetti");
    const origin = {
      x: (rect.left + 28) / window.innerWidth,
      y: (rect.bottom - 48) / window.innerHeight,
    };
    const colors = ["#34f5b0", "#7cf7d4", "#ffb020", "#7c8cff", "#ffffff"];
    confetti({ particleCount: 60, angle: 65, spread: 55, startVelocity: 48, origin, colors, scalar: 0.9, disableForReducedMotion: true });
    setTimeout(
      () =>
        confetti({ particleCount: 40, angle: 80, spread: 80, startVelocity: 36, origin, colors, scalar: 0.8, disableForReducedMotion: true }),
      160
    );
  }

  async function submit() {
    if (!ready || status !== "idle") return;
    setStatus("sending");
    await new Promise((r) => setTimeout(r, 1100)); // replace with your real request
    setStatus("sent");
    celebrate();
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    submit();
  }

  function reset() {
    setForm(EMPTY);
    setStatus("idle");
  }

  return (
    <div
      className="grid min-h-screen place-items-center bg-white p-4"
      style={{ fontFamily: "'Roboto', system-ui, sans-serif" }}
    >
      <div
        ref={cardRef}
        className={cn(
          "relative isolate flex min-h-[540px] w-full max-w-[470px] gap-4 overflow-hidden rounded-3xl",
          "border border-[#e5d5be] bg-[#FFF4DE] p-6 transition-shadow duration-700",
          sent
            ? "shadow-[0_25px_70px_-15px_rgba(52,245,176,0.35)]"
            : "shadow-[0_25px_70px_-15px_rgba(180,140,80,0.25),0_8px_24px_rgba(0,0,0,0.04)]"
        )}
      >
        <BorderBeam
          size={170}
          duration={7}
          borderWidth={1.5}
          colorFrom={sent ? "#10b981" : "#f59e0b"}
          colorTo={sent ? "#34d399" : "#d97706"}
        />

        <Zipper
          progress={progress}
          sent={sent}
          pullable={ready && status === "idle"}
          onPull={submit}
        />

        <div className="min-w-0 flex-1">
          <AnimatePresence mode="wait" initial={false}>
            {!sent ? (
              <motion.form
                key="form"
                onSubmit={onSubmit}
                noValidate
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0, filter: "blur(4px)" }}
                transition={{ duration: 0.25 }}
                className="space-y-4"
              >
                <header className="space-y-1">
                  <h2
                    className="text-[22px] font-semibold leading-tight tracking-tight text-[#1c1813]"
                    style={{ fontFamily: "'Roboto', sans-serif" }}
                  >
                    Start a project
                  </h2>
                  <p className="text-[13px] text-[#716353]">
                    Fill in the five fields and the zip closes. I reply within a day.
                  </p>
                </header>

                <Field id="zf-name" label="Name" done={checks[0]}>
                  <Input id="zf-name" placeholder="Your name" autoComplete="name" className={cn("h-11", inputCls)} {...bind("name")} />
                </Field>

                <Field id="zf-email" label="Email" done={checks[1]}>
                  <Input id="zf-email" type="email" placeholder="you@company.com" autoComplete="email" className={cn("h-11", inputCls)} {...bind("email")} />
                </Field>

                <Field id="zf-company" label="Company" done={checks[2]}>
                  <Input id="zf-company" placeholder="Company or project" autoComplete="organization" className={cn("h-11", inputCls)} {...bind("company")} />
                </Field>

                <Field id="zf-budget" label="Budget" done={checks[3]}>
                  <div role="radiogroup" aria-label="Budget" className="grid grid-cols-4 gap-2">
                    {BUDGETS.map((b) => {
                      const active = form.budget === b;
                      return (
                        <button
                          key={b}
                          type="button"
                          role="radio"
                          aria-checked={active}
                          onClick={() => setForm((f) => ({ ...f, budget: b }))}
                          className={cn(
                            "relative h-10 rounded-xl border border-[#dfcfb9] bg-white/70 text-xs font-medium outline-none transition-colors",
                            "focus-visible:ring-[3px] focus-visible:ring-amber-500/30",
                            active ? "text-[#1c1305] font-semibold" : "text-[#635545] hover:bg-white"
                          )}
                        >
                          {active && (
                            <motion.span
                              layoutId="budget-pill"
                              transition={{ type: "spring", stiffness: 420, damping: 32 }}
                              className="absolute inset-0 rounded-xl bg-gradient-to-b from-amber-200 to-orange-400 shadow-[0_4px_14px_-3px_rgba(255,160,32,.55)]"
                            />
                          )}
                          <span className="relative z-10">{b}</span>
                        </button>
                      );
                    })}
                  </div>
                </Field>

                <Field id="zf-message" label="What do you need?" done={checks[4]}>
                  <Textarea id="zf-message" placeholder="A few lines about the project" rows={3} className={cn("min-h-[84px] resize-none", inputCls)} {...bind("message")} />
                </Field>

                <div className="space-y-2 pt-1">
                  <p aria-live="polite" className="text-right text-[11px] text-[#857461]">
                    {ready ? "Pull the zip down to send" : `${done} of ${checks.length} done`}
                  </p>
                  <ShimmerButton
                    type="submit"
                    disabled={!ready || status === "sending"}
                    shimmerColor="#ffe4a0"
                    shimmerDuration="2.6s"
                    background="rgba(35, 28, 22, 1)"
                    borderRadius="14px"
                    className={cn(
                      "h-12 w-full text-sm font-semibold transition-all duration-500",
                      ready
                        ? "shadow-[0_4px_24px_-4px_rgba(180,120,40,.45)]"
                        : "pointer-events-none opacity-40"
                    )}
                  >
                    {status === "sending" ? "Sending…" : "Send request"}
                  </ShimmerButton>
                </div>
              </motion.form>
            ) : (
              <motion.div
                key="sent"
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ type: "spring", stiffness: 260, damping: 22, delay: 0.15 }}
                className="flex h-full min-h-[490px] flex-col items-center justify-center text-center"
              >
                <div className="mb-5 grid size-14 place-items-center rounded-full border border-emerald-600/30 bg-emerald-500/15 shadow-[0_0_30px_-6px_rgba(16,185,129,.4)]">
                  <svg viewBox="0 0 24 24" className="size-6 text-emerald-600" fill="none" stroke="currentColor" strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round">
                    <motion.path
                      d="M5 12.5l4.5 4.5L19 7.5"
                      initial={{ pathLength: 0 }}
                      animate={{ pathLength: 1 }}
                      transition={{ duration: 0.5, delay: 0.45, ease: "easeOut" }}
                    />
                  </svg>
                </div>
                <h3
                  className="text-xl font-semibold text-[#1c1813]"
                  style={{ fontFamily: "'Roboto', sans-serif" }}
                >
                  Request sent
                </h3>
                <p className="mt-2 max-w-[260px] text-[13px] leading-relaxed text-[#635545]">
                  Thanks, <span className="font-semibold text-[#1c1813]">{form.name.split(" ")[0]}</span>. I'll reply to{" "}
                  <span className="font-semibold text-[#1c1813]">{form.email}</span> within a day.
                </p>
                <button
                  type="button"
                  onClick={reset}
                  className="mt-6 inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-[13px] font-medium text-[#4a3e31] outline-none transition-colors hover:bg-black/[0.05] hover:text-[#1c1813] focus-visible:ring-[3px] focus-visible:ring-emerald-500/30"
                >
                  <RotateCcw className="size-3.5" />
                  Send another
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
