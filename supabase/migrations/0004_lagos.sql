-- Where in Lagos, rather than which pricing band.
--
-- The customer was being asked to choose a delivery zone — "Mainland central",
-- "Outer Lagos" — which is the shop's own vocabulary. Nobody knows which band
-- their house is in, and a wrong guess is an order on the wrong run at the
-- wrong price. They now choose their area and local government, and the zone
-- follows from the pair.

alter table addresses add column if not exists lga  text not null default '';
alter table addresses add column if not exists area text not null default '';

-- Every address the shop takes from here on names its place. The default
-- above exists for rows written before this migration, not for new ones.
alter table addresses
  add constraint address_names_its_place
  check (
    (length(trim(lga)) > 0 and length(trim(area)) > 0)
    or created_at < now()
  );

create index addresses_by_area on addresses (lga, area);
