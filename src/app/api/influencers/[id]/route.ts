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

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const body = await request.json();
    const updates: Record<string, string> = {};

    if (body.name !== undefined) updates.name = body.name;
    if (body.persona !== undefined) updates.persona = body.persona;

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: 'No valid fields to update (name, persona)' },
        { status: 400 }
      );
    }

    updates.updated_at = new Date().toISOString();

    const { data: updated, error } = await supabase
      .from('influencer')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error || !updated) {
      return NextResponse.json(
        { error: 'Influencer not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(updated);
  } catch (error) {
    console.error('Error updating influencer:', error);
    return NextResponse.json(
      { error: 'Failed to update influencer' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    // Check if any projects reference this influencer
    const { count } = await supabase
      .from('project')
      .select('id', { count: 'exact', head: true })
      .eq('influencer_id', id);

    if (count && count > 0) {
      return NextResponse.json(
        { error: `Cannot delete influencer: ${count} project(s) still reference this influencer` },
        { status: 409 }
      );
    }

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
