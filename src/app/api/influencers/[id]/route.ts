import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/db';
import { logger } from '@/lib/logger';

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
    const formData = await request.formData();
    const name = formData.get('name');
    const persona = formData.get('persona');
    const image = formData.get('image');

    const updates: Record<string, string | null> = {};
    if (name !== null && typeof name === 'string') updates.name = name;
    if (persona !== null && typeof persona === 'string') updates.persona = persona;

    const hasImage = image && image instanceof File && image.size > 0;

    if (Object.keys(updates).length === 0 && !hasImage) {
      return NextResponse.json(
        { error: 'No valid fields to update (name, persona, image)' },
        { status: 400 }
      );
    }

    // Handle image replacement
    if (hasImage) {
      // Fetch existing influencer to find old image path for cleanup
      const { data: existing } = await supabase
        .from('influencer')
        .select('image_url')
        .eq('id', id)
        .single();

      // Delete old image from Storage if it exists
      if (existing?.image_url) {
        const oldUrl = existing.image_url as string;
        // Extract storage path from public URL: .../storage/v1/object/public/assets/influencers/...
        const storageMarker = '/storage/v1/object/public/assets/';
        const markerIndex = oldUrl.indexOf(storageMarker);
        if (markerIndex !== -1) {
          const oldPath = oldUrl.substring(markerIndex + storageMarker.length);
          await supabase.storage.from('assets').remove([oldPath]);
        }
      }

      // Upload new image
      const ext = (image as File).name.split('.').pop() || 'png';
      const storagePath = `influencers/${id}/reference.${ext}`;
      const buffer = Buffer.from(await (image as File).arrayBuffer());
      const { error: uploadError } = await supabase.storage
        .from('assets')
        .upload(storagePath, buffer, { contentType: (image as File).type, upsert: true });

      if (uploadError) {
        logger.error({ err: uploadError, route: `/api/influencers/${id}` }, 'Error uploading influencer image');
        return NextResponse.json(
          { error: 'Failed to upload image' },
          { status: 500 }
        );
      }

      const { data: publicUrlData } = supabase.storage
        .from('assets')
        .getPublicUrl(storagePath);
      updates.image_url = publicUrlData.publicUrl;
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
    logger.error({ err: error, route: `/api/influencers/[id]` }, 'Error updating influencer');
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
    // Check if any active projects reference this influencer
    const TERMINAL_STATUSES = ['completed', 'failed'];
    const { data: activeProjects } = await supabase
      .from('project')
      .select('id, name, status')
      .eq('influencer_id', id)
      .not('status', 'in', `(${TERMINAL_STATUSES.join(',')})`);

    if (activeProjects && activeProjects.length > 0) {
      return NextResponse.json(
        {
          error: `Cannot delete influencer: ${activeProjects.length} active project(s) still reference this influencer`,
          projects: activeProjects.map((p: { id: string; name: string | null; status: string }) => ({
            id: p.id,
            name: p.name,
            status: p.status,
          })),
        },
        { status: 409 }
      );
    }

    const { error } = await supabase
      .from('influencer')
      .delete()
      .eq('id', id);

    if (error) {
      logger.error({ err: error, route: `/api/influencers/[id]` }, 'Error deleting influencer');
      return NextResponse.json({ error: 'Failed to delete influencer' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error({ err: error, route: `/api/influencers/[id]` }, 'Error deleting influencer');
    return NextResponse.json({ error: 'Failed to delete influencer' }, { status: 500 });
  }
}
