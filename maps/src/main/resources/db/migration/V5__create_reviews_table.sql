create table if not exists reviews (
    id        bigserial primary key,
    spot_id   bigint       not null references spots(id),
    author_id bigint       not null references users(id),
    review_type varchar(10) not null check (review_type in ('EXPERT', 'USER')),
    body      text         not null,
    rating    int          not null check (rating between 1 and 5),
    status    varchar(10)  not null default 'PENDING' check (status in ('PENDING', 'APPROVED', 'REJECTED')),
    created_at timestamp   not null default current_timestamp
);

create index if not exists idx_reviews_spot_status on reviews(spot_id, status);
create index if not exists idx_reviews_spot_status_type on reviews(spot_id, status, review_type);