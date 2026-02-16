import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/db';
import { logger } from '@/lib/logger';

export async function DELETE(request: NextRequest) {
  try {
    const { error } = await supabase
      .from('tiktok_connection')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000');

    if (error) {
      logger.error({ error }, 'Failed to delete TikTok connection');
      return NextResponse.json(
        { error: 'Failed to disconnect TikTok' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error({ err: error }, 'Failed to disconnect TikTok');
    return NextResponse.json(
      { error: 'Failed to disconnect TikTok' },
      { status: 500 }
    );
  }
}
