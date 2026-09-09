"use client";

import Image from "next/image";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { LoginForm } from "@/src/modules/auth/components/login-form";
import { useAuth } from "@/src/hooks/use-auth";
import { Loading } from "@/components/common/loading";

export default function LoginPage() {
  const router = useRouter();
  const { isAuthenticated, isLoading } = useAuth();

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      router.replace("/dashboard");
    }
  }, [isAuthenticated, isLoading, router]);

  if (isLoading) return <Loading fullscreen label="Memeriksa sesi..." />;
  if (isAuthenticated) return <Loading fullscreen label="Mengarahkan..." />;

  return (
    <main className="min-h-screen bg-[linear-gradient(105deg,white_0%,white_34%,oklch(0.78_0.08_210)_66%,oklch(0.32_0.14_245)_100%)] px-4 py-4 sm:px-8 sm:py-8 lg:px-12">
      <div className="mx-auto grid min-h-[calc(100vh-2rem)] max-w-6xl overflow-hidden rounded-[2rem] bg-white shadow-[0_18px_45px_-10px_oklch(0.25_0.08_230/0.32),0_4px_14px_oklch(0.25_0.08_230/0.12)] sm:min-h-[calc(100vh-4rem)] lg:grid-cols-[1.08fr_0.92fr]">
        {/* Brand panel */}
        <div className="relative hidden flex-col items-center justify-center overflow-visible bg-white p-10 text-foreground lg:flex xl:p-16">
          <div
            aria-hidden="true"
            className="absolute -right-2 top-0 bottom-0 z-10 w-5 rounded-r-[1.5rem] border-y border-r border-black/5 bg-white shadow-[-10px_0_18px_-6px_oklch(0.2_0.02_250/0.34)] [clip-path:polygon(0_0,100%_4%,100%_96%,0_100%)]"
          />
          <div className="relative flex w-full max-w-lg flex-col items-center text-center">
            <div className="flex w-full flex-col items-center">
              <div className="rounded-3xl bg-white p-4">
                <Image
                  src="/icon.png"
                  alt="Logo SIPKESMAS"
                  width={208}
                  height={208}
                  priority
                  className="h-52 w-52 rounded-2xl object-cover"
                />
              </div>
              <p className="mt-2 scale-y-110 text-4xl font-black uppercase leading-[0.88] tracking-[0.22em] text-success">
                SIPKESMAS
              </p>
              <p className="mt-2 max-w-xl text-base font-medium leading-tight text-muted-foreground">
                Sistem Informasi Perawatan Kesehatan Masyarakat
              </p>
              <p className="mt-8 max-w-md text-justify text-sm font-bold leading-relaxed text-muted-foreground">
                SIPKESMAS adalah sistem informasi yang mendukung penyelenggaraan Program Perawatan
                Kesehatan Masyarakat (Perkesmas) sebagai upaya kesehatan masyarakat esensial di
                Puskesmas. Sistem ini membantu Lingkungan Dinas Kesehatan dari berbagai Puskesmas
                dan dikelola perawat untuk keluarga binaan. Mengelola asuhan keperawatan kesehatan
                masyarakat secara terintegrasi, aman, dan terpercaya.
              </p>
            </div>
          </div>
          <p className="absolute bottom-6 w-full text-center text-xs font-medium text-muted-foreground">
            © 2026 Tim PKL Dinas Kesehatan Ponorogo
          </p>
        </div>

        {/* Form panel */}
        <div className="relative flex items-center justify-center rounded-r-[2rem] bg-white px-6 py-12 text-foreground sm:px-12 lg:px-16">
          <div className="relative w-full max-w-sm px-2 py-6 sm:px-4">
            <div className="mb-8 lg:hidden">
              <div className="flex flex-col items-center text-center">
                <Image
                  src="/icon.png"
                  alt="Logo SIPKESMAS"
                  width={128}
                  height={128}
                  priority
                  className="h-32 w-32 rounded-2xl object-cover"
                />
                <span className="mt-4 text-xl font-bold tracking-[0.2em] text-success">
                  SIPKESMAS
                </span>
                <span className="mt-1 text-xs text-muted-foreground">
                  Sistem Informasi Kesehatan Masyarakat
                </span>
              </div>
            </div>
            <h2 className="relative -top-4 text-center text-2xl font-semibold tracking-tight text-foreground">
              MASUK KE AKUN
            </h2>
            <div className="mt-8 text-sm [&_label]:text-sm [&_input]:text-sm [&_input]:border-input [&_input]:bg-background [&_input]:text-foreground [&_input]:placeholder:text-muted-foreground [&_.login-submit]:text-sm [&_.login-submit]:border-primary [&_.login-submit]:bg-white [&_.login-submit]:text-primary [&_.login-submit]:shadow-md [&_.login-submit]:hover:bg-white/90 [&_p]:text-xs [&_p]:text-muted-foreground">
              <LoginForm />
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
