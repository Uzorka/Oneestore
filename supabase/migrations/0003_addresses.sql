-- The address the rider actually uses.
--
-- Found by writing a real order through the schema: checkout asks "who should
-- the rider ask for?" as a required field, and there was nowhere to put the
-- answer. Nor the recipient's number, nor the delivery instructions — all
-- three are on the domain object and all three were being dropped on the way
-- to the database.

alter table addresses add column if not exists recipient_name  text not null default '';
alter table addresses add column if not exists recipient_phone text not null default '';
alter table addresses add column if not exists instructions    text not null default '';

-- The rules the app already enforces, said where they cannot be bypassed.
--
-- "An address without a landmark is never saved" has been in the README since
-- the first milestone and was enforced only in a validation function — which
-- protects the form, not the table. A Lagos rider phones and asks for the
-- landmark; an address without one is an address they cannot deliver to.

alter table addresses
  add constraint address_needs_a_landmark check (length(trim(landmark)) > 0);

alter table addresses
  add constraint address_needs_a_street check (length(trim(street)) > 0);

alter table addresses
  add constraint address_needs_someone_to_ask_for check (length(trim(recipient_name)) > 0);
