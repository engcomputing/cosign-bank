"use client";

import { useEffect, useState } from "react";
import { useTideCloak } from "@tidecloak/nextjs";

const DISMISS_KEY = "tide.profile-onboarding.dismissed";

type Props = {
  baseUrl: string;
  realm: string;
  fields?: Array<"email" | "firstName" | "lastName">;
  required?: boolean;
  onDone?: () => void;
};

export function ProfileOnboarding({
  baseUrl,
  realm,
  fields = ["firstName"],
  required = false,
  onDone,
}: Props) {
  const { authenticated, getValueFromToken, token } = useTideCloak();
  const [open, setOpen] = useState(false);
  const [values, setValues] = useState({ email: "", firstName: "", lastName: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!authenticated) return;
    if (!required && localStorage.getItem(DISMISS_KEY) === "1") return;

    const hasName = getValueFromToken("given_name") || getValueFromToken("name");
    const hasEmail = getValueFromToken("email");
    const missing =
      (fields.includes("firstName") && !hasName) ||
      (fields.includes("email") && !hasEmail);

    if (missing) {
      setValues((current) => ({
        ...current,
        email: (getValueFromToken("email") as string) || "",
        firstName: (getValueFromToken("given_name") as string) || "",
        lastName: (getValueFromToken("family_name") as string) || "",
      }));
      setOpen(true);
    }
  }, [authenticated, fields, required, getValueFromToken]);

  if (!open) return null;

  const dismiss = () => {
    localStorage.setItem(DISMISS_KEY, "1");
    setOpen(false);
    onDone?.();
  };

  async function save() {
    setBusy(true);
    setError(null);
    try {
      const body: Record<string, string> = {};
      for (const field of fields) {
        if (values[field]) body[field] = values[field].trim();
      }

      const response = await fetch(`${baseUrl}/realms/${realm}/account/`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (response.status === 401 || response.status === 403) {
        throw new Error("Not authorised to update your profile. Check the account audience.");
      }
      if (response.status === 202) {
        throw new Error("Your changes were queued for approval and are not saved yet.");
      }
      if (!response.ok) throw new Error(`Could not save your details (${response.status}).`);

      setOpen(false);
      onDone?.();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  const label: Record<string, string> = {
    email: "Email",
    firstName: "What should we call you?",
    lastName: "Last name",
  };

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="onboarding-title">
      <div className="modal-card">
        <span className="eyebrow">Optional profile</span>
        <h2 id="onboarding-title">Welcome to CoSign Bank</h2>
        <p>{required ? "We need one detail before you continue." : "Add a display name, or skip this for now."}</p>

        {fields.map((field) => (
          <label className="field" key={field}>
            <span>{label[field]}</span>
            <input
              type={field === "email" ? "email" : "text"}
              value={values[field]}
              onChange={(event) => setValues({ ...values, [field]: event.target.value })}
              autoComplete={field === "email" ? "email" : field === "firstName" ? "given-name" : "family-name"}
            />
          </label>
        ))}

        {error && <p className="form-error" role="alert">{error}</p>}

        <div className="button-row modal-actions">
          {!required && <button className="button secondary" type="button" onClick={dismiss} disabled={busy}>Not now</button>}
          <button className="button primary" type="button" onClick={save} disabled={busy}>{busy ? "Saving…" : "Save"}</button>
        </div>
      </div>
    </div>
  );
}
