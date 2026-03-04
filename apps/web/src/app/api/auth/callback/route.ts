import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.redirect(new URL('/dashboard', 'http://localhost:3000'));
}
