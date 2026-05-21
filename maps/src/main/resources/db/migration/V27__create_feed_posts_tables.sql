ALTER TABLE users ADD COLUMN private_account BOOLEAN NOT NULL DEFAULT FALSE;

CREATE TABLE feed_posts (
    id BIGSERIAL PRIMARY KEY,
    author_id BIGINT NOT NULL,
    content TEXT,
    media_urls TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE TABLE post_likes (
    id BIGSERIAL PRIMARY KEY,
    post_id BIGINT NOT NULL,
    user_id BIGINT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_pl_post FOREIGN KEY (post_id) REFERENCES feed_posts (id) ON DELETE CASCADE
);

CREATE TABLE post_comments (
    id BIGSERIAL PRIMARY KEY,
    post_id BIGINT NOT NULL,
    author_id BIGINT NOT NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_pc_post FOREIGN KEY (post_id) REFERENCES feed_posts (id) ON DELETE CASCADE
);
