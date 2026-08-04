import { AuthBackground } from "@/components/ui/AuthBackground";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <AuthBackground />
      <div
        className={
          "relative mx-auto flex min-h-dvh w-full max-w-[480px] flex-col justify-center px-6 " +
          "pt-[max(2rem,env(safe-area-inset-top))] pb-[max(2rem,env(safe-area-inset-bottom))]"
        }
      >
        {children}
      </div>
    </>
  );
}
