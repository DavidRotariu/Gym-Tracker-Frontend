/**
 * The brand moment above the login/signup form — kept from the old boxed
 * hero, just unboxed now that it sits directly on the ambient AuthBackground
 * instead of inside its own dark panel.
 */
export function AuthWordmark() {
  return (
    <div className="flex flex-col gap-1">
      <p className="text-kicker text-label-tertiary uppercase">Progressive</p>
      <h1 className="font-stat text-stat leading-none text-label">
        OVER<span className="text-accent-ink">LOAD</span>
      </h1>
    </div>
  );
}
