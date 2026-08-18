-- Company-approved production agreement, published from the controlled draft
-- after resolving every entity, venue, notice, liability, and draft marker.
do $$
declare
  v_content text;
  v_signer_id uuid;
  v_agreement_id uuid;
begin
  select content into v_content
  from public.aactivated_agreements
  where brand_id = 'aactivated'
    and version = 'legal-review-draft-2026-08-07'
  limit 1;

  if v_content is null then
    raise exception 'Controlled AACTIVATED RX agreement draft was not found';
  end if;

  v_content := replace(v_content,
    'AACTIVATEDRX REPRESENTATIVE AGREEMENT — LEGAL REVIEW REQUIRED',
    'AACTIVATED RX REPRESENTATIVE AGREEMENT');
  v_content := replace(v_content,
    'Version: legal-review-draft-2026-08-07',
    'Version: 2026-08-07.1');
  v_content := replace(v_content,
    'This Representative Agreement ("Agreement") is entered into between PepScriptRX [INSERT FULL LEGAL ENTITY NAME AND ENTITY TYPE], including its AACTIVATEDRX subsidiary, division, or program (collectively, the "Company"), and the individual or entity accepting this Agreement ("Representative"). AACTIVATEDRX is operated under PepScriptRX. Counsel must confirm the exact legal relationship and replace this description if AACTIVATEDRX is a separately formed subsidiary.',
    'This Representative Agreement ("Agreement") is entered into between Vitality Enterprises LLC, doing business as PepScriptRX, together with AACTIVATED RX, an affiliate program (collectively, the "Company"), and the individual or entity accepting this Agreement ("Representative").');
  v_content := replace(v_content,
    '13. INDEMNIFICATION AND LIMITATION OF LIABILITY — COUNSEL REVIEW REQUIRED' || E'\n\n' ||
    'To the maximum extent permitted by applicable law, Representative will be responsible for losses arising from Representative''s unlawful conduct, unauthorized claims, misuse of information, infringement, fraud, or material breach. Counsel must review and insert any approved indemnification procedures, exclusions, liability cap, and state-specific limitations before publication. No bracketed or incomplete liability language may be published.',
    '13. INDEMNIFICATION AND LIMITATION OF LIABILITY' || E'\n\n' ||
    'To the maximum extent permitted by applicable law, Representative will indemnify, defend, and hold harmless the Company and its members, managers, officers, employees, and affiliates from third-party claims, losses, liabilities, penalties, and reasonable costs arising from Representative''s unlawful conduct, unauthorized claims, misuse of information, infringement, fraud, or material breach of this Agreement, except to the extent caused by the Company''s gross negligence or willful misconduct.' || E'\n\n' ||
    'To the maximum extent permitted by applicable law, neither party will be liable to the other for indirect, incidental, special, exemplary, punitive, or consequential damages. The Company''s aggregate liability arising from this Agreement will not exceed commissions paid or payable to Representative during the six months preceding the event giving rise to the claim. These limitations do not apply where liability cannot lawfully be limited.');
  v_content := replace(v_content,
    '14. DISPUTES, GOVERNING LAW, AND VENUE — COUNSEL REVIEW REQUIRED' || E'\n\n' ||
    'This Agreement is governed by the laws of [INSERT STATE], without regard to conflict-of-law rules, except where another law must apply. Any required pre-suit notice, informal-resolution period, mediation, arbitration, jury-trial waiver, class-action waiver, court venue, and small-claims provisions must be inserted and approved by counsel for [INSERT COUNTY AND STATE] before publication. No dispute waiver is created by this draft.',
    '14. DISPUTES, GOVERNING LAW, AND VENUE' || E'\n\n' ||
    'This Agreement is governed by the laws of the State of California, without regard to conflict-of-law rules, except where another law must apply. Before filing a lawsuit, a party must provide written notice describing the dispute and allow thirty days for good-faith informal resolution, unless immediate relief is reasonably necessary. Subject to applicable law, the state and federal courts located in San Bernardino County, California will have exclusive jurisdiction and venue. This Agreement does not require arbitration and does not waive any right that cannot lawfully be waived.');
  v_content := replace(v_content,
    'Legal notices to the Company must be sent to [INSERT LEGAL NOTICE EMAIL AND PHYSICAL ADDRESS].',
    'Legal notices to the Company must be sent to service@pepscriptrx.com and Vitality Enterprises LLC dba PepScriptRX, 411 W State St, Suite B, Redlands, CA 92373.');
  v_content := replace(v_content, 'END OF LEGAL-REVIEW DRAFT', 'END OF AGREEMENT');

  if v_content ~* '(LEGAL REVIEW REQUIRED|COUNSEL REVIEW REQUIRED|INSERT FULL|INSERT STATE|INSERT COUNTY|INSERT LEGAL|LEGAL-REVIEW DRAFT|No dispute waiver is created by this draft)' then
    raise exception 'Production agreement still contains unresolved draft language';
  end if;

  select id into v_signer_id
  from public.profiles
  where lower(coalesce(full_name, '')) = 'manuel rodriguez'
    and role in ('admin','owner','platform_admin','master_admin','super_admin')
  order by created_at
  limit 1;

  update public.aactivated_agreements
  set status = 'retired'
  where brand_id = 'aactivated' and status = 'approved';

  insert into public.aactivated_agreements (
    brand_id, version, effective_date, title, content, content_hash, status,
    created_by, approved_by, published_at, company_signed_by,
    company_signer_name, company_signature_text, company_signed_at
  ) values (
    'aactivated', '2026-08-07.1', date '2026-08-07',
    'AACTIVATED RX Representative Agreement', v_content,
    encode(extensions.digest(v_content, 'sha256'), 'hex'), 'approved',
    v_signer_id, v_signer_id, now(), v_signer_id,
    'Manuel Rodriguez', 'Manuel Rodriguez', now()
  )
  on conflict (brand_id, version) do update set
    effective_date = excluded.effective_date,
    title = excluded.title,
    content = excluded.content,
    content_hash = excluded.content_hash,
    status = excluded.status,
    approved_by = excluded.approved_by,
    published_at = excluded.published_at,
    company_signed_by = excluded.company_signed_by,
    company_signer_name = excluded.company_signer_name,
    company_signature_text = excluded.company_signature_text,
    company_signed_at = excluded.company_signed_at
  returning id into v_agreement_id;

  insert into public.aactivated_onboarding_audit (
    onboarding_id, actor_id, action, metadata
  ) values (
    null, v_signer_id, 'agreement_published',
    jsonb_build_object(
      'agreement_id', v_agreement_id,
      'version', '2026-08-07.1',
      'company_signer_name', 'Manuel Rodriguez',
      'company_signed', true,
      'company_entity', 'Vitality Enterprises LLC dba PepScriptRX',
      'affiliate_program', 'AACTIVATED RX'
    )
  );
end $$;
