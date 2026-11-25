-- Upcoming bookings created from the booking form whose Bilene dates disagree
-- with what the form said. Read-only — run in the SQL editor (PROD or TEST).
--
-- Why: the form's "nights in Bilene" used to default to 7 and the booking's
-- check-out was entry + nights. #029 was created 14/01 → 21/01 while its
-- airport transfer was on 06/02. Fixed on 2026-11-25 (utils/bileneStay.ts),
-- but this kind of mismatch can come back from any guest who types one thing
-- in one field and another elsewhere — so this stays as a periodic check.
--
-- country_exit later than check_out is NOT a problem (guests travelling on in
-- Mozambique); it is shown for context only.

with f as (
  select b.booking_number, b.check_in, b.check_out,
         nullif(fs.payload->>'nights_bilene', '')::int          as nights_typed,
         nullif(fs.payload->>'country_entry_date', '')::date     as country_entry,
         nullif(fs.payload->>'country_exit_date', '')::date      as country_exit,
         nullif(fs.payload->>'transfer_to_bilene_date', '')::date  as transfer_in,
         nullif(fs.payload->>'transfer_to_airport_date', '')::date as transfer_out,
         fs.payload ? 'target_booking_id'                         as from_update_link
  from form_submissions fs
  join bookings b on b.id = fs.created_booking_id
  where b.check_out >= current_date
)
select *,
       (check_out - check_in)                                         as nights_booked,
       transfer_out is not null and transfer_out <> check_out         as checkout_vs_transfer,
       transfer_in  is not null and transfer_in  <> check_in          as checkin_vs_transfer,
       nights_typed is not null and nights_typed <> (check_out - check_in) as nights_vs_booked,
       country_exit is not null and country_exit < check_out         as exit_before_checkout
from f
where (transfer_out is not null and transfer_out <> check_out)
   or (transfer_in  is not null and transfer_in  <> check_in)
   or (nights_typed is not null and nights_typed <> (check_out - check_in))
   or (country_exit is not null and country_exit < check_out)
order by check_in;
