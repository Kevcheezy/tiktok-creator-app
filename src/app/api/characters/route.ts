import { NextResponse } from 'next/server';
import { db } from '@/db';
import { aiCharacter } from '@/db/schema';
import { eq } from 'drizzle-orm';

export async function GET() {
  const characters = await db.query.aiCharacter.findMany({
    where: eq(aiCharacter.status, 'Active'),
  });
  return NextResponse.json(characters);
}
