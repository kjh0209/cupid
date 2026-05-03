import { NextRequest, NextResponse } from "next/server";

interface Post {
  id: string;
  title: string;
  content: string;
  authorId: string;
  createdAt: string;
}

const posts: Post[] = [];

export async function GET() {
  return NextResponse.json({ posts });
}

export async function POST(request: NextRequest) {
  const body = await request.json();

  // Missing validation - good target for eval task
  const post: Post = {
    id: Math.random().toString(36).slice(2),
    title: body.title,
    content: body.content,
    authorId: body.authorId,
    createdAt: new Date().toISOString(),
  };

  posts.push(post);
  return NextResponse.json({ post }, { status: 201 });
}
