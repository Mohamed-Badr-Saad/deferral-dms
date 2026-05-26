"use client";

import { useEffect, useState } from "react";
import type { UserRole } from "@/src/lib/constants";

type Profile = {
  id: string;
  email: string;
  name: string;
  department: string;
  position: string;
  role: UserRole;
  gmGroup: string | null;
  signatureUrl: string | null;
  signatureUploadedAt: string | null;
};

let cachedProfile: Profile | null | undefined;
let profileRequest: Promise<Profile | null> | null = null;

async function fetchProfileOnce() {
  if (!profileRequest) {
    profileRequest = fetch("/api/profile", { cache: "no-store" })
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        const nextProfile = (data?.profile ?? null) as Profile | null;
        cachedProfile = nextProfile;
        return nextProfile;
      })
      .catch(() => {
        profileRequest = null;
        cachedProfile = undefined;
        return null;
      });
  }

  return profileRequest;
}

export function resetProfileCache() {
  cachedProfile = undefined;
  profileRequest = null;
}

export function useProfile() {
  const [profile, setProfile] = useState<Profile | null>(
    cachedProfile ?? null,
  );
  const [loading, setLoading] = useState(cachedProfile === undefined);

  useEffect(() => {
    let mounted = true;

    if (cachedProfile !== undefined) {
      setProfile(cachedProfile);
      setLoading(false);
      return () => {
        mounted = false;
      };
    }

    (async () => {
      try {
        const nextProfile = await fetchProfileOnce();
        if (!mounted) return;
        setProfile(nextProfile);
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
