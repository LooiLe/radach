package com.radach.maps.repository;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;

import com.radach.maps.model.TrailPathUpvote;

public interface TrailPathUpvoteRepository extends JpaRepository<TrailPathUpvote, Long> {
    Optional<TrailPathUpvote> findByUserIdAndPathId(Long userId, Long pathId);
    boolean existsByUserIdAndPathId(Long userId, Long pathId);
    List<TrailPathUpvote> findByUserId(Long userId);
}
