"use client";

import { useState, type FormEvent } from "react";

export default function AdminLoginPage() {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/admin/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email: form.get("email"),
        password: form.get("password"),
      }),
    });
    setBusy(false);
    if (!response.ok) {
      setError("Invalid credentials or administrator access is not enabled.");
      return;
    }
    window.location.assign("/");
  }
  return (
    <main className="grid min-h-screen place-items-center bg-slate-100 p-4">
      <form
        onSubmit={submit}
        className="w-full max-w-sm rounded-2xl border bg-white p-6 shadow-sm"
      >
        <p className="text-sm font-semibold text-indigo-700">House of Stars</p>
        <h1 className="mt-1 text-2xl font-bold">Administrator sign in</h1>
        <p className="mt-2 text-sm text-slate-500">
          Use your separately provisioned administrator account.
        </p>
        <label className="mt-6 block text-sm font-medium">
          Email
          <input
            required
            name="email"
            type="email"
            autoComplete="username"
            className="mt-1 w-full rounded-lg border px-3 py-3"
          />
        </label>
        <label className="mt-4 block text-sm font-medium">
          Password
          <input
            required
            name="password"
            type="password"
            autoComplete="current-password"
            className="mt-1 w-full rounded-lg border px-3 py-3"
          />
        </label>
        {error && <p className="mt-4 text-sm text-red-700">{error}</p>}
        <button
          disabled={busy}
          className="mt-6 w-full rounded-lg bg-indigo-700 px-4 py-3 font-semibold text-white disabled:opacity-50"
        >
          {busy ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </main>
  );
}
