create table spots (
    id serial primary key,
    name varchar(255) not null,
    type varchar(100) not null,
    address varchar(500) not null,
    latitude double precision not null,
    longitude double precision not null,
    tags text not null default '[]',
    status varchar(50) not null,
    created_at timestamp with time zone not null default now()
);

create index idx_spots_latitude_longitude on spots (latitude, longitude);
create index idx_spots_status on spots (status);
