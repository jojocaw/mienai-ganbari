"use client";

import { useState } from "react";
import { rememberOwnerPass, type OwnerGate } from "./owner";

/** Shown instead of an owner screen when the server asks for the owner's passcode (or says none has been decided). */
export default function OwnerPass({ gate, message }: { gate: OwnerGate; message: string }) {
  const [pass, setPass] = useState("");

  if (gate === "unset")
    return (
      <section className="flex flex-col gap-2 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm leading-relaxed text-amber-900">
        <h2 className="text-base font-bold">店長の入口は、合言葉を決めると開きます</h2>
        <p>{message}</p>
        <p>
          例: <code className="rounded bg-white px-1">MIENAI_OWNER_PASS=好きな合言葉</code>
        </p>
      </section>
    );

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!pass) return;
        rememberOwnerPass(pass);
        window.location.reload();
      }}
      className="flex flex-col gap-3 rounded-xl border border-stone-300 bg-white p-4"
    >
      <h2 className="text-base font-bold text-stone-900">店長の合言葉</h2>
      <p className="text-sm text-stone-700">{message}</p>
      <input
        type="password"
        value={pass}
        onChange={(e) => setPass(e.target.value)}
        autoComplete="current-password"
        aria-label="店長の合言葉"
        disabled={gate === "wait"}
        className="w-full rounded-lg border border-stone-300 px-3 py-2 text-base text-stone-900 focus:border-emerald-600 focus:outline-none"
      />
      <button type="submit" disabled={!pass || gate === "wait"} className="rounded-xl bg-emerald-700 px-4 py-3 text-base font-bold text-white disabled:bg-stone-300">
        開く
      </button>
      <p className="text-xs text-stone-500">合言葉は、このタブを閉じるまで覚えます。スタッフの1行の画面には要りません。</p>
    </form>
  );
}
