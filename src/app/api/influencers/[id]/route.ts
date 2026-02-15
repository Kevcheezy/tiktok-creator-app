import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/db';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const { data: influencer, error } = await supabase
    .from('influencer')
    .select('*')
    .eq('id', id)
    .single();

  if (error || !influencer) {
    return NextResponse.json(
      { error: 'Influencer not found' },
      { status: 404 }
    );
  }

  return NextResponse.json(influencer);
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const { error } = await supabase
      .from('influencer')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting influencer:', error);
      return NextResponse.json({ error: 'Failed to delete influencer' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting influencer:', error);
    return NextResponse.json({ error: 'Failed to delete influencer' }, { status: 500 });
  }
}
