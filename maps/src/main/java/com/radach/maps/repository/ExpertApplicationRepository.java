package com.radach.maps.repository;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;

import com.radach.maps.model.ExpertApplication;
import com.radach.maps.model.ExpertApplication.Status;

public interface ExpertApplicationRepository extends JpaRepository<ExpertApplication, Long> {

    List<ExpertApplication> findByStatus(Status status);

    List<ExpertApplication> findByUserIdOrderByCreatedAtDesc(Long userId);

    boolean existsByUserIdAndStatus(Long userId, Status status);
}
