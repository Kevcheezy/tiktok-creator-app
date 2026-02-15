import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/db';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const { data: proj, error } = await supabase
    .from('project')
    .select('*, character:ai_character(*), script_template:script_template(*)')
    .eq('id', id)
    .single();

  if (error || !proj) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 });
  }

  return NextResponse.json(proj);
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const body = await request.json();

    const { data: updated, error } = await supabase
      .from('project')
      .update({ ...body, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();

    if (error || !updated) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    return NextResponse.json(updated);
  } catch (error) {
    console.error('Error updating project:', error);
    return NextResponse.json(
      { error: 'Failed to update project' },
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
    // Check if pipeline is actively running
    const ACTIVE_STATUSES = ['analyzing', 'scripting', 'casting', 'directing', 'voiceover', 'editing'];

    const { data: proj, error: fetchError } = await supabase
      .from('project')
      .select('status')
      .eq('id', id)
      .single();

    if (fetchError || !proj) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    if (ACTIVE_STATUSES.includes(proj.status)) {
      return NextResponse.json(
        { error: `Cannot delete project while pipeline is running (status: ${proj.status})` },
        { status: 409 }
      );
    }

    // Delete related records first (completed_run, assets, scenes, scripts)
    await supabase.from('completed_run').delete().eq('project_id', id);
    await supabase.from('asset').delete().eq('project_id', id);

    const { data: scripts } = await supabase
      .from('script')
      .select('id')
      .eq('project_id', id);

    if (scripts && scripts.length > 0) {
      const scriptIds = scripts.map((s) => s.id);
      await supabase.from('scene').delete().in('script_id', scriptIds);
      await supabase.from('script').delete().eq('project_id', id);
    }

    const { error } = await supabase
      .from('project')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting project:', error);
      return NextResponse.json({ error: 'Failed to delete project' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting project:', error);
    return NextResponse.json({ error: 'Failed to delete project' }, { status: 500 });
  }
}
