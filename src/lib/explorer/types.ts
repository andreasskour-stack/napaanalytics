// src/lib/explorer/types.ts

export type DuelRow = {
  rowId: string;
  duelId: number;
  challengeId: number;
  episodeId: number;

  playerId: number;
  playerName: string;
  tribe: string | null;

  // slicers
  propType: string;
  targetType: string;
  gamePrice: string;
  puzzle: boolean | null;
  airDate: string | null; // yyyy-mm-dd
  week: number | null;

  // performance
  won: 0 | 1;
  arrivedFirst: 0 | 1;
  isFinalPoint: 0 | 1;

  // team + metric
  teamColor: "Red" | "Blue";
  normMargin: number | null;
};

export type PuzzleMode = "ALL" | "ONLY" | "EXCLUDE";

export type Filters = {
  propTypes: Set<string>;
  targetTypes: Set<string>;
  gamePrices: Set<string>;
  puzzleMode: PuzzleMode;
  airDateMin: string | null;
  airDateMax: string | null;
  weekMin: number | null;
  weekMax: number | null;
};

export type PlayerAgg = {
  playerId: number;
  playerName: string;

  totalDuels: number;
  wins: number;
  winPct: number;

  arrivedFirst: number;
  arriveFirstPct: number;

  finalPtsWon: number;

  teamColor: "Red" | "Blue" | "Unknown";
  normMargin: number | null;
};

export type SortKey =
  | "playerId"
  | "playerName"
  | "winPct"
  | "arriveFirstPct"
  | "totalDuels"
  | "finalPtsWon"
  | "normMargin"
  | "teamColor";

export type SortDir = "asc" | "desc";

export type Meta = {
  version: number;
  generatedAtISO: string;
  rowCount: number;
  values: {
    propType: string[];
    targetType: string[];
    gamePrice: string[];
    week: number[];
    airDate: string[];
    puzzle: string[];
  };
  ranges: {
    week: { min: number; max: number };
    airDate: { min: string | null; max: string | null };
  };
};
