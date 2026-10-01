// Uses the existing Supabase Auth Admin API. Never writes credentials to disk.
// Inspect first: node tools/provision-pure-owner.mjs
// Provision: LILY_TEMP_PASSWORD in the process environment, then append --provision.
import { execFileSync } from 'node:child_process';
import { createClient } from '@supabase/supabase-js';
import assert from 'node:assert/strict';
const email = 'lilypurepeptides@gmail.com';
const project = 'ubfruugzofftwlomkqcl';
const keys = JSON.parse(execFileSync('supabase', ['projects','api-keys','--project-ref',project,'--output','json'], {encoding:'utf8',stdio:['ignore','pipe','pipe'],windowsHide:true}));
const key = keys.find(k => k.name === 'service_role')?.api_key;
assert.ok(key,'Existing production service credential unavailable');
const client = createClient(`https://${project}.supabase.co`,key,{auth:{persistSession:false,autoRefreshToken:false}});
async function result(query) {const {data,error}=await query;if(error)throw new Error(error.message);return data;}
const profiles = await result(client.from('profiles').select('*').ilike('email',email));
assert.ok(profiles.length<=1,'Duplicate email profiles require review');
const profile=profiles[0];
// Remediate only the just-created identity if the legacy signup trigger defaulted
// it to unscoped admin. Never repurpose a pre-existing privileged identity.
if(process.argv.includes('--scope-new-account')){
  assert.ok(profile&&profile.role==='admin'&&!profile.brand_id&&!profile.store_slug&&!profile.admin_scope);
  const {data,error}=await client.auth.admin.getUserById(profile.id);if(error)throw new Error(error.message);
  assert.equal(data.user.email,email);assert.equal(data.user.user_metadata.full_name,'Lily Graham');
  assert.equal(data.user.user_metadata.force_password_reset,true);assert.ok(!data.user.last_sign_in_at);
  assert.ok(Date.now()-Date.parse(data.user.created_at)<30*60*1000,'Account is not newly provisioned');
  const scope={role:'partner_admin_limited',brand_id:'purepeptidelabs',store_slug:'purepeptidelabs',admin_scope:'PUREPEPTIDELABS',partner_access_level:'limited',access_scope:'brand_only',global_admin:false,super_admin:false,can_view_all_brands:false,can_view_all_reps:false,can_view_all_orders:false,can_view_all_customers:false,can_edit_global_catalog:false,can_edit_global_settings:false,can_view_platform_financials:false,can_view_other_partner_financials:false};
  await result(client.from('profiles').update(scope).eq('id',profile.id).eq('email',email).eq('role','admin').is('brand_id',null));
  Object.assign(profile,scope);console.log('Restricted the newly provisioned profile to Pure Peptide Labs.');
}
if(profile){
  assert.ok(['patient','rep','partner_admin_limited'].includes(profile.role),'Existing privileged identity cannot be reassigned');
  for(const [field,allowed] of [['brand_id','purepeptidelabs'],['store_slug','purepeptidelabs'],['admin_scope','PUREPEPTIDELABS']])assert.ok(!profile[field]||profile[field]===allowed,'Existing profile belongs to another store');
  for(const flag of ['global_admin','super_admin','can_view_all_brands','can_view_all_orders'])assert.ok(!profile[flag],'Existing global capabilities require review');
  const assignments=await result(client.from('partner_admin_brand_assignments').select('brand_id').eq('profile_id',profile.id));
  assert.ok(assignments.every(a=>a.brand_id==='purepeptidelabs'),'Existing other-brand assignment');
  const reps=await result(client.from('reps').select('rep_slug').eq('profile_id',profile.id));
  assert.ok(reps.every(r=>r.rep_slug==='LILY60'),'Existing other-owner assignment');
}
let user;
for(let page=1;page<=100;page++){
  const {data,error}=await client.auth.admin.listUsers({page,perPage:1000});if(error)throw new Error(error.message);
  user=data.users.find(u=>u.email?.toLowerCase()===email);if(user||data.users.length<1000)break;
}
if(profile&&user)assert.equal(profile.id,user.id,'Auth/profile identity mismatch');
const rep=await result(client.from('reps').select('id,rep_name,rep_slug,profile_id,commission_rate,parent_rep_id,parent_brand_id,managed_by_profile_id').eq('rep_slug','LILY60').single());
assert.equal(rep.rep_name,'Lily Graham');assert.ok(!rep.profile_id||rep.profile_id===user?.id,'Owner already linked to another login');
assert.equal(rep.parent_rep_id,null);assert.equal(rep.parent_brand_id,null);
console.log(JSON.stringify({email,authExists:Boolean(user),profileExists:Boolean(profile),role:profile?.role??null,owner:rep.rep_name,commission:rep.commission_rate,directPlatform:true}));
if(process.argv.includes('--provision')){
  assert.ok(process.env.LILY_TEMP_PASSWORD,'LILY_TEMP_PASSWORD must be provided in the process environment');
  const metadata={...(user?.user_metadata??{}),full_name:'Lily Graham',role:profile?.role??'patient',force_password_reset:true};
  const response=user
    ? await client.auth.admin.updateUserById(user.id,{password:process.env.LILY_TEMP_PASSWORD,user_metadata:metadata})
    : await client.auth.admin.createUser({email,password:process.env.LILY_TEMP_PASSWORD,email_confirm:true,user_metadata:metadata});
  if(response.error)throw new Error(response.error.message);
  console.log(JSON.stringify({authProvisioned:true,email,temporaryPasswordSet:true,passwordPrinted:false}));
}
if(process.argv.includes('--verify')){
  const anon=keys.find(k=>k.name==='anon')?.api_key;assert.ok(anon);
  const session=createClient(`https://${project}.supabase.co`,anon,{auth:{persistSession:false,autoRefreshToken:false}});
  const login=await session.auth.signInWithPassword({email,password:process.env.LILY_TEMP_PASSWORD});
  if(login.error)throw new Error(login.error.message);
  try{
    const own=await result(session.from('profiles').select('id,role,brand_id,admin_scope,global_admin,super_admin').eq('id',login.data.user.id).single());
    assert.equal(own.role,'partner_admin_limited');assert.equal(own.brand_id,'purepeptidelabs');assert.equal(own.global_admin,false);assert.equal(own.super_admin,false);
    assert.equal(await result(session.rpc('is_platform_admin')),false);
    assert.equal(await result(session.rpc('current_partner_brand_id')),'purepeptidelabs');
    assert.equal(await result(session.rpc('partner_has_capability',{p_capability:'orders_customers'})),true);
    for(const brand of ['glow','aactivated','radiance','rockphorm'])assert.equal(await result(session.rpc('is_current_partner_brand',{p_brand_id:brand,p_store_slug:brand,p_scope_code:brand.toUpperCase()})),false);
    const orders=await result(session.from('patient_submissions').select('id,brand_id,store_slug,checkout_scope_code,rep_id'));
    assert.ok(orders.every(o=>o.brand_id==='purepeptidelabs'||o.store_slug==='purepeptidelabs'||o.checkout_scope_code==='PUREPEPTIDELABS'||o.rep_id===rep.id),'Cross-store order access detected');
    const visibleReps=await result(session.from('reps').select('id,brand_id,rep_slug'));
    assert.ok(visibleReps.every(r=>r.brand_id==='purepeptidelabs'||r.id===rep.id),'Cross-store rep access detected');
    const ledger=await result(session.from('commission_ledger').select('id,rep_id,submission_id'));
    assert.ok(ledger.every(r=>r.rep_id===rep.id||orders.some(o=>o.id===r.submission_id)),'Cross-store ledger access detected');
    assert.equal(Number(rep.commission_rate),.65);
    const scope=await result(client.from('checkout_scopes').select('default_commission_rate,parent_account_id').eq('scope_code','PUREPEPTIDELABS').single());
    assert.equal(Number(scope.default_commission_rate),.65);assert.equal(scope.parent_account_id,null);
    const assignments=await result(client.from('partner_admin_brand_assignments').select('brand_id,access_level').eq('profile_id',own.id));
    assert.deepEqual(assignments,[{brand_id:'purepeptidelabs',access_level:'limited'}]);
    console.log(JSON.stringify({loginVerified:true,storeScopedAdmin:true,platformAdmin:false,crossBrandAccess:false,visibleOrders:orders.length,visibleReps:visibleReps.length,visibleLedgerEntries:ledger.length,commissionRate:.65,directPlatform:true}));
  }finally{await session.auth.signOut({scope:'local'});}
}
