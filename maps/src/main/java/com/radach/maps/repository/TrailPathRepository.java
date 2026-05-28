package com.radach.maps.repository;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;

import com.radach.maps.model.TrailPath;
import com.radach.maps.model.TrailPathStatus;

public interface TrailPathRepository extends JpaRepository<TrailPath, Long> {

    List<TrailPath> findBySpotIdAndStatusAndIsPrivateFalseOrderByUpvoteCountDescCreatedAtDesc(Long spotId, TrailPathStatus status);

    List<TrailPath> findBySpotIdAndStatusOrderByUpvoteCountDescCreatedAtDesc(Long spotId, TrailPathStatus status);

    List<TrailPath> findBySubmittedByOrderByCreatedAtDesc(Long submittedBy);

    List<TrailPath> findByStatusOrderByCreatedAtAsc(TrailPathStatus status);
}
