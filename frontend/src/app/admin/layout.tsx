"use client";
import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [authorized, setAuthorized] = useState(false);

  useEffect(() => {
    // Exclude the admin login page from the authorization check
    if (pathname === "/admin/login") {
      setAuthorized(true);
      return;
    }

    const isAdmin = localStorage.getItem("admin_logged_in");
    if (isAdmin !== "true") {
      router.push("/login");
    } else {
      setAuthorized(true);
    }
  }, [router, pathname]);

  if (!authorized) {
    return null;
  }

  return <>{children}</>;
}
