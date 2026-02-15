import { NextResponse } from 'next/server';
import { supabase } from '@/db';
import { logger } from '@/lib/logger';

export async function GET() {
  const { data: characters, error } = await supabase
    .from('ai_character')
    .select('*')
    .eq('status', 'Active');

  if (error) {
    logger.error({ err: error, route: '/api/characters' }, 'Error listing characters');
    return NextResponse.json({ error: 'Failed to list characters' }, { status: 500 });
  }

  return NextResponse.json(characters);
}
