"use client";

import Image from "next/image";
import type { SyntheticEvent } from "react";
import type { LeagueToolPlayer } from "@/lib/leagueTools";

type AvatarSize = "xs" | "sm" | "md" | "lg";

type TeamMeta = {
  code: string;
  name: string;
  logoCode?: string;
};

const avatarPixels: Record<AvatarSize, number> = {
  xs: 26,
  sm: 34,
  md: 42,
  lg: 58
};

const nflTeams: Record<string, TeamMeta> = {
  ARI: { code: "ARI", name: "Arizona Cardinals", logoCode: "ari" },
  ATL: { code: "ATL", name: "Atlanta Falcons", logoCode: "atl" },
  BAL: { code: "BAL", name: "Baltimore Ravens", logoCode: "bal" },
  BUF: { code: "BUF", name: "Buffalo Bills", logoCode: "buf" },
  CAR: { code: "CAR", name: "Carolina Panthers", logoCode: "car" },
  CHI: { code: "CHI", name: "Chicago Bears", logoCode: "chi" },
  CIN: { code: "CIN", name: "Cincinnati Bengals", logoCode: "cin" },
  CLE: { code: "CLE", name: "Cleveland Browns", logoCode: "cle" },
  DAL: { code: "DAL", name: "Dallas Cowboys", logoCode: "dal" },
  DEN: { code: "DEN", name: "Denver Broncos", logoCode: "den" },
  DET: { code: "DET", name: "Detroit Lions", logoCode: "det" },
  GB: { code: "GB", name: "Green Bay Packers", logoCode: "gb" },
  HOU: { code: "HOU", name: "Houston Texans", logoCode: "hou" },
  IND: { code: "IND", name: "Indianapolis Colts", logoCode: "ind" },
  JAC: { code: "JAX", name: "Jacksonville Jaguars", logoCode: "jax" },
  JAX: { code: "JAX", name: "Jacksonville Jaguars", logoCode: "jax" },
  KC: { code: "KC", name: "Kansas City Chiefs", logoCode: "kc" },
  LA: { code: "LAR", name: "Los Angeles Rams", logoCode: "lar" },
  LAC: { code: "LAC", name: "Los Angeles Chargers", logoCode: "lac" },
  LAR: { code: "LAR", name: "Los Angeles Rams", logoCode: "lar" },
  LV: { code: "LV", name: "Las Vegas Raiders", logoCode: "lv" },
  MIA: { code: "MIA", name: "Miami Dolphins", logoCode: "mia" },
  MIN: { code: "MIN", name: "Minnesota Vikings", logoCode: "min" },
  NE: { code: "NE", name: "New England Patriots", logoCode: "ne" },
  NO: { code: "NO", name: "New Orleans Saints", logoCode: "no" },
  NYG: { code: "NYG", name: "New York Giants", logoCode: "nyg" },
  NYJ: { code: "NYJ", name: "New York Jets", logoCode: "nyj" },
  PHI: { code: "PHI", name: "Philadelphia Eagles", logoCode: "phi" },
  PIT: { code: "PIT", name: "Pittsburgh Steelers", logoCode: "pit" },
  SEA: { code: "SEA", name: "Seattle Seahawks", logoCode: "sea" },
  SF: { code: "SF", name: "San Francisco 49ers", logoCode: "sf" },
  TB: { code: "TB", name: "Tampa Bay Buccaneers", logoCode: "tb" },
  TEN: { code: "TEN", name: "Tennessee Titans", logoCode: "ten" },
  WAS: { code: "WAS", name: "Washington Commanders", logoCode: "wsh" },
  WSH: { code: "WAS", name: "Washington Commanders", logoCode: "wsh" },
  FA: { code: "FA", name: "Free Agent" },
  "-": { code: "-", name: "No NFL team" }
};

export function playerDisplayName(playerId: string, player?: LeagueToolPlayer | null) {
  const joinedName = [player?.first_name, player?.last_name].filter(Boolean).join(" ");

  if (player?.full_name) {
    return player.full_name;
  }

  if (joinedName) {
    return joinedName;
  }

  return playerId
    .replace(/^demo-/, "")
    .replace(/^player:/, "")
    .split("-")
    .map((part) => part ? part[0].toUpperCase() + part.slice(1) : part)
    .join(" ");
}

export function initialsFromName(name: string) {
  const parts = name.split(/\s+/).filter(Boolean);
  const initials = parts.length > 1 ? `${parts[0][0]}${parts[parts.length - 1][0]}` : name.slice(0, 2);
  return initials.toUpperCase();
}

export function playerHeadshotUrl(playerId?: string | null) {
  return playerId && /^\d+$/.test(playerId) ? `https://sleepercdn.com/content/nfl/players/thumb/${playerId}.jpg` : "";
}

export function teamMeta(team?: string | null): TeamMeta {
  const code = team?.trim().toUpperCase() || "FA";
  return nflTeams[code] ?? { code, name: code };
}

export function teamLogoUrl(team?: string | null) {
  const meta = teamMeta(team);
  return meta.logoCode ? `https://a.espncdn.com/i/teamlogos/nfl/500/${meta.logoCode}.png` : "";
}

export function sleeperAvatarUrl(avatar?: string | null) {
  return avatar ? `https://sleepercdn.com/avatars/thumbs/${avatar}` : "";
}

function hideBrokenImage(event: SyntheticEvent<HTMLImageElement>) {
  event.currentTarget.style.display = "none";
}

export function PlayerAvatar({ playerId, name, size = "md" }: { playerId?: string | null; name: string; size?: AvatarSize }) {
  const imageUrl = playerHeadshotUrl(playerId);
  const pixels = avatarPixels[size];

  return (
    <span className={`football-avatar football-avatar-${size}`} aria-hidden="true">
      {imageUrl ? (
        <Image alt="" height={pixels} loading="lazy" onError={hideBrokenImage} src={imageUrl} width={pixels} />
      ) : null}
      <em>{initialsFromName(name)}</em>
    </span>
  );
}

export function TeamLogo({ team, size = "sm" }: { team?: string | null; size?: "xs" | "sm" | "md" }) {
  const meta = teamMeta(team);
  const imageUrl = teamLogoUrl(team);
  const pixels = size === "xs" ? 18 : size === "md" ? 28 : 22;

  return (
    <span className={`team-logo team-logo-${size}`} title={meta.name} aria-label={meta.name}>
      {imageUrl ? (
        <Image alt="" height={pixels} loading="lazy" onError={hideBrokenImage} src={imageUrl} width={pixels} />
      ) : (
        <em>{meta.code.slice(0, 2)}</em>
      )}
    </span>
  );
}

export function TeamIdentity({ team, showName = false, compact = false }: { team?: string | null; showName?: boolean; compact?: boolean }) {
  const meta = teamMeta(team);

  return (
    <span className={compact ? "team-identity compact" : "team-identity"}>
      <TeamLogo team={team} size={compact ? "xs" : "sm"} />
      <span>
        <strong>{meta.code}</strong>
        {showName ? <small>{meta.name}</small> : null}
      </span>
    </span>
  );
}

export function PlayerIdentity({
  playerId,
  name,
  position,
  team,
  detail,
  compact = false,
  avatarSize = "md"
}: {
  playerId?: string | null;
  name: string;
  position?: string | null;
  team?: string | null;
  detail?: string;
  compact?: boolean;
  avatarSize?: AvatarSize;
}) {
  return (
    <span className={compact ? "player-identity compact" : "player-identity"}>
      <PlayerAvatar playerId={playerId} name={name} size={avatarSize} />
      <span className="player-identity-copy">
        <strong>{name}</strong>
        <small>
          {position ? <b>{position}</b> : null}
          <TeamIdentity team={team} compact />
          {detail ? <em>{detail}</em> : null}
        </small>
      </span>
    </span>
  );
}

export function ManagerIdentity({
  name,
  subtitle,
  avatar,
  compact = false
}: {
  name: string;
  subtitle?: string;
  avatar?: string | null;
  compact?: boolean;
}) {
  const imageUrl = sleeperAvatarUrl(avatar);
  const pixels = compact ? 32 : 38;

  return (
    <span className={compact ? "manager-identity compact" : "manager-identity"}>
      <span className="manager-avatar" aria-hidden="true">
        {imageUrl ? (
          <Image alt="" height={pixels} loading="lazy" onError={hideBrokenImage} src={imageUrl} width={pixels} />
        ) : null}
        <em>{initialsFromName(name)}</em>
      </span>
      <span>
        <strong>{name}</strong>
        {subtitle ? <small>{subtitle}</small> : null}
      </span>
    </span>
  );
}
