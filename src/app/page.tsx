import { LoginForm } from "@/components/login-form";

export default function Page() {
  return (
    <div className="flex flex-col min-h-[660px] w-full items-center p-6">
      <div className="text-center pt-5 pb-10">
        <h1 className="text-6xl font-futura font-bold italic">GYM</h1>
        <h1 className="text-6xl font-futura font-bold italic">TRACKER</h1>
      </div>
      <LoginForm />
    </div>
  );
}
