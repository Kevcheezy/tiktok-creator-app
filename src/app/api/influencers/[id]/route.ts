import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/db';
import { logger } from '@/lib/logger';
import { getPublicUrl, extractStoragePath, deleteStorageFile } from '@/lib/storage';
import { WaveSpeedClient } from '@/lib/api-clients/wavespeed';
import { API_COSTS } from '@/lib/constants';

const wavespeed = new WaveSpeedClient();

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
    const contentType = request.headers.get('content-type') || '';
    let name: string | null = null;
    let persona: string | null = null;
    let image: File | null = null;
    let storagePath: string | null = null;

    if (contentType.includes('application/json')) {
      const body = await request.json();
      name = body.name ?? null;
      persona = body.persona ?? null;
      storagePath = body.storagePath ?? null;
    } else {
      const formData = await request.formData();
      name = formData.get('name') as string | null;
      persona = formData.get('persona') as string | null;
      const imageField = formData.get('image');
      if (imageField && imageField instanceof File && imageField.size > 0) {
        image = imageField;
      }
    }

    const updates: Record<string, string | null> = {};
    if (name !== null && typeof name === 'string') updates.name = name;
    if (persona !== null && typeof persona === 'string') updates.persona = persona;

    const hasNewImage = !!storagePath || !!image;

    if (Object.keys(updates).length === 0 && !hasNewImage) {
      return NextResponse.json(
        { error: 'No valid fields to update (name, persona, image/storagePath)' },
        { status: 400 }
      );
    }

    // Clean up old image when replacing
    if (hasNewImage) {
      const { data: existing } = await supabase
        .from('influencer')
        .select('image_url')
        .eq('id', id)
        .single();

      if (existing?.image_url) {
        const oldPath = extractStoragePath(existing.image_url as string);
        if (oldPath) {
          await deleteStorageFile(oldPath);
        }
      }
    }

    // Direct-to-storage: file already uploaded, just resolve public URL
    if (storagePath) {
      updates.image_url = getPublicUrl(storagePath);
    }

    // Legacy: server-side upload via FormData
    if (image) {
      const ext = image.name.split('.').pop() || 'png';
      const legacyPath = `influencers/${id}/reference.${ext}`;
      const buffer = Buffer.from(await image.arrayBuffer());
      const { error: uploadError } = await supabase.storage
        .from('assets')
        .upload(legacyPath, buffer, { contentType: image.type, upsert: true });

      if (uploadError) {
        logger.error({ err: uploadError, route: `/api/influencers/${id}` }, 'Error uploading influencer image');
        return NextResponse.json(
          { error: 'Failed to upload image' },
          { status: 500 }
        );
      }

      const { data: publicUrlData } = supabase.storage
        .from('assets')
        .getPublicUrl(legacyPath);
      updates.image_url = publicUrlData.publicUrl;
    }

    // Upscale new image to 4K via WaveSpeed (non-fatal)
    if (hasNewImage && updates.image_url) {
      try {
        logger.info({ influencerId: id, route: '/api/influencers/[id]' }, 'Upscaling influencer image to 4K');
        const { taskId } = await wavespeed.upscaleImage(updates.image_url, {
          targetResolution: '4k',
          outputFormat: 'png',
        });
        const result = await wavespeed.pollResult(taskId, {
          maxWait: 60000,
          initialInterval: 3000,
        });
        if (result.url) {
          updates.image_url = result.url;
          // Track upscale cost
          const { data: currentInf } = await supabase
            .from('influencer')
            .select('cost_usd')
            .eq('id', id)
            .single();
          const currentCost = parseFloat(currentInf?.cost_usd || '0');
          (updates as Record<string, unknown>).cost_usd = (currentCost + API_COSTS.imageUpscaler).toFixed(4);
          logger.info({ influencerId: id, taskId }, 'Influencer image upscaled to 4K');
        }
      } catch (upscaleErr) {
        logger.error({ err: upscaleErr, influencerId: id, route: '/api/influencers/[id]' }, 'Influencer image upscale failed, using original');
      }
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
