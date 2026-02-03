"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { useLang } from "@/lib/lang";

export default function AuthCallbackPage() {
  const router = useRouter();
  const { t } = useLang();
  const [status, setStatus] = useState<string>(t("处理中...", "Processing..."));

  useEffect(() => {
    const handle = async () => {
      try {
        const params = new URLSearchParams(window.location.search);
        const next = params.get("next");
        const code = params.get("code");
        const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
        const type = hashParams.get("type");

        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) {
            setStatus(error.message);
            return;
          }
        } else if (hashParams.get("access_token") && hashParams.get("refresh_token")) {
          const accessToken = hashParams.get("access_token") as string;
          const refreshToken = hashParams.get("refresh_token") as string;
          const { error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });
          if (error) {
            setStatus(error.message);
            return;
          }
        }

        if (next) {
          router.replace(next);
          return;
        }

        if (type === "recovery") {
          router.replace("/auth/reset");
          return;
        }

        const { data } = await supabase.auth.getSession();
        if (data?.session) {
          router.replace("/");
        } else {
          router.replace("/auth/login");
        }
      } catch (e: any) {
        setStatus(e?.message || t("处理失败", "Callback failed"));
      }
    };

    handle();
  }, [router, t]);

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-header">
          <Link href="/" style={{ display: "inline-block", marginBottom: 24 }}>
            <svg viewBox="0 0 40 40" fill="none" style={{ width: 50, height: 50, color: "#f59e0b" }}>
              <circle cx="20" cy="20" r="18" stroke="currentColor" strokeWidth="2.5"/>
              <path d="M20 4 C20 4, 8 16, 20 20 C32 24, 20 36, 20 36" stroke="currentColor" strokeWidth="2.5" fill="none"/>
              <path d="M4 20 H36" stroke="currentColor" strokeWidth="2.5"/>
            </svg>
          </Link>
          <h1>{t("验证中", "Verifying")}</h1>
          <p>{status}</p>
        </div>
      </div>
    </div>
  );
}
