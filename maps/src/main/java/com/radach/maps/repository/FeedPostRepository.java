package com.radach.maps.repository;

import com.radach.maps.model.FeedPost;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Collection;
import java.util.List;

@Repository
public interface FeedPostRepository extends JpaRepository<FeedPost, Long> {
    List<FeedPost> findByAuthorIdInOrderByCreatedAtDesc(Collection<Long> authorIds);
    List<FeedPost> findByAuthorIdOrderByCreatedAtDesc(Long authorId);
    List<FeedPost> findAllByOrderByCreatedAtDesc();
}
