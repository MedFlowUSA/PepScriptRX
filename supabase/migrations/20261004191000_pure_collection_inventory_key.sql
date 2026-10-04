-- public_inventory_status unifies UUID and text catalogs using a text product_id.
do $$ declare definition text:=pg_get_functiondef('public.quote_pure_cart(jsonb,text,boolean)'::regprocedure);
begin
  if position('and product_id=product.id' in definition)>0 then
    execute replace(definition,'and product_id=product.id','and product_id::text=product.id::text');
  elsif position('and product_id::text=product.id::text' in definition)=0 then
    raise exception 'Pure quote inventory lookup changed';
  end if;
end $$;
