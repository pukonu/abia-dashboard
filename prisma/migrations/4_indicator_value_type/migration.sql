create type "indicator_value_type" as enum ('score', 'percentage', 'number');

alter table "indicators"
  add column "value_type" "indicator_value_type" not null default 'number',
  add column "score_options" jsonb;

update "indicators"
set "value_type" = case
  when "description" ~ '(^|\n)\s*[A-E]\.\s+' then 'score'::indicator_value_type
  when "unit" = '%' then 'percentage'::indicator_value_type
  else 'number'::indicator_value_type
end;
