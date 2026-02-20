import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export const dynamic = "force-dynamic";

function getArchiveDir() {
  return path.join(process.cwd(), "src", "data", "archive");
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const name = url.searchParams.get("name") ?? "";

    // Strict allowlist: ONLY rankings_ep_XXX.json
    if (!/^rankings_ep_\d{3}\.json$/i.test(name)) {
      return NextResponse.json({ error: "Invalid file name." }, { status: 400 });
    }

    const filePath = path.join(getArchiveDir(), name);

    if (!fs.existsSync(filePath)) {
      return NextResponse.json({ error: "Not found." }, { status: 404 });
    }

    const raw = fs.readFileSync(filePath, "utf8");
    const json = JSON.parse(raw);

    return NextResponse.json(json);
  } catch (e) {
    return NextResponse.json({ error: "Failed to read file." }, { status: 500 });
  }
}
