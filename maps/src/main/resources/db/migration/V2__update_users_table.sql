alter table users
add column password_hash varchar(100) not null,
add column email varchar(100) not null unique