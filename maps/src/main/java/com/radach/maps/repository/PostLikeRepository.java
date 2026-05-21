package com.radach.maps.repository;

import com.radach.maps.model.PostLike;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

@Repository
public interface PostLikeRepository extends JpaRepository<PostLike, Long> {
    Optional<PostLike> findByPostIdAndUserId(Long postId, Long userId);
    List<PostLike> findByPostId(Long postId);
    List<PostLike> findByPostIdIn(Collection<Long> postIds);
    long countByPostId(Long postId);
}
