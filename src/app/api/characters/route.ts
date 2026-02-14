import { NextResponse } from 'next/server';
import { supabase } from '@/db';

export async function GET() {
  const { data: characters, error } = await supabase
    .from('ai_character')
    .select('*')
    .eq('status', 'Active');

  if (error) {
    console.error('Error listing characters:', error);
    return NextResponse.json({ error: 'Failed to list characters' }, { status: 500 });
  }

  return NextResponse.json(characters);
}
