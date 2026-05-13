create table if not exists spot_events (
    id         bigserial    primary key,
    spot_id    bigint       not null references spots(id),
    event_type varchar(10)  not null check (event_type in ('VIEW', 'SAVE')),
    created_at timestamp    not null default current_timestamp
);

create index if not exists idx_spot_events_spot on spot_events(spot_id);
create index if not exists idx_spot_events_type on spot_events(event_type);