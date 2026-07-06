-- =====================================================================
-- Luna Promoters :: 0029 Proper-case display names
-- Names are stored title-cased ("john smith" / "JOHN SMITH" -> "John Smith")
-- via a trigger on insert/update, and existing rows are backfilled once.
-- initcap() capitalises the first letter of each word (handles spaces,
-- hyphens and apostrophes: "o'brien" -> "O'Brien", "mary-jane" -> "Mary-Jane").
-- =====================================================================

create or replace function public.tg_proper_name()
returns trigger language plpgsql set search_path = public as $$
begin
  if TG_TABLE_NAME = 'guests' then
    if NEW.first_name is not null then NEW.first_name := initcap(btrim(NEW.first_name)); end if;
    if NEW.last_name  is not null then NEW.last_name  := initcap(btrim(NEW.last_name));  end if;
  elsif TG_TABLE_NAME = 'promoters' then
    if NEW.full_name is not null then NEW.full_name := initcap(btrim(NEW.full_name)); end if;
  end if;
  return NEW;
end $$;

drop trigger if exists proper_name_guests on public.guests;
create trigger proper_name_guests
  before insert or update of first_name, last_name on public.guests
  for each row execute function public.tg_proper_name();

drop trigger if exists proper_name_promoters on public.promoters;
create trigger proper_name_promoters
  before insert or update of full_name on public.promoters
  for each row execute function public.tg_proper_name();

-- One-time backfill of existing names.
update public.guests
  set first_name = initcap(btrim(first_name)),
      last_name  = initcap(btrim(last_name))
  where first_name is not null or last_name is not null;

update public.promoters
  set full_name = initcap(btrim(full_name))
  where full_name is not null;
