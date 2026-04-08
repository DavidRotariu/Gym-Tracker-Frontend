import { LoginForm } from "@/components/login-form";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AUTH_COOKIE_NAME } from "@/lib/auth";

export default async function Page() {
  const token = (await cookies()).get(AUTH_COOKIE_NAME)?.value;
  if (token) {
    redirect("/home");
  }

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
