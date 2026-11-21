import { useNavigate } from "@tanstack/react-router";
import { useApp } from "./AppState";
import { CharImg } from "./Art";
import { Button } from "./ui/button";

export function InviteToast() {
  const { invite, clearInvite } = useApp();
  const nav = useNavigate();
  if (!invite) return null;
  return (
    <div className="fixed inset-x-3 top-3 z-50 mx-auto flex max-w-md items-center gap-3 rounded-lg border border-blood bg-card p-3 glow-blood">
      <CharImg id={invite.from.karakter} className="h-14 w-10" />
      <div className="flex-1 text-sm">
        <b>{invite.from.nama}</b> mengajak kamu mabar di room <b className="text-primary">{invite.code}</b>
      </div>
      <div className="flex flex-col gap-1">
        <Button size="sm" onClick={() => { const c = invite.code; clearInvite(); void nav({ to: "/room/$code", params: { code: c } }); }}>Gabung</Button>
        <Button size="sm" variant="ghost" onClick={clearInvite}>Nanti</Button>
      </div>
    </div>
  );
}
