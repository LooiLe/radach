package com.radach.maps.repository;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import com.radach.maps.model.ARAnnotation;

public interface ARAnnotationRepository extends JpaRepository<ARAnnotation, Long> {

    List<ARAnnotation> findByStatus(ARAnnotation.Status status);

    /**
     * Find all approved annotations within a given radius (meters) of a GPS coordinate.
     * Uses the Haversine formula for spherical distance.
     */
    @Query("SELECT a FROM ARAnnotation a WHERE a.status = 'APPROVED' " +
           "AND (6371000 * acos(LEAST(1.0, cos(radians(:lat)) * cos(radians(a.latitude)) * " +
           "cos(radians(a.longitude) - radians(:lng)) + sin(radians(:lat)) * " +
           "sin(radians(a.latitude))))) <= :radiusM " +
           "ORDER BY a.createdAt DESC")
    List<ARAnnotation> findApprovedWithinRadius(
            @Param("lat") double lat,
            @Param("lng") double lng,
            @Param("radiusM") double radiusM);
}
