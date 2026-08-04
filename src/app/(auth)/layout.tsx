export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      className={
        "mx-auto flex min-h-dvh w-full max-w-[480px] flex-col justify-center px-6 " +
        // AuthHero goes full-bleed (-mx-6) and can land flush at y=0 on
        // short viewports where the centered content overflows — pad by
        // whichever is bigger, the resting 2rem or the actual notch/Dynamic
        // Island inset, so the hero never sits under it.
        "pt-[max(2rem,env(safe-area-inset-top))] pb-[max(2rem,env(safe-area-inset-bottom))]"
      }
    >
      {children}
    </div>
  );
}
