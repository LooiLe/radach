package com.radach.maps.repository;

import com.radach.maps.model.Journey;
import com.radach.maps.model.TrailPathStatus;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface JourneyRepository extends JpaRepository<Journey, Long> {

    List<Journey> findBySpotIdAndStatusAndIsPrivateFalseOrderByUpvoteCountDescCreatedAtDesc(Long spotId, TrailPathStatus status);

    List<Journey> findBySpotIdAndStatusOrderByUpvoteCountDescCreatedAtDesc(Long spotId, TrailPathStatus status);

    List<Journey> findBySubmittedByOrderByCreatedAtDesc(Long submittedBy);

    List<Journey> findByStatusOrderByCreatedAtAsc(TrailPathStatus status);

    List<Journey> findByStatusAndIsPrivateFalseOrderByCreatedAtDesc(TrailPathStatus status);
}
