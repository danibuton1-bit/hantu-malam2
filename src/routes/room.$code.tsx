import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, Crown, Send } from "lucide-react";
import { CharImg } from "@/components/Art";
import { useApp } from "@/components/AppState";
import { Game, type GamePlayer } from "@/components/Game";
import { MuteButton } from "@/components/MuteButton";
import { ProfileCorner } from "@/components/ProfileCorner";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { audio } from "@/lib/audio";

export const Route = createFileRoute("/room/$code")({
  head: ({ params }) => ({
    meta: [
      { title: `Room ${params.code} - Hantu Malam` },
      { name: "description", content: `Gabung ke room ${params.code} dan mabar horor Hantu Malam.` },
      { property: "og:title", content: `Room ${params.code} - Hantu Malam` },
      { property: "og:description", content: "Lobby mabar horor: 1 hantu melawan 3 pemburu." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: RoomPage,
});

type RoomRow = { code: string; host_id: string; status: string };

function RoomPage() {
  const { code } = Route.useParams();
  const { ready, account, online, sendInvite, setRoom } = useApp();
  const nav = useNavigate();
  const [room, setRoomRow] = useState<RoomRow | null | undefined>(undefined);
  const [players, setPlayers] = useState<GamePlayer[]>([]);
  const [startedAt, setStartedAt] = useState<number>(0);
  const [invited, setInvited] = useState<Record<string, boolean>>({});
  const [err, setErr] = useState("");

  useEffect(() => { if (ready && !account) void nav({ to: "/" }); }, [ready, account, nav]);

  const refresh = useCallback(async () => {
    const [{ data: r }, { data: ps }, { data: gs }] = await Promise.all([
      supabase.from("rooms").select("code,host_id,status").eq("code", code).maybeSingle(),
      supabase.from("players").select("*").eq("room_code", code).order("joined_at"),
      supabase.from("game_state").select("started_at").eq("room_code", code).maybeSingle(),
    ]);
    setRoomRow(r ?? null);
    setPlayers((ps ?? []).map((p) => ({ id: p.profile_id, nama: p.nama, username: p.username, karakter: p.karakter as GamePlayer["karakter"], role: (p.role as GamePlayer["role"]) ?? null, status: p.status })));
    if (gs?.started_at) setStartedAt(new Date(gs.started_at).getTime());
  }, [code]);

  // join
  useEffect(() => {
    if (!account) return;
    setRoom(code);
    void (async () => {
      const { data: r } = await supabase.from("rooms").select("status").eq("code", code).maybeSingle();
      if (!r) { setRoomRow(null); return; }
      const { count } = await supabase.from("players").select("id", { count: "exact", head: true }).eq("room_code", code);
      const { data: mine } = await supabase.from("players").select("id").eq("room_code", code).eq("profile_id", account.id).maybeSingle();
      if (!mine) {
        if ((count ?? 0) >= 4) { setErr("Room penuh (maksimal 4 pemain)."); }
        else if (r.status !== "lobby") { setErr("Game di room ini sudah berjalan."); }
        else await supabase.from("players").insert({ room_code: code, profile_id: account.id, nama: account.nama, username: account.username, karakter: account.karakter_pilihan });
      }
      await refresh();
    })();
    const ch = supabase.channel(`room-db-${code}-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "players", filter: `room_code=eq.${code}` }, () => void refresh())
      .on("postgres_changes", { event: "*", schema: "public", table: "rooms", filter: `code=eq.${code}` }, () => void refresh())
      .subscribe();
    return () => { void supabase.removeChannel(ch); setRoom(null); };
  }, [account, code, refresh, setRoom]);

  async function leave() {
    if (!account) return;
    await supabase.from("players").delete().eq("room_code", code).eq("profile_id", account.id);
    void nav({ to: "/home" });
  }

  async function start() {
    if (players.length < 2) return;
    audio.init();
    const ghost = players[Math.floor(Math.random() * players.length)]!;
    await Promise.all(players.map((p) => supabase.from("players").update({ role: p.id === ghost.id ? "ghost" : "hunter", status: "alive" }).eq("room_code", code).eq("profile_id", p.id)));
    await supabase.from("game_state").upsert({ room_code: code, keys_found: 0, started_at: new Date(Date.now() + 3000).toISOString(), winner: null, updated_at: new Date().toISOString() });
    await supabase.from("rooms").update({ status: "playing" }).eq("code", code);
  }

  async function backToLobby() {
    await supabase.from("players").update({ role: null, status: "alive" }).eq("room_code", code);
    await supabase.from("rooms").update({ status: "lobby" }).eq("code", code);
  }

  if (!account || room === undefined) return <main className="p-6 text-center text-muted-foreground">Memuat room...</main>;
  if (room === null) return (
    <main className="mx-auto max-w-md space-y-4 p-6 text-center">
      <h1 className="font-horror text-3xl text-primary">ROOM TIDAK ADA</h1>
      <Button asChild><Link to="/home">Kembali</Link></Button>
    </main>
  );

  const isHost = room.host_id === account.id;
  const inRoom = players.some((p) => p.id === account.id);
  if (room.status !== "lobby" && inRoom && players.every((p) => p.role)) {
    return <Game code={code} me={account.id} players={players} startedAt={startedAt} isHost={isHost} onBackToLobby={backToLobby} onLeave={leave} />;
  }

  const invitable = online.filter((u) => !players.some((p) => p.id === u.id));
  return (
    <main className="mx-auto min-h-dvh max-w-md space-y-4 px-4 py-4">
      <header className="flex items-start gap-2"><div className="flex-1"><ProfileCorner /></div><MuteButton /></header>
      <button onClick={leave} className="inline-flex items-center gap-1 text-sm text-muted-foreground"><ArrowLeft className="size-4" /> Keluar room</button>
      <div className="rounded-xl border border-blood bg-card p-4 text-center glow-blood">
        <div className="text-xs text-muted-foreground">KODE ROOM</div>
        <div className="font-horror text-5xl tracking-[0.3em] text-primary">{code}</div>
      </div>
      {err && <p className="text-sm text-destructive">{err}</p>}
      <section>
        <h2 className="font-horror mb-2 text-xl">PEMAIN ({players.length}/4)</h2>
        <div className="grid grid-cols-2 gap-2">
          {players.map((p) => (
            <div key={p.id} className="flex items-center gap-2 rounded-lg border border-border bg-card p-2">
              <CharImg id={p.karakter} className="h-16 w-12" />
              <div className="min-w-0 text-sm">
                <div className="flex items-center gap-1 truncate font-bold">{p.id === room.host_id && <Crown className="size-3.5 text-gold" />}{p.nama}</div>
                <div className="truncate text-xs text-muted-foreground">{p.username}</div>
              </div>
            </div>
          ))}
        </div>
      </section>
      {isHost ? (
        <Button size="lg" className="h-14 w-full text-lg glow-blood" disabled={players.length < 2} onClick={start}>
          {players.length < 2 ? "Minimal 2 pemain" : "START"}
        </Button>
      ) : (
        <p className="text-center text-sm text-muted-foreground">Menunggu host memulai game...</p>
      )}
      <section className="rounded-xl border border-border bg-card p-3">
        <h2 className="font-horror text-lg">UNDANG TEMAN ONLINE</h2>
        {invitable.length === 0 && <p className="text-sm text-muted-foreground">Tidak ada teman online lain saat ini.</p>}
        <ul className="mt-2 space-y-2">
          {invitable.map((u) => (
            <li key={u.id} className="flex items-center gap-2 rounded-lg bg-muted p-2">
              <CharImg id={u.karakter} className="h-10 w-8" />
              <div className="flex-1 text-sm"><b>{u.nama}</b><div className="text-xs text-muted-foreground">{u.username}</div></div>
              <Button size="sm" variant={invited[u.id] ? "ghost" : "default"} onClick={() => { sendInvite(u.id, code); setInvited((s) => ({ ...s, [u.id]: true })); }}>
                <Send /> {invited[u.id] ? "Terkirim" : "Undang"}
              </Button>
            </li>
          ))}
        </ul>
      </section>
      <div className="rounded-lg border border-border bg-muted/50 p-3 text-xs text-muted-foreground">
        1 pemain acak jadi HANTU ASAP, sisanya PEMBURU. Pemburu cari 5 kunci lalu kabur lewat gerbang Kuburan Belakang dalam 5 menit. Hati-hati Kuntilanak dan Pocong: menyentuh mereka menguras baterai senter.
      </div>
    </main>
  );
}
