"use client";

import { useEffect, useState } from "react";

type Profile = {
  id: string;
  email: string;
  name: string;
  department: string;
  position: string;
  role: string;
  signatureUrl: string | null;
  signatureUploadedAt: string | null;
};

export function useProfile() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await fetch("/api/profile");
        const data = await res.json();
        if (!mounted) return;
        setProfile(data?.profile ?? null);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  return { profile, loading };
}
