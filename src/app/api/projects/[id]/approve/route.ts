import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/db';
import { getPipelineQueue } from '@/lib/queue';
import { logger } from '@/lib/logger';
import { WaveSpeedClient } from '@/lib/api-clients/wavespeed';
import { API_COSTS } from '@/lib/constants';

/**
 * POST /api/projects/[id]/approve
 *
 * Approves the current review stage and enqueues the next pipeline step.
 * - analysis_review -> auto-draft concept via LLM, set status to 'concept_review'
 * - concept_review  -> save concept edits, enqueue 'scripting'
 * - script_review   -> enqueue 'broll_planning'
 * - casting_review  -> enqueue 'directing'
 * - asset_review    -> enqueue 'editing'
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    // Fetch current project status
    const { data: proj, error } = await supabase
      .from('project')
      .select('id, status, product_image_url')
      .eq('id', id)
      .single();

    if (error || !proj) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Gate: require product image before progressing past analysis_review
    if (proj.status === 'analysis_review' && !proj.product_image_url) {
      return NextResponse.json(
        { error: 'A product image is required before proceeding. Upload one or verify the extracted image.' },
        { status: 400 }
      );
    }

    // analysis_review -> concept_review (auto-draft concept from product_data via LLM)
    if (proj.status === 'analysis_review') {
      const { data: fullProj } = await supabase
        .from('project')
        .select('product_data')
        .eq('id', id)
        .single();

      const productData = fullProj?.product_data as {
        product_name?: string;
        category?: string;
        selling_points?: string[];
        key_claims?: string[];
        benefits?: string[];
        hook_angle?: string;
      } | null;

      let concept = null;

      if (productData) {
        try {
          const wavespeed = new WaveSpeedClient();
          const systemPrompt = `You are a marketing strategist. Given product data, create a strategic concept for a UGC advertisement.
Output ONLY valid JSON matching this structure:
{
  "persona": {
    "demographics": "specific age, gender, life stage",
    "psychographics": "values, priorities, lifestyle constraints",
    "current_situation": "specific challenges they face right now",
    "desired_outcomes": "what they actually want beyond product benefits"
  },
  "pain_points": {
    "functional": ["3-5 surface-level practical problems"],
    "emotional": ["3-5 deeper emotional drivers"]
  },
  "unique_mechanism": "how this product works differently from category defaults",
  "transformation": {
    "before": "vivid description of their current frustrated state",
    "after": "vivid description of their desired state with emotional specificity"
  },
  "hook_angle": "the strategic opening angle for the advertisement"
}`;

          const userPrompt = `Product: ${productData.product_name || 'Unknown'}
Category: ${productData.category || 'general'}
Selling Points: ${(productData.selling_points || []).join(', ')}
Key Claims: ${(productData.key_claims || []).join(', ')}
Benefits: ${(productData.benefits || []).join(', ')}
Current Hook Angle: ${productData.hook_angle || 'N/A'}

Create a detailed strategic concept targeting the most compelling audience for this product.`;

          const rawResponse = await wavespeed.chatCompletion(systemPrompt, userPrompt);
          const cleaned = rawResponse.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
          concept = JSON.parse(cleaned);

          // Track LLM cost
          await supabase.rpc('increment_project_cost', {
            p_id: id,
            amount: API_COSTS.wavespeedChat,
          });
        } catch (err) {
          logger.error({ err, projectId: id, route: '/api/projects/[id]/approve' }, 'Failed to auto-draft concept, proceeding with null concept');
        }
      }

      await supabase
        .from('project')
        .update({
          status: 'concept_review',
          concept,
          cancel_requested_at: null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id);

      return NextResponse.json({
        message: 'Analysis approved. Concept drafted for review.',
        projectId: id,
        previousStatus: 'analysis_review',
        nextStep: 'concept_review',
      });
    }

    // concept_review -> scripting (save any pending concept edits, enqueue scripting)
    if (proj.status === 'concept_review') {
      let conceptFromBody = null;
      try {
        const body = await request.json();
        if (body?.concept) {
          conceptFromBody = body.concept;
        }
      } catch {
        // No body or invalid JSON — use existing concept
      }

      const updatePayload: Record<string, unknown> = {
        cancel_requested_at: null,
        updated_at: new Date().toISOString(),
      };

      if (conceptFromBody) {
        updatePayload.concept = conceptFromBody;
      }

      await supabase
        .from('project')
        .update(updatePayload)
        .eq('id', id);

      await getPipelineQueue().add('scripting', {
        projectId: id,
        step: 'scripting',
      });

      return NextResponse.json({
        message: 'Concept approved. Scripting started.',
        projectId: id,
        previousStatus: 'concept_review',
        nextStep: 'scripting',
      });
    }

    // script_review -> broll_planning (B-roll planning runs before influencer selection)
    if (proj.status === 'script_review') {
      await supabase
        .from('project')
        .update({ status: 'broll_planning', cancel_requested_at: null, updated_at: new Date().toISOString() })
        .eq('id', id);

      await getPipelineQueue().add('broll_planning', {
        projectId: id,
        step: 'broll_planning',
      });

      return NextResponse.json({
        message: 'Script approved. B-roll planning started.',
        projectId: id,
        previousStatus: 'script_review',
        nextStep: 'broll_planning',
      });
    }

    // broll_review -> influencer_selection (user picks influencer after B-roll review)
    if (proj.status === 'broll_review') {
      await supabase
        .from('project')
        .update({ status: 'influencer_selection', cancel_requested_at: null, updated_at: new Date().toISOString() })
        .eq('id', id);

      return NextResponse.json({
        message: 'B-roll plan approved. Please select an influencer before casting.',
        projectId: id,
        previousStatus: 'broll_review',
        nextStep: 'influencer_selection',
      });
    }

    // Gate: require influencer voice before directing (voice needed for voiceover stage)
    if (proj.status === 'casting_review') {
      const { data: project } = await supabase
        .from('project')
        .select('influencer_id')
        .eq('id', id)
        .single();

      if (project?.influencer_id) {
        const { data: influencer } = await supabase
          .from('influencer')
          .select('id, name, voice_id')
          .eq('id', project.influencer_id)
          .single();

        if (influencer && !influencer.voice_id) {
          return NextResponse.json(
            { error: `Influencer "${influencer.name}" has no designed voice. Design a voice from the Influencer page before directing.` },
            { status: 400 }
          );
        }
      }
    }

    // Map review status to next pipeline step
    const nextStepMap: Record<string, { step: string; jobName: string }> = {
      casting_review: { step: 'directing', jobName: 'directing' },
    };

    const next = nextStepMap[proj.status];

    if (proj.status === 'asset_review') {
      // Clear any stale cancel flag before enqueuing new work
      await supabase
        .from('project')
        .update({ cancel_requested_at: null, updated_at: new Date().toISOString() })
        .eq('id', id);

      await getPipelineQueue().add('editing', {
        projectId: id,
        step: 'editing',
      });

      return NextResponse.json({
        message: 'Approved. Enqueued "editing" step.',
        projectId: id,
        previousStatus: proj.status,
        nextStep: 'editing',
      });
    }

    if (!next) {
      return NextResponse.json(
        { error: `Project is not in a review state (current: ${proj.status})` },
        { status: 400 }
      );
    }

    // Clear any stale cancel flag before enqueuing new work
    await supabase
      .from('project')
      .update({ cancel_requested_at: null, updated_at: new Date().toISOString() })
      .eq('id', id);

    // Enqueue next pipeline step
    await getPipelineQueue().add(next.jobName, {
      projectId: id,
      step: next.step as 'scripting' | 'casting' | 'directing',
    });

    return NextResponse.json({
      message: `Approved. Enqueued "${next.step}" step.`,
      projectId: id,
      previousStatus: proj.status,
      nextStep: next.step,
    });
  } catch (error) {
    logger.error({ err: error, route: '/api/projects/[id]/approve' }, 'Error approving project');
    return NextResponse.json(
      { error: 'Failed to approve project' },
      { status: 500 }
    );
  }
}
