import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Logo, CharImg } from "@/components/Art";
import { useApp } from "@/components/AppState";
import { MuteButton } from "@/components/MuteButton";
import { ProfileCorner } from "@/components/ProfileCorner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { roomCode } from "@/lib/game";

export const Route = createFileRoute("/home")({
  head: () => ({
    meta: [
      { title: "Halaman Utama - Hantu Malam" },
      { name: "description", content: "Buat room horor dan undang teman yang sedang online untuk mabar Hantu Malam." },
      { property: "og:title", content: "Halaman Utama - Hantu Malam" },
      { property: "og:description", content: "Buat room dan undang teman online." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Home,
});

function Home() {
  const { ready, account, online, setRoom } = useApp();
  const nav = useNavigate();
  const [busy, setBusy] = useState(false);
  const [code, setCode] = useState("");
  const [err, setErr] = useState("");
  useEffect(() => { if (ready && !account) void nav({ to: "/" }); }, [ready, account, nav]);
  useEffect(() => setRoom(null), [setRoom]);
  if (!account) return null;

  async function create() {
    if (!account) return;
    setBusy(true); setErr("");
    for (let i = 0; i < 5; i++) {
      const c = roomCode();
      const { error } = await supabase.from("rooms").insert({ code: c, host_id: account.id });
      if (!error) { void nav({ to: "/room/$code", params: { code: c } }); return; }
    }
    setErr("Gagal membuat room, coba lagi."); setBusy(false);
  }

  return (
    <main className="mx-auto min-h-dvh max-w-md space-y-5 px-4 py-4">
      <header className="flex items-start gap-2"><div className="flex-1"><ProfileCorner /></div><MuteButton /></header>
      <Logo className="mx-auto w-40 rounded-lg" />
      <Button size="lg" className="h-16 w-full text-xl glow-blood" onClick={create} disabled={busy}>{busy ? "Membuka pintu..." : "BUAT ROOM"}</Button>
      {err && <p className="text-sm text-destructive">{err}</p>}
      <section className="rounded-xl border border-border bg-card p-4">
        <h2 className="font-horror text-xl">TEMAN ONLINE ({online.length})</h2>
        <p className="mb-3 text-xs text-muted-foreground">Buat room dulu, lalu undang mereka dari lobby. Undangan teman akan muncul di atas layar.</p>
        {online.length === 0 && <p className="text-sm text-muted-foreground">Belum ada yang online. Ajak temanmu buka game ini.</p>}
        <ul className="space-y-2">
          {online.map((u) => (
            <li key={u.id} className="flex items-center gap-3 rounded-lg bg-muted p-2">
              <CharImg id={u.karakter} className="h-10 w-8" />
              <div className="flex-1 text-sm"><b>{u.nama}</b><div className="text-xs text-muted-foreground">{u.username}</div></div>
              <span className="text-xs text-muted-foreground">{u.room ? `di room ${u.room}` : "santai"}</span>
            </li>
          ))}
        </ul>
      </section>
      <details className="text-sm text-muted-foreground">
        <summary>Punya kode room?</summary>
        <form className="mt-2 flex gap-2" onSubmit={(e) => { e.preventDefault(); if (code.length === 4) void nav({ to: "/room/$code", params: { code } }); }}>
          <Input value={code} maxLength={4} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="ABCD" className="tracking-widest" />
          <Button type="submit" variant="secondary">Gabung</Button>
        </form>
      </details>
    </main>
  );
}
