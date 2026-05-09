"use client";

import { useState } from "react";
import AdminSignInForm from "./admin-sign-in-form";

const UNLOCK_CLICK_COUNT = 5;

export default function AdminSignInGate() {
  const [clickCount, setClickCount] = useState(0);
  const isUnlocked = clickCount >= UNLOCK_CLICK_COUNT;

  if (isUnlocked) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-100 px-4 py-10 text-slate-950">
        <div className="w-full max-w-md">
          <AdminSignInForm />
        </div>
      </main>
    );
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center bg-slate-100 px-4 text-slate-950">
      <section
        role="alertdialog"
        aria-labelledby="maintenance-title"
        aria-describedby="maintenance-description"
        className="w-full max-w-md rounded-lg border border-slate-200 bg-white p-7 text-center shadow-lg shadow-slate-200/80"
      >
        <p className="text-xs font-black uppercase text-sky-600">Server Notice</p>
        <h1 id="maintenance-title" className="mt-3 text-2xl font-black">
          도메인 서버 준비중입니다
        </h1>
        <p
          id="maintenance-description"
          className="mt-3 text-sm font-semibold leading-6 text-slate-600"
        >
          현재 접속 환경을 확인하고 있습니다. 잠시 후 다시 시도해 주세요.
        </p>
      </section>

      <button
        type="button"
        aria-label="관리자 접근 열기"
        onClick={() => setClickCount((count) => count + 1)}
        className="fixed bottom-0 right-0 h-20 w-20 cursor-default opacity-0"
      />
    </main>
  );
}
