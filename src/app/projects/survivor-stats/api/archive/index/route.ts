import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export const dynamic = "force-dynamic";

function getArchiveDir() {
  // points to: <projectRoot>/src/data/archive
  return path.join(process.cwd(), "src", "data", "archive");
}

export async function GET() {
  try {
    const dir = getArchiveDir();
    const files = fs
      .readdirSync(dir)
      .filter((f) => /^rankings_ep_\d{3}\.json$/i.test(f))
      .sort((a, b) => a.localeCompare(b));

    return NextResponse.json({ rankings: files });
  } catch (e) {
    return NextResponse.json(
      { rankings: [], error: "Failed to read archive directory." },
      { status: 500 }
    );
  }
}
