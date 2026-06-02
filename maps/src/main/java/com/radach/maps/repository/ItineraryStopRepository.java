package com.radach.maps.repository;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;

import com.radach.maps.model.ItineraryStop;

public interface ItineraryStopRepository extends JpaRepository<ItineraryStop, Long> {

    List<ItineraryStop> findByItineraryIdOrderByStopOrderAsc(Long itineraryId);

    void deleteByItineraryId(Long itineraryId);
}
