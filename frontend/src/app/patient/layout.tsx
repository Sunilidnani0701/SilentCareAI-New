"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function PatientLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [authorized, setAuthorized] = useState(false);

  useEffect(() => {
    const pid = localStorage.getItem("patient_id");
    const isAdmin = localStorage.getItem("admin_logged_in") === "true";
    if (!pid && !isAdmin) {
      router.push("/login");
    } else {
      setAuthorized(true);
    }
  }, [router]);

  if (!authorized) {
    return null;
  }

  return <>{children}</>;
}
