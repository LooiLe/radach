CREATE TABLE friendships (
    id SERIAL PRIMARY KEY,
    requester_id BIGINT NOT NULL,
    addressee_id BIGINT NOT NULL,
    status VARCHAR(50) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_requester FOREIGN KEY (requester_id) REFERENCES users (id),
    CONSTRAINT fk_addressee FOREIGN KEY (addressee_id) REFERENCES users (id),
    CONSTRAINT uc_friendship UNIQUE (requester_id, addressee_id)
);
