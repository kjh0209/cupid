import { NextRequest, NextResponse } from "next/server";

interface CreateUserBody {
  email: string;
  name: string;
  role?: string;
}

// In-memory store for demo
const users: Array<CreateUserBody & { id: string }> = [];

export async function GET(request: NextRequest) {
  return NextResponse.json({ users, count: users.length });
}

export async function POST(request: NextRequest) {
  let body: CreateUserBody;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // TODO: add Zod validation
  if (!body.email || !body.name) {
    return NextResponse.json({ error: "email and name are required" }, { status: 400 });
  }

  const user = {
    id: Math.random().toString(36).slice(2),
    email: body.email,
    name: body.name,
    role: body.role ?? "user",
  };

  users.push(user);
  return NextResponse.json({ user }, { status: 201 });
}
