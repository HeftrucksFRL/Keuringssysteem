create index if not exists idx_machines_updated_at
on public.machines(updated_at desc);

create index if not exists idx_inspections_status_date
on public.inspections(status, inspection_date desc);

create index if not exists idx_planning_state_due_date
on public.planning_items(state, due_date);

create index if not exists idx_planning_machine_state
on public.planning_items(machine_id, state);

create index if not exists idx_rentals_status_dates
on public.rentals(status, start_date, end_date);

create index if not exists idx_todo_items_owner_completed_due
on public.todo_items(owner_id, completed, due_date, created_at desc);

create index if not exists idx_agenda_events_owner_date
on public.agenda_events(owner_id, event_date);

create index if not exists idx_mail_events_status_created_at
on public.mail_events(delivery_status, created_at desc);
