import { NextResponse } from 'next/server';
import { MOCK_DATA } from '@/lib/mock-data';

export async function GET() {
  return NextResponse.json({ preferences: MOCK_DATA.user_preferences[0] || null });
}

export async function PUT() {
  return NextResponse.json({ preferences: MOCK_DATA.user_preferences[0] || null });
}
