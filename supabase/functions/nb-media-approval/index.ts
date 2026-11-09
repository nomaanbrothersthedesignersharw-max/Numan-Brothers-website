/**
 * Privileged media promotion. Client sends its session JWT via functions.invoke().
 * The secret key is supplied by the Supabase runtime, never to browser code.
 * Approval is verified against *fresh* Auth app_metadata on every request.
 *
 * Deploy only after reviewing the Phase 2 migration and Edge Function tests.
 */
import { withSupabase } from 'npm:@supabase/server@1'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json',
}
const json = (status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), { status, headers: cors })

/**
 * Website CMS stores hero, editorial, featured-card and per-section media
 * URLs in the same homepage JSON document. Check *all* of those references
 * before archive, revoke or deletion — including unsaved published changes
 * represented by the last persisted draft. SQL triggers enforce this again.
 */
function homepageReferences(content: unknown, assetUrl: string): boolean {
  if (!content || typeof content !== 'object' || Array.isArray(content)) return false;
  const home = content as Record<string, unknown>;
  if (['heroImage','menImage','kidsImage','storyImage','customizationImage']
      .some(key => home[key] === assetUrl)) return true;
  return ['featuredImages','sectionVideos'].some(key => {
    const group = home[key];
    return group && typeof group === 'object' && !Array.isArray(group)
      && Object.values(group as Record<string, unknown>).some(value => value === assetUrl);
  });
}

const handler = withSupabase({ auth: 'user' }, async (req, ctx) => {
  if (req.method !== 'POST') return json(405, { error: 'Method not allowed' })

  let request: { id?: unknown; action?: unknown };
  try { request = await req.json() }
  catch { return json(400, { error: 'Expected JSON body' }) }
  const id = request.id;
  const action = request.action;
  if (typeof id !== 'string' || !/^[0-9a-f-]{36}$/i.test(id) ||
      !['approve','revoke','archive','restore','delete'].includes(action as string)) {
    return json(400, { error: 'Invalid asset or action' })
  }

  const actorId = ctx.jwtClaims?.sub;
  if (typeof actorId !== 'string' || !actorId) return json(401, { error: 'Sign in again' })

  // JWT role claims may be stale after revocation. Always verify current role
  // with the Auth admin endpoint before any RLS-bypassing storage operation.
  const { data: identity, error: identityError } =
    await ctx.supabaseAdmin.auth.admin.getUserById(actorId)
  const role = identity?.user?.app_metadata?.nb_role;
  if (identityError || !identity?.user ||
      (role !== 'owner' && role !== 'admin')) {
    return json(403, { error: 'Owner/admin permission required' })
  }

  const { data: asset, error: assetError } = await ctx.supabaseAdmin
    .from('nb_media').select('id,storage_path,approved,archived_at').eq('id', id).maybeSingle()
  if (assetError) return json(500, { error: 'Could not inspect the media record' })
  if (!asset) return json(404, { error: 'Media not found' })

  const path = asset.storage_path as string;
  if (!/^[0-9a-f-]{36}\/[0-9a-f-]{36}\.(jpg|png|webp|avif|gif|mp4|webm)$/i.test(path)) {
    return json(409, { error: 'Media path requires manual review' })
  }

  // Restoring an archived asset never breaks existing public references.
  if (action === 'restore') {
    const {error}=await ctx.supabaseAdmin.from('nb_media')
      .update({archived_at:null}).eq('id',id)
    if(error)return json(500,{error:'Unable to restore the media asset'})
    return json(200,{ok:true,archived:false})
  }

  const publicBucket = ctx.supabaseAdmin.storage.from('nb-media-public');
  if (action === 'approve') {
    if(asset.archived_at)return json(409,{error:'Restore the asset from archive before approving'})
    // An earlier retry may have copied the object before the DB update failed.
    const { data: existing } = await publicBucket.info(path)
    if (!existing) {
      const { error: copyError } = await ctx.supabaseAdmin.storage
        .from('nb-media-staging').copy(path, path, { destinationBucket: 'nb-media-public' })
      if (copyError) return json(502, { error: 'Media copy failed; approval not recorded' })
    }
    const { error: updateError } = await ctx.supabaseAdmin.from('nb_media')
      .update({ approved: true }).eq('id', id)
    if (updateError) return json(500, { error: 'Object copied but metadata update failed; retry approval' })
    return json(200, { ok: true, approved: true })
  }

  // A published product or homepage must never be left with a broken gallery.
  // Associations are rebuilt transactionally when a product is published.
  const publicUrl = publicBucket.getPublicUrl(path).data.publicUrl
  const [products, homes, collections, legacyImages, legacyVideo, productVideoGallery,
    productDraftImages, productDraftVideo, productDraftVideoGallery, homeDraft] = await Promise.all([
    ctx.supabaseAdmin.from('nb_product_media')
      .select('product_id', { count: 'exact', head: true }).eq('media_id', id),
    ctx.supabaseAdmin.from('nb_home_public').select('content').eq('key', 'home').maybeSingle(),
    ctx.supabaseAdmin.from('nb_categories')
      .select('path', { count: 'exact', head: true }).eq('image_url', publicUrl),
    ctx.supabaseAdmin.from('nb_products')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'published').contains('image_urls', [publicUrl]),
    ctx.supabaseAdmin.from('nb_products')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'published').eq('video_url', publicUrl),
    ctx.supabaseAdmin.from('nb_products')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'published').contains('video_urls', [publicUrl]),
    // Draft references must also be released *and saved* before file deletion.
    // Otherwise previously saved work would silently point to missing Storage.
    ctx.supabaseAdmin.from('nb_product_drafts')
      .select('product_id', { count: 'exact', head: true })
      .contains('content', {imageUrls:[publicUrl]}),
    ctx.supabaseAdmin.from('nb_product_drafts')
      .select('product_id', { count: 'exact', head: true })
      .eq('content->>videoUrl', publicUrl),
    ctx.supabaseAdmin.from('nb_product_drafts')
      .select('product_id', { count: 'exact', head: true })
      .contains('content', {videoUrls:[publicUrl]}),
    ctx.supabaseAdmin.from('nb_home_drafts')
      .select('content').eq('key','home').maybeSingle(),
  ])
  if (products.error || homes.error || collections.error ||
      legacyImages.error || legacyVideo.error || productVideoGallery.error ||
      productDraftImages.error || productDraftVideo.error || productDraftVideoGallery.error || homeDraft.error) {
    return json(503, { error: 'Cannot verify media references; revocation denied' })
  }
  const referencedByHome = homepageReferences(homes.data?.content, publicUrl)
  const referencedByHomeDraft = homepageReferences(homeDraft.data?.content, publicUrl)
  if ((products.count ?? 0) > 0 || (collections.count ?? 0) > 0 ||
      (legacyImages.count ?? 0) > 0 || (legacyVideo.count ?? 0) > 0 ||
      (productVideoGallery.count ?? 0) > 0 ||
      (productDraftImages.count ?? 0) > 0 || (productDraftVideo.count ?? 0) > 0 ||
      (productDraftVideoGallery.count ?? 0) > 0 ||
      referencedByHome || referencedByHomeDraft) {
    return json(409, { error: 'This file is still used by a published page or saved draft. Remove it, save and publish the replacement, then retry deletion.' })
  }

  if(action==='archive') {
    // Archiving an in-use file would make the published page impossible to
    // republish without replacing its image. Reject it like deletion.
    const {error}=await ctx.supabaseAdmin.from('nb_media')
      .update({archived_at:new Date().toISOString()}).eq('id',id)
    if(error)return json(500,{error:'Unable to archive this asset'})
    return json(200,{ok:true,archived:true})
  }

  if(action==='delete') {
    // The metadata row is deliberately deleted last. Any Storage failure
    // keeps a server-side record that an owner can retry/reconcile.
    // Associations (including archived products) must be removed first.
    if(asset.approved){
      const {error}=await ctx.supabaseAdmin.from('nb_media').update({approved:false}).eq('id',id)
      if(error)return json(409,{error:'Could not safely revoke approval before deleting'})
    }
    const {error:publicError}=await publicBucket.remove([path])
    if(publicError)return json(502,{error:'Could not remove the public file; deletion incomplete'})
    const {error:stagingError}=await ctx.supabaseAdmin.storage.from('nb-media-staging').remove([path])
    if(stagingError)return json(502,{error:'Could not remove the original file; deletion incomplete'})
    const {error:recordError}=await ctx.supabaseAdmin.from('nb_media').delete().eq('id',id)
    if(recordError)return json(409,{error:'File copies removed, but a database reference prevents record deletion; review dependent drafts'})
    return json(200,{ok:true,deleted:true})
  }

  // No currently published content depends on this image. Unpublish metadata
  // first, then remove the public Storage copy; failures require reconciliation.
  const { error: updateError } = await ctx.supabaseAdmin.from('nb_media')
    .update({ approved: false }).eq('id', id)
  if (updateError) return json(500, { error: 'Could not revoke media approval' })
  const { error: deleteError } = await publicBucket.remove([path])
  if (deleteError) return json(502, { error: 'Approval revoked, public copy removal needs reconciliation' })
  return json(200, { ok: true, approved: false })
})

export default {
  fetch(req: Request) {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
    return handler(req)
  },
}
