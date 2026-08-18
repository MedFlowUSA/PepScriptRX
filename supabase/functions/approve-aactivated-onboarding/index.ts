import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const URL=Deno.env.get('SUPABASE_URL')??'', ANON=Deno.env.get('SUPABASE_ANON_KEY')??'', SERVICE=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')??'';
const EMAIL_KEY=Deno.env.get('EMAIL_PROVIDER_API_KEY')??Deno.env.get('RESEND_API_KEY')??'',FROM_EMAIL=Deno.env.get('FROM_EMAIL')??Deno.env.get('NOTIFY_FROM')??'PepScriptRX <noreply@pepscriptrx.com>',SITE=(Deno.env.get('SITE_URL')??Deno.env.get('APP_URL')??'https://pepscriptrx.vercel.app').replace(/\/+$/,'');
const cors={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, x-client-info, x-supabase-api-version, apikey, content-type','Content-Type':'application/json'};
serve(async(req)=>{if(req.method==='OPTIONS')return new Response('ok',{headers:cors});try{
  const token=req.headers.get('Authorization')??''; const auth=createClient(URL,ANON,{global:{headers:{Authorization:token}}}); const {data:{user}}=await auth.auth.getUser(); if(!user)return out({error:'Authentication required'},401);
  const db=createClient(URL,SERVICE); const {data:admin}=await db.from('profiles').select('id,role,brand_id,store_slug').or(`id.eq.${user.id},auth_user_id.eq.${user.id}`).maybeSingle();
  const platform=['admin','owner','platform_admin','master_admin','super_admin'].includes(admin?.role); const scoped=['rx_plus_admin','partner_admin_full'].includes(admin?.role)&&['aactivated','aactivatedrx'].includes(String(admin?.brand_id??admin?.store_slug).toLowerCase()); if(!platform&&!scoped)return out({error:'AACTIVATEDRX administrator authorization required'},403);
  const body=await req.json();
  if(body.action==='list_store_manager_reps'){
    const [{data:linkedRows,error:linkedError},{data:allReps,error:repsError}]=await Promise.all([
      db.from('aactivated_onboarding_profiles').select('rep_id').not('rep_id','is',null),
      db.from('reps').select('*').order('created_at',{ascending:false}),
    ]);
    if(linkedError||repsError)throw linkedError??repsError;
    const linkedIds=new Set((linkedRows??[]).map((row:any)=>row.rep_id));
    const reps=(allReps??[]).filter((row:any)=>linkedIds.has(row.id)||['aactivated','aactivatedrx'].includes(String(row.rep_channel??row.brand_name??row.custom_store_slug??'').toLowerCase())||String(row.rep_slug??'').toUpperCase()==='GUY60');
    return out({ok:true,reps});
  }
  const {data:application,error:applicationLoadError}=await db.from('rep_store_intake_submissions').select('*').eq('id',body.application_id).eq('source_portal_id','aactivated').single(); if(applicationLoadError||!application)return out({error:'AACTIVATEDRX application not found'},404);
  const {data:submittedOnboarding,error:submittedOnboardingError}=await db.from('aactivated_onboarding_profiles').select('*').eq('application_id',application.id).single();if(submittedOnboardingError||!submittedOnboarding)return out({error:'Onboarding record not found'},404);
  const [{data:signedAgreement},{data:submittedW9},{data:submittedPayout}]=await Promise.all([
    db.from('aactivated_agreement_signatures').select('id').eq('onboarding_id',submittedOnboarding.id).limit(1).maybeSingle(),
    db.from('aactivated_w9_submissions').select('id,status').eq('onboarding_id',submittedOnboarding.id).neq('status','superseded').order('created_at',{ascending:false}).limit(1).maybeSingle(),
    db.from('aactivated_payout_profiles').select('id,verification_status').eq('onboarding_id',submittedOnboarding.id).is('superseded_at',null).order('submitted_at',{ascending:false}).limit(1).maybeSingle(),
  ]);
  const allSubmitted=submittedOnboarding.account_status==='complete'&&Boolean(signedAgreement)&&['submitted','under_review','accepted'].includes(submittedW9?.status)&&submittedOnboarding.starter_kit_status==='complete'&&['submitted','verified'].includes(submittedPayout?.verification_status);
  if(!allSubmitted)return out({error:'Final approval is available only after the rep submits every onboarding step and starter-kit purchase attestation.'},409);
  const repCode=String(body.rep_code??'').replace(/[^A-Z0-9]/gi,'').toUpperCase(); if(!repCode)return out({error:'Representative code required'},400);
  const {data:existingOnboarding}=await db.from('aactivated_onboarding_profiles').select('rep_id').eq('application_id',application.id).maybeSingle();
  let {data:rep,error:repLookupError}=await db.from('reps').select('id,profile_id').eq('rep_slug',repCode).maybeSingle();if(repLookupError)throw repLookupError;
  if(rep&&rep.id!==existingOnboarding?.rep_id){const {data:otherOwner,error:ownerError}=await db.from('aactivated_onboarding_profiles').select('id').eq('rep_id',rep.id).neq('application_id',application.id).limit(1).maybeSingle();if(ownerError)throw ownerError;const belongsToApplicant=Boolean(application.applicant_user_id&&rep.profile_id===application.applicant_user_id);const reusableOrphan=!otherOwner&&(!rep.profile_id||belongsToApplicant);if(!reusableOrphan)return out({error:'Representative code is already assigned. Choose a different code.'},409);}
  const {data:aactivatedParent}=await db.from('reps').select('id').eq('rep_slug','GUY60').maybeSingle();
  const repPayload={rep_slug:repCode,rep_name:application.full_name,parent_rep_id:body.sponsor_rep_id||aactivatedParent?.id||null,commission_rate:0,payout_email:application.email,active:true,custom_store_slug:'aactivated',brand_name:'AACTIVATEDRX',rep_channel:'aactivated',rep_tier:'aactivated_rep'};
  if(rep){const {error}=await db.from('reps').update(repPayload).eq('id',rep.id);if(error)throw error;}else{const created=await db.from('reps').insert(repPayload).select('id,profile_id').single();if(created.error)throw created.error;rep=created.data;}
  let authUser=null;
  if(application.applicant_user_id){const found=await db.auth.admin.getUserById(application.applicant_user_id);if(!found.error)authUser=found.data.user;}
  if(!authUser){const {data:existingProfile}=await db.from('profiles').select('id,auth_user_id').ilike('email',application.email).maybeSingle();const authId=existingProfile?.auth_user_id??existingProfile?.id;if(authId){const found=await db.auth.admin.getUserById(authId);if(!found.error)authUser=found.data.user;}}
  if(!authUser){const invited=await db.auth.admin.inviteUserByEmail(application.email,{redirectTo:`${SITE}/auth/callback`,data:{full_name:application.full_name,role:'rep',brand_id:'aactivated'}});if(invited.error)throw invited.error;authUser=invited.data.user;}
  const {error:profileError}=await db.from('profiles').upsert({id:authUser.id,auth_user_id:authUser.id,email:application.email,full_name:application.full_name,phone:application.phone,role:'rep',brand_id:'aactivated',store_slug:'aactivated'},{onConflict:'id'});if(profileError)throw profileError;
  const {error:repLinkError}=await db.from('reps').update({profile_id:authUser.id}).eq('id',rep.id);if(repLinkError)throw repLinkError;
  const finalizedAt=new Date().toISOString();
  const {data:onboarding,error:onboardingError}=await db.from('aactivated_onboarding_profiles').upsert({application_id:application.id,rep_id:rep.id,user_id:authUser.id,state:'active',account_status:'complete',agreement_status:'complete',w9_status:'accepted',starter_kit_status:'complete',payout_status:'complete',commissions_enabled:true,referral_enabled:true,approved_at:finalizedAt,activated_at:finalizedAt,updated_at:finalizedAt},{onConflict:'application_id'}).select('id').single();if(onboardingError)throw onboardingError;
  const [w9Review,payoutReview]=await Promise.all([
    db.from('aactivated_w9_submissions').update({status:'accepted',reviewer_id:user.id,reviewed_at:finalizedAt,correction_reason:null}).eq('id',submittedW9.id),
    db.from('aactivated_payout_profiles').update({verification_status:'verified',verified_at:finalizedAt,admin_notes:null}).eq('id',submittedPayout.id),
  ]);if(w9Review.error||payoutReview.error)throw w9Review.error??payoutReview.error;
  const {error:applicationUpdateError}=await db.from('rep_store_intake_submissions').update({status:'ready_to_build',approval_status:'approved',approval_notes:body.internal_note||'Approved for secure onboarding',paypal_account:null,applicant_user_id:authUser.id}).eq('id',application.id);if(applicationUpdateError)throw applicationUpdateError;
  await notifyApproval(db,onboarding.id,application.email);
  const {error:auditError}=await db.from('aactivated_onboarding_audit').insert({onboarding_id:onboarding.id,actor_id:user.id,action:'final_onboarding_approved_and_activated',reason:body.internal_note||null,metadata:{commission_configuration_pending:Number(body.commission_percent||0),existing_applicant_promoted:true,starter_kit_purchase_attested:true}});if(auditError)throw auditError;
  return out({ok:true,onboarding_id:onboarding.id});
}catch(error){console.error('Secure approval failed',error instanceof Error?error.message:'unknown');return out({error:'Secure approval failed'},400);}});
function out(body:unknown,status=200){return new Response(JSON.stringify(body),{status,headers:cors});}
async function notifyApproval(db:any,onboardingId:string,email:string){const path='/rep';const {data:row,error}=await db.from('aactivated_onboarding_notifications').insert({onboarding_id:onboardingId,event_type:'rep_portal_activated',recipient_email:email,status:'pending',secure_portal_path:path}).select('id').single();if(error)throw error;if(!EMAIL_KEY){await db.from('aactivated_onboarding_notifications').update({status:'suppressed'}).eq('id',row.id);return;}try{const response=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:`Bearer ${EMAIL_KEY}`,'Content-Type':'application/json'},body:JSON.stringify({from:FROM_EMAIL,to:[email],subject:'Your AACTIVATEDRX representative portal is active',html:`<p>Your onboarding has received final approval and your AACTIVATEDRX representative portal is active.</p><p><a href="${SITE}${path}">Open your representative portal</a></p>`})});await db.from('aactivated_onboarding_notifications').update({status:response.ok?'sent':'failed',sent_at:response.ok?new Date().toISOString():null}).eq('id',row.id);}catch{await db.from('aactivated_onboarding_notifications').update({status:'failed'}).eq('id',row.id);}}
